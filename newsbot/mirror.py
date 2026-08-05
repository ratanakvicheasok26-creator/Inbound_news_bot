"""Cross-bot mirroring.

The English bot publishes every post it sends (individual stories and
batched digests) to a shared Redis list. The Khmer bot drains that list
and re-posts the same news in Khmer, so both channels stay in sync.
Both deployments must point at the same REDIS_URL.
"""

from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)

_QUEUE_KEY = "newsbot:mirror:queue"


def mirror_available() -> bool:
    """True when both bots can share the queue (REDIS_URL configured)."""
    return bool(os.environ.get("REDIS_URL", "").strip())


def _client():
    import redis

    return redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)


def entry_to_payload(entry) -> dict:
    """Serialize the Entry fields the rewrite pipeline needs."""
    return {
        "id": entry.id,
        "title": entry.title,
        "summary": entry.summary,
        "link": entry.link,
        "source_name": entry.source_name,
        "image_url": entry.image_url,
    }


def payload_to_entry(data: dict):
    """Reconstruct an Entry from a serialized payload."""
    from newsbot.feeds import Entry

    return Entry(
        id=str(data.get("id") or ""),
        title=str(data.get("title") or ""),
        summary=str(data.get("summary") or ""),
        link=str(data.get("link") or ""),
        source_name=str(data.get("source_name") or "Inbound Reports"),
        image_url=data.get("image_url"),
    )


def build_story_payload(post) -> dict:
    """Build a mirror payload for one individual StoryPost."""
    return {
        "kind": "story",
        "urgent": bool(getattr(post, "urgent", False)),
        "website_url": post.primary_url,
        "image_url": post.image_url,
        "cluster": [entry_to_payload(e) for e in post.entries],
    }


def build_batch_payload(batched: list) -> dict:
    """Build a mirror payload for a batched digest message."""
    return {
        "kind": "batch",
        "stories": [
            {
                "cluster": [entry_to_payload(e) for e in story.entries],
                "website_url": story.website_url,
                "image_url": story.image_url,
            }
            for story in batched
        ],
    }


def publish(payload: dict) -> None:
    """Enqueue one post for the mirror bot. No-op without Redis."""
    if not mirror_available():
        logger.info("Mirror: REDIS_URL not set — nothing enqueued.")
        return
    try:
        client = _client()
        client.rpush(_QUEUE_KEY, json.dumps(payload, ensure_ascii=False))
        client.close()
        logger.info("Mirror: enqueued %s payload for the Khmer bot.", payload.get("kind"))
    except Exception:
        logger.exception("Mirror: failed to enqueue payload")


def drain(max_items: int = 25) -> list[dict]:
    """Pop up to max_items payloads from the queue (FIFO). No-op without Redis."""
    if not mirror_available():
        logger.info("Mirror: REDIS_URL not set — nothing to drain.")
        return []
    payloads: list[dict] = []
    try:
        client = _client()
        for _ in range(max_items):
            raw = client.lpop(_QUEUE_KEY)
            if raw is None:
                break
            try:
                payloads.append(json.loads(raw))
            except (json.JSONDecodeError, TypeError):
                logger.warning("Mirror: dropped invalid queue item: %.200s", raw)
        client.close()
    except Exception:
        logger.exception("Mirror: failed to drain queue")
    if payloads:
        logger.info("Mirror: drained %d payload(s) to post in Khmer.", len(payloads))
    return payloads
