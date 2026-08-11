"""Tests for newsbot.health — DB probe skips when Supabase env is unset."""

from unittest.mock import patch

from newsbot.health import _build_health_response, _check_database


def test_check_database_skipped_without_supabase_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)

    result = _check_database()
    assert result["status"] == "skipped"
    assert "SUPABASE" in result.get("reason", "")


def test_health_response_skipped_db_when_no_supabase(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "test-key-for-health")

    with patch("newsbot.health._check_ai_providers", return_value={
        "groq": {"keys_available": 1},
    }):
        body = _build_health_response()

    assert body["database"]["status"] == "skipped"
    assert body["ai_ok"] is True
    assert "ai_providers" not in body
    assert body["status"] in ("ok", "degraded")
