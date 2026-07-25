"""TerminalFeed API client — multi-source data aggregation.

Free, no API key required. 100K req/day. Provides cybersecurity threats,
economic data, space weather, service status, predictions, crypto, stocks,
earthquakes, and more.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://terminalfeed.io/api"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def _fetch(endpoint: str) -> dict | list | None:
    try:
        resp = httpx.get(f"{_BASE}/{endpoint}", timeout=_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        logger.exception("TerminalFeed %s failed", endpoint)
        return None


def _get_list(data: Any) -> list:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("data", [])
    return []


def _wrap(title: str, url: str, summary: str, category: str, raw: Any) -> dict[str, Any]:
    return {
        "title": title[:200],
        "url": url,
        "source_name": "TerminalFeed",
        "source_domain": "terminalfeed.io",
        "summary": summary[:500],
        "published_at": datetime.now(timezone.utc).isoformat(),
        "language": "en",
        "category": category,
        "raw_json": raw,
    }


def fetch_cyber_threats() -> list[dict[str, Any]]:
    data = _fetch("cyber-threats")
    if not data:
        return []
    items = _get_list(data)
    articles = []
    for item in items[:20]:
        if not isinstance(item, dict):
            continue
        threat = item.get("threat") or item.get("indicator") or item.get("name", "")
        source = item.get("source", "")
        itype = item.get("type", "")
        date = item.get("date", "")
        articles.append(_wrap(
            f"Threat ({itype}): {threat[:100]}",
            "https://terminalfeed.io",
            f"Source: {source}. Type: {itype}. Indicator: {threat}. Date: {date}",
            "cybersecurity",
            item,
        ))
    return articles


def fetch_economic_data() -> list[dict[str, Any]]:
    data = _fetch("economic-data")
    if not data:
        return []
    indicators = data.get("data", data) if isinstance(data, dict) else {}
    if not isinstance(indicators, dict):
        return []
    articles = []
    for key, val in indicators.items():
        name = key.replace("_", " ").title()
        if isinstance(val, dict):
            value = val.get("value", "")
            change = val.get("change", "")
        else:
            value = val
            change = ""
        articles.append(_wrap(
            f"Economic: {name} = {value}",
            "https://terminalfeed.io",
            f"{name}: {value} (change: {change})" if change else f"{name}: {value}",
            "finance_news",
            {"indicator": key, "value": value, "change": change},
        ))
    return articles[:15]


def fetch_space_weather() -> list[dict[str, Any]]:
    data = _fetch("space-weather")
    if not data:
        return []
    sw = data.get("data", data) if isinstance(data, dict) else {}
    if not isinstance(sw, dict):
        return []
    kp = sw.get("kp_index") or sw.get("kp", "")
    storm = sw.get("storm_level") or sw.get("class", "")
    solar = sw.get("solar_wind_speed") or ""
    return [_wrap(
        f"Space weather: Kp={kp}, Storm={storm}",
        "https://terminalfeed.io",
        f"Kp index: {kp}. Storm level: {storm}. Solar wind: {solar}.",
        "science",
        sw,
    )]


def fetch_service_status() -> list[dict[str, Any]]:
    data = _fetch("service-status")
    if not data:
        return []
    items = _get_list(data)
    articles = []
    for item in items[:15]:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "")
        indicator = item.get("indicator", "")
        desc = item.get("description", "")
        if indicator.lower() not in ("degraded", "down", "outage", "partial", "incident"):
            continue
        articles.append(_wrap(
            f"Service status: {name} - {indicator}",
            "https://terminalfeed.io",
            f"{name}: {indicator}. {desc}",
            "cloud",
            item,
        ))
    return articles


def fetch_earthquakes() -> list[dict[str, Any]]:
    data = _fetch("earthquake")
    if not data:
        return []
    items = _get_list(data)
    articles = []
    for item in items[:10]:
        if not isinstance(item, dict):
            continue
        mag = item.get("magnitude", "")
        place = item.get("place", "")
        url = item.get("url") or "https://earthquake.usgs.gov/"
        articles.append(_wrap(
            f"Earthquake M{mag}: {place}",
            url,
            f"Magnitude {mag} earthquake near {place}",
            "science",
            item,
        ))
    return articles


def fetch_launches() -> list[dict[str, Any]]:
    data = _fetch("launches")
    if not data:
        return []
    items = _get_list(data)
    articles = []
    for item in items[:10]:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "")
        provider = item.get("provider", "")
        net = item.get("net", "") or item.get("date", "")
        articles.append(_wrap(
            f"Space launch: {name} ({provider})",
            "https://terminalfeed.io",
            f"{name} by {provider}. Scheduled: {net}",
            "space",
            item,
        ))
    return articles


def fetch_github_trending_terminal() -> list[dict[str, Any]]:
    data = _fetch("github-trending")
    if not data:
        return []
    items = _get_list(data)
    articles = []
    for item in items[:15]:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "")
        desc = item.get("description", "")
        url = item.get("url", "")
        stars = item.get("stars", "")
        lang = item.get("language", "")
        articles.append(_wrap(
            f"Trending: {name} ({stars}⭐ {lang})" if stars else f"Trending: {name}",
            url or f"https://github.com/{name}",
            desc[:300] if desc else name,
            "developer",
            item,
        ))
    return articles


def fetch_crypto_movers() -> list[dict[str, Any]]:
    data = _fetch("crypto-movers")
    if not data:
        return []
    items = _get_list(data)
    articles = []
    for item in items[:10]:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "")
        symbol = item.get("symbol", "")
        change = item.get("change_24h_percent", "")
        price = item.get("price_usd", "")
        articles.append(_wrap(
            f"Crypto: {name} ({symbol}) {change}%",
            "https://terminalfeed.io",
            f"{name} ({symbol}): ${price}. 24h change: {change}%",
            "crypto",
            item,
        ))
    return articles


def fetch_all_terminalfeed() -> list[dict[str, Any]]:
    """Fetch from all TerminalFeed endpoints, deduplicated by title."""
    seen: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for fetcher in [
        fetch_cyber_threats,
        fetch_economic_data,
        fetch_space_weather,
        fetch_service_status,
        fetch_earthquakes,
        fetch_launches,
        fetch_github_trending_terminal,
        fetch_crypto_movers,
    ]:
        for a in fetcher():
            key = a["title"]
            if key not in seen:
                seen.add(key)
                all_articles.append(a)

    logger.info("TerminalFeed total: %d unique items", len(all_articles))
    return all_articles
