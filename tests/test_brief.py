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
        import newsbot.feeds as feeds

        cfg = importlib.reload(cfg)
        importlib.reload(feeds)
        return cfg

    yield _reload
    monkeypatch.setenv("NEWS_LANGUAGE", "en")
    import newsbot.config as cfg
    import newsbot.feeds as feeds

    importlib.reload(cfg)
    importlib.reload(feeds)


def test_brief_hours_default(reload_config):
    cfg = reload_config(BRIEF_SCHEDULE_HOURS="6,12,18,22")
    assert cfg.BRIEF_SCHEDULE_HOURS == (6, 12, 18, 22)


def test_brief_hours_parse_custom(reload_config):
    cfg = reload_config(BRIEF_SCHEDULE_HOURS="6,18")
    assert cfg.BRIEF_SCHEDULE_HOURS == (6, 18)


def test_brief_text_english(reload_config):
    cfg = reload_config(NEWS_LANGUAGE="en", BRIEF_TEXT="", BRIEF_TEXT_KM="")
    text = cfg.brief_text("https://example.com/brief/2026-08-08")
    assert "Today's Brief" in text
    assert "https://example.com/brief/2026-08-08" in text
    assert cfg.brief_button_label() == "Open today's Brief →"


def test_brief_text_khmer(reload_config):
    cfg = reload_config(NEWS_LANGUAGE="km", BRIEF_TEXT="", BRIEF_TEXT_KM="")
    text = cfg.brief_text("https://example.com/brief/2026-08-08")
    assert "សេចក្តីសង្ខេបថ្ងៃនេះ" in text
    assert "https://example.com/brief/2026-08-08" in text
    assert "Today's Brief" not in text
    assert "បើក Brief" in cfg.brief_button_label()


def test_digest_header_plain_default(reload_config):
    cfg = reload_config(DIGEST_HEADER_TEXT="")
    assert cfg.DIGEST_HEADER_TEXT == "Inbound Reports"
    assert "📰" not in cfg.DIGEST_HEADER_TEXT


def test_digest_header_strips_legacy_emoji_html(reload_config):
    cfg = reload_config(DIGEST_HEADER_TEXT="📰 <b>Inbound Reports</b>")
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
