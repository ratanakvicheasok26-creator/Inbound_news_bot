"""Persistent state backends for subscriber and posted-ID storage.

Uses Redis (Upstash) when REDIS_URL is set — survives Render/Railway restarts.
Falls back to local JSON files for local development.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
import uuid
from abc import ABC, abstractmethod

__all__ = [
    "StateBackend",
    "get_state",
    "reset_state",
    "acquire_instance_lock",
    "refresh_instance_lock",
    "release_instance_lock",
]

logger = logging.getLogger(__name__)

POSTED_ID_TTL_SECONDS: int = 30 * 24 * 60 * 60

# Namespace by language so an English and Khmer bot sharing the same Redis
# never collide on subscribers/posted-IDs/instance-lock. "en" keeps the
# legacy un-suffixed keys so the existing deployment's state is preserved.
from newsbot.config import NEWS_LANGUAGE

_LANG_PREFIX: str = "" if NEWS_LANGUAGE == "en" else f"{NEWS_LANGUAGE}:"

_SUBSCRIBERS_KEY = f"newsbot:{_LANG_PREFIX}subscribers"
_GROUP_THREADS_KEY = f"newsbot:{_LANG_PREFIX}group_threads"
_POSTED_ID_PREFIX = f"newsbot:{_LANG_PREFIX}posted:"
_POSTED_TITLE_PREFIX = f"newsbot:{_LANG_PREFIX}posted_title:"
_BRIEFED_ID_PREFIX = f"newsbot:{_LANG_PREFIX}briefed:"


class StateBackend(ABC):
    """Interface for persistent state storage."""

    @abstractmethod
    def load_subscribers(self) -> set[int]: ...

    @abstractmethod
    def save_subscribers(self, ids: set[int]) -> None: ...

    @abstractmethod
    def load_group_threads(self) -> dict[int, int]: ...

    @abstractmethod
    def save_group_threads(self, mapping: dict[int, int]) -> None: ...

    @abstractmethod
    def load_posted_ids(self) -> set[str]: ...

    @abstractmethod
    def save_posted_ids(self, ids: set[str]) -> None: ...

    @abstractmethod
    def add_posted_ids(self, ids: set[str]) -> None: ...

    @abstractmethod
    def load_posted_titles(self) -> set[str]: ...

    @abstractmethod
    def save_posted_titles(self, titles: set[str]) -> None: ...

    @abstractmethod
    def add_posted_titles(self, titles: set[str]) -> None: ...

    @abstractmethod
    def load_briefed_ids(self) -> set[str]: ...

    @abstractmethod
    def save_briefed_ids(self, ids: set[str]) -> None: ...

    @abstractmethod
    def add_briefed_ids(self, ids: set[str]) -> None: ...


class RedisState(StateBackend):
    """Redis-backed state using sets with TTL for posted IDs."""

    def __init__(self, redis_url: str) -> None:
        import redis

        self._r = redis.Redis.from_url(redis_url, decode_responses=True)
        self._r.ping()
        logger.info("Redis state backend connected.")

    def load_subscribers(self) -> set[int]:
        raw = self._r.smembers(_SUBSCRIBERS_KEY)
        return {int(cid) for cid in raw}

    def save_subscribers(self, ids: set[int]) -> None:
        pipe = self._r.pipeline()
        pipe.delete(_SUBSCRIBERS_KEY)
        if ids:
            pipe.sadd(_SUBSCRIBERS_KEY, *(str(cid) for cid in ids))
        pipe.execute()

    def load_group_threads(self) -> dict[int, int]:
        raw = self._r.hgetall(_GROUP_THREADS_KEY)
        try:
            return {int(k): int(v) for k, v in raw.items()}
        except (ValueError, TypeError):
            logger.exception("Failed to parse group threads from Redis")
            return {}

    def save_group_threads(self, mapping: dict[int, int]) -> None:
        pipe = self._r.pipeline()
        pipe.delete(_GROUP_THREADS_KEY)
        if mapping:
            pipe.hset(
                _GROUP_THREADS_KEY,
                mapping={str(k): str(v) for k, v in mapping.items()},
            )
        pipe.execute()

    def _load_redis_set(self, prefix: str) -> set[str]:
        result: set[str] = set()
        cursor = 0
        while True:
            cursor, keys = self._r.scan(cursor, match=f"{prefix}*", count=200)
            for key in keys:
                result.add(key[len(prefix):])
            if cursor == 0:
                break
        return result

    # Atomic replace: SCAN+DEL old prefix keys, then SET new values with TTL.
    # Runs server-side so concurrent readers never see a half-cleared set.
    # Delete keys one-by-one to avoid Lua unpack() stack limits on large SCAN batches.
    _SAVE_SET_LUA = """
    local cursor = '0'
    local prefix = ARGV[1]
    local ttl = tonumber(ARGV[2])
    repeat
      local result = redis.call('SCAN', cursor, 'MATCH', prefix .. '*', 'COUNT', 200)
      cursor = result[1]
      local keys = result[2]
      for j = 1, #keys do
        redis.call('DEL', keys[j])
      end
    until cursor == '0'
    for i = 3, #ARGV do
      redis.call('SET', prefix .. ARGV[i], '1', 'EX', ttl)
    end
    return #ARGV - 2
    """

    def _save_redis_set(self, prefix: str, values: set[str]) -> None:
        args = [prefix, str(POSTED_ID_TTL_SECONDS), *values]
        self._r.eval(self._SAVE_SET_LUA, 0, *args)

    def _add_redis_set(self, prefix: str, values: set[str]) -> None:
        pipe = self._r.pipeline()
        for value in values:
            pipe.set(f"{prefix}{value}", "1", ex=POSTED_ID_TTL_SECONDS)
        pipe.execute()

    def load_posted_ids(self) -> set[str]:
        return self._load_redis_set(_POSTED_ID_PREFIX)

    def save_posted_ids(self, ids: set[str]) -> None:
        self._save_redis_set(_POSTED_ID_PREFIX, ids)

    def add_posted_ids(self, ids: set[str]) -> None:
        self._add_redis_set(_POSTED_ID_PREFIX, ids)

    def load_posted_titles(self) -> set[str]:
        return self._load_redis_set(_POSTED_TITLE_PREFIX)

    def save_posted_titles(self, titles: set[str]) -> None:
        self._save_redis_set(_POSTED_TITLE_PREFIX, titles)

    def add_posted_titles(self, titles: set[str]) -> None:
        self._add_redis_set(_POSTED_TITLE_PREFIX, titles)

    def load_briefed_ids(self) -> set[str]:
        return self._load_redis_set(_BRIEFED_ID_PREFIX)

    def save_briefed_ids(self, ids: set[str]) -> None:
        self._save_redis_set(_BRIEFED_ID_PREFIX, ids)

    def add_briefed_ids(self, ids: set[str]) -> None:
        self._add_redis_set(_BRIEFED_ID_PREFIX, ids)


class FileState(StateBackend):
    """Local JSON file state — for development and non-Redis deployments."""

    def __init__(self, subscribers_path: str, posted_path: str) -> None:
        self._subscribers_path = subscribers_path
        self._posted_path = posted_path
        self._lock = threading.Lock()
        # File backend stores no timestamps, so cap by count to bound growth
        # (~years of digests) instead of growing forever.
        self._posted_id_cap = 50_000
        self._posted_title_cap = 50_000

    def _atomic_write(self, path: str, data: object) -> None:
        """Write JSON atomically: write to temp file, then os.replace."""
        dir_name = os.path.dirname(path) or "."
        fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(data, f)
            os.replace(tmp_path, path)
        except OSError:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    def _load_json_set(self, path: str) -> set:
        """Load a JSON array from a file and return as a set."""
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    return set(json.load(f))
            except (json.JSONDecodeError, OSError):
                logger.exception("Failed to load %s", path)
        return set()

    def _save_json_set(self, path: str, data: set) -> None:
        """Save a set as a JSON array atomically."""
        try:
            self._atomic_write(path, list(data))
        except OSError:
            logger.exception("Failed to save %s", path)

    def load_subscribers(self) -> set[int]:
        return self._load_json_set(self._subscribers_path)

    def save_subscribers(self, ids: set[int]) -> None:
        self._save_json_set(self._subscribers_path, ids)

    def _group_threads_path(self) -> str:
        return self._subscribers_path.replace("subscribers", "group_threads")

    def load_group_threads(self) -> dict[int, int]:
        path = self._group_threads_path()
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                return {int(k): int(v) for k, v in data.items()}
            except (json.JSONDecodeError, OSError, ValueError, TypeError):
                logger.exception("Failed to load %s", path)
        return {}

    def save_group_threads(self, mapping: dict[int, int]) -> None:
        try:
            self._atomic_write(
                self._group_threads_path(),
                {str(k): v for k, v in mapping.items()},
            )
        except OSError:
            logger.exception("Failed to save %s", self._group_threads_path())

    def load_posted_ids(self) -> set[str]:
        return self._load_json_set(self._posted_path)

    def save_posted_ids(self, ids: set[str]) -> None:
        self._save_json_set(self._posted_path, ids)

    def add_posted_ids(self, ids: set[str]) -> None:
        with self._lock:
            existing = self.load_posted_ids()
            existing.update(ids)
            if len(existing) > self._posted_id_cap:
                existing = set(list(existing)[-self._posted_id_cap :])
            self.save_posted_ids(existing)

    def _posted_titles_path(self) -> str:
        return self._posted_path.replace(".json", "_titles.json")

    def load_posted_titles(self) -> set[str]:
        return self._load_json_set(self._posted_titles_path())

    def save_posted_titles(self, titles: set[str]) -> None:
        self._save_json_set(self._posted_titles_path(), titles)

    def add_posted_titles(self, titles: set[str]) -> None:
        with self._lock:
            existing = self.load_posted_titles()
            existing.update(titles)
            if len(existing) > self._posted_title_cap:
                existing = set(list(existing)[-self._posted_title_cap :])
            self.save_posted_titles(existing)

    def _briefed_ids_path(self) -> str:
        return self._posted_path.replace("posted_ids", "briefed_ids")

    def load_briefed_ids(self) -> set[str]:
        return self._load_json_set(self._briefed_ids_path())

    def save_briefed_ids(self, ids: set[str]) -> None:
        self._save_json_set(self._briefed_ids_path(), ids)

    def add_briefed_ids(self, ids: set[str]) -> None:
        with self._lock:
            existing = self.load_briefed_ids()
            existing.update(ids)
            if len(existing) > self._posted_id_cap:
                existing = set(list(existing)[-self._posted_id_cap :])
            self.save_briefed_ids(existing)


_state: StateBackend | None = None
_state_lock = threading.Lock()


def get_state() -> StateBackend:
    """Return the active state backend (Redis if REDIS_URL set, else File)."""
    global _state
    if _state is not None:
        return _state

    with _state_lock:
        if _state is not None:
            return _state

        redis_url = os.environ.get("REDIS_URL", "").strip()
        if redis_url:
            try:
                _state = RedisState(redis_url)
                return _state
            except Exception:
                logger.exception("Failed to connect to Redis — falling back to file state")

        from newsbot.config import POSTED_LOG, SUBSCRIBERS_LOG

        _state = FileState(SUBSCRIBERS_LOG, POSTED_LOG)
        logger.info("Using file-based state backend.")
        return _state


def reset_state() -> None:
    """Reset the cached state backend (for testing)."""
    global _state
    _state = None


_INSTANCE_LOCK_KEY = f"newsbot:instance_lock:{_LANG_PREFIX}".rstrip(":")
_INSTANCE_LOCK_TTL_SECONDS = 900
_INSTANCE_LOCK_TOKEN = f"{os.getpid()}-{uuid.uuid4().hex}"

_REFRESH_LOCK_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
end
return 0
"""

_RELEASE_LOCK_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
"""


def acquire_instance_lock() -> bool:
    """Try to acquire a distributed single-instance lock via Redis.

    Prevents two long-poll replicas (e.g. overlapping Railway/Render
    deploys) from both polling Telegram and both firing the scheduled
    jobs. Returns False when Redis is configured but unavailable or the
    lock is held by another instance. Without REDIS_URL, returns True
    (local/dev).
    """
    redis_url = os.environ.get("REDIS_URL", "").strip()
    if not redis_url:
        logger.warning("REDIS_URL not set — skipping single-instance guard.")
        return True
    try:
        import redis

        r = redis.Redis.from_url(redis_url, decode_responses=True)
        r.ping()
        # If operator requested to clear stale locks on boot:
        if os.environ.get("CLEAR_INSTANCE_LOCK", "").lower() in ("1", "true", "yes", "on", "force"):
            r.delete(_INSTANCE_LOCK_KEY)
            logger.info("Cleared stale instance lock (%s) via CLEAR_INSTANCE_LOCK env var.", _INSTANCE_LOCK_KEY)

        acquired = r.set(
            _INSTANCE_LOCK_KEY,
            _INSTANCE_LOCK_TOKEN,
            nx=True,
            ex=_INSTANCE_LOCK_TTL_SECONDS,
        )
        if not acquired:
            logger.error(
                "Another bot instance holds the lock (%s) — refusing to start to "
                "prevent duplicate posts. Release it with the TTL or by setting CLEAR_INSTANCE_LOCK=true.",
                _INSTANCE_LOCK_KEY,
            )
            return False
        logger.info("Acquired single-instance lock (%s).", _INSTANCE_LOCK_KEY)
        return True
    except Exception:
        logger.exception(
            "Failed to acquire Redis instance lock — refusing to start "
            "(fail-closed; set REDIS_URL correctly or unset it for local-only)."
        )
        return False


def refresh_instance_lock() -> None:
    """Renew the single-instance lock TTL only if we still own it."""
    redis_url = os.environ.get("REDIS_URL", "").strip()
    if not redis_url:
        return
    try:
        import redis

        r = redis.Redis.from_url(redis_url, decode_responses=True)
        r.eval(
            _REFRESH_LOCK_LUA,
            1,
            _INSTANCE_LOCK_KEY,
            _INSTANCE_LOCK_TOKEN,
            str(_INSTANCE_LOCK_TTL_SECONDS),
        )
    except Exception:
        logger.warning("Failed to refresh Redis instance lock.", exc_info=True)


def release_instance_lock() -> None:
    """Best-effort release of the single-instance lock (owner only)."""
    redis_url = os.environ.get("REDIS_URL", "").strip()
    if not redis_url:
        return
    try:
        import redis

        r = redis.Redis.from_url(redis_url, decode_responses=True)
        r.eval(_RELEASE_LOCK_LUA, 1, _INSTANCE_LOCK_KEY, _INSTANCE_LOCK_TOKEN)
    except Exception:
        logger.debug("Failed to release Redis instance lock.", exc_info=True)
