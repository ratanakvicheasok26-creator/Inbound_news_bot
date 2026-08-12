"""Tests for bot.py — ranking, StoryPost keyboard, and prepare helpers."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from newsbot.bot import (
    StoryPost,
    _rank_clusters,
    _source_keyboard,
    _prepare_entries,
    broadcast_stories,
)
from newsbot.config import DIGEST_MAX_STORIES
from newsbot.feeds import Entry


def _entry(
    id_: str,
    title: str = "Title",
    summary: str = "summary",
    link: str = "http://a.com",
    image_url: str | None = None,
) -> Entry:
    return Entry(
        id=id_,
        title=title,
        summary=summary,
        link=link,
        source_name="Src",
        image_url=image_url,
    )


class TestBotImports:
    def test_import_bot(self):
        from newsbot.bot import fetch_and_post, fetch_urgent_and_post
        assert callable(fetch_and_post)
        assert callable(fetch_urgent_and_post)


class TestRankClusters:
    def test_prefers_multi_source(self):
        single = [_entry("1")]
        multi = [_entry("2"), _entry("3")]
        ranked = _rank_clusters([single, multi])
        assert ranked[0] is multi
        assert ranked[1] is single


class TestSourceKeyboard:
    def test_primary_read_more_button(self):
        post = StoryPost(
            text="x",
            primary_url="https://inbound-news-web.vercel.app/story/abc",
            primary_source="Example",
        )
        markup = _source_keyboard(post)
        assert "Local Lens" in markup.inline_keyboard[0][0].text or "sources" in markup.inline_keyboard[0][0].text
        assert markup.inline_keyboard[0][0].url == "https://inbound-news-web.vercel.app/story/abc"

    def test_no_extra_source_buttons(self):
        post = StoryPost(
            text="x",
            primary_url="https://inbound-news-web.vercel.app/brief/2026-08-05",
            primary_source="Source A",
            extra_urls=["https://b.com", "https://c.com"],
            extra_sources=["Source B", "Source C"],
        )
        markup = _source_keyboard(post)
        assert len(markup.inline_keyboard) == 1
        assert len(markup.inline_keyboard[0]) == 1
        assert "b.com" not in markup.inline_keyboard[0][0].url


class TestPrepareEntries:
    @patch("newsbot.bot.cluster_entries")
    @patch("newsbot.bot.collect_new_entries")
    @patch("newsbot.bot.get_state")
    def test_returns_separate_stories(self, mock_state, mock_collect, mock_cluster):
        mock_state.return_value.load_posted_ids.return_value = set()
        mock_state.return_value.load_posted_titles.return_value = set()
        entry_count = DIGEST_MAX_STORIES + 2  # more entries than the digest cap
        mock_collect.return_value = [_entry(str(i), link=f"http://x.com/{i}") for i in range(entry_count)]
        mock_cluster.return_value = [
            [_entry(str(i), title=f"T{i}", link=f"http://x.com/{i}")] for i in range(entry_count)
        ]

        def fake_rewrite(cluster, urgent=False, header=None):
            return f"<b>{cluster[0].title}</b>\n\nWhat happened: x"

        with patch("newsbot.bot.rewrite_with_ai", side_effect=fake_rewrite) as mock_ai, patch(
            "newsbot.bot.pick_image_url", return_value=None
        ), patch("newsbot.bot.publish_cluster_story", return_value=None), patch(
            "newsbot.bot.time.sleep"
        ):
            stories = _prepare_entries(urgent=False)
        assert len(stories) == DIGEST_MAX_STORIES
        assert all(isinstance(s, StoryPost) for s in stories)
        assert "<b>T0</b>" in stories[0].text
        assert mock_ai.call_count == DIGEST_MAX_STORIES
        assert "/brief/" in stories[0].primary_url
        assert "x.com" not in stories[0].primary_url


class TestPrepareUrgent:
    @patch("newsbot.bot.pick_image_url", return_value=None)
    @patch("newsbot.bot.rewrite_with_ai", return_value="<b>[URGENT: X]</b>")
    @patch("newsbot.bot.looks_urgent")
    @patch("newsbot.bot.cluster_entries")
    @patch("newsbot.bot.collect_new_entries")
    @patch("newsbot.bot.get_state")
    def test_only_urgent_and_skips_posted(
        self, mock_state, mock_collect, mock_cluster, mock_urgent, mock_ai, mock_image
    ):
        mock_state.return_value.load_posted_ids.return_value = {"already"}
        mock_state.return_value.load_posted_titles.return_value = set()
        mock_collect.return_value = [_entry("new1"), _entry("new2")]
        mock_cluster.return_value = [[_entry("new1")], [_entry("new2")]]
        mock_urgent.side_effect = [True, False]

        with patch("newsbot.bot.publish_cluster_story", return_value="story-uuid"):
            stories = _prepare_entries(urgent=True)
        assert len(stories) == 1
        assert stories[0].entry_ids == {"new1"}
        assert stories[0].primary_url.endswith("/story/story-uuid")
        mock_collect.assert_called_once_with({"already"}, set())


def test_broadcast_stories_sends_separately_with_button():
    site = "https://inbound-news-web.vercel.app"
    post1 = StoryPost(
        text="<b>One</b>",
        primary_url=f"{site}/story/1",
        primary_source="Source A",
        entry_ids={"1"},
    )
    post2 = StoryPost(
        text="<b>Two</b>",
        primary_url=f"{site}/story/2",
        primary_source="Source B",
        image_url="https://img.com/x.jpg",
        entry_ids={"2"},
    )

    mock_bot = MagicMock()
    mock_bot.send_message = AsyncMock()
    mock_bot.send_photo = AsyncMock()
    context = MagicMock()
    context.bot = mock_bot

    async def _run():
        with patch("newsbot.bot.TELEGRAM_CHANNEL_ID", -100), patch("newsbot.bot.TELEGRAM_THREAD_ID", None), patch(
            "newsbot.bot.get_state"
        ) as mock_state:
            mock_state.return_value.load_subscribers.return_value = set()
            mock_state.return_value.load_group_threads.return_value = {}
            return await broadcast_stories(context, [post1, post2])

    ids = asyncio.run(_run())

    assert ids == {"1", "2"}
    assert mock_bot.send_message.await_count == 1
    assert mock_bot.send_photo.await_count == 1
    msg_kwargs = mock_bot.send_message.await_args.kwargs
    btn = msg_kwargs["reply_markup"].inline_keyboard[0][0]
    assert "sources" in btn.text.lower() or "lens" in btn.text.lower()
    assert btn.url == f"{site}/story/1"
    photo_kwargs = mock_bot.send_photo.await_args.kwargs
    assert photo_kwargs["photo"] == "https://img.com/x.jpg"
    assert photo_kwargs["reply_markup"].inline_keyboard[0][0].url == f"{site}/story/2"


def test_broadcast_routes_subscribed_group_to_recorded_topic():
    post = StoryPost(
        text="<b>One</b>",
        primary_url="https://inbound-news-web.vercel.app/story/1",
        primary_source="Source A",
        entry_ids={"1"},
    )

    mock_bot = MagicMock()
    mock_bot.send_message = AsyncMock()
    context = MagicMock()
    context.bot = mock_bot

    async def _run():
        with patch("newsbot.bot.TELEGRAM_CHANNEL_ID", -100), patch("newsbot.bot.TELEGRAM_THREAD_ID", None), patch(
            "newsbot.bot.get_state"
        ) as mock_state:
            mock_state.return_value.load_subscribers.return_value = {-100}
            mock_state.return_value.load_group_threads.return_value = {-100: 42}
            return await broadcast_stories(context, [post])

    ids = asyncio.run(_run())

    assert ids == {"1"}
    assert mock_bot.send_message.await_count == 1
    kwargs = mock_bot.send_message.await_args.kwargs
    assert kwargs["chat_id"] == -100
    assert kwargs["message_thread_id"] == 42


class TestTgSend:
    def test_retries_on_retry_after_then_succeeds(self, monkeypatch):
        from telegram.error import RetryAfter

        from newsbot.bot import _tg_send

        monkeypatch.setattr("newsbot.bot._SEND_THROTTLE_SECONDS", 0.0)
        calls = {"n": 0}

        async def flaky(**kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RetryAfter(0)
            return "sent"

        result = asyncio.run(_tg_send(flaky))
        assert result == "sent"
        assert calls["n"] == 2

    def test_forbidden_propagates_immediately(self, monkeypatch):
        from telegram.error import Forbidden

        from newsbot.bot import _tg_send

        monkeypatch.setattr("newsbot.bot._SEND_THROTTLE_SECONDS", 0.0)
        calls = {"n": 0}

        async def blocked(**kwargs):
            calls["n"] += 1
            raise Forbidden("blocked")

        with pytest.raises(Forbidden):
            asyncio.run(_tg_send(blocked))
        assert calls["n"] == 1

    def test_blocks_legacy_empty_slot_cta(self, monkeypatch):
        from newsbot.bot import _tg_send
        from newsbot.brief_cta import LegacyBriefCtaBlocked

        monkeypatch.setattr("newsbot.bot._SEND_THROTTLE_SECONDS", 0.0)
        calls = {"n": 0}

        async def sender(**kwargs):
            calls["n"] += 1
            return "sent"

        with pytest.raises(LegacyBriefCtaBlocked):
            asyncio.run(
                _tg_send(
                    sender,
                    text=(
                        "<b>សេចក្តីសង្ខេបថ្ងៃនេះ (Brief)</b>\n\n"
                        "ព័ត៌មានសំខាន់ៗផ្ញើមកកាន់ឆានែលនេះភ្លាមៗ។"
                    ),
                )
            )
        assert calls["n"] == 0


class TestSafeLink:
    def test_accepts_public_https(self):
        from newsbot.bot import _safe_link

        assert _safe_link("https://example.com/story/1") == "https://example.com/story/1"

    def test_rejects_private_and_bad_schemes(self):
        from newsbot.bot import _safe_link

        assert _safe_link("http://169.254.169.254/latest/meta-data") is None
        assert _safe_link("http://127.0.0.1:8080/") is None
        assert _safe_link("javascript:alert(1)") is None
        assert _safe_link(None) is None
        assert _safe_link(123) is None


class TestPickImageUrl:
    def test_rejects_private_image_and_falls_back_to_og(self):
        from newsbot.ai import pick_image_url
        from newsbot.feeds import Entry

        entry = Entry(
            id="1",
            title="t",
            summary="s",
            link="https://example.com/article",
            source_name="Example",
            image_url="http://169.254.169.254/x.jpg",
        )
        with patch("newsbot.ai._fetch_og_image", return_value="https://cdn.example.com/og.jpg"):
            assert pick_image_url([entry]) == "https://cdn.example.com/og.jpg"

    def test_accepts_valid_public_image(self):
        from newsbot.ai import pick_image_url
        from newsbot.feeds import Entry

        entry = Entry(
            id="1",
            title="t",
            summary="s",
            link="https://example.com/article",
            source_name="Example",
            image_url="https://cdn.example.com/a.jpg",
        )
        assert pick_image_url([entry]) == "https://cdn.example.com/a.jpg"
