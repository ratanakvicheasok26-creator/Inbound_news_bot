"""NASA Open API client — space science and technology.

Uses NASA's public APIs (api.nasa.gov). Free with DEMO_KEY (30 req/hr, 50 req/day).
For higher limits, register for a free key at https://api.nasa.gov.

Endpoints used:
- APOD (Astronomy Picture of the Day)
- NeoWs (Near Earth Object Web Service)
- EPIC (Earth Polychromatic Imaging Camera)
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://api.nasa.gov"
_TIMEOUT = 15


def _get_api_key() -> str:
    """Get NASA API key from environment, falling back to DEMO_KEY."""
    import os
    return os.environ.get("NASA_API_KEY", "DEMO_KEY")


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_apod(
    count: int = 1,
    date: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch Astronomy Picture of the Day.

    Args:
        count: Number of days to fetch (1-100 for DEMO_KEY).
        date: Specific date (YYYY-MM-DD). If None, returns today.

    Returns:
        List of dicts with standardized article schema.
    """
    api_key = _get_api_key()
    params: dict[str, Any] = {"api_key": api_key}
    if date:
        params["date"] = date
    else:
        params["count"] = min(count, 100)

    try:
        resp = httpx.get(f"{_API_BASE}/planetary/apod", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("NASA APOD timed out")
        return []
    except Exception:
        logger.exception("NASA APOD request failed")
        return []

    # Single item comes as dict, multiple as list
    if isinstance(data, dict):
        data = [data]

    articles: list[dict[str, Any]] = []

    for item in data:
        title = item.get("title", "").strip()
        explanation = item.get("explains", "") or item.get("explanation", "")
        media_type = item.get("media_type", "")
        date_str = item.get("date", "")
        hd_url = item.get("hdurl", "")
        img_url = item.get("url", "")

        url = hd_url if hd_url else img_url

        summary_parts = [explanation[:300]] if explanation else []
        summary_parts.append(f"Media: {media_type}")
        if date_str:
            summary_parts.append(f"Date: {date_str}")
        summary = " | ".join(summary_parts)

        published_at = None
        if date_str:
            try:
                published_at = datetime.strptime(date_str, "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                ).isoformat()
            except ValueError:
                pass

        articles.append({
            "title": f"APOD: {title}" if title else "Astronomy Picture of the Day",
            "url": url,
            "source_name": "NASA APOD",
            "source_domain": "apod.nasa.gov",
            "summary": summary,
            "published_at": published_at or datetime.now(timezone.utc).isoformat(),
            "language": "en",
            "category": "science",
            "raw_json": item,
        })

    logger.info("NASA APOD: %d pictures", len(articles))
    return articles


def fetch_neows() -> list[dict[str, Any]]:
    """Fetch near-Earth objects approaching in the next 7 days."""
    api_key = _get_api_key()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end_date = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")

    try:
        resp = httpx.get(
            f"{_API_BASE}/neo/rest/v1/feed",
            params={"api_key": api_key, "start_date": today, "end_date": end_date},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("NASA NeoWs request failed")
        return []

    near_earth_objects = data.get("near_earth_objects", {})
    articles: list[dict[str, Any]] = []

    for date_str, objects in near_earth_objects.items():
        for obj in objects:
            name = obj.get("name", "")
            nasa_jpl = obj.get("nasa_jpl_url", "")
            diameter = obj.get("estimated_diameter", {}).get("kilometers", {})
            min_d = diameter.get("estimated_diameter_min", 0)
            max_d = diameter.get("estimated_diameter_max", 0)
            hazardous = obj.get("is_potentially_hazardous_asteroid", False)
            close = obj.get("close_approach_data", [{}])[0]
            velocity = close.get("relative_velocity", {}).get("kilometers_per_hour", "N/A")
            miss_distance = close.get("miss_distance", {}).get("kilometers", "N/A")

            summary_parts = [
                f"Diameter: {min_d:.2f} - {max_d:.2f} km",
                f"Velocity: {velocity} km/h",
                f"Miss distance: {float(miss_distance):,.0f} km" if miss_distance != "N/A" else "Miss distance: N/A",
            ]
            if hazardous:
                summary_parts.append("⚠️ POTENTIALLY HAZARDOUS")
            summary = " | ".join(summary_parts)

            articles.append({
                "title": f"Asteroid approaching: {name}" if hazardous else f"Asteroid flyby: {name}",
                "url": nasa_jpl or "https://neo.jpl.nasa.gov/",
                "source_name": "NASA NeoWs",
                "source_domain": "neo.jpl.nasa.gov",
                "summary": summary,
                "published_at": datetime.now(timezone.utc).isoformat(),
                "language": "en",
                "category": "science",
                "raw_json": obj,
            })

    logger.info("NASA NeoWs: %d approaching objects", len(articles))
    return articles


def fetch_epic(count: int = 5) -> list[dict[str, Any]]:
    """Fetch Earth Polychromatic Imaging Camera images (daily Earth photos)."""
    api_key = _get_api_key()

    try:
        resp = httpx.get(
            f"{_API_BASE}/EPIC/api/natural",
            params={"api_key": api_key, "count": min(count, 10)},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("NASA EPIC request failed")
        return []

    articles: list[dict[str, Any]] = []

    for item in data:
        caption = item.get("caption", "Earth from space")
        date_str = item.get("date", "")
        image_name = item.get("image", "")
        centroid = item.get("centroid_coordinates", {})
        lat = centroid.get("lat", 0)
        lon = centroid.get("lon", 0)

        image_url = f"https://epic.gsfc.nasa.gov/natural/png/{image_name}.png" if image_name else ""

        published_at = None
        if date_str:
            try:
                published_at = datetime.fromisoformat(date_str.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": f"Earth photo: {caption}",
            "url": image_url or "https://epic.gsfc.nasa.gov/",
            "source_name": "NASA EPIC",
            "source_domain": "epic.gsfc.nasa.gov",
            "summary": f"{caption}. Coordinates: {lat:.2f}°N, {lon:.2f}°E" if lat and lon else caption,
            "published_at": published_at or datetime.now(timezone.utc).isoformat(),
            "language": "en",
            "category": "science",
            "raw_json": item,
        })

    logger.info("NASA EPIC: %d images", len(articles))
    return articles


def fetch_all_nasa() -> list[dict[str, Any]]:
    """Fetch from all NASA endpoints, deduplicated by URL."""
    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    # APOD (1 today's picture)
    for a in fetch_apod(count=1):
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    time.sleep(0.3)

    # Near-Earth objects
    for a in fetch_neows():
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    time.sleep(0.3)

    # EPIC Earth photos
    for a in fetch_epic(count=3):
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            all_articles.append(a)

    logger.info("NASA total: %d unique items", len(all_articles))
    return all_articles
