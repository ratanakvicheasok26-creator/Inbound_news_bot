"""AI summary rewriting for API workers.

Uses shared.ai_router for 3-tier provider fallback with key rotation:
  Tier 1: Groq (3 keys) → Tier 2: OpenRouter (3 keys) → Tier 3: Gemini (3 keys)
Falls back to original summary when all providers are exhausted.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from shared.ai_router import get_router

logger = logging.getLogger(__name__)

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


def _rewrite_single(article: dict[str, Any], router) -> str | None:
    """Rewrite a single article summary using the shared AI router."""
    title = article.get("title", "Untitled")
    source_name = article.get("source_name", "Unknown")
    summary = article.get("summary", "")

    if len(summary) < 50:
        return None

    prompt = _PROMPT_TEMPLATE.format(
        title=title, source_name=source_name, summary=summary[:500]
    )

    result, provider = router.call(prompt, max_tokens=200)
    if result:
        logger.debug("AI rewrite via %s for '%.50s'", provider, title)
    return result


def rewrite_batch(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rewrite summaries for a batch of articles.

    Uses the shared AI router with 3-tier fallback and key rotation.
    Falls back to original summary when all providers are exhausted.

    Args:
        articles: List of article dicts with 'title', 'summary', 'source_name'.

    Returns:
        Same list with rewritten summaries.
    """
    router = get_router()

    rewritten = 0
    for article in articles:
        original_summary = article.get("summary", "")
        new_summary = _rewrite_single(article, router)

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
