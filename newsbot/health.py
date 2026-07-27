"""HTTP health check server for Render / Railway deployments.

Returns JSON diagnostics:
  - Database connectivity + latency
  - AI provider status per key
  - Overall system status (ok / degraded / down)
"""

from __future__ import annotations

import json
import logging
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from newsbot.config import PORT

__all__ = ["start_health_server"]

logger = logging.getLogger(__name__)

_start_time = time.time()


def _check_database() -> dict:
    """Check Supabase connectivity and latency."""
    try:
        from workers.db import get_supabase
        supabase = get_supabase()
        start = time.time()
        result = supabase.table("articles").select("id", count="exact").limit(1).execute()
        latency_ms = round((time.time() - start) * 1000)
        return {"status": "ok", "latency_ms": latency_ms, "article_count": result.count or 0}
    except Exception as exc:
        return {"status": "down", "error": str(exc)[:200]}


def _check_ai_providers() -> dict:
    """Check AI provider key availability from the router."""
    try:
        from shared.ai_router import get_router
        router = get_router()
        return router.get_status()
    except Exception as exc:
        return {"error": str(exc)[:200]}


def _build_health_response() -> dict:
    """Build the full health response."""
    db_status = _check_database()
    ai_status = _check_ai_providers()

    # Determine overall status
    if db_status.get("status") == "down":
        status = "down"
    else:
        # Check if any AI provider is available
        any_ai = False
        for name, info in ai_status.items() if isinstance(ai_status, dict) else []:
            if isinstance(info, dict) and info.get("keys_available", 0) > 0:
                any_ai = True
                break
        if any_ai:
            status = "ok"
        else:
            status = "degraded"  # DB works but all AI providers are rate-limited

    return {
        "status": status,
        "database": db_status,
        "ai_providers": ai_status,
        "uptime_seconds": round(time.time() - _start_time),
    }


class HealthHandler(BaseHTTPRequestHandler):
    """JSON health check endpoint."""

    def do_GET(self) -> None:
        if self.path in ("/", "/health"):
            try:
                body_dict = _build_health_response()
                body = json.dumps(body_dict, indent=2).encode()
                code = 200 if body_dict["status"] != "down" else 503
            except Exception as exc:
                body_dict = {"status": "error", "error": str(exc)[:200]}
                body = json.dumps(body_dict).encode()
                code = 500
        else:
            body = json.dumps({"error": "not found"}).encode()
            code = 404

        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        """Silence access logs."""
        return


def start_health_server() -> None:
    """Start the HTTP health server in the current thread (blocking)."""
    server = HTTPServer(("0.0.0.0", PORT), HealthHandler)
    logger.info("Health server listening on 0.0.0.0:%d (/ and /health)", PORT)
    server.serve_forever()
