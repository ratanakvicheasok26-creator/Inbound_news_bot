"""Central source registry — loads sources.yaml and provides helper functions.

Adding a new source = editing sources.yaml. No Python code changes needed.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

_YAML_PATH = Path(__file__).resolve().parent.parent / "sources.yaml"

_cache: dict[str, Any] | None = None


def _load() -> dict[str, Any]:
    global _cache
    if _cache is not None:
        return _cache

    if not _YAML_PATH.exists():
        logger.error("sources.yaml not found at %s", _YAML_PATH)
        _cache = {"version": 1, "sources": []}
        return _cache

    with _YAML_PATH.open() as f:
        _cache = yaml.safe_load(f) or {"version": 1, "sources": []}

    logger.info("Loaded %d sources from sources.yaml", len(_cache.get("sources", [])))
    return _cache


def reload() -> dict[str, Any]:
    """Force reload from disk (call after editing sources.yaml)."""
    global _cache
    _cache = None
    return _load()


def get_all_sources(
    category: str | None = None,
    source_type: str | None = None,
    enabled_only: bool = True,
) -> list[dict[str, Any]]:
    """Return all sources, optionally filtered by category or type."""
    data = _load()
    sources = data.get("sources", [])

    result = []
    for s in sources:
        if enabled_only and not s.get("enabled", True):
            continue
        if category and s.get("category") != category:
            continue
        if source_type and s.get("type") != source_type:
            continue
        result.append(s)

    return result


def get_rss_feeds(tier: int = 1, category: str | None = None) -> list[str]:
    """Return RSS feed URLs for the given tier.

    Args:
        tier: 1 = Telegram bot, 2 = website ingestion, 3 = deep research
        category: Optional category filter (e.g. "cambodia", "crypto", "ai")

    Returns:
        List of RSS feed URL strings.
    """
    sources = get_all_sources(source_type="rss", category=category)
    feeds = []
    for s in sources:
        tiers = s.get("tier", [])
        if tier in tiers:
            feeds.append(s["url"])
    return feeds


# Prefer these outlets when capping the Telegram bot feed list (name substring match).
_BOT_CURATED_NAME_HINTS: tuple[str, ...] = (
    "TechCrunch",
    "The Verge",
    "Ars Technica",
    "Wired",
    "MIT Technology Review",
    "Reuters",
    "Hacker News",
    "Lobsters",
    "The Hacker News",
    "Phnom Penh Post",
    "Khmer Times",
    "Rest of World",
    "Tech in Asia",
    "Bloomberg",
    "Financial Times",
    "CNBC",
    "BBC",
    "Guardian",
    "NYTimes",
    "New York Times",
    "Hugging Face",
    "OpenAI",
    "Google AI",
    "DeepMind",
    "Anthropic",
    "Cloudflare",
    "GitHub Blog",
)


def get_bot_rss_feeds(limit: int = 130) -> list[str]:
    """Curated subset of tier-1 RSS feeds for the Telegram bot.

    sources.yaml currently tags nearly all RSS as tier [1, 2], so a naive
    tier=1 load returns ~900+ URLs and blows the ~60s global fetch budget.
    This picks curated majors first, then one feed per category, then fills
    stably up to ``limit``.
    """
    if limit <= 0:
        return []

    sources = get_all_sources(source_type="rss")
    tier1 = [s for s in sources if 1 in s.get("tier", []) and s.get("url")]
    if not tier1:
        return []

    selected: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    def _add(src: dict[str, Any]) -> bool:
        url = src["url"]
        if url in seen_urls:
            return False
        seen_urls.add(url)
        selected.append(src)
        return True

    for hint in _BOT_CURATED_NAME_HINTS:
        hint_l = hint.lower()
        for s in tier1:
            if hint_l in str(s.get("name", "")).lower():
                _add(s)
                if len(selected) >= limit:
                    return [s["url"] for s in selected]

    cats_seen: set[str] = {str(s.get("category") or "") for s in selected}
    for s in tier1:
        cat = str(s.get("category") or "uncategorized")
        if cat in cats_seen:
            continue
        if _add(s):
            cats_seen.add(cat)
        if len(selected) >= limit:
            return [s["url"] for s in selected]

    for s in tier1:
        _add(s)
        if len(selected) >= limit:
            break

    return [s["url"] for s in selected[:limit]]


def get_api_sources(tier: int = 2) -> list[dict[str, Any]]:
    """Return API source configs for the given tier.

    Returns:
        List of dicts with keys: name, module, function, queries, requires_key, etc.
    """
    sources = get_all_sources(source_type="api")
    result = []
    for s in sources:
        tiers = s.get("tier", [])
        if tier in tiers:
            result.append(s)
    return result


def get_source_names(tier: int | None = None, category: str | None = None) -> list[str]:
    """Return human-readable source names, for logging/debugging."""
    sources = get_all_sources()
    names = []
    for s in sources:
        if tier is not None and tier not in s.get("tier", []):
            continue
        if category and s.get("category") != category:
            continue
        names.append(s.get("name", "unknown"))
    return names


def get_categories() -> list[str]:
    """Return all unique categories across sources."""
    data = _load()
    cats = set()
    for s in data.get("sources", []):
        cat = s.get("category")
        if cat:
            cats.add(cat)
    return sorted(cats)


def count_sources() -> dict[str, int]:
    """Return counts by type and tier."""
    data = _load()
    sources = data.get("sources", [])

    by_type = {"rss": 0, "api": 0, "other": 0}
    by_tier = {1: 0, 2: 0, 3: 0}

    for s in sources:
        if not s.get("enabled", True):
            continue
        stype = s.get("type", "other")
        by_type[stype] = by_type.get(stype, 0) + 1
        for t in s.get("tier", []):
            by_tier[t] = by_tier.get(t, 0) + 1

    return {"by_type": by_type, "by_tier": by_tier, "total": len(sources)}
