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


def _is_private_host(host: str) -> bool:
    """True for loopback, link-local, private, and IPv6 mapped ranges."""
    lower = host.lower().strip("[]")
    if lower == "localhost" or lower.endswith(".localhost"):
        return True
    if lower in ("metadata.google.internal", "metadata") or lower.endswith(".internal"):
        return True
    if lower.startswith("::ffff:"):
        lower = lower[len("::ffff:") :]
    if ":" in lower:
        return (
            lower == "::1"
            or lower.startswith(("fe80:", "fc", "fd"))
            or _is_private_host(lower.split(":").pop())
        )
    return bool(
        re.match(
            r"^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)",
            lower,
        )
    )


def resolves_to_private(host: str) -> bool:
    """True if hostname is private, or any DNS A/AAAA record is private.

    Fail-closed on DNS errors so a lookup failure cannot open an SSRF path.
    """
    import socket

    if not host or _is_private_host(host):
        return True
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return True
    if not infos:
        return True
    for info in infos:
        addr = info[4][0]
        if _is_private_host(str(addr)):
            return True
    return False


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
    if not host or _is_private_host(host):
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


_MAX_REDIRECTS = 4


def fetch_og_image(page_url: str, timeout: float = 4.0) -> str | None:
    """Fetch og:image / twitter:image from an article page.

    Redirects are followed manually and each hop's host is re-validated, so a
    30x from an allowed host to an internal one (e.g. cloud metadata at
    169.254.169.254) cannot bypass the private-host guard.
    """
    if not is_valid_image_url(page_url):
        return None
    try:
        url = page_url
        resp = None
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            for _ in range(_MAX_REDIRECTS + 1):
                if not is_valid_image_url(url):
                    return None
                host = urlparse(url).hostname or ""
                if resolves_to_private(host):
                    return None
                resp = client.get(
                    url,
                    headers={"User-Agent": "InboundNewsBot/1.0 (image discovery)"},
                )
                if resp.is_redirect:
                    location = resp.headers.get("location")
                    if not location:
                        return None
                    url = str(httpx.URL(url).join(location))
                    continue
                break
        if resp is None:
            return None
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

