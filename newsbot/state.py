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
from abc import ABC, abstractmethod

__all__ = ["StateBackend", "get_state", "reset_state"]

logger = logging.getLogger(__name__)

POSTED_ID_TTL_SECONDS: int = 30 * 24 * 60 * 60

_SUBSCRIBERS_KEY = "newsbot:subscribers"
_POSTED_ID_PREFIX = "newsbot:posted:"
_POSTED_TITLE_PREFIX = "newsbot:posted_title:"


class StateBackend(ABC):
    """Interface for persistent state storage."""

    @abstractmethod
    def load_subscribers(self) -> set[int]: ...

    @abstractmethod
    def save_subscribers(self, ids: set[int]) -> None: ...

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


class FileState(StateBackend):
    """Local JSON file state — for development and non-Redis deployments."""

    def __init__(self, subscribers_path: str, posted_path: str) -> None:
        self._subscribers_path = subscribers_path
        self._posted_path = posted_path
        self._lock = threading.Lock()

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

    def load_posted_ids(self) -> set[str]:
        return self._load_json_set(self._posted_path)

    def save_posted_ids(self, ids: set[str]) -> None:
        self._save_json_set(self._posted_path, ids)

    def add_posted_ids(self, ids: set[str]) -> None:
        with self._lock:
            existing = self.load_posted_ids()
            existing.update(ids)
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
            self.save_posted_titles(existing)


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
