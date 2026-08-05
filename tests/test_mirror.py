"""Tests for mirror.py — queue payloads, publish/drain, and bot mirror handlers."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from newsbot.bot import (
    BatchedStory,
    StoryPost,
    _mark_posted,
    _mirror_batch,
    _mirror_story,
    _publish_mirror_batched,
    _publish_mirror_stories,
    broadcast_batched,
    broadcast_stories,
    mirror_drain_job,
)
from newsbot.feeds import Entry
from newsbot.mirror import (
    build_batch_payload,
    build_story_payload,
    drain,
    entry_to_payload,
    payload_to_entry,
    publish,
)


def _entry(id_: str = "e1", title: str = "Title", link: str = "http://a.com") -> Entry:
    return Entry(
        id=id_,
        title=title,
        summary="summary",
        link=link,
        source_name="Src",
        image_url=None,
    )


class TestMirrorSerialization:
    def test_entry_roundtrip(self):
        e = _entry()
        payload = entry_to_payload(e)
        back = payload_to_entry(payload)
        assert back.id == e.id
        assert back.title == e.title
        assert back.summary == e.summary
        assert back.link == e.link
        assert back.source_name == e.source_name
        assert back.image_url == e.image_url

    def test_story_payload(self):
        e = _entry()
        post = StoryPost(
            text="<b>X</b>",
            primary_url="http://site/story/1",
            primary_source="Src",
            entries=[e],
            urgent=True,
            entry_ids={e.id},
            entry_titles={e.title},
        )
        payload = build_story_payload(post)
        assert payload["kind"] == "story"
        assert payload["urgent"] is True
        assert payload["website_url"] == "http://site/story/1"
        assert payload["cluster"][0]["id"] == "e1"

    def test_batch_payload(self):
        s = BatchedStory(
            title="T",
            summary="S",
            source_line="Src",
            website_url="http://site/story/1",
            entries=[_entry()],
        )
        payload = build_batch_payload([s])
        assert payload["kind"] == "batch"
        assert len(payload["stories"]) == 1
        assert payload["stories"][0]["website_url"] == "http://site/story/1"


class TestMirrorQueue:
    def test_publish_no_redis_is_noop(self):
        with patch.dict("os.environ", {}, clear=True), \
             patch("newsbot.mirror._client") as mock_client:
            publish({"kind": "story"})
            mock_client.assert_not_called()

    def test_publish_enqueues_json(self):
        fake = MagicMock()
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake):
            publish({"kind": "story", "x": 1})
            fake.rpush.assert_called_once()
            raw = fake.rpush.call_args[0][1]
            assert '"kind": "story"' in raw

    def test_drain_no_redis_returns_empty(self):
        with patch.dict("os.environ", {}, clear=True):
            assert drain() == []

    def test_drain_pops_payloads(self):
        fake = MagicMock()
        fake.lpop.side_effect = ['{"kind": "story"}', '{"kind": "batch"}', None]
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake):
            payloads = drain(max_items=10)
        assert [p["kind"] for p in payloads] == ["story", "batch"]
        assert fake.lpop.call_count == 3

    def test_drain_drops_invalid_items(self):
        fake = MagicMock()
        fake.lpop.side_effect = ["not json", '{"kind": "story"}', None]
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake):
            payloads = drain(max_items=10)
        assert [p["kind"] for p in payloads] == ["story"]


class TestMirrorPublishGating:
    def test_english_publishes_stories(self):
        e = _entry()
        post = StoryPost(
            text="X", primary_url="u", primary_source="Src",
            entries=[e], entry_ids={e.id},
        )
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "en"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.publish") as mock_publish:
            _publish_mirror_stories([post], {e.id})
            mock_publish.assert_called_once()

    def test_khmer_does_not_publish(self):
        e = _entry()
        post = StoryPost(
            text="X", primary_url="u", primary_source="Src",
            entries=[e], entry_ids={e.id},
        )
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.publish") as mock_publish:
            _publish_mirror_stories([post], {e.id})
            mock_publish.assert_not_called()

    def test_skips_unposted_stories(self):
        e = _entry()
        post = StoryPost(
            text="X", primary_url="u", primary_source="Src",
            entries=[e], entry_ids={e.id},
        )
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "en"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.publish") as mock_publish:
            _publish_mirror_stories([post], {"other-id"})
            mock_publish.assert_not_called()

    def test_english_publishes_batch(self):
        s = BatchedStory(
            title="T", summary="S", source_line="Src", website_url="u",
            entries=[_entry()],
        )
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "en"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.publish") as mock_publish:
            _publish_mirror_batched([s])
            mock_publish.assert_called_once()


class TestMirrorHandlers:
    def _story_payload(self):
        return {
            "kind": "story",
            "urgent": True,
            "website_url": "http://site/story/1",
            "cluster": [entry_to_payload(_entry("e1"))],
        }

    async def test_mirror_story_posts_and_marks(self):
        e = _entry("e1")
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot._cluster_to_story") as mock_cluster, \
             patch("newsbot.bot.broadcast_stories", new=AsyncMock()) as mock_broadcast, \
             patch("newsbot.bot._mark_posted") as mock_mark:
            mock_cluster.return_value = StoryPost(
                text="<b>Khmer</b>", primary_url="u", primary_source="Src",
                entries=[e], entry_ids={e.id},
            )
            mock_broadcast.return_value = {e.id}
            await _mirror_story(MagicMock(), self._story_payload())
            mock_cluster.assert_called_once()
            mock_broadcast.assert_awaited_once()
            mock_mark.assert_called_once()

    async def test_mirror_story_skips_empty_cluster(self):
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot._cluster_to_story") as mock_cluster, \
             patch("newsbot.bot.broadcast_stories", new=AsyncMock()) as mock_broadcast:
            await _mirror_story(MagicMock(), {"kind": "story", "cluster": []})
            mock_cluster.assert_not_called()
            mock_broadcast.assert_not_called()

    async def test_mirror_batch_posts(self):
        payload = {
            "kind": "batch",
            "stories": [
                {"cluster": [entry_to_payload(_entry("e1"))], "website_url": "http://site/story/1"}
            ],
        }
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot._cluster_to_batched") as mock_cluster, \
             patch("newsbot.bot.broadcast_batched", new=AsyncMock()) as mock_broadcast, \
             patch("newsbot.bot._mark_posted_batched") as mock_mark:
            mock_cluster.return_value = BatchedStory(
                title="T", summary="S", source_line="Src", website_url="u",
                entries=[_entry("e1")], entry_ids={"e1"},
            )
            mock_broadcast.return_value = {"e1"}
            await _mirror_batch(MagicMock(), payload)
            mock_cluster.assert_called_once()
            mock_broadcast.assert_awaited_once()
            mock_mark.assert_called_once()

    async def test_mirror_drain_skips_non_km(self):
        context = MagicMock()
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "en"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.drain") as mock_drain:
            await mirror_drain_job(context)
            mock_drain.assert_not_called()
