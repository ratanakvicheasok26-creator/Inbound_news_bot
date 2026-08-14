"""Tests for Telegram → website link helpers."""

from newsbot.feeds import Entry
from newsbot.website_links import (
    brief_url,
    reader_url,
    search_url,
    story_url,
    website_base_url,
)


def test_website_base_default(monkeypatch):
    monkeypatch.setenv("WEBSITE_BASE_URL", "https://inbound-news-web.vercel.app")
    assert website_base_url().startswith("https://")


def test_story_brief_and_search_urls(monkeypatch):
    import newsbot.config as cfg

    monkeypatch.setattr(cfg, "WEBSITE_BASE_URL", "https://example.com")
    monkeypatch.setenv("WEBSITE_BASE_URL", "https://example.com")
    assert story_url("abc-123") == "https://example.com/story/abc-123"
    assert "q=Hello%20World" in search_url("Hello World")
    assert reader_url(title="Hi", story_id="x") == "https://example.com/story/x"
    # Fallback is today's brief — not empty search
    assert "/brief/" in reader_url(title="Hi", story_id=None)
    assert brief_url().startswith("https://example.com/brief/")


def test_publish_skipped_without_supabase(monkeypatch):
    from newsbot.website_links import publish_cluster_story

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    cluster = [
        Entry(id="1", title="T", summary="s", link="https://a.com/1", source_name="A"),
    ]
    assert publish_cluster_story(cluster, title="T", summary="s") is None
