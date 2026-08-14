"""Focused unit tests for workers.dedup helpers (no live Supabase)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from workers.dedup import (
    _EMBED_CHUNK_SIZE,
    _fetch_unprocessed,
    _is_unique_violation,
    _jaccard_similarity,
)


def test_jaccard_identical():
    assert _jaccard_similarity("hello world", "hello world") == 1.0


def test_jaccard_disjoint():
    assert _jaccard_similarity("alpha beta", "gamma delta") == 0.0


def test_jaccard_partial():
    score = _jaccard_similarity("open source ai", "open source software")
    assert 0.0 < score < 1.0


def test_is_unique_violation_detects_common_shapes():
    assert _is_unique_violation(Exception("duplicate key value violates unique constraint"))
    assert _is_unique_violation(Exception("23505"))
    assert _is_unique_violation(Exception("UNIQUE constraint failed"))
    assert not _is_unique_violation(Exception("connection reset"))


def test_embed_chunk_size_is_cohere_safe():
    assert 64 <= _EMBED_CHUNK_SIZE <= 96


class _FakeQuery:
    """Minimal chainable mock for supabase.table(...).select(...).order(...).range(...)."""

    def __init__(self, pages: list[list[dict]]):
        self._pages = pages
        self._page_idx = 0

    def select(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        if self._page_idx < len(self._pages):
            data = self._pages[self._page_idx]
            self._page_idx += 1
            return SimpleNamespace(data=data)
        return SimpleNamespace(data=[])


def test_fetch_unprocessed_paginates_linked_ids_and_filters(monkeypatch):
    """linked_ids must come from *all* story_sources pages, not a single limit."""
    from workers import dedup

    monkeypatch.setattr(dedup, "_FETCH_PAGE_SIZE", 2)

    # Two full pages (size=2) then a short page — proves we keep paging.
    linked_pages = [
        [{"article_id": "a1"}, {"article_id": "a2"}],
        [{"article_id": "a3"}],
    ]
    article_pages = [
        [
            {"id": "a1", "title": "linked"},
            {"id": "a4", "title": "new"},
        ],
        [
            {"id": "a3", "title": "linked"},
            {"id": "a5", "title": "also new"},
        ],
    ]

    story_sources_q = _FakeQuery(linked_pages)
    articles_q = _FakeQuery(article_pages)

    supabase = MagicMock()

    def table(name: str):
        if name == "story_sources":
            return story_sources_q
        if name == "articles":
            return articles_q
        raise AssertionError(f"unexpected table {name}")

    supabase.table.side_effect = table

    result = _fetch_unprocessed(supabase, limit=10)
    ids = [r["id"] for r in result]
    assert ids == ["a4", "a5"]
