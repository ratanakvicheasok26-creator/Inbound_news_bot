"""Block the deleted empty-slot Brief CTA card — keep real Brief digests.

The old Khmer/English reminder card lived in ``_send_brief_cta`` / ``brief_text()``
and fired on every Brief hour when there was nothing to post. That path is gone.
This module is the last line of defense so leftover env copy, a stale digest
header, or any other sender cannot emit that card again.

Real multi-story Briefs (EN ``brief_job`` + KM ``mirror_drain``) are unchanged.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# Unique body/title lines from the removed card — not present on real digests.
_LEGACY_CTA_MARKERS: tuple[str, ...] = (
    "សេចក្តីសង្ខេបថ្ងៃនេះ",
    "ព័ត៌មានសំខាន់ៗផ្ញើមកកាន់ឆានែលនេះភ្លាមៗ",
    "Must-know tech hits this channel as it breaks",
)

_LEGACY_CTA_ENV_KEYS: tuple[str, ...] = ("BRIEF_TEXT", "BRIEF_TEXT_KM")


class LegacyBriefCtaBlocked(Exception):
    """Outbound Telegram copy matched the removed empty-slot Brief CTA."""


def is_legacy_brief_cta(text: str | None) -> bool:
    """True when ``text`` is (or contains) the deleted empty-slot CTA card."""
    if not text:
        return False
    return any(marker in text for marker in _LEGACY_CTA_MARKERS)


def is_legacy_cta_header(text: str | None) -> bool:
    """True when a digest header was overwritten with the old CTA title."""
    if not text:
        return False
    stripped = text.strip()
    if stripped.casefold() == "today's brief":
        return True
    return "សេចក្តីសង្ខេបថ្ងៃនេះ" in stripped


def leftover_brief_cta_env_keys(environ: dict[str, str] | None = None) -> list[str]:
    env = environ if environ is not None else os.environ
    return [key for key in _LEGACY_CTA_ENV_KEYS if (env.get(key) or "").strip()]


def warn_legacy_brief_cta_env(environ: dict[str, str] | None = None) -> list[str]:
    """Log leftover BRIEF_TEXT* vars but do not exit.

    Exiting on these vars prevented new KM deploys from starting, so the old
    CTA-sending worker kept the instance lock and kept posting the card.
    The vars are unused — ignore them and boot.
    """
    leftover = leftover_brief_cta_env_keys(environ)
    if leftover:
        logger.warning(
            "Ignoring leftover Brief CTA env (%s). Unset them when convenient; "
            "they are not used. Empty Brief slots stay silent.",
            ", ".join(leftover),
        )
    return leftover


def raise_if_legacy_brief_cta(text: str | None, *, field: str = "text") -> None:
    """Refuse to send the deleted empty-slot CTA card."""
    if not is_legacy_brief_cta(text):
        return
    logger.error(
        "Blocked legacy empty-slot Brief CTA (%s) — card is removed; "
        "real Briefs still post when there are stories.",
        field,
    )
    raise LegacyBriefCtaBlocked(field)
