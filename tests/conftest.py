"""Test configuration — set dummy env vars before any module imports."""

import os

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "dummy-token-for-testing")
os.environ.setdefault("GROQ_API_KEY", "dummy-key-for-testing")
# Tests assert English copy — force EN even if local .env has NEWS_LANGUAGE=km.
os.environ["NEWS_LANGUAGE"] = "en"

import pytest

from newsbot import bot as bot_module


@pytest.fixture(autouse=True)
def _no_real_tech_classification(monkeypatch):
    """Keep tests hermetic: the AI tech gate must never hit real providers.

    Returns None = fail-open, so pipelines behave as if no AI filter ran.
    Tests that exercise the gate override this stub themselves.
    """
    monkeypatch.setattr(bot_module, "is_tech_news_ai", lambda *a, **k: None)

