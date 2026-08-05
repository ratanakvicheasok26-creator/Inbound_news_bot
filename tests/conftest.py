"""Test configuration — set dummy env vars before any module imports."""

import os

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "dummy-token-for-testing")
os.environ.setdefault("GROQ_API_KEY", "dummy-key-for-testing")
# Tests assert English copy — keep them deterministic regardless of the local
# .env (which is NEWS_LANGUAGE=km). Override with NEWS_LANGUAGE=km in your
# shell to run the suite in Khmer mode.
os.environ.setdefault("NEWS_LANGUAGE", "en")
