"""AI-powered story rewriting via Groq API with structured JSON output and template rendering."""

from __future__ import annotations

import html
import json
import logging
import re
import time
from typing import Any

import httpx

from newsbot.config import (
    DIGEST_MIN_SOURCES,
    GROQ_MAX_TOKENS,
    GROQ_MODEL,
    LINK_CAP_NORMAL,
    LINK_CAP_URGENT,
    NEWS_CATEGORIES_SET,
    URGENCY_LEVELS_SET,
)
from newsbot.feeds import Entry

__all__ = [
    "render_template",
    "trim_for_caption",
    "collect_links",
    "pick_image_url",
    "rewrite_with_ai",
]

logger = logging.getLogger(__name__)

_MAX_TELEGRAM_LENGTH: int = 4096
_CAPTION_MAX: int = 1024
_MAX_RETRIES: int = 3
_RETRY_BASE_DELAY: float = 1.0

_REQUIRED_JSON_KEYS = ("urgency", "headline", "summary", "category")

_OG_IMAGE_RE = re.compile(
    r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)


class ContentRejected(Exception):
    """Raised when the AI flags a cluster as spam/advertising/non-news content."""


_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|li|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub("", text)
    text = re.sub(r"<[^>]*$", "", text)
    text = html.unescape(html.unescape(text))
    return re.sub(r"[ \t]+", " ", text).strip()


def _html_escape(text: str) -> str:
    return html.escape(text, quote=False)


def _parse_ai_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    match = re.search(r"\{.*?\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError("Could not parse AI output as JSON")


def _validate_ai_data(data: dict) -> tuple[bool, str | None]:
    for key in _REQUIRED_JSON_KEYS:
        if key not in data:
            return False, f"Missing required key: '{key}'"
        if not isinstance(data[key], str) or not data[key].strip():
            return False, f"Key '{key}' must be a non-empty string"

    if data["urgency"] not in URGENCY_LEVELS_SET:
        return False, f"Invalid urgency level: '{data['urgency']}'"

    if data["category"] not in NEWS_CATEGORIES_SET:
        return False, f"Invalid category: '{data['category']}'"

    for key in ("key_points", "tags"):
        if key in data and not isinstance(data[key], list):
            return False, f"Key '{key}' must be a list"

    return True, None


def _sanitize_ai_data(data: dict) -> dict:
    _STRING_KEYS = ("headline", "summary", "tldr")
    _LIST_KEYS = ("key_points", "tags")
    for key in _STRING_KEYS:
        if key in data and isinstance(data[key], str):
            data[key] = _strip_html(data[key])
    for key in _LIST_KEYS:
        if key in data and isinstance(data[key], list):
            data[key] = [_strip_html(item) for item in data[key] if isinstance(item, str)]
    return data


def _bullet_list(items: list[str], limit: int = 4) -> str:
    return "\n".join(f"▸ {_html_escape(item)}" for item in items[:limit])


_CATEGORY_LABELS: dict[str, str] = {
    "startups": "Startups",
    "ai": "AI & ML",
    "cybersecurity": "Cybersecurity",
    "defi": "DeFi & Crypto",
    "big_tech": "Big Tech",
    "hardware": "Hardware & Devices",
    "science": "Science & Research",
    "regulation": "Regulation & Policy",
    "cloud": "Cloud & DevOps",
    "opensource": "Open Source",
    "gaming": "Gaming",
    "climate": "Climate Tech",
    "telecom": "Telecom & Space",
    "mobile": "Mobile & Apps",
    "regional": "SE Asia Tech",
}


_URGENCY_BADGES: dict[str, str] = {
    "breaking": "🔴 CRITICAL",
    "alert": "🟡 ALERT",
    "analysis": "🔵 Analysis",
    "market": "💰 Market",
    "explainer": "📖 Explainer",
}


def _render_template(data: dict) -> str:
    """Render AI-structured data into a formatted Telegram HTML message."""
    headline = _html_escape(str(data.get("headline", "Untitled")))
    summary = _html_escape(str(data.get("summary", "")))
    key_points = data.get("key_points", [])
    tldr = _html_escape(str(data.get("tldr", "")))
    urgency = data.get("urgency", "analysis")

    badge = _URGENCY_BADGES.get(urgency, "")
    if badge:
        sections: list[str] = [f"<b>{badge} — Inbound Reports</b>", ""]
    else:
        sections = []

    sections.append(f"<b>{headline}</b>")
    sections.append("")
    sections.append(summary)

    if key_points:
        sections.append("")
        sections.append(_bullet_list(key_points))

    if tldr and urgency == "explainer":
        sections.append("")
        sections.append(f"<b>TL;DR:</b> {tldr}")

    text = "\n".join(sections)
    if len(text) > _MAX_TELEGRAM_LENGTH:
        text = text[: _MAX_TELEGRAM_LENGTH - 1].rsplit("\n", 1)[0] + "\n..."

    return text


render_template = _render_template


_COMPACT_MAX_SENTENCES = 3


def _build_compact_prompt(cluster: list[Entry]) -> str:
    headlines = "\n".join(
        f"- [{e.source_name}] {e.title}: {_strip_html(e.summary)[:200]}"
        for e in cluster[:5]
    )
    return f"""You are a tech news bot writing a compact 2-3 sentence summary.

Summarise the following tech news story in at most {_COMPACT_MAX_SENTENCES} sentences.
Focus on: what happened, at a high level — who, what, why it matters.
- Plain text only, no markdown, no HTML, no bold, no headlines, no bullet points.
- Do not simply repeat article titles.
- Report facts only — no opinions, no speculation.

Stories covering the same event:
{headlines}"""


def rewrite_compact(cluster: list[Entry]) -> str:
    prompt = _build_compact_prompt(cluster)
    raw_output, _provider = _call_ai_with_fallback(prompt)

    if raw_output is None:
        primary = cluster[0]
        summary = _strip_html((primary.summary or "No summary available.")[:200])
        return summary

    output = raw_output.strip()
    sentences = output.split(". ")
    if len(sentences) > _COMPACT_MAX_SENTENCES:
        output = ". ".join(sentences[:_COMPACT_MAX_SENTENCES]) + "."
    return output


def trim_for_caption(text: str, limit: int = _CAPTION_MAX) -> str:
    if len(text) <= limit:
        return text
    truncated = text[: limit - 1].rsplit("\n", 1)[0]
    if len(truncated) < limit // 2:
        truncated = text[: limit - 1]
    return truncated.rstrip() + "..."


def collect_links(cluster: list[Entry], urgent: bool = False) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = []
    seen: set[str] = set()
    for entry in cluster:
        if entry.link not in seen:
            seen.add(entry.link)
            links.append((entry.link, entry.source_name))
    cap = LINK_CAP_URGENT if urgent else LINK_CAP_NORMAL
    return links[:cap]


def _fetch_og_image(url: str) -> str | None:
    """Fallback: fetch og:image from the article page when RSS has no image."""
    try:
        resp = httpx.get(
            url,
            timeout=3,
            follow_redirects=True,
            headers={"User-Agent": "InboundNewsBot/1.0"},
        )
        resp.raise_for_status()
        match = _OG_IMAGE_RE.search(resp.text)
        return match.group(1) if match else None
    except Exception:
        return None


def pick_image_url(cluster: list[Entry]) -> str | None:
    for entry in cluster:
        if entry.image_url:
            return entry.image_url
    if cluster:
        return _fetch_og_image(cluster[0].link)
    return None


def _build_prompt(cluster: list[Entry], source_note: str) -> str:
    headlines = "\n".join(
        f"- [{e.source_name}] {e.title}: {_strip_html(e.summary)[:200]}"
        for e in cluster[:5]
    )
    return f"""You are a tech news bot writing concise posts for a Telegram channel.

FIRST, check: is this legitimate tech/business/security/science news, or is it spam,
an advertisement, a listing, or unrelated non-news content?

If it is NOT legitimate news, respond with ONLY this JSON:
{{"reject": true, "reason": "brief reason"}}

Otherwise, return a JSON object with these fields:

{{
  "urgency": "breaking|alert|analysis|market|explainer",
  "category": "startups|ai|cybersecurity|defi|big_tech|hardware|science|regulation|cloud|opensource|gaming|climate|telecom|mobile|regional",
  "headline": "clear, concise headline",
  "summary": "1-2 sentence summary focused on what happened and why it matters",
  "key_points": ["point 1", "point 2", "point 3"],
  "tldr": "one-sentence TL;DR (only for explainer urgency)",
  "tags": ["Topic1", "Topic2"]
}}

Urgency classification:
- "breaking": active exploit, major outage, critical vulnerability being exploited NOW
- "alert": vulnerability disclosed, breach, action required, deadline
- "analysis": regulation, governance, policy, research report, trend
- "market": price action, trading volume, ETF flows, token launches, funding rounds
- "explainer": education, how something works, deep dive, tutorial

Rules:
- Report facts only — no opinions, no speculation, no buy/sell advice
- Never closely mirror any single article's wording
- If sources disagree, note it in context
- No HTML tags in any field — plain text only
- Return ONLY valid JSON, no preamble, no markdown code fences
{source_note}

Stories covering the same event:
{headlines}"""


def _call_groq_with_retry(prompt: str) -> str | None:
    from newsbot.config import create_groq_client

    client = create_groq_client()
    raw_output = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                max_tokens=GROQ_MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content
            if content is None:
                raise ValueError("Groq API returned empty content")
            raw_output = content.strip()
            break
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "Groq API attempt %d/%d failed (%s), retrying in %.1fs",
                    attempt, _MAX_RETRIES, exc, delay,
                )
                time.sleep(delay)
            else:
                logger.warning("Groq API failed after %d attempts: %s", _MAX_RETRIES, exc)
    return raw_output


def _call_gemini_with_retry(prompt: str) -> str | None:
    """Fallback path when Groq is rate-limited/unavailable. Returns None if
    Gemini isn't configured (no GOOGLE_GEMINI_API_KEY) or also fails."""
    from newsbot.config import GEMINI_MODEL, create_gemini_client

    client = create_gemini_client()
    if client is None:
        return None

    raw_output = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            content = response.text
            if not content or not content.strip():
                raise ValueError("Gemini API returned empty content")
            raw_output = content.strip()
            break
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "Gemini API attempt %d/%d failed (%s), retrying in %.1fs",
                    attempt, _MAX_RETRIES, exc, delay,
                )
                time.sleep(delay)
            else:
                logger.warning("Gemini API failed after %d attempts: %s", _MAX_RETRIES, exc)
    return raw_output


def _call_openrouter_with_retry(prompt: str) -> str | None:
    """Last-resort fallback when both Groq and Gemini fail/unavailable.
    Uses OpenRouter's current free-tier model (see OPENROUTER_MODEL). Returns None if OPENROUTER_API_KEY
    isn't set or the call also fails."""
    from newsbot.config import OPENROUTER_MODEL, create_openrouter_client

    client = create_openrouter_client()
    if client is None:
        return None

    raw_output = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=OPENROUTER_MODEL,
                max_tokens=GROQ_MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content
            if not content or not content.strip():
                raise ValueError("OpenRouter API returned empty content")
            raw_output = content.strip()
            break
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    "OpenRouter API attempt %d/%d failed (%s), retrying in %.1fs",
                    attempt, _MAX_RETRIES, exc, delay,
                )
                time.sleep(delay)
            else:
                logger.warning("OpenRouter API failed after %d attempts: %s", _MAX_RETRIES, exc)
    return raw_output


def _call_ai_with_fallback(prompt: str) -> tuple[str | None, str]:
    """Try Groq first, then Gemini, then OpenRouter (free tier).
    Returns (raw_output, provider_used)."""
    raw_output = _call_groq_with_retry(prompt)
    if raw_output is not None:
        return raw_output, "groq"

    logger.warning("Groq unavailable, falling back to Gemini")
    raw_output = _call_gemini_with_retry(prompt)
    if raw_output is not None:
        return raw_output, "gemini"

    logger.warning("Gemini unavailable, falling back to OpenRouter (free tier)")
    raw_output = _call_openrouter_with_retry(prompt)
    if raw_output is not None:
        return raw_output, "openrouter"

    return None, "none"


def _fallback_data(cluster: list[Entry], urgent: bool) -> dict:
    primary = cluster[0]
    urgency = "alert" if urgent else "analysis"
    source_names = list(dict.fromkeys(e.source_name for e in cluster))

    title = (primary.title or "").strip() or "Untitled Story"
    summary = (primary.summary or "No summary available.")[:200]

    return {
        "urgency": urgency,
        "category": "startups",
        "headline": title,
        "summary": summary,
        "key_points": [f"Reported by: {', '.join(source_names[:3])}"],
        "tags": ["News"],
        "published_date": primary.published_date or "",
    }


def rewrite_with_ai(cluster: list[Entry], urgent: bool = False, header: str | None = None) -> str:
    links = collect_links(cluster, urgent=urgent)

    source_note = ""
    if len(links) < DIGEST_MIN_SOURCES:
        source_note = (
            f"\nNote: only {len(links)} source(s) available so far "
            f"(prefer {DIGEST_MIN_SOURCES}+ when possible)."
        )

    source_names = list(dict.fromkeys(e.source_name for e in cluster))
    source_name_str = source_names[0] if source_names else "Unknown"

    prompt = _build_prompt(cluster, source_note)
    raw_output, provider = _call_ai_with_fallback(prompt)

    if raw_output is None:
        logger.warning("Groq, Gemini, and OpenRouter all failed/unavailable — using hardcoded fallback")
        data = _fallback_data(cluster, urgent)
    else:
        try:
            data = _parse_ai_json(raw_output)
            if provider != "groq":
                logger.info("Rewrote via %s fallback (earlier tier(s) unavailable)", provider)
        except ValueError:
            logger.warning(
                "Failed to parse %s output as JSON, using fallback. Raw: %.200s",
                provider, raw_output,
            )
            data = _fallback_data(cluster, urgent)

    if isinstance(data, dict) and data.get("reject"):
        title = cluster[0].title if cluster else "?"
        reason = data.get("reason", "unspecified")
        logger.warning("AI rejected content as non-news (%s): %.100s", reason, title)
        raise ContentRejected(reason)

    data = _sanitize_ai_data(data)

    is_valid, reason = _validate_ai_data(data)
    if not is_valid:
        logger.warning("AI output validation failed (%s), using fallback", reason)
        data = _fallback_data(cluster, urgent)
        is_valid, _ = _validate_ai_data(data)
        if not is_valid:
            logger.error("Fallback data also failed validation — using hardcoded minimal data")
            data = {
                "urgency": "alert",
                "category": "startups",
                "headline": cluster[0].title or "Untitled Story",
                "summary": (cluster[0].summary or "No summary available.")[:200],
                "key_points": [],
                "tags": [],
            }

    data["source_name"] = source_name_str

    if urgent and data.get("urgency") not in ("breaking", "alert"):
        data["urgency"] = "alert"

    rendered = _render_template(data)
    if header:
        rendered = f"{header}\n\n{rendered}"

    return rendered
