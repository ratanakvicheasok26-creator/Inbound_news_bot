"""Tests for bot.py — ranking, StoryPost keyboard, and prepare helpers."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

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
        post = StoryPost(text="x", primary_url="https://example.com/a", primary_source="Example")
        markup = _source_keyboard(post)
        assert markup.inline_keyboard[0][0].text == "Example"
        assert markup.inline_keyboard[0][0].url == "https://example.com/a"

    def test_extra_source_buttons(self):
        post = StoryPost(
            text="x",
            primary_url="https://a.com",
            primary_source="Source A",
            extra_urls=["https://b.com", "https://c.com", "https://d.com"],
            extra_sources=["Source B", "Source C", "Source D"],
        )
        markup = _source_keyboard(post)
        assert len(markup.inline_keyboard) == 2
        assert len(markup.inline_keyboard[1]) == 2
        assert markup.inline_keyboard[1][0].text == "Source B"


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
        ), patch("newsbot.bot.time.sleep"):
            stories = _prepare_entries(urgent=False)
        assert len(stories) == DIGEST_MAX_STORIES
        assert all(isinstance(s, StoryPost) for s in stories)
        assert "<b>T0</b>" in stories[0].text
        assert mock_ai.call_count == DIGEST_MAX_STORIES


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

        stories = _prepare_entries(urgent=True)
        assert len(stories) == 1
        assert stories[0].entry_ids == {"new1"}
        mock_collect.assert_called_once_with({"already"}, set())


def test_broadcast_stories_sends_separately_with_button():
    post1 = StoryPost(text="<b>One</b>", primary_url="https://a.com", primary_source="Source A", entry_ids={"1"})
    post2 = StoryPost(
        text="<b>Two</b>",
        primary_url="https://b.com",
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
            return await broadcast_stories(context, [post1, post2])

    ids = asyncio.run(_run())

    assert ids == {"1", "2"}
    assert mock_bot.send_message.await_count == 1
    assert mock_bot.send_photo.await_count == 1
    msg_kwargs = mock_bot.send_message.await_args.kwargs
    assert msg_kwargs["reply_markup"].inline_keyboard[0][0].text == "Source A"
    photo_kwargs = mock_bot.send_photo.await_args.kwargs
    assert photo_kwargs["photo"] == "https://img.com/x.jpg"
    assert photo_kwargs["reply_markup"].inline_keyboard[0][0].url == "https://b.com"