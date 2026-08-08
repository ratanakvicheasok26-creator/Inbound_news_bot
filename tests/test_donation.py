"""Donation caption language + Saturday schedule constant."""

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


def test_donation_days_saturday_only(reload_config):
    cfg = reload_config()
    assert cfg.DONATION_SCHEDULE_DAYS == (5,)


def test_donation_days_env_override(reload_config):
    cfg = reload_config(DONATION_SCHEDULE_DAYS="0,4")
    assert cfg.DONATION_SCHEDULE_DAYS == (0, 4)


def test_donation_days_env_invalid_defaults_saturday(reload_config):
    cfg = reload_config(DONATION_SCHEDULE_DAYS="bogus")
    assert cfg.DONATION_SCHEDULE_DAYS == (5,)


def test_donation_text_english_default(reload_config):
    cfg = reload_config(NEWS_LANGUAGE="en", DONATION_TEXT="", DONATION_TEXT_KM="")
    text = cfg.donation_text()
    assert "Support Inbound Reports" in text
    assert "ABA Payment Link" in text


def test_donation_text_khmer_default(reload_config):
    cfg = reload_config(NEWS_LANGUAGE="km", DONATION_TEXT="", DONATION_TEXT_KM="")
    text = cfg.donation_text()
    assert "ចូលរួមជាមួយយើង" in text
    assert "ចុចទីនេះដើម្បីបរិច្ចាក" in text
    assert "Support Inbound Reports" not in text


def test_donation_text_overrides(reload_config):
    cfg = reload_config(
        NEWS_LANGUAGE="km",
        DONATION_TEXT_KM="<b>សូមជួយ</b>",
        DONATION_TEXT="<b>Custom EN</b>",
    )
    assert cfg.donation_text() == "<b>សូមជួយ</b>"

    cfg = reload_config(
        NEWS_LANGUAGE="en",
        DONATION_TEXT="<b>Custom EN</b>",
        DONATION_TEXT_KM="<b>សូមជួយ</b>",
    )
    assert cfg.donation_text() == "<b>Custom EN</b>"
