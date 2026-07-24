"""Wikipedia Pageviews client — trending topic detection.

Free, no API key required. Detects spiking Wikipedia articles as a signal
for emerging tech news topics. Spikes in page views often predict
mainstream news cycles by 24-48 hours.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import unquote, urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://wikimedia.org/api/rest_v1/metrics"
_USER_AGENT = "InboundNewsBot/1.0 (https://github.com/sothunly-alt/Inbound_news_bot; ratharo69@gmail.com)"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _wiki_url(title: str) -> str:
    """Build a Wikipedia article URL from its title."""
    encoded = title.replace(" ", "_")
    return f"https://en.wikipedia.org/wiki/{encoded}"


def fetch_top_articles(
    date: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Fetch top-viewed Wikipedia articles for a given date.

    Args:
        date: Date string in YYYY/MM/DD format. Defaults to yesterday.
        limit: Max articles to return (caps at 200).

    Returns:
        List of dicts with standardized article schema.
    """
    if date is None:
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        date = yesterday.strftime("%Y/%m/%d")

    url = f"{_API_BASE}/pageviews/top/en.wikipedia/all-access/{date}"
    headers = {"User-Agent": _USER_AGENT}

    try:
        resp = httpx.get(url, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Wikipedia Pageviews timed out for date: %s", date)
        return []
    except Exception:
        logger.exception("Wikipedia Pageviews request failed")
        return []

    items = data.get("items", [])
    if not items:
        return []

    articles_data = items[0].get("articles", [])
    articles: list[dict[str, Any]] = []

    # Filter out special pages and namespace 0 articles only
    skip_prefixes = (
        "Wikipedia:", "Special:", "Help:", "Portal:", "File:",
        "Talk:", "User:", "Template:", "Category:", "Main_Page",
        "-", "Article_", "Special:",
    )

    for item in articles_data[:limit]:
        title = item.get("article", "")
        if not title or title.startswith(skip_prefixes):
            continue

        views = item.get("views", 0)
        rank = item.get("rank", 0)

        # Decode URL-encoded titles
        clean_title = unquote(title.replace("_", " "))

        # Skip very short titles (likely disambiguation)
        if len(clean_title) < 3:
            continue

        wiki_url = _wiki_url(title)

        articles.append({
            "title": f"Wikipedia trending: {clean_title} ({views:,} views)",
            "url": wiki_url,
            "source_name": "Wikipedia Pageviews",
            "source_domain": "en.wikipedia.org",
            "summary": (
                f"Article '{clean_title}' is trending on English Wikipedia "
                f"with {views:,} views (rank #{rank}). "
                f"This may indicate an emerging news story."
            ),
            "published_at": datetime.now(timezone.utc).isoformat(),
            "language": "en",
            "category": "science",
            "raw_json": item,
        })

    logger.info("Wikipedia Pageviews: %d trending articles for %s", len(articles), date)
    return articles


def fetch_pageviews_for_article(
    article_title: str,
    days: int = 30,
) -> list[dict[str, Any]]:
    """Fetch pageview history for a specific article.

    Useful for detecting if a topic is currently spiking in interest.

    Args:
        article_title: Wikipedia article title (e.g. "Artificial_intelligence").
        days: Number of recent days to query (max 30 for free tier).

    Returns:
        Single-element list with a standardized article dict containing
        the trend data in summary, or empty list on error.
    """
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=min(days, 30))).strftime("%Y%m%d")
    end = now.strftime("%Y%m%d")
    article = article_title.replace(" ", "_")

    url = (
        f"{_API_BASE}/pageviews/per-article/en.wikipedia/all-access/"
        f"all-agents/{article}/daily/{start}/{end}"
    )
    headers = {"User-Agent": _USER_AGENT}

    try:
        resp = httpx.get(url, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("Wikipedia Pageviews timed out for article: %s", article_title)
        return []
    except Exception:
        logger.exception("Wikipedia Pageviews per-article request failed")
        return []

    items = data.get("items", [])
    if not items:
        return []

    total_views = sum(item.get("views", 0) for item in items)
    recent_views = sum(item.get("views", 0) for item in items[-7:]) if len(items) >= 7 else total_views
    daily_avg = total_views / len(items) if items else 0

    # Calculate trend: compare last 7 days vs previous period
    if len(items) >= 14:
        prev_views = sum(item.get("views", 0) for item in items[-14:-7])
        trend_pct = ((recent_views - prev_views) / prev_views * 100) if prev_views > 0 else 0
    else:
        trend_pct = 0

    clean_title = unquote(article.replace("_", " "))
    trend_label = f"+{trend_pct:.0f}%" if trend_pct >= 0 else f"{trend_pct:.0f}%"

    return [{
        "title": f"Wikipedia trend: {clean_title} ({trend_label})",
        "url": _wiki_url(article),
        "source_name": "Wikipedia Pageviews",
        "source_domain": "en.wikipedia.org",
        "summary": (
            f"Article '{clean_title}' has {total_views:,} total views over {len(items)} days "
            f"(avg {daily_avg:,.0f}/day). 7-day trend: {trend_label}. "
            f"{'This topic is trending upward.' if trend_pct > 10 else 'Interest is stable.'}"
        ),
        "published_at": now.isoformat(),
        "language": "en",
        "category": "science",
        "raw_json": {"items": items, "total_views": total_views, "trend_pct": trend_pct},
    }]


# Tech-related keywords to monitor for spiking interest
TECH_KEYWORDS = [
    "Artificial_intelligence",
    "Large_language_model",
    "OpenAI",
    "Google_Artificial_Intelligence",
    "Cybersecurity",
    "Cryptocurrency",
    "Quantum_computing",
    "Electric_vehicle",
    "SpaceX",
    "Apple_Inc",
    "Microsoft",
    "Meta_Platforms",
    "Tesla,_Inc",
    "Rust_programming_language",
    "Linux",
]


def fetch_all_wikipedia(
    keywords: list[str] | None = None,
    detect_spikes: bool = True,
) -> list[dict[str, Any]]:
    """Fetch Wikipedia trending data, optionally detecting tech spikes.

    Combines today's top articles with trend analysis for known tech keywords.

    Args:
        keywords: List of Wikipedia article titles to monitor for spikes.
        detect_spikes: If True, also query per-article trends for tech keywords.

    Returns:
        Deduplicated list of standardized article dicts.
    """
    if keywords is None:
        keywords = TECH_KEYWORDS

    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    # 1. Today's top articles
    top_articles = fetch_top_articles(limit=50)
    for a in top_articles:
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    # 2. Trend analysis for tech keywords (if spike detection enabled)
    if detect_spikes:
        for kw in keywords:
            trends = fetch_pageviews_for_article(kw, days=14)
            for t in trends:
                if t["url"] not in seen_urls:
                    seen_urls.add(t["url"])
                    all_articles.append(t)
            time.sleep(0.2)

    logger.info("Wikipedia total: %d unique articles", len(all_articles))
    return all_articles
