"""Hugging Face client — trending models, datasets, and spaces.

100% free for reading public data. No API key required.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_BASE = "https://huggingface.co/api"
_TIMEOUT = 15


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_trending_models(
    sort: str = "likes",
    direction: str = -1,
    limit: int = 30,
    search: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch trending models from Hugging Face Hub.

    Args:
        sort: Sort field ("likes", "downloads", "lastModified").
        direction: -1 for descending, 1 for ascending.
        limit: Max models to return.
        search: Optional search filter.

    Returns:
        List of dicts with standardized article schema.
    """
    params: dict[str, Any] = {
        "sort": sort,
        "direction": direction,
        "limit": min(limit, 50),
    }
    if search:
        params["search"] = search

    try:
        resp = httpx.get(f"{_BASE}/models", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        models = resp.json()
    except httpx.TimeoutException:
        logger.warning("HuggingFace models timed out")
        return []
    except Exception:
        logger.exception("HuggingFace models request failed")
        return []

    articles: list[dict[str, Any]] = []

    for model in models:
        model_id = model.get("modelId") or model.get("id", "")
        if not model_id:
            continue

        url = f"https://huggingface.co/{model_id}"
        author = model.get("author", "")
        pipeline_tag = model.get("pipeline_tag", "")
        tags = model.get("tags", []) or []
        likes = model.get("likes", 0)
        downloads = model.get("downloads", 0)
        last_modified = model.get("lastModified", "")

        published_at = None
        if last_modified:
            try:
                published_at = datetime.fromisoformat(last_modified.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        summary_parts = []
        if pipeline_tag:
            summary_parts.append(f"Pipeline: {pipeline_tag}")
        summary_parts.append(f"❤️ {likes:,} likes | ⬇️ {downloads:,} downloads")
        if author:
            summary_parts.append(f"By {author}")

        articles.append({
            "title": f"HF Model: {model_id}",
            "url": url,
            "source_name": "Hugging Face",
            "source_domain": "huggingface.co",
            "summary": " | ".join(summary_parts),
            "published_at": published_at,
            "language": "en",
            "category": pipeline_tag or "ai",
            "raw_json": model,
        })

    logger.info("HuggingFace: %d trending models", len(articles))
    return articles


def fetch_trending_datasets(
    sort: str = "likes",
    direction: str = -1,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Fetch trending datasets from Hugging Face."""
    params = {
        "sort": sort,
        "direction": direction,
        "limit": min(limit, 50),
    }

    try:
        resp = httpx.get(f"{_BASE}/datasets", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        datasets = resp.json()
    except httpx.TimeoutException:
        logger.warning("HuggingFace datasets timed out")
        return []
    except Exception:
        logger.exception("HuggingFace datasets request failed")
        return []

    articles: list[dict[str, Any]] = []

    for ds in datasets:
        ds_id = ds.get("id", "")
        if not ds_id:
            continue

        url = f"https://huggingface.co/datasets/{ds_id}"
        author = ds.get("author", "")
        tags = ds.get("tags", []) or []
        likes = ds.get("likes", 0)
        downloads = ds.get("downloads", 0)
        last_modified = ds.get("lastModified", "")

        published_at = None
        if last_modified:
            try:
                published_at = datetime.fromisoformat(last_modified.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": f"HF Dataset: {ds_id}",
            "url": url,
            "source_name": "Hugging Face Datasets",
            "source_domain": "huggingface.co",
            "summary": f"❤️ {likes:,} likes | ⬇️ {downloads:,} downloads | Tags: {', '.join(tags[:3])}",
            "published_at": published_at,
            "language": "en",
            "category": "dataset",
            "raw_json": ds,
        })

    logger.info("HuggingFace: %d trending datasets", len(articles))
    return articles


def fetch_trending_spaces(
    sort: str = "likes",
    direction: str = -1,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Fetch trending Spaces from Hugging Face."""
    params = {
        "sort": sort,
        "direction": direction,
        "limit": min(limit, 50),
    }

    try:
        resp = httpx.get(f"{_BASE}/spaces", params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        spaces = resp.json()
    except httpx.TimeoutException:
        logger.warning("HuggingFace spaces timed out")
        return []
    except Exception:
        logger.exception("HuggingFace spaces request failed")
        return []

    articles: list[dict[str, Any]] = []

    for space in spaces:
        space_id = space.get("id", "")
        if not space_id:
            continue

        url = f"https://huggingface.co/spaces/{space_id}"
        author = space.get("author", "")
        sdk = space.get("sdk", "")
        likes = space.get("likes", 0)
        last_modified = space.get("lastModified", "")

        published_at = None
        if last_modified:
            try:
                published_at = datetime.fromisoformat(last_modified.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        articles.append({
            "title": f"HF Space: {space_id}",
            "url": url,
            "source_name": "Hugging Face Spaces",
            "source_domain": "huggingface.co",
            "summary": f"SDK: {sdk} | ❤️ {likes:,} likes | By {author}",
            "published_at": published_at,
            "language": "en",
            "category": "space",
            "raw_json": space,
        })

    logger.info("HuggingFace: %d trending spaces", len(articles))
    return articles


def fetch_all_huggingface() -> list[dict[str, Any]]:
    """Fetch all trending HF content (models + datasets + spaces), deduplicated."""
    seen_urls: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for fetcher in [fetch_trending_models, fetch_trending_datasets, fetch_trending_spaces]:
        articles = fetcher()
        for a in articles:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                all_articles.append(a)
        time.sleep(0.3)

    logger.info("HuggingFace total: %d unique items", len(all_articles))
    return all_articles
