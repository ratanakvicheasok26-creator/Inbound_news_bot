"""NIST National Vulnerability Database (NVD) API client — CVE tracking.

Free, no API key required. Authoritative source for cybersecurity
vulnerability data. Tracks CVEs with CVSS scores, affected products,
and references.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
_USER_AGENT = "InboundNewsBot/1.0 (https://github.com/sothunly-alt/Inbound_news_bot)"
_TIMEOUT = 20


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def fetch_recent_cves(
    keyword: str | None = None,
    results_per_page: int = 20,
    days_back: int = 7,
) -> list[dict[str, Any]]:
    """Fetch recent CVEs from NVD.

    Args:
        keyword: Optional keyword to filter CVEs (e.g. "microsoft", "chrome").
        results_per_page: Number of results (max 2000, 20 recommended for speed).
        days_back: How many days back to search.

    Returns:
        List of dicts with standardized article schema.
    """
    headers = {"User-Agent": _USER_AGENT}

    # Calculate date range
    now = datetime.now(UTC)
    start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    start_date = start_date - timedelta(days=days_back)

    params: dict[str, Any] = {
        "pubStartDate": start_date.strftime("%Y-%m-%dT00:00:00.000"),
        "pubEndDate": now.strftime("%Y-%m-%dT23:59:59.999"),
        "resultsPerPage": min(results_per_page, 2000),
    }

    if keyword:
        params["keywordSearch"] = keyword

    try:
        resp = httpx.get(_API_BASE, params=params, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        logger.warning("NVD API timed out for keyword: %s", keyword)
        return []
    except Exception:
        logger.exception("NVD API request failed")
        return []

    vulnerabilities = data.get("vulnerabilities", [])
    articles: list[dict[str, Any]] = []

    for vuln in vulnerabilities:
        cve = vuln.get("cve", {})
        cve_id = cve.get("id", "")
        if not cve_id:
            continue

        # Get description
        descriptions = cve.get("descriptions", [])
        desc_en = next((d["value"] for d in descriptions if d.get("lang") == "en"), "")

        # Get CVSS score
        metrics = cve.get("metrics", {})
        cvss_score = None
        severity = None

        # Try CVSS v3.1 first, then v3.0, then v2.0
        for version_key in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
            metric_list = metrics.get(version_key, [])
            if metric_list:
                cvss_data = metric_list[0].get("cvssData", {})
                cvss_score = cvss_data.get("baseScore")
                severity = cvss_data.get("baseSeverity") or metric_list[0].get("baseSeverity")
                break

        # Get published date
        published = cve.get("published", "")
        published_at = None
        if published:
            try:
                published_at = datetime.fromisoformat(published.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        # Get references
        references = cve.get("references", [])
        ref_url = references[0].get("url", f"https://nvd.nist.gov/vuln/detail/{cve_id}") if references else f"https://nvd.nist.gov/vuln/detail/{cve_id}"

        # Get weaknesses/CWE
        weaknesses = cve.get("weaknesses", [])
        cwe_list = []
        for w in weaknesses:
            for desc in w.get("description", []):
                if desc.get("value", "").startswith("CWE-"):
                    cwe_list.append(desc["value"])

        summary_parts = []
        if cvss_score is not None:
            summary_parts.append(f"CVSS: {cvss_score} ({severity})")
        if cwe_list:
            summary_parts.append(f"CWE: {', '.join(cwe_list[:3])}")
        summary_parts.append(desc_en[:300] if desc_en else cve_id)

        articles.append({
            "title": f"CVE {cve_id}: {desc_en[:100]}..." if len(desc_en) > 100 else f"CVE {cve_id}: {desc_en}",
            "url": ref_url,
            "source_name": "NVD",
            "source_domain": "nvd.nist.gov",
            "summary": " | ".join(summary_parts),
            "published_at": published_at or datetime.now(UTC).isoformat(),
            "language": "en",
            "category": "cybersecurity",
            "raw_json": {k: v for k, v in cve.items() if k != "descriptions"},
        })

    logger.info("NVD: %d CVEs (keyword=%s)", len(articles), keyword)
    return articles


DEFAULT_KEYWORDS = [
    None,  # unfiltered = all recent
    "artificial intelligence",
    "microsoft",
    "google chrome",
    "linux kernel",
    "apache",
    "cisco",
    "amazon web services",
    "kubernetes",
    "docker",
    "openai",
]


def fetch_all_nvd(
    keywords: list[str | None] | None = None,
    results_per_keyword: int = 10,
    days_back: int = 3,
) -> list[dict[str, Any]]:
    """Fetch recent CVEs across multiple keywords, deduplicated by CVE ID."""
    if keywords is None:
        keywords = DEFAULT_KEYWORDS

    seen_cves: set[str] = set()
    all_articles: list[dict[str, Any]] = []

    for kw in keywords:
        articles = fetch_recent_cves(keyword=kw, results_per_page=results_per_keyword, days_back=days_back)
        for a in articles:
            # Extract CVE ID from title for dedup
            cve_id = a["title"].split(":")[0].replace("CVE ", "").strip()
            if cve_id not in seen_cves:
                seen_cves.add(cve_id)
                all_articles.append(a)
        time.sleep(0.6)  # NVD rate limit: 5 req/30s without API key

    logger.info("NVD total: %d unique CVEs", len(all_articles))
    return all_articles
