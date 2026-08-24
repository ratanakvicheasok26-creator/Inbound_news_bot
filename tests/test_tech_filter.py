"""Tests for the AI tech filter layered on the TECH_ONLY keyword gate."""

from unittest.mock import MagicMock, patch

import pytest

import newsbot.ai as ai_module
import newsbot.bot as bot_module
from newsbot.ai import is_tech_news_ai
from newsbot.feeds import Entry


@pytest.fixture(autouse=True)
def _clear_tech_cache():
    ai_module._TECH_VERDICT_CACHE.clear()
    yield
    ai_module._TECH_VERDICT_CACHE.clear()


def _entry(eid: str = "e1", title: str = "EU bans plastic straws") -> Entry:
    return Entry(
        id=eid,
        title=title,
        summary="Government policy story",
        link="https://example.com/a",
        source_name="Example",
        image_url=None,
    )


def _router_returning(raw: str | None):
    router = MagicMock()
    router.call.return_value = (raw, "gemini")
    return router


class TestIsTechNewsAi:
    def test_true_verdict(self):
        with patch("newsbot.ai.get_router", return_value=_router_returning('{"tech": true}')):
            assert is_tech_news_ai("Google ships AI chip", "hardware launch") is True

    def test_false_verdict(self):
        with patch("newsbot.ai.get_router", return_value=_router_returning('{"tech": false}')):
            assert is_tech_news_ai("EU bans plastic straws", "government policy") is False

    def test_string_verdict_accepted(self):
        with patch("newsbot.ai.get_router", return_value=_router_returning('{"tech": "false"}')):
            assert is_tech_news_ai("t", "s") is False

    def test_none_when_router_returns_none(self):
        with patch("newsbot.ai.get_router", return_value=_router_returning(None)):
            assert is_tech_news_ai("t", "s") is None

    def test_none_on_garbage_output(self):
        with patch("newsbot.ai.get_router", return_value=_router_returning("hello world")):
            assert is_tech_news_ai("t", "s") is None

    def test_none_on_router_exception(self):
        with patch("newsbot.ai.get_router", side_effect=RuntimeError("down")):
            assert is_tech_news_ai("t", "s") is None

    def test_cache_prevents_second_call(self):
        router = _router_returning('{"tech": false}')
        with patch("newsbot.ai.get_router", return_value=router):
            assert is_tech_news_ai("Same Title", "s1") is False
            assert is_tech_news_ai("same title", "s2") is False
        assert router.call.call_count == 1


class TestAiTechGate:
    def test_fail_open_when_ai_unavailable(self):
        cluster = [_entry()]
        with (
            patch.object(bot_module, "TECH_ONLY", True),
            patch.object(bot_module, "TECH_AI_FILTER", True),
            patch.object(bot_module, "NEWS_LANGUAGE", "en"),
            patch.object(bot_module, "is_tech_news_ai", return_value=None),
        ):
            assert bot_module._ai_tech_gate(cluster) is True

    def test_drops_non_tech(self):
        cluster = [_entry()]
        with (
            patch.object(bot_module, "TECH_ONLY", True),
            patch.object(bot_module, "TECH_AI_FILTER", True),
            patch.object(bot_module, "NEWS_LANGUAGE", "en"),
            patch.object(bot_module, "is_tech_news_ai", return_value=False),
        ):
            assert bot_module._ai_tech_gate(cluster) is False

    def test_keeps_tech(self):
        cluster = [_entry(title="New GPU launch")]
        with (
            patch.object(bot_module, "TECH_ONLY", True),
            patch.object(bot_module, "TECH_AI_FILTER", True),
            patch.object(bot_module, "NEWS_LANGUAGE", "en"),
            patch.object(bot_module, "is_tech_news_ai", return_value=True),
        ):
            assert bot_module._ai_tech_gate(cluster) is True

    def test_disabled_flags_keep_story(self):
        cluster = [_entry()]
        with (
            patch.object(bot_module, "TECH_ONLY", True),
            patch.object(bot_module, "TECH_AI_FILTER", False),
            patch.object(bot_module, "is_tech_news_ai") as mock_ai,
        ):
            assert bot_module._ai_tech_gate(cluster) is True
        mock_ai.assert_not_called()

    def test_km_bot_never_gates(self):
        cluster = [_entry()]
        with (
            patch.object(bot_module, "TECH_ONLY", True),
            patch.object(bot_module, "TECH_AI_FILTER", True),
            patch.object(bot_module, "NEWS_LANGUAGE", "km"),
            patch.object(bot_module, "is_tech_news_ai") as mock_ai,
        ):
            assert bot_module._ai_tech_gate(cluster) is True
        mock_ai.assert_not_called()


class TestPrepareEntriesGate:
    """The digest pipeline applies the gate before any rewrite AI calls."""

    def _patches(self, verdict):
        entry = _entry()
        story = MagicMock()
        return (
            patch.object(bot_module, "collect_new_entries", return_value=[entry]),
            patch.object(bot_module, "cluster_entries", return_value=[[entry]]),
            patch.object(bot_module, "get_state"),
            patch.object(bot_module, "is_tech_news_ai", return_value=verdict),
            patch.object(bot_module, "_cluster_to_story", return_value=story),
        )

    def test_non_tech_cluster_dropped_before_rewrite(self):
        p1, p2, p3, p4, p5 = self._patches(False)
        with p1, p2, p3, p4, p5 as m_story:
            stories = bot_module._prepare_entries()
        assert stories == []
        m_story.assert_not_called()

    def test_tech_cluster_survives(self):
        p1, p2, p3, p4, p5 = self._patches(True)
        with p1, p2, p3, p4, p5:
            stories = bot_module._prepare_entries()
        assert len(stories) == 1

    def test_ai_unavailable_falls_through_to_rewrite(self):
        p1, p2, p3, p4, p5 = self._patches(None)
        with p1, p2, p3, p4, p5:
            stories = bot_module._prepare_entries()
        assert len(stories) == 1
