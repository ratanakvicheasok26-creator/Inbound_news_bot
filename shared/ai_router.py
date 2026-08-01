"""Shared AI router with key rotation, 429 handling, and multi-provider fallback.

Usage:
    from shared.ai_router import AIRouter
    router = AIRouter()
    result = router.call("rewrite", prompt)
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# --- Retry / backoff config ---

_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 2.0
_KEY_COOLDOWN_SECONDS = 60
_DEFAULT_HTTP_TIMEOUT = float(os.environ.get("AI_HTTP_TIMEOUT_SECONDS", "30"))


def _http_timeout_seconds() -> float:
    try:
        from newsbot.config import AI_HTTP_TIMEOUT_SECONDS

        return float(AI_HTTP_TIMEOUT_SECONDS)
    except Exception:
        return _DEFAULT_HTTP_TIMEOUT


@dataclass
class _KeyState:
    """Tracks rate-limit state for a single API key."""
    key: str
    cooldown_until: float = 0.0

    def is_available(self) -> bool:
        return time.time() >= self.cooldown_until

    def mark_rate_limited(self, retry_after: float | None = None) -> None:
        wait = retry_after or _KEY_COOLDOWN_SECONDS
        self.cooldown_until = time.time() + wait
        logger.info("Key ...%s rate-limited for %.0fs", self.key[-6:], wait)


@dataclass
class _ProviderConfig:
    """Configuration for a single AI provider."""
    name: str
    env_var: str
    model: str
    base_url: str | None = None
    import_path: str = "openai"
    keys: list[_KeyState] = field(default_factory=list)
    _current_index: int = 0

    def next_key(self) -> _KeyState | None:
        """Return the next available key, or None if all are on cooldown."""
        if not self.keys:
            return None
        # Try all keys starting from current index
        for _ in range(len(self.keys)):
            key_state = self.keys[self._current_index % len(self.keys)]
            self._current_index += 1
            if key_state.is_available():
                return key_state
        return None

    @property
    def available_count(self) -> int:
        return sum(1 for k in self.keys if k.is_available())

    @property
    def all_rate_limited(self) -> bool:
        return len(self.keys) > 0 and all(not k.is_available() for k in self.keys)


class AIRouter:
    """Multi-provider AI router with key rotation and graceful degradation.

    Provider chain: Groq → OpenRouter → Gemini
    Each provider supports multiple comma-separated API keys.
    On 429, the key is marked for cooldown and the router tries the next key.
    When all keys for a provider are exhausted, moves to the next provider.
    When ALL providers are exhausted, returns None (graceful degradation).
    """

    def __init__(self) -> None:
        self._providers = self._init_providers()
        self._stats = {p.name: {"calls": 0, "successes": 0, "failures": 0} for p in self._providers}
        # Cache clients per (provider, key) so we don't spin up a fresh
        # httpx/genai connection pool on every single call — that leak is
        # what was slowly growing memory to Railway's cap over ~61min cycles.
        self._openai_clients: dict[tuple[str, str], object] = {}
        self._genai_clients: dict[str, object] = {}

    def _init_providers(self) -> list[_ProviderConfig]:
        """Parse env vars and create provider configs with key rotation."""
        providers = []

        # Tier 1: Groq
        groq_keys = self._parse_keys(os.environ.get("GROQ_API_KEY", ""))
        if groq_keys:
            providers.append(_ProviderConfig(
                name="groq",
                env_var="GROQ_API_KEY",
                model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
                base_url="https://api.groq.com/openai/v1",
                keys=[_KeyState(key=k) for k in groq_keys],
            ))

        # Tier 2: OpenRouter
        # Future: paid DeepSeek as additional tier — not wired.
        openrouter_keys = self._parse_keys(os.environ.get("OPENROUTER_API_KEY", ""))
        if openrouter_keys:
            providers.append(_ProviderConfig(
                name="openrouter",
                env_var="OPENROUTER_API_KEY",
                model=os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
                base_url="https://openrouter.ai/api/v1",
                keys=[_KeyState(key=k) for k in openrouter_keys],
            ))

        # Tier 3: Gemini
        gemini_keys = self._parse_keys(os.environ.get("GOOGLE_GEMINI_API_KEY", ""))
        if gemini_keys:
            providers.append(_ProviderConfig(
                name="gemini",
                env_var="GOOGLE_GEMINI_API_KEY",
                model=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
                import_path="google.genai",
                keys=[_KeyState(key=k) for k in gemini_keys],
            ))

        if not providers:
            logger.warning("No AI provider keys configured — all AI calls will return None")

        return providers

    @staticmethod
    def _parse_keys(raw: str) -> list[str]:
        """Parse comma-separated API keys, stripping whitespace."""
        return [k.strip() for k in raw.split(",") if k.strip()]

    # ---- Public API ----

    def call(self, prompt: str, *, max_tokens: int = 200) -> tuple[str | None, str]:
        """Call AI with the full fallback chain.

        Args:
            prompt: The user prompt to send.
            max_tokens: Maximum response tokens.

        Returns:
            (response_text, provider_name) — response_text is None if all providers failed.
        """
        for provider in self._providers:
            if not provider.keys:
                continue
            result = self._call_provider(provider, prompt, max_tokens)
            if result[0] is not None:
                return result
            logger.info("All keys exhausted for %s, trying next provider", provider.name)

        logger.warning("All AI providers exhausted — returning None (graceful degradation)")
        return (None, "none")

    def call_with_fallback(self, prompt: str, *, max_tokens: int = 200, fallback_text: str = "") -> tuple[str, str]:
        """Like call() but never returns None — falls back to fallback_text."""
        text, provider = self.call(prompt, max_tokens=max_tokens)
        if text is None:
            return (fallback_text, "fallback")
        return (text, provider)

    def get_status(self) -> dict:
        """Return current status of all providers (for health endpoint)."""
        status = {}
        for provider in self._providers:
            status[provider.name] = {
                "configured": bool(provider.keys),
                "keys_total": len(provider.keys),
                "keys_available": provider.available_count,
                "all_rate_limited": provider.all_rate_limited,
                "model": provider.model,
                "stats": self._stats[provider.name].copy(),
            }
        return status

    # ---- Provider-specific calling ----

    def _call_provider(self, provider: _ProviderConfig, prompt: str, max_tokens: int) -> tuple[str | None, str]:
        """Try all keys for a single provider."""
        self._stats[provider.name]["calls"] += 1

        if provider.name == "gemini":
            return self._call_gemini(provider, prompt, max_tokens)
        else:
            return self._call_openai_compatible(provider, prompt, max_tokens)

    def _call_openai_compatible(self, provider: _ProviderConfig, prompt: str, max_tokens: int) -> tuple[str | None, str]:
        """Call an OpenAI-compatible API (Groq, OpenRouter) with key rotation."""
        for attempt in range(1, _MAX_RETRIES + 1):
            key_state = provider.next_key()
            if key_state is None:
                break

            try:
                cache_key = (provider.name, key_state.key)
                client = self._openai_clients.get(cache_key)
                if client is None:
                    from openai import OpenAI
                    client = OpenAI(
                        api_key=key_state.key,
                        base_url=provider.base_url,
                        timeout=_http_timeout_seconds(),
                    )
                    self._openai_clients[cache_key] = client

                response = client.chat.completions.create(
                    model=provider.model,
                    max_tokens=max_tokens,
                    messages=[{"role": "user", "content": prompt}],
                )
                content = response.choices[0].message.content
                if content and content.strip():
                    self._stats[provider.name]["successes"] += 1
                    return (content.strip(), provider.name)
                logger.warning("%s returned empty content on key ...%s", provider.name, key_state.key[-6:])

            except Exception as exc:
                retry_after = self._extract_retry_after(exc)
                if self._is_rate_limit(exc) or retry_after:
                    key_state.mark_rate_limited(retry_after)
                    logger.info("%s key ...%s rate-limited (attempt %d/%d)",
                                provider.name, key_state.key[-6:], attempt, _MAX_RETRIES)
                elif self._is_permanent_error(exc):
                    logger.warning("%s permanent error on key ...%s, skipping retries: %s",
                                    provider.name, key_state.key[-6:], exc)
                    break
                else:
                    logger.warning("%s error on key ...%s: %s", provider.name, key_state.key[-6:], exc)

            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                time.sleep(delay)

        self._stats[provider.name]["failures"] += 1
        return (None, provider.name)

    def _call_gemini(self, provider: _ProviderConfig, prompt: str, max_tokens: int) -> tuple[str | None, str]:
        """Call Google Gemini with key rotation."""
        for attempt in range(1, _MAX_RETRIES + 1):
            key_state = provider.next_key()
            if key_state is None:
                break

            try:
                from google import genai
                from google.genai import types

                client = self._genai_clients.get(key_state.key)
                if client is None:
                    # google-genai timeout is milliseconds
                    timeout_ms = int(_http_timeout_seconds() * 1000)
                    client = genai.Client(
                        api_key=key_state.key,
                        http_options=types.HttpOptions(timeout=timeout_ms),
                    )
                    self._genai_clients[key_state.key] = client

                response = client.models.generate_content(
                    model=provider.model,
                    contents=prompt,
                )
                content = response.text
                if content and content.strip():
                    self._stats[provider.name]["successes"] += 1
                    return (content.strip(), provider.name)
                logger.warning("%s returned empty content on key ...%s", provider.name, key_state.key[-6:])

            except Exception as exc:
                retry_after = self._extract_retry_after(exc)
                if self._is_rate_limit(exc) or retry_after:
                    key_state.mark_rate_limited(retry_after)
                    logger.info("%s key ...%s rate-limited (attempt %d/%d)",
                                provider.name, key_state.key[-6:], attempt, _MAX_RETRIES)
                elif self._is_permanent_error(exc):
                    logger.warning("%s permanent error on key ...%s, skipping retries: %s",
                                    provider.name, key_state.key[-6:], exc)
                    break
                else:
                    logger.warning("%s error on key ...%s: %s", provider.name, key_state.key[-6:], exc)

            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                time.sleep(delay)

        self._stats[provider.name]["failures"] += 1
        return (None, provider.name)

    # ---- Helpers ----

    @staticmethod
    def _is_rate_limit(exc: Exception) -> bool:
        """Check if an exception is a 429 rate limit."""
        msg = str(exc).lower()
        return "429" in msg or "rate" in msg or "too many" in msg or "quota" in msg

    @staticmethod
    def _is_permanent_error(exc: Exception) -> bool:
        """Check if an exception is a permanent, non-retryable error.

        404 (model/route doesn't exist) and 400 (bad request) won't resolve
        by retrying the same key/model — e.g. OpenRouter returning 404 when
        a ``:free`` model's shared pool is saturated and suggesting the
        paid slug instead. Retrying these 3x just burns time and quota.
        """
        msg = str(exc).lower()
        return "404" in msg or "not found" in msg or "400" in msg or "bad request" in msg

    @staticmethod
    def _extract_retry_after(exc: Exception) -> float | None:
        """Try to extract Retry-After from exception details."""
        # OpenAI-style exceptions may have response.headers
        for attr in ("response", "resp"):
            resp = getattr(exc, attr, None)
            if resp is not None:
                headers = getattr(resp, "headers", None)
                if headers:
                    retry_after = headers.get("retry-after") or headers.get("Retry-After")
                    if retry_after:
                        try:
                            return float(retry_after)
                        except (ValueError, TypeError):
                            pass
        return None


# ---- Module-level singleton ----

_router: AIRouter | None = None


def get_router() -> AIRouter:
    """Get or create the singleton AI router."""
    global _router
    if _router is None:
        _router = AIRouter()
    return _router
