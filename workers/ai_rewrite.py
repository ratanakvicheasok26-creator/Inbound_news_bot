"""AI summary rewriting for API workers.

Primary: Groq (llama-3.3-70b-versatile)
Fallback: Google Gemini (gemini-2.0-flash)
Last resort: keep original summary
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

_MAX_RETRIES: int = 2
_RETRY_DELAY: float = 1.0
_BATCH_DELAY: float = 0.3

_PROMPT_TEMPLATE = """Rewrite this summary into a clear, concise 2-3 sentence news summary.
Rules:
- Factual, no opinions, no speculation
- Plain text only, no markdown, no HTML
- Keep it under 200 characters
- If already concise enough, return as-is

Title: {title}
Source: {source_name}
Original summary: {summary}"""


def _get_groq_client():
    """Get Groq client. Returns None if GROQ_API_KEY is not set."""
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    except Exception:
        logger.exception("Failed to create Groq client")
        return None


def _get_gemini_client():
    """Get Gemini client. Returns None if GOOGLE_GEMINI_API_KEY is not set."""
    api_key = os.environ.get("GOOGLE_GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception:
        logger.exception("Failed to create Gemini client")
        return None


def _rewrite_with_groq(client, prompt: str) -> str | None:
    """Call Groq API. Returns rewritten text or None."""
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content
            if content and content.strip():
                return content.strip()
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_DELAY * attempt)
            else:
                logger.warning("Groq failed: %s", exc)
    return None


def _rewrite_with_gemini(client, prompt: str) -> str | None:
    """Call Gemini API. Returns rewritten text or None."""
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
            )
            content = response.text
            if content and content.strip():
                return content.strip()
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_DELAY * attempt)
            else:
                logger.warning("Gemini failed: %s", exc)
    return None


def _rewrite_single(groq_client, gemini_client, article: dict[str, Any]) -> str | None:
    """Rewrite a single article summary. Tries Groq first, then Gemini."""
    title = article.get("title", "Untitled")
    source_name = article.get("source_name", "Unknown")
    summary = article.get("summary", "")

    if len(summary) < 50:
        return None

    prompt = _PROMPT_TEMPLATE.format(
        title=title, source_name=source_name, summary=summary[:500]
    )

    # Primary: Groq
    if groq_client:
        result = _rewrite_with_groq(groq_client, prompt)
        if result:
            return result

    # Fallback: Gemini
    if gemini_client:
        logger.info("Groq failed, falling back to Gemini for '%.50s'", title)
        result = _rewrite_with_gemini(gemini_client, prompt)
        if result:
            return result

    return None


def rewrite_batch(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rewrite summaries for a batch of articles.

    Tries Groq first, falls back to Gemini if Groq fails.
    Falls back to original summary if both fail.

    Args:
        articles: List of article dicts with 'title', 'summary', 'source_name'.

    Returns:
        Same list with rewritten summaries.
    """
    groq_client = _get_groq_client()
    gemini_client = _get_gemini_client()

    if not groq_client and not gemini_client:
        logger.info("No AI keys set (GROQ_API_KEY / GOOGLE_GEMINI_API_KEY), skipping rewrite")
        return articles

    rewritten = 0
    for article in articles:
        original_summary = article.get("summary", "")
        new_summary = _rewrite_single(groq_client, gemini_client, article)

        if new_summary and new_summary != original_summary:
            raw = article.get("raw_json", {})
            if isinstance(raw, dict):
                raw["original_summary"] = original_summary
            article["raw_json"] = raw
            article["summary"] = new_summary
            rewritten += 1

        time.sleep(_BATCH_DELAY)

    logger.info("AI rewrite: %d/%d summaries updated", rewritten, len(articles))
    return articles
