"""Test configuration — set dummy env vars before any module imports."""

import os

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "dummy-token-for-testing")
os.environ.setdefault("GROQ_API_KEY", "dummy-key-for-testing")
# Tests assert English copy — force EN even if local .env has NEWS_LANGUAGE=km.
os.environ["NEWS_LANGUAGE"] = "en"
