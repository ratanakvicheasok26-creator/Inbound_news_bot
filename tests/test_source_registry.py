"""Tests for newsbot.source_registry — bot RSS feed budget."""

from newsbot.source_registry import get_bot_rss_feeds


def test_get_bot_rss_feeds_respects_limit():
    requested = 10
    feeds = get_bot_rss_feeds(limit=requested)
    assert len(feeds) <= requested


def test_get_bot_rss_feeds_non_empty_when_yaml_exists():
    feeds = get_bot_rss_feeds(limit=20)
    assert len(feeds) > 0
    assert all(isinstance(u, str) and u.startswith("http") for u in feeds)
