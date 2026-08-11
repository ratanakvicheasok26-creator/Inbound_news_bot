"""Helpers for extracting and validating article image URLs."""

from __future__ import annotations

import ipaddress
import logging
import re
import socket
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

_MAX_REDIRECTS = 4

# Decimal-only IPv4 (reject 0x7f.0.0.1, 2130706433, etc. before httpx dials them).
_DECIMAL_IPV4_RE = re.compile(
    r"^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$"
)


def _is_blocked_hostname(host: str) -> bool:
    lower = host.lower().rstrip(".")
    if not lower:
        return True
    if lower == "localhost" or lower.endswith(".localhost"):
        return True
    if lower in ("metadata.google.internal", "metadata") or lower.endswith(".internal"):
        return True
    return False


def _ip_is_private(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """True for loopback, link-local, private, ULA, and IPv4-mapped privates."""
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _parse_literal_ip(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """Parse a host as an IP literal. Rejects non-decimal IPv4 forms."""
    raw = host.strip().strip("[]")
    if not raw:
        return None
    # IPv4 must be dotted-decimal only — blocks 0x7f.0.0.1 / 2130706433 / 127.1
    if ":" not in raw and not _DECIMAL_IPV4_RE.match(raw):
        # Might still be a hostname; only reject if it *looks* like an IP attempt
        if re.search(r"[\d]", raw) and re.fullmatch(r"[0-9a-fxX.]+", raw):
            return None  # signal invalid literal via caller treating as blocked
        try:
            # bare integers like 2130706433
            if raw.isdigit() or (raw.lower().startswith("0x") and all(c in "0123456789abcdefx" for c in raw.lower())):
                return None
        except Exception:
            pass
        return None
    try:
        return ipaddress.ip_address(raw)
    except ValueError:
        return None


def _is_private_host(host: str) -> bool:
    """True for loopback, link-local, private, ULA, and IPv4-mapped ranges.

    Also rejects ambiguous IPv4 literals (hex/octal/integer) that httpx would
    dial as loopback/metadata.
    """
    lower = (host or "").lower().strip().strip("[]")
    if _is_blocked_hostname(lower):
        return True

    # Ambiguous numeric IPv4 forms (hex / decimal integer / short) — fail closed.
    if ":" not in lower and re.fullmatch(r"[0-9a-fxX.]+", lower) and not _DECIMAL_IPV4_RE.match(lower):
        return True

    ip = _parse_literal_ip(lower)
    if ip is not None:
        return _ip_is_private(ip)
    return False


def resolves_to_private(host: str) -> bool:
    """True if hostname is private, or any DNS A/AAAA record is private.

    Fail-closed on DNS errors so a lookup failure cannot open an SSRF path.
    """
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
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            if _is_private_host(str(addr)):
                return True
            continue
        if _ip_is_private(ip):
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
        parsed = urlparse(u)
        host = parsed.hostname or ""
    except Exception:
        return False
    if not host or _is_private_host(host):
        return False
    # Userinfo in URL is a common SSRF/smuggle trick — reject.
    if parsed.username is not None or parsed.password is not None:
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

        if isinstance(raw.get("primary_location"), dict):
            pass

    return None


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
