"""Cross-bot mirroring.

The English bot publishes every post it sends (individual stories and
batched digests) to a shared Redis list. The Khmer bot drains that list
and re-posts the same news in Khmer, so both channels stay in sync.
Both deployments must point at the same REDIS_URL.

Reliability model (at-least-once, never silent-drop):
  - Main list:       newsbot:mirror:queue
  - In-flight:       newsbot:mirror:processing + claim hash (visibility timeout)
  - Dead letter:     newsbot:mirror:deadletter (auto-replayed into queue)
  - Local EN outbox: data/mirror_outbox.jsonl when Redis is unreachable
  - ACK only after success, or after the item is safely requeued/deadlettered
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_QUEUE_KEY = "newsbot:mirror:queue"
_PROCESSING_KEY = "newsbot:mirror:processing"
_CLAIMED_KEY = "newsbot:mirror:claimed"
_DEADLETTER_KEY = "newsbot:mirror:deadletter"
_MAX_REQUEUE_ATTEMPTS = int(os.environ.get("MIRROR_MAX_REQUEUE_ATTEMPTS", "5"))
_PUBLISH_MAX_RETRIES = int(os.environ.get("MIRROR_PUBLISH_RETRIES", "5"))
_PROCESSING_TIMEOUT_SECONDS = float(
    os.environ.get("MIRROR_PROCESSING_TIMEOUT_SECONDS", "900")
)
# Bound queue growth if the Khmer bot is down — overflow oldest to deadletter.
_MAX_QUEUE_LENGTH: int = int(os.environ.get("MIRROR_MAX_QUEUE_LENGTH", "500"))
_OUTBOX_PATH = Path(
    os.environ.get("MIRROR_OUTBOX_PATH", "data/mirror_outbox.jsonl")
)

# Atomic claim: LMOVE into processing and stamp claim time.
_CLAIM_LUA = """
local raw = redis.call('LMOVE', KEYS[1], KEYS[2], 'LEFT', 'RIGHT')
if raw then
  redis.call('HSET', KEYS[3], raw, ARGV[1])
end
return raw
"""

# Reclaim only stale (or unstamped) processing items.
_RECLAIM_LUA = """
local items = redis.call('LRANGE', KEYS[1], 0, -1)
local now = tonumber(ARGV[1])
local timeout = tonumber(ARGV[2])
local n = 0
for _, raw in ipairs(items) do
  local claimed = tonumber(redis.call('HGET', KEYS[3], raw) or '0')
  if (not claimed) or claimed == 0 or (now - claimed) >= timeout then
    redis.call('RPUSH', KEYS[2], raw)
    redis.call('LREM', KEYS[1], 1, raw)
    redis.call('HDEL', KEYS[3], raw)
    n = n + 1
  end
end
return n
"""


@dataclass(frozen=True)
class QueuedPayload:
    """A drained mirror item still held in the processing list until settled."""

    payload: dict
    raw: str


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
        "en_text": getattr(post, "text", ""),
        "cluster": [entry_to_payload(e) for e in post.entries],
        "en_source": {
            "source_type": "telegram_en",
            "primary_url": post.primary_url,
            "created_at": time.time(),
        },
    }


def build_batch_payload(batched: list) -> dict:
    """Build a mirror payload for a batched digest message."""
    return {
        "kind": "batch",
        "stories": [
            {
                "title": getattr(story, "title", ""),
                "summary": getattr(story, "summary", ""),
                "cluster": [entry_to_payload(e) for e in story.entries],
                "website_url": story.website_url,
                "image_url": story.image_url,
            }
            for story in batched
        ],
        "en_source": {
            "source_type": "telegram_en",
            "created_at": time.time(),
        },
    }


def _encode(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _overflow_to_deadletter(client, list_key: str) -> None:
    """If list_key exceeds cap, park oldest on deadletter (or drop if already there)."""
    while True:
        length = client.llen(list_key)
        if length is None or length <= _MAX_QUEUE_LENGTH:
            return
        old = client.lpop(list_key)
        if old is None:
            return
        if list_key == _DEADLETTER_KEY:
            logger.error(
                "Mirror: deadletter over capacity (%d) — dropping oldest",
                length,
            )
            continue
        logger.error(
            "Mirror: %s over capacity (%d) — moving oldest to deadletter",
            list_key,
            length,
        )
        _push_deadletter(client, old)


def _push_deadletter(client, raw: str) -> bool:
    try:
        client.rpush(_DEADLETTER_KEY, raw)
        _overflow_to_deadletter(client, _DEADLETTER_KEY)
        return True
    except Exception:
        logger.exception("Mirror: failed to write deadletter")
        return False


def deadletter(payload: dict) -> bool:
    """Park a poison/exhausted payload on the deadletter list."""
    if not mirror_available():
        return _append_local_outbox({**payload, "_deadletter": True})
    try:
        client = _client()
        try:
            return _push_deadletter(client, _encode(payload))
        finally:
            client.close()
    except Exception:
        logger.exception("Mirror: deadletter unavailable — writing local outbox")
        return _append_local_outbox({**payload, "_deadletter": True})


def _append_local_outbox(payload: dict) -> bool:
    """Last-resort durable write when Redis cannot accept the item."""
    try:
        _OUTBOX_PATH.parent.mkdir(parents=True, exist_ok=True)
        line = _encode(payload) + "\n"
        with _OUTBOX_PATH.open("a", encoding="utf-8") as fh:
            fh.write(line)
            fh.flush()
            os.fsync(fh.fileno())
        logger.error("Mirror: wrote payload to local outbox %s", _OUTBOX_PATH)
        return True
    except Exception:
        logger.exception("Mirror: local outbox write FAILED — item may be lost")
        return False


def flush_outbox(max_items: int = 50) -> int:
    """EN: push local outbox lines into Redis when connectivity returns."""
    if not mirror_available() or not _OUTBOX_PATH.exists():
        return 0
    try:
        lines = _OUTBOX_PATH.read_text(encoding="utf-8").splitlines()
    except Exception:
        logger.exception("Mirror: failed to read local outbox")
        return 0
    if not lines:
        return 0

    remaining: list[str] = []
    flushed = 0
    try:
        client = _client()
        try:
            for i, line in enumerate(lines):
                if flushed >= max_items:
                    remaining.extend(lines[i:])
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    logger.warning("Mirror: dropping corrupt outbox line")
                    continue
                if not isinstance(payload, dict):
                    continue
                # Items marked for deadletter go straight there.
                if payload.pop("_deadletter", False):
                    if _push_deadletter(client, _encode(payload)):
                        flushed += 1
                    else:
                        remaining.append(_encode({**payload, "_deadletter": True}))
                    continue
                try:
                    client.rpush(_QUEUE_KEY, _encode(payload))
                    _overflow_to_deadletter(client, _QUEUE_KEY)
                    flushed += 1
                except Exception:
                    remaining.append(line)
                    remaining.extend(lines[i + 1 :])
                    break
        finally:
            client.close()
    except Exception:
        logger.exception("Mirror: outbox flush failed")
        return 0

    try:
        if remaining:
            _atomic_write_lines(_OUTBOX_PATH, remaining)
        else:
            _OUTBOX_PATH.unlink(missing_ok=True)
    except Exception:
        logger.exception("Mirror: failed to rewrite outbox after flush")

    if flushed:
        logger.info("Mirror: flushed %d payload(s) from local outbox.", flushed)
    return flushed


def _atomic_write_lines(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        dir=str(path.parent), prefix=".mirror_outbox_", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            for line in lines:
                fh.write(line if line.endswith("\n") else line + "\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def publish(payload: dict) -> bool:
    """Enqueue one post for the mirror bot. Returns True on success.

    Retries Redis; on final failure writes deadletter + local outbox so the
    item can be recovered. Always attempts flush_outbox first.
    """
    if not mirror_available():
        logger.info("Mirror: REDIS_URL not set — parking in local outbox.")
        return _append_local_outbox(payload)

    # Opportunistically drain any backlog from earlier Redis outages.
    try:
        flush_outbox()
    except Exception:
        logger.exception("Mirror: flush_outbox during publish failed")

    raw = _encode(payload)
    last_exc: Exception | None = None
    for attempt in range(1, _PUBLISH_MAX_RETRIES + 1):
        try:
            client = _client()
            try:
                client.rpush(_QUEUE_KEY, raw)
                _overflow_to_deadletter(client, _QUEUE_KEY)
            finally:
                client.close()
            logger.info(
                "Mirror: enqueued %s payload for the Khmer bot.",
                payload.get("kind"),
            )
            return True
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "Mirror: enqueue attempt %d/%d failed: %s",
                attempt,
                _PUBLISH_MAX_RETRIES,
                exc,
            )
            time.sleep(min(2.0, 0.2 * (2 ** (attempt - 1))))

    logger.error(
        "Mirror: failed to enqueue %s after %d attempts — deadletter + outbox.",
        payload.get("kind"),
        _PUBLISH_MAX_RETRIES,
        exc_info=last_exc,
    )
    try:
        client = _client()
        try:
            _push_deadletter(client, raw)
        finally:
            client.close()
    except Exception:
        logger.exception("Mirror: deadletter write also failed")
    _append_local_outbox(payload)
    # False = live queue did not accept it (EN already public; recovery paths hold it).
    return False


def requeue(payload: dict) -> bool:
    """Re-enqueue a failed mirror item (bounded attempts).

    Returns True when the item is safely on the main queue or deadletter
    (caller may ACK the processing copy). Returns False only if nothing
    durable could be written — leave the item in processing for reclaim.
    """
    if not mirror_available():
        return _append_local_outbox(payload)

    attempts = int(payload.get("_attempts") or 0) + 1
    payload = dict(payload)
    payload["_attempts"] = attempts

    if attempts > _MAX_REQUEUE_ATTEMPTS:
        logger.error(
            "Mirror: exhausting %s after %d failed attempts — deadletter",
            payload.get("kind"),
            attempts - 1,
        )
        if deadletter(payload):
            return True
        return _append_local_outbox(payload)

    last_exc: Exception | None = None
    for attempt in range(1, _PUBLISH_MAX_RETRIES + 1):
        try:
            client = _client()
            try:
                client.rpush(_QUEUE_KEY, _encode(payload))
                _overflow_to_deadletter(client, _QUEUE_KEY)
            finally:
                client.close()
            logger.warning(
                "Mirror: requeued %s (attempt %d/%d)",
                payload.get("kind"),
                attempts,
                _MAX_REQUEUE_ATTEMPTS,
            )
            return True
        except Exception as exc:
            last_exc = exc
            time.sleep(min(2.0, 0.2 * attempt))

    logger.error(
        "Mirror: failed to requeue %s — falling back to deadletter/outbox",
        payload.get("kind"),
        exc_info=last_exc,
    )
    if deadletter(payload):
        return True
    return _append_local_outbox(payload)


def ack(raw: str) -> bool:
    """Remove one in-flight item from processing + claim hash. True on success."""
    if not mirror_available() or not raw:
        return False
    try:
        client = _client()
        try:
            pipe = client.pipeline()
            pipe.lrem(_PROCESSING_KEY, 1, raw)
            pipe.hdel(_CLAIMED_KEY, raw)
            pipe.execute()
            return True
        finally:
            client.close()
    except Exception:
        logger.exception("Mirror: failed to ack processing item")
        return False


def settle(payload: dict, raw: str, *, success: bool, poison: bool = False) -> bool:
    """Finish a drained item without silent loss.

    - success: ACK only
    - failure/poison: park (requeue or deadletter) then ACK
    - if park fails: do NOT ACK (reclaim will retry later)
    """
    if success:
        return ack(raw)

    parked = deadletter(payload) if poison else requeue(payload)
    if not parked:
        logger.error(
            "Mirror: could not park %s — leaving in processing for reclaim",
            payload.get("kind"),
        )
        return False
    return ack(raw)


def _reclaim_processing(client) -> int:
    """Move stale processing items back onto the main queue."""
    now = str(time.time())
    timeout = str(_PROCESSING_TIMEOUT_SECONDS)
    try:
        n = client.eval(
            _RECLAIM_LUA,
            3,
            _PROCESSING_KEY,
            _QUEUE_KEY,
            _CLAIMED_KEY,
            now,
            timeout,
        )
        n = int(n or 0)
        if n:
            logger.warning(
                "Mirror: reclaimed %d stale in-flight payload(s) (timeout=%.0fs).",
                n,
                _PROCESSING_TIMEOUT_SECONDS,
            )
            _overflow_to_deadletter(client, _QUEUE_KEY)
        return n
    except Exception:
        # Fallback without Lua: reclaim everything older via claim hash.
        return _reclaim_processing_fallback(client)


def _reclaim_processing_fallback(client) -> int:
    items = client.lrange(_PROCESSING_KEY, 0, -1) or []
    if not items:
        return 0
    now = time.time()
    n = 0
    for raw in items:
        try:
            claimed_raw = client.hget(_CLAIMED_KEY, raw)
            claimed = float(claimed_raw) if claimed_raw else 0.0
        except (TypeError, ValueError):
            claimed = 0.0
        if claimed and (now - claimed) < _PROCESSING_TIMEOUT_SECONDS:
            continue
        pipe = client.pipeline()
        pipe.rpush(_QUEUE_KEY, raw)
        pipe.lrem(_PROCESSING_KEY, 1, raw)
        pipe.hdel(_CLAIMED_KEY, raw)
        pipe.execute()
        n += 1
    if n:
        logger.warning(
            "Mirror: reclaimed %d stale in-flight payload(s) (fallback).",
            n,
        )
        _overflow_to_deadletter(client, _QUEUE_KEY)
    return n


def reclaim_processing() -> int:
    """Public wrapper: reclaim stale processing items onto the main queue."""
    if not mirror_available():
        return 0
    try:
        client = _client()
        try:
            return _reclaim_processing(client)
        finally:
            client.close()
    except Exception:
        logger.exception("Mirror: failed to reclaim processing list")
        return 0


def replay_deadletter(max_items: int = 10) -> int:
    """Move deadletter items back onto the main queue (reset attempt counter)."""
    if not mirror_available() or max_items <= 0:
        return 0
    try:
        client = _client()
        try:
            return _replay_deadletter_conn(client, max_items)
        finally:
            client.close()
    except Exception:
        logger.exception("Mirror: deadletter replay failed")
        return 0


def _pop_to_processing(client) -> str | None:
    """Atomically move one queue item into processing and stamp claim time."""
    now = str(time.time())
    try:
        return client.eval(
            _CLAIM_LUA,
            3,
            _QUEUE_KEY,
            _PROCESSING_KEY,
            _CLAIMED_KEY,
            now,
        )
    except Exception:
        # Fallback: LMOVE (or LPOP+RPUSH) then HSET — small race window.
        try:
            raw = client.lmove(_QUEUE_KEY, _PROCESSING_KEY, "LEFT", "RIGHT")
        except Exception:
            raw = client.lpop(_QUEUE_KEY)
            if raw is not None:
                client.rpush(_PROCESSING_KEY, raw)
        if raw is not None:
            try:
                client.hset(_CLAIMED_KEY, raw, now)
            except Exception:
                logger.exception("Mirror: failed to stamp claim time")
        return raw


def _ack_processing(client, raw: str) -> None:
    """Drop one processing entry + claim stamp (same connection)."""
    try:
        pipe = client.pipeline()
        pipe.lrem(_PROCESSING_KEY, 1, raw)
        pipe.hdel(_CLAIMED_KEY, raw)
        pipe.execute()
    except Exception:
        logger.exception("Mirror: failed to clear processing item")


def _replay_deadletter_conn(client, max_items: int) -> int:
    """Move up to max_items deadletter payloads onto the main queue."""
    moved = 0
    for _ in range(max(0, max_items)):
        raw = client.lpop(_DEADLETTER_KEY)
        if raw is None:
            break
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Mirror: dropping corrupt deadletter item")
            continue
        if not isinstance(payload, dict):
            continue
        payload.pop("_attempts", None)
        client.rpush(_QUEUE_KEY, _encode(payload))
        moved += 1
    if moved:
        _overflow_to_deadletter(client, _QUEUE_KEY)
        logger.info("Mirror: replayed %d deadletter payload(s).", moved)
    return moved


def drain(max_items: int = 25, *, replay: int = 10) -> list[QueuedPayload]:
    """Claim up to max_items payloads into the processing list (FIFO).

    Callers must ``settle(...)`` so items are either posted or parked before
    ACK. Stale processing leftovers and deadletter items are recovered first.
    """
    if not mirror_available():
        logger.info("Mirror: REDIS_URL not set — nothing to drain.")
        return []

    claimed: list[QueuedPayload] = []
    try:
        client = _client()
        try:
            _reclaim_processing(client)
            try:
                _replay_deadletter_conn(client, replay)
            except Exception:
                logger.exception("Mirror: deadletter replay failed")

            for _ in range(max_items):
                raw = _pop_to_processing(client)
                if raw is None:
                    break
                try:
                    payload = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    logger.warning("Mirror: parking invalid queue item in deadletter")
                    _push_deadletter(client, raw if isinstance(raw, str) else str(raw))
                    _ack_processing(client, raw)
                    continue
                if not isinstance(payload, dict):
                    logger.warning("Mirror: parking non-object queue item in deadletter")
                    _push_deadletter(client, raw)
                    _ack_processing(client, raw)
                    continue
                claimed.append(QueuedPayload(payload=payload, raw=raw))
        finally:
            client.close()
    except Exception:
        logger.exception("Mirror: failed to drain queue")
    if claimed:
        logger.info("Mirror: drained %d payload(s) to post in Khmer.", len(claimed))
    return claimed
