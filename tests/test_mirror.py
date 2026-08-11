"""Tests for mirror.py — queue payloads, publish/drain, and bot mirror handlers."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

from newsbot.ai import KhmerTranslationFailed, MirrorRewriteFailed
from newsbot.bot import (
    BatchedStory,
    StoryPost,
    _cluster_to_batched,
    _cluster_to_story,
    _mirror_batch,
    _mirror_story,
    _publish_mirror_batched,
    _publish_mirror_stories,
    mirror_drain_job,
)
from newsbot.feeds import Entry
from newsbot.mirror import (
    QueuedPayload,
    ack,
    build_batch_payload,
    build_story_payload,
    drain,
    entry_to_payload,
    flush_outbox,
    payload_to_entry,
    publish,
    reclaim_processing,
    requeue,
    settle,
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
    def test_publish_no_redis_uses_outbox(self, tmp_path):
        outbox = tmp_path / "outbox.jsonl"
        with patch.dict("os.environ", {}, clear=True), \
             patch("newsbot.mirror._OUTBOX_PATH", outbox), \
             patch("newsbot.mirror._client") as mock_client:
            assert publish({"kind": "story"}) is True
            mock_client.assert_not_called()
            assert outbox.exists()
            assert "story" in outbox.read_text()

    def test_publish_enqueues_json(self):
        fake = MagicMock()
        fake.llen.return_value = 1
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake), \
             patch("newsbot.mirror.flush_outbox", return_value=0):
            assert publish({"kind": "story", "x": 1}) is True
            fake.rpush.assert_called()
            raw = fake.rpush.call_args[0][1]
            assert '"kind": "story"' in raw

    def test_publish_returns_false_after_retries_writes_recovery(self, tmp_path):
        fake = MagicMock()
        fake.rpush.side_effect = RuntimeError("redis down")
        outbox = tmp_path / "outbox.jsonl"
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake), \
             patch("newsbot.mirror.flush_outbox", return_value=0), \
             patch("newsbot.mirror._OUTBOX_PATH", outbox), \
             patch("newsbot.mirror.time.sleep"):
            assert publish({"kind": "story"}) is False
        assert outbox.exists()

    def test_drain_no_redis_returns_empty(self):
        with patch.dict("os.environ", {}, clear=True):
            assert drain() == []

    def test_drain_claims_via_lua(self):
        fake = MagicMock()
        # reclaim lua + claim lua x3 (2 items + None)
        fake.eval.side_effect = [0, '{"kind": "story"}', '{"kind": "batch"}', None]
        fake.lpop.return_value = None  # deadletter empty
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake):
            items = drain(max_items=10, replay=0)
        assert [i.payload["kind"] for i in items] == ["story", "batch"]
        assert all(isinstance(i, QueuedPayload) for i in items)

    def test_drain_parks_invalid_in_deadletter(self):
        fake = MagicMock()
        fake.eval.side_effect = [0, "not json", '{"kind": "story"}', None]
        fake.lpop.return_value = None
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake):
            items = drain(max_items=10, replay=0)
        assert [i.payload["kind"] for i in items] == ["story"]
        assert any(
            c.args and c.args[0] == "newsbot:mirror:deadletter"
            for c in fake.rpush.call_args_list
        )

    def test_ack_removes_from_processing(self):
        fake = MagicMock()
        pipe = MagicMock()
        fake.pipeline.return_value = pipe
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake):
            assert ack('{"kind": "story"}') is True
        pipe.lrem.assert_called_once()
        pipe.hdel.assert_called_once()
        pipe.execute.assert_called_once()

    def test_settle_success_acks_only(self):
        with patch("newsbot.mirror.ack", return_value=True) as mock_ack, \
             patch("newsbot.mirror.requeue") as mock_requeue:
            assert settle({"kind": "story"}, "raw", success=True) is True
            mock_ack.assert_called_once_with("raw")
            mock_requeue.assert_not_called()

    def test_settle_failure_requires_park_before_ack(self):
        with patch("newsbot.mirror.requeue", return_value=False) as mock_requeue, \
             patch("newsbot.mirror.ack") as mock_ack:
            assert settle({"kind": "story"}, "raw", success=False) is False
            mock_requeue.assert_called_once()
            mock_ack.assert_not_called()

    def test_settle_poison_deadletters(self):
        with patch("newsbot.mirror.deadletter", return_value=True) as mock_dl, \
             patch("newsbot.mirror.ack", return_value=True) as mock_ack:
            assert settle({"kind": "story"}, "raw", success=False, poison=True) is True
            mock_dl.assert_called_once()
            mock_ack.assert_called_once_with("raw")

    def test_reclaim_processing_uses_lua(self):
        fake = MagicMock()
        fake.eval.return_value = 2
        fake.llen.return_value = 2
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._client", return_value=fake):
            assert reclaim_processing() == 2

    def test_flush_outbox_pushes_to_redis(self, tmp_path):
        outbox = tmp_path / "outbox.jsonl"
        outbox.write_text('{"kind": "story", "id": 1}\n', encoding="utf-8")
        fake = MagicMock()
        fake.llen.return_value = 1
        with patch.dict("os.environ", {"REDIS_URL": "redis://x"}), \
             patch("newsbot.mirror._OUTBOX_PATH", outbox), \
             patch("newsbot.mirror._client", return_value=fake):
            assert flush_outbox() == 1
        assert not outbox.exists()
        fake.rpush.assert_called()


class TestMirrorPublishGating:
    def test_english_publishes_stories(self):
        e = _entry()
        post = StoryPost(
            text="X", primary_url="u", primary_source="Src",
            entries=[e], entry_ids={e.id},
        )
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "en"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.publish", return_value=True) as mock_publish:
            _publish_mirror_stories([post], {e.id})
            mock_publish.assert_called_once()

    def test_english_logs_when_publish_fails(self):
        e = _entry()
        post = StoryPost(
            text="X", primary_url="u", primary_source="Src",
            entries=[e], entry_ids={e.id},
        )
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "en"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.publish", return_value=False), \
             patch("newsbot.bot.logger") as mock_logger:
            _publish_mirror_stories([post], {e.id})
            mock_logger.error.assert_called()

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
             patch("newsbot.bot.publish", return_value=True) as mock_publish:
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
             patch("newsbot.bot._mirror_already_posted", return_value=False), \
             patch("newsbot.bot._cluster_to_story") as mock_cluster, \
             patch("newsbot.bot.broadcast_stories", new=AsyncMock()) as mock_broadcast, \
             patch("newsbot.bot._mark_posted") as mock_mark:
            mock_cluster.return_value = StoryPost(
                text="<b>Khmer</b>", primary_url="u", primary_source="Src",
                entries=[e], entry_ids={e.id},
            )
            mock_broadcast.return_value = {e.id}
            assert await _mirror_story(MagicMock(), self._story_payload()) == (True, False)
            mock_cluster.assert_called_once()
            mock_broadcast.assert_awaited_once()
            mock_mark.assert_called_once()

    async def test_mirror_story_poison_empty_cluster(self):
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}):
            assert await _mirror_story(MagicMock(), {"kind": "story", "cluster": []}) == (
                False,
                True,
            )

    async def test_mirror_story_requeues_when_rewrite_none(self):
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot._mirror_already_posted", return_value=False), \
             patch("newsbot.bot._cluster_to_story", return_value=None), \
             patch("newsbot.bot.broadcast_stories", new=AsyncMock()) as mock_broadcast:
            assert await _mirror_story(MagicMock(), self._story_payload()) == (False, False)
            mock_broadcast.assert_not_called()

    async def test_mirror_story_idempotent_skip(self):
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot._mirror_already_posted", return_value=True), \
             patch("newsbot.bot._cluster_to_story") as mock_cluster, \
             patch("newsbot.bot.broadcast_stories", new=AsyncMock()) as mock_broadcast:
            assert await _mirror_story(MagicMock(), self._story_payload()) == (True, False)
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
             patch("newsbot.bot._mirror_already_posted", return_value=False), \
             patch("newsbot.bot._cluster_to_batched") as mock_cluster, \
             patch("newsbot.bot.broadcast_batched", new=AsyncMock()) as mock_broadcast, \
             patch("newsbot.bot._mark_posted_batched") as mock_mark:
            mock_cluster.return_value = BatchedStory(
                title="T", summary="S", source_line="Src", website_url="u",
                entries=[_entry("e1")], entry_ids={"e1"},
            )
            mock_broadcast.return_value = {"e1"}
            assert await _mirror_batch(MagicMock(), payload) == (True, False)
            mock_cluster.assert_called_once()
            mock_broadcast.assert_awaited_once()
            mock_mark.assert_called_once()

    async def test_mirror_batch_requeues_partial(self):
        payload = {
            "kind": "batch",
            "stories": [
                {"cluster": [entry_to_payload(_entry("e1"))], "website_url": "http://a"},
                {"cluster": [entry_to_payload(_entry("e2"))], "website_url": "http://b"},
            ],
        }
        good = BatchedStory(
            title="T", summary="S", source_line="Src", website_url="u",
            entries=[_entry("e1")], entry_ids={"e1"},
        )
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot._mirror_already_posted", return_value=False), \
             patch("newsbot.bot._cluster_to_batched", side_effect=[good, None]), \
             patch("newsbot.bot.broadcast_batched", new=AsyncMock()) as mock_broadcast:
            assert await _mirror_batch(MagicMock(), payload) == (False, False)
            mock_broadcast.assert_not_called()

    async def test_mirror_drain_skips_non_km(self):
        context = MagicMock()
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "en"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.drain") as mock_drain:
            await mirror_drain_job(context)
            mock_drain.assert_not_called()

    async def test_mirror_drain_settles_on_khmer_failure(self):
        payload = self._story_payload()
        raw = json.dumps(payload)
        item = QueuedPayload(payload=payload, raw=raw)
        context = MagicMock()
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.drain", return_value=[item]), \
             patch("newsbot.bot._mirror_story", side_effect=KhmerTranslationFailed("no km")), \
             patch("newsbot.bot.settle") as mock_settle:
            mock_settle.return_value = True
            await mirror_drain_job(context)
            mock_settle.assert_called_once_with(
                payload, raw, success=False, poison=False
            )

    async def test_mirror_drain_settles_success(self):
        payload = self._story_payload()
        raw = json.dumps(payload)
        item = QueuedPayload(payload=payload, raw=raw)
        context = MagicMock()
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot.mirror_available", return_value=True), \
             patch("newsbot.bot.drain", return_value=[item]), \
             patch("newsbot.bot._mirror_story", new=AsyncMock(return_value=(True, False))), \
             patch("newsbot.bot.settle", return_value=True) as mock_settle:
            await mirror_drain_job(context)
            mock_settle.assert_called_once_with(
                payload, raw, success=True, poison=False
            )

    async def test_mirror_story_requeues_when_send_fails(self):
        e = _entry("e1")
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot._mirror_already_posted", return_value=False), \
             patch("newsbot.bot._cluster_to_story") as mock_cluster, \
             patch("newsbot.bot.broadcast_stories", new=AsyncMock(return_value=set())):
            mock_cluster.return_value = StoryPost(
                text="<b>Khmer</b>", primary_url="u", primary_source="Src",
                entries=[e], entry_ids={e.id},
            )
            assert await _mirror_story(MagicMock(), self._story_payload()) == (False, False)


class TestMirrorRewriteRaise:
    def test_km_story_rewrite_raises(self):
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot.rewrite_with_ai", side_effect=RuntimeError("boom")):
            try:
                _cluster_to_story([_entry()], urgent=False)
                assert False, "expected MirrorRewriteFailed"
            except MirrorRewriteFailed:
                pass

    def test_en_story_rewrite_returns_none(self):
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "en"}), \
             patch("newsbot.bot.rewrite_with_ai", side_effect=RuntimeError("boom")):
            assert _cluster_to_story([_entry()], urgent=False) is None

    def test_km_batch_rewrite_raises(self):
        with patch.dict("newsbot.bot.__dict__", {"NEWS_LANGUAGE": "km"}), \
             patch("newsbot.bot.rewrite_compact_khmer", side_effect=RuntimeError("boom")):
            try:
                _cluster_to_batched([_entry()])
                assert False, "expected MirrorRewriteFailed"
            except MirrorRewriteFailed:
                pass


class TestMirrorRequeue:
    def test_requeue_increments_attempts(self):
        mock_client = MagicMock()
        mock_client.llen.return_value = 1
        with patch("newsbot.mirror.mirror_available", return_value=True), \
             patch("newsbot.mirror._client", return_value=mock_client):
            assert requeue({"kind": "story"}) is True
            raw = mock_client.rpush.call_args[0][1]
            assert json.loads(raw)["_attempts"] == 1

    def test_requeue_deadletters_after_max(self):
        mock_client = MagicMock()
        mock_client.llen.return_value = 1
        with patch("newsbot.mirror.mirror_available", return_value=True), \
             patch("newsbot.mirror._client", return_value=mock_client):
            assert requeue({"kind": "story", "_attempts": 5}) is True
            assert mock_client.rpush.call_args[0][0] == "newsbot:mirror:deadletter"
