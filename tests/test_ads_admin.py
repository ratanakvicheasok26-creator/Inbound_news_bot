"""Unit tests for sponsor ad admin helpers."""

from __future__ import annotations

import re

from newsbot.ads_admin import _DEFAULT_PLACEMENTS, _PIPE_SPLIT


def test_pipe_split_fields():
    parts = _PIPE_SPLIT.split("ABA Bank | Pay faster | Open account | https://example.com")
    assert parts == ["ABA Bank", "Pay faster", "Open account", "https://example.com"]


def test_default_placements_cover_site_slots():
    assert set(_DEFAULT_PLACEMENTS) == {"home", "homeFeed", "story", "brief", "donate"}


def test_uuid_prefix_match_pattern():
    full = "11111111-1111-4111-8111-111111111101"
    needle = "11111111"
    assert full.startswith(needle)
    assert re.match(r"^[0-9a-f-]{8,}$", needle)
