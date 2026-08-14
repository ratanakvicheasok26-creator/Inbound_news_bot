"""Daily Brief schedule, captions, and batched message format."""

from __future__ import annotations

import importlib

import pytest

from newsbot.bot import BatchedStory


@pytest.fixture
def reload_config(monkeypatch):
    def _reload(**env: str):
        for key, value in env.items():
            if value is None:
                monkeypatch.delenv(key, raising=False)
            else:
                monkeypatch.setenv(key, value)
        import newsbot.config as cfg
        from newsbot import feeds

        cfg = importlib.reload(cfg)
        importlib.reload(feeds)
        return cfg

    yield _reload
    monkeypatch.setenv("NEWS_LANGUAGE", "en")
    import newsbot.config as cfg
    from newsbot import feeds

    importlib.reload(cfg)
    importlib.reload(feeds)


def test_brief_hours_default(reload_config):
    cfg = reload_config(BRIEF_SCHEDULE_HOURS="6,12,18,22")
    assert cfg.BRIEF_SCHEDULE_HOURS == (6, 12, 18, 22)


def test_brief_hours_parse_custom(reload_config):
    cfg = reload_config(BRIEF_SCHEDULE_HOURS="6,18")
    assert cfg.BRIEF_SCHEDULE_HOURS == (6, 18)


def test_brief_button_label_english(reload_config):
    cfg = reload_config(NEWS_LANGUAGE="en")
    assert cfg.brief_button_label() == "Open today's Brief →"


def test_brief_button_label_khmer(reload_config):
    cfg = reload_config(NEWS_LANGUAGE="km")
    assert "បើក Brief" in cfg.brief_button_label()


def test_digest_header_plain_default(reload_config):
    cfg = reload_config(DIGEST_HEADER_TEXT="")
    assert cfg.DIGEST_HEADER_TEXT == "Inbound Reports"
    assert "📰" not in cfg.DIGEST_HEADER_TEXT


def test_digest_header_strips_legacy_emoji_html(reload_config):
    cfg = reload_config(DIGEST_HEADER_TEXT="📰 <b>Inbound Reports</b>")
    assert cfg.DIGEST_HEADER_TEXT == "Inbound Reports"


def test_digest_header_rejects_legacy_cta_title(reload_config):
    cfg = reload_config(DIGEST_HEADER_TEXT="សេចក្តីសង្ខេបថ្ងៃនេះ (Brief)")
    assert cfg.DIGEST_HEADER_TEXT == "Inbound Reports"
    cfg = reload_config(DIGEST_HEADER_TEXT="Today's Brief")
    assert cfg.DIGEST_HEADER_TEXT == "Inbound Reports"


def test_compile_batch_message_format(monkeypatch):
    import newsbot.bot as bot_mod

    monkeypatch.setattr(bot_mod, "DIGEST_HEADER_TEXT", "Inbound Reports")

    batched = [
        BatchedStory(
            title="Story One",
            summary="First summary about AI safety research.",
            source_line='<a href="https://a.example">Source A</a>',
            website_url="https://example.com/brief/2026-08-10",
        ),
        BatchedStory(
            title="Story Two",
            summary="Second summary with enough detail for a tease.",
            source_line='<a href="https://b.example">Source B</a>',
            website_url="https://example.com/brief/2026-08-10",
        ),
    ]
    msg = bot_mod._compile_batch_message(batched)
    assert msg.count("📰") == 1
    assert "Inbound Reports" in msg
    assert "Tease only" in msg
    assert "🔹" in msg
    assert "Story One" in msg
    assert "Story Two" in msg
    assert "Open today's Brief on Inbound Reports" in msg
    assert "/brief/" in msg
    from newsbot.brief_cta import is_legacy_brief_cta

    assert not is_legacy_brief_cta(msg)


def test_batched_brief_uses_briefed_not_posted():
    """ASAP-posted IDs still batch when not yet briefed."""
    import asyncio
    from unittest.mock import AsyncMock, MagicMock, patch

    from newsbot.bot import BatchedStory, _run_batched_pipeline
    from newsbot.feeds import Entry

    def _e(id_: str, title: str) -> Entry:
        return Entry(
            id=id_,
            title=title,
            summary="summary",
            link=f"http://x/{id_}",
            source_name="Src",
        )

    e1, e2 = _e("a", "Alpha News Story"), _e("b", "Beta News Story")
    state = MagicMock()
    state.load_briefed_ids.return_value = set()
    state.load_posted_ids.return_value = {"a", "b"}  # already ASAP-posted

    batched = [
        BatchedStory(
            title="Alpha",
            summary="A",
            source_line="Src",
            website_url="http://u/a",
            entries=[e1],
            entry_ids={"a"},
            entry_titles={"Alpha News Story"},
        ),
        BatchedStory(
            title="Beta",
            summary="B",
            source_line="Src",
            website_url="http://u/b",
            entries=[e2],
            entry_ids={"b"},
            entry_titles={"Beta News Story"},
        ),
    ]

    with patch("newsbot.bot.get_state", return_value=state), \
         patch("newsbot.bot.load_site_brief_stories", return_value=[]), \
         patch("newsbot.bot.collect_new_entries", return_value=[e1, e2]) as mock_collect, \
         patch("newsbot.bot.cluster_entries", return_value=[[e1], [e2]]), \
         patch("newsbot.bot._rank_clusters", side_effect=lambda c: c), \
         patch("newsbot.bot._cluster_to_batched", side_effect=batched), \
         patch("newsbot.bot.broadcast_batched", new=AsyncMock(return_value={"a", "b"})), \
         patch("newsbot.bot._publish_mirror_batched") as mock_mirror:
        n = asyncio.run(_run_batched_pipeline(MagicMock()))

    assert n == 2
    mock_collect.assert_called_once_with(set(), set())
    state.add_briefed_ids.assert_called()
    briefed_arg = state.add_briefed_ids.call_args[0][0]
    assert briefed_arg == {"a", "b"}
    mock_mirror.assert_called_once()


def test_batched_brief_skips_already_briefed():
    import asyncio
    from unittest.mock import MagicMock, patch

    from newsbot.bot import _run_batched_pipeline

    state = MagicMock()
    state.load_briefed_ids.return_value = {"a", "b", "c"}
    state.load_posted_ids.return_value = {"a", "b", "c"}

    with patch("newsbot.bot.get_state", return_value=state), \
         patch("newsbot.bot.load_site_brief_stories", return_value=[]), \
         patch("newsbot.bot.collect_new_entries", return_value=[]) as mock_collect:
        n = asyncio.run(_run_batched_pipeline(MagicMock()))

    assert n == 0
    mock_collect.assert_called_once_with({"a", "b", "c"}, set())


def test_batched_brief_prefers_supabase_skips_rss():
    import asyncio
    from unittest.mock import AsyncMock, MagicMock, patch

    from newsbot.bot import _run_batched_pipeline
    from newsbot.brief_inventory import SiteBriefStory
    from newsbot.feeds import Entry
    from newsbot.mirror import build_batch_payload

    e1 = Entry(id="a1", title="Alpha", summary="A", link="https://a.example", source_name="SrcA")
    e2 = Entry(id="a2", title="Beta", summary="B", link="https://b.example", source_name="SrcB")
    site = [
        SiteBriefStory(story_id="s1", title="Alpha", summary="A", entries=[e1]),
        SiteBriefStory(story_id="s2", title="Beta", summary="B", entries=[e2]),
    ]
    state = MagicMock()
    state.load_briefed_ids.return_value = set()
    state.load_posted_ids.return_value = set()

    with patch("newsbot.bot.get_state", return_value=state), \
         patch("newsbot.bot.load_site_brief_stories", return_value=site) as mock_site, \
         patch("newsbot.bot.collect_new_entries") as mock_collect, \
         patch("newsbot.bot.broadcast_batched", new=AsyncMock(return_value={"story:s1", "a1", "story:s2", "a2"})) as mock_broadcast, \
         patch("newsbot.bot._publish_mirror_batched") as mock_mirror:
        n = asyncio.run(_run_batched_pipeline(MagicMock()))

    assert n == 2
    mock_site.assert_called_once()
    mock_collect.assert_not_called()
    mock_broadcast.assert_awaited_once()
    batched = mock_broadcast.await_args.args[1]
    payload = build_batch_payload(batched)
    assert payload["stories"][0]["cluster"]
    assert payload["stories"][1]["cluster"]
    mock_mirror.assert_called_once()
    briefed = state.add_briefed_ids.call_args[0][0]
    assert "story:s1" in briefed
    assert "story:s2" in briefed


def test_batched_brief_rss_fallback_when_supabase_empty():
    import asyncio
    from unittest.mock import AsyncMock, MagicMock, patch

    from newsbot.bot import BatchedStory, _run_batched_pipeline
    from newsbot.feeds import Entry

    e1 = Entry(id="r1", title="Rss One Story", summary="s", link="http://r/1", source_name="R")
    e2 = Entry(id="r2", title="Rss Two Story", summary="s", link="http://r/2", source_name="R")
    state = MagicMock()
    state.load_briefed_ids.return_value = set()
    state.load_posted_ids.return_value = set()
    rss_batched = [
        BatchedStory(title="Rss One", summary="s", source_line="R", website_url="http://u/1",
                     entries=[e1], entry_ids={"r1"}, entry_titles={"Rss One Story"}),
        BatchedStory(title="Rss Two", summary="s", source_line="R", website_url="http://u/2",
                     entries=[e2], entry_ids={"r2"}, entry_titles={"Rss Two Story"}),
    ]

    with patch("newsbot.bot.get_state", return_value=state), \
         patch("newsbot.bot.load_site_brief_stories", return_value=[]), \
         patch("newsbot.bot.collect_new_entries", return_value=[e1, e2]) as mock_collect, \
         patch("newsbot.bot.cluster_entries", return_value=[[e1], [e2]]), \
         patch("newsbot.bot._rank_clusters", side_effect=lambda c: c), \
         patch("newsbot.bot._cluster_to_batched", side_effect=rss_batched), \
         patch("newsbot.bot.broadcast_batched", new=AsyncMock(return_value={"r1", "r2"})), \
         patch("newsbot.bot._publish_mirror_batched"):
        n = asyncio.run(_run_batched_pipeline(MagicMock()))

    assert n == 2
    mock_collect.assert_called_once_with(set(), set())


def test_batched_brief_rss_fallback_when_supabase_errors():
    import asyncio
    from unittest.mock import MagicMock, patch

    from newsbot.bot import _run_batched_pipeline

    state = MagicMock()
    state.load_briefed_ids.return_value = set()
    state.load_posted_ids.return_value = set()

    with patch("newsbot.bot.get_state", return_value=state), \
         patch("newsbot.bot.load_site_brief_stories", side_effect=RuntimeError("db down")), \
         patch("newsbot.bot.collect_new_entries", return_value=[]) as mock_collect:
        n = asyncio.run(_run_batched_pipeline(MagicMock()))

    assert n == 0
    mock_collect.assert_called_once()


_KM_EMPTY_SLOT_CTA = (
    "<b>សេចក្តីសង្ខេបថ្ងៃនេះ (Brief)</b>\n\n"
    "ព័ត៌មានសំខាន់ៗផ្ញើមកកាន់ឆានែលនេះភ្លាមៗ។ "
    "ខាងក្រោម (និងនៅលើគេហទំព័រ) ជាការត្រួតពិនិត្យរហ័ស — "
    "មានប្រភពពេញលេញ និង Local Lens នៅលើ Inbound Reports។\n\n"
    '<a href="https://inbound-news-web.vercel.app/brief/2026-08-11">បើក Brief ថ្ងៃនេះ →</a>'
)

_EN_EMPTY_SLOT_CTA = (
    "<b>Today's Brief</b>\n\n"
    "Must-know tech hits this channel as it breaks. "
    "Below (and on the site) is a short keep-up skim — "
    "full sources and Local Lens on Inbound Reports.\n\n"
    '<a href="https://inbound-news-web.vercel.app/brief/2026-08-11">Open today\'s Brief →</a>'
)


def test_legacy_cta_detector_matches_empty_slot_card_only():
    from newsbot.brief_cta import is_legacy_brief_cta

    assert is_legacy_brief_cta(_KM_EMPTY_SLOT_CTA)
    assert is_legacy_brief_cta(_EN_EMPTY_SLOT_CTA)
    assert not is_legacy_brief_cta("Inbound Reports · Aug 12")
    assert not is_legacy_brief_cta("បើក Brief ថ្ងៃនេះ →")  # button label alone is fine


def test_raise_if_legacy_brief_cta():
    from newsbot.brief_cta import LegacyBriefCtaBlocked, raise_if_legacy_brief_cta

    raise_if_legacy_brief_cta(None)
    raise_if_legacy_brief_cta("normal digest")
    with pytest.raises(LegacyBriefCtaBlocked):
        raise_if_legacy_brief_cta(_KM_EMPTY_SLOT_CTA)
