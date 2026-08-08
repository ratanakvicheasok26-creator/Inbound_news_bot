"""Daily Brief reminder schedule + caption language."""

from __future__ import annotations

import importlib

import pytest


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
