"""One-off backfill — normalize story categories to the 15 site slugs.

The ingestion workers historically wrote raw source taxonomy (GitHub
languages, arXiv codes, Hugging Face pipeline tags, Semantic Scholar /
OpenAlex field names, Lobsters tags, generic API categories, None) into
`stories.category`, so most topic pages on the website were empty.

This script reclassifies every existing story using `workers.categories`
(alias map + keyword classifier) and updates the rows where the category
changes. It is idempotent — safe to re-run.

Usage:
    python -m workers.backfill_categories            # dry run (report only)
    python -m workers.backfill_categories --apply    # write changes to Supabase

Env vars required:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import logging
import sys

from dotenv import load_dotenv
load_dotenv()

from workers.categories import SITE_SLUGS, normalize_category
from workers.db import get_supabase

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

_PAGE_SIZE = 1000


def _iter_stories(supabase):
    """Yield all stories (id, title, summary_en, category), paginated."""
    offset = 0
    while True:
        result = (
            supabase.table("stories")
            .select("id, title, summary_en, category")
            .order("created_at", desc=True)
            .range(offset, offset + _PAGE_SIZE - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break
        yield from rows
        if len(rows) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE


def _count_by_slug(stories: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for s in stories:
        key = s.get("category") or "None"
        counts[key] = counts.get(key, 0) + 1
    return counts


def run(apply: bool = False) -> int:
    supabase = get_supabase()
    logger.info("Fetching all stories...")

    stories = list(_iter_stories(supabase))
    logger.info("Loaded %d stories", len(stories))

    before = _count_by_slug(stories)
    site_before = {slug: before.get(slug, 0) for slug in SITE_SLUGS}

    updates: dict[str, list[str]] = {}
    unchanged = 0
    no_signal = 0
    for story in stories:
        slug = normalize_category(
            story.get("category"),
            story.get("title"),
            story.get("summary_en"),
        )
        current = story.get("category")
        if slug is None:
            no_signal += 1
            continue
        if slug == current:
            unchanged += 1
            continue
        updates.setdefault(slug, []).append(story["id"])

    logger.info(
        "Classification: %d to update, %d already correct, %d no signal",
        sum(len(v) for v in updates.values()),
        unchanged,
        no_signal,
    )

    changed_ids = sum(len(v) for v in updates.values())
    if changed_ids == 0:
        logger.info("Nothing to change.")
        return 0

    if not apply:
        logger.info("DRY RUN — no changes written. Re-run with --apply to update Supabase.")
        for slug, ids in sorted(updates.items(), key=lambda kv: -len(kv[1])):
            logger.info("  -> %s: %d stories", slug, len(ids))
        return 0

    applied = 0
    for slug, ids in updates.items():
        result = supabase.table("stories").update({"category": slug}).in_("id", ids).execute()
        count = len(result.data) if result.data else 0
        applied += count
        logger.info("Updated %d stories -> %s", count, slug)

    after = {slug: before.get(slug, 0) + len(updates.get(slug, [])) for slug in SITE_SLUGS}

    logger.info("Backfill complete: %d stories updated.", applied)
    logger.info("Site slug counts before -> after:")
    for slug in SITE_SLUGS:
        a = site_before[slug]
        b = after[slug]
        if a != b:
            logger.info("  %-13s %4d -> %4d", slug, a, b)

    return 0 if applied == changed_ids else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalize story categories to site slugs.")
    parser.add_argument("--apply", action="store_true", help="Write changes to Supabase.")
    args = parser.parse_args()
    sys.exit(run(apply=args.apply))
