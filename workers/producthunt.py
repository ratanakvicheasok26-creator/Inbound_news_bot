"""Product Hunt API client — product launches and tech discovery.

GraphQL API. Requires API key from https://www.producthunt.com/v2/oauth/applications
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_API = "https://api.producthunt.com/v2/api/graphql"
_TIMEOUT = 15


def _get_key() -> str | None:
    return os.environ.get("PRODUCTHUNT_API_KEY")


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


QUERY = """
query {
  posts(first: 20, order: VOTES) {
    edges {
      node {
        id
        name
        tagline
        description
        url
        votesCount
        commentsCount
        createdAt
        topics {
          edges {
            node {
              name
            }
          }
        }
        website
      }
    }
  }
}
"""


def fetch_top_products() -> list[dict[str, Any]]:
    api_key = _get_key()
    if not api_key:
        logger.warning("PRODUCTHUNT_API_KEY not set, skipping Product Hunt")
        return []

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = httpx.post(_API, json={"query": QUERY}, headers=headers, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.exception("Product Hunt request failed")
        return []

    edges = data.get("data", {}).get("posts", {}).get("edges", [])
    articles: list[dict[str, Any]] = []

    for edge in edges:
        node = edge.get("node", {})
        name = node.get("name", "").strip()
        if not name:
            continue

        tagline = node.get("tagline", "")
        desc = node.get("description", "") or ""
        votes = node.get("votesCount", 0)
        comments = node.get("commentsCount", 0)
        website = node.get("website", "")
        ph_url = node.get("url", f"https://www.producthunt.com/posts/{name.lower().replace(' ', '-')}")

        topics = []
        for t_edge in node.get("topics", {}).get("edges", []):
            t_name = t_edge.get("node", {}).get("name", "")
            if t_name:
                topics.append(t_name)

        published_at = None
        created = node.get("createdAt")
        if created:
            try:
                published_at = datetime.fromisoformat(created.replace("Z", "+00:00")).isoformat()
            except (ValueError, TypeError):
                pass

        summary_parts = []
        if tagline:
            summary_parts.append(tagline)
        if topics:
            summary_parts.append(f"Topics: {', '.join(topics[:5])}")
        summary_parts.append(f"Upvotes: {votes} | Comments: {comments}")
        if desc:
            summary_parts.append(desc[:200])

        articles.append({
            "title": f"[PH] {name}",
            "url": website or ph_url,
            "source_name": "Product Hunt",
            "source_domain": "producthunt.com",
            "summary": " | ".join(summary_parts),
            "published_at": published_at or datetime.now(timezone.utc).isoformat(),
            "language": "en",
            "category": "startups",
            "raw_json": node,
        })

    logger.info("Product Hunt: %d products", len(articles))
    return articles


def fetch_all_producthunt() -> list[dict[str, Any]]:
    return fetch_top_products()
