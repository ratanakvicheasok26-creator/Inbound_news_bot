"""Helpers for extracting and validating article image URLs."""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_OG_IMAGE_RE = re.compile(
    r'<meta\s+[^>]*(?:property|name)=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']'
    r"|<meta\s+[^>]*content=[\"']([^\"']+)[\"'][^>]*(?:property|name)=[\"']og:image[\"']",
    re.I,
)

_TWITTER_IMAGE_RE = re.compile(
    r'<meta\s+[^>]*(?:property|name)=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']'
    r"|<meta\s+[^>]*content=[\"']([^\"']+)[\"'][^>]*(?:property|name)=[\"']twitter:image[\"']",
    re.I,
)


def is_valid_image_url(url: str | None) -> bool:
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if not u.startswith(("http://", "https://")):
        return False
    if len(u) > 2000:
        return False
    try:
        host = urlparse(u).hostname or ""
    except Exception:
        return False
    if not host or host in {"localhost", "127.0.0.1"}:
        return False
    return True


def extract_image_url(article: dict[str, Any]) -> str | None:
    """Pull the best image URL from a normalized article dict / raw payload."""
    direct = article.get("image_url")
    if is_valid_image_url(direct):
        return direct.strip()

    raw = article.get("raw_json")
    if isinstance(raw, str):
        try:
            import json
            raw = json.loads(raw)
        except Exception:
            raw = None

    if isinstance(raw, dict):
        for key in (
            "socialimage",
            "image_url",
            "imageUrl",
            "urlToImage",
            "thumbnail",
            "image",
            "cover",
        ):
            val = raw.get(key)
            if isinstance(val, str) and is_valid_image_url(val):
                return val.strip()
            if isinstance(val, dict):
                nested = val.get("url") or val.get("src")
                if isinstance(nested, str) and is_valid_image_url(nested):
                    return nested.strip()

        # OpenAlex / Semantic Scholar style
        if isinstance(raw.get("primary_location"), dict):
            pass

    return None


def fetch_og_image(page_url: str, timeout: float = 4.0) -> str | None:
    """Fetch og:image / twitter:image from an article page."""
    if not is_valid_image_url(page_url):
        return None
    try:
        resp = httpx.get(
            page_url,
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": "InboundNewsBot/1.0 (image discovery)"},
        )
        resp.raise_for_status()
        html = resp.text[:120_000]
        for pattern in (_OG_IMAGE_RE, _TWITTER_IMAGE_RE):
            match = pattern.search(html)
            if match:
                candidate = (match.group(1) or match.group(2) or "").strip()
                if is_valid_image_url(candidate):
                    return candidate
    except Exception as exc:
        logger.debug("og:image fetch failed for %s: %s", page_url, exc)
    return None
