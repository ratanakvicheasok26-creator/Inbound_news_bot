"""Shared Supabase client for ingestion workers."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_supabase = None


def get_supabase():
    """Return a Supabase client (lazy singleton)."""
    global _supabase
    if _supabase is not None:
        return _supabase

    from supabase import create_client

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not url or not key:
        raise RuntimeError(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars. "
            "Use the service-role key, not the anon key."
        )

    _supabase = create_client(url, key)
    logger.info("Supabase client connected to %s", url)
    return _supabase
