"""Supabase Daily Brief inventory: window, skip-briefed, assembly."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from newsbot.brief_inventory import (
    SiteBriefStory,
    assemble_site_stories,
    is_site_story_briefed,
    load_site_brief_stories,
    previous_brief_slot_start,
    story_brief_id,
    supabase_ready,
)
from newsbot.feeds import Entry
from newsbot.mirror import build_batch_payload

TZ = ZoneInfo("Asia/Phnom_Penh")
HOURS = (6, 12, 18, 22)


def test_story_brief_id_prefix():
    assert story_brief_id("abc-123") == "story:abc-123"


def test_supabase_ready(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    assert supabase_ready({}) is False
    assert supabase_ready({"SUPABASE_URL": "https://x.supabase.co"}) is False
    assert (
        supabase_ready(
            {
                "SUPABASE_URL": "https://x.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "secret",
            }
        )
        is True
    )


def test_previous_slot_at_6am_is_10pm_yesterday():
    now = datetime(2026, 8, 12, 6, 0, tzinfo=TZ)
    start = previous_brief_slot_start(now, hours=HOURS, tz=TZ)
    assert start == datetime(2026, 8, 11, 22, 0, tzinfo=TZ)


def test_previous_slot_during_6am_hour():
    now = datetime(2026, 8, 12, 6, 15, tzinfo=TZ)
    start = previous_brief_slot_start(now, hours=HOURS, tz=TZ)
    assert start == datetime(2026, 8, 11, 22, 0, tzinfo=TZ)


def test_previous_slot_at_noon_is_6am_today():
    now = datetime(2026, 8, 12, 12, 0, tzinfo=TZ)
    start = previous_brief_slot_start(now, hours=HOURS, tz=TZ)
    assert start == datetime(2026, 8, 12, 6, 0, tzinfo=TZ)


def test_previous_slot_mid_morning_is_6am():
    now = datetime(2026, 8, 12, 9, 30, tzinfo=TZ)
    start = previous_brief_slot_start(now, hours=HOURS, tz=TZ)
    assert start == datetime(2026, 8, 12, 6, 0, tzinfo=TZ)


def test_is_site_story_briefed_by_story_or_article():
    assert is_site_story_briefed("s1", {"a1"}, {"story:s1"})
    assert is_site_story_briefed("s1", {"a1"}, {"a1"})
    assert not is_site_story_briefed("s1", {"a1"}, {"story:other"})


def test_assemble_skips_already_briefed_story():
    stories = [
        {"id": "s1", "title": "One", "summary_en": "A", "image_url": None},
        {"id": "s2", "title": "Two", "summary_en": "B", "image_url": "https://img/x.jpg"},
    ]
    sources = [
        {"story_id": "s1", "article_id": "a1", "source_name": "Src1", "source_url": "https://a1.example"},
        {"story_id": "s2", "article_id": "a2", "source_name": "Src2", "source_url": "https://a2.example"},
    ]
    articles = [
        {"id": "a1", "title": "One", "summary": "A", "url": "https://a1.example", "source_name": "Src1"},
        {"id": "a2", "title": "Two", "summary": "B", "url": "https://a2.example", "source_name": "Src2"},
    ]
    assembled = assemble_site_stories(stories, sources, articles, {"story:s1"})
    assert [s.story_id for s in assembled] == ["s2"]
    assert "story:s2" in assembled[0].entry_ids
    assert "a2" in assembled[0].entry_ids
    assert assembled[0].entries[0].link == "https://a2.example"


def test_assemble_synthetic_entry_when_no_articles():
    stories = [{"id": "s9", "title": "Lonely", "summary_en": "Only me", "image_url": None}]
    assembled = assemble_site_stories(stories, [], [], set())
    assert len(assembled) == 1
    assert assembled[0].entries[0].id == "story:s9"
    assert "/story/s9" in assembled[0].entries[0].link


def test_load_site_brief_stories_uses_client_and_filters(monkeypatch):
    class _Result:
        def __init__(self, data):
            self.data = data

    class _Query:
        def __init__(self, table, store):
            self._table = table
            self._store = store

        def select(self, *_a, **_k):
            return self

        def gte(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def in_(self, *_a, **_k):
            return self

        def execute(self):
            return _Result(self._store.get(self._table, []))

    class _Client:
        def __init__(self, store):
            self._store = store

        def table(self, name):
            return _Query(name, self._store)

    store = {
        "stories": [
            {
                "id": "keep",
                "title": "Keep Me",
                "summary_en": "Fresh",
                "source_count": 3,
                "created_at": "2026-08-12T01:00:00+07:00",
                "image_url": None,
            },
            {
                "id": "skip",
                "title": "Already Briefed",
                "summary_en": "Old",
                "source_count": 5,
                "created_at": "2026-08-12T02:00:00+07:00",
                "image_url": None,
            },
        ],
        "story_sources": [
            {"story_id": "keep", "article_id": "ak", "source_name": "K", "source_url": "https://k.example"},
            {"story_id": "skip", "article_id": "as", "source_name": "S", "source_url": "https://s.example"},
        ],
        "articles": [
            {"id": "ak", "title": "Keep Me", "summary": "Fresh", "url": "https://k.example", "source_name": "K"},
            {"id": "as", "title": "Already Briefed", "summary": "Old", "url": "https://s.example", "source_name": "S"},
        ],
    }
    now = datetime(2026, 8, 12, 6, 0, tzinfo=TZ)
    out = load_site_brief_stories(
        briefed_ids={"story:skip"},
        now=now,
        hours=HOURS,
        tz=TZ,
        client=_Client(store),
    )
    assert [s.story_id for s in out] == ["keep"]


def test_load_returns_empty_without_supabase(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    assert load_site_brief_stories(briefed_ids=set()) == []


def test_mirror_payload_includes_clusters_from_site_story():
    story = SiteBriefStory(
        story_id="s1",
        title="Alpha",
        summary="Summary",
        entries=[
            Entry(
                id="a1",
                title="Alpha",
                summary="Summary",
                link="https://a.example/1",
                source_name="Src",
            )
        ],
    )
    from newsbot.bot import _site_stories_to_batched

    batched = _site_stories_to_batched([story])
    payload = build_batch_payload(batched)
    assert payload["kind"] == "batch"
    assert payload["stories"][0]["cluster"][0]["id"] == "a1"
    assert "/story/s1" in batched[0].website_url
