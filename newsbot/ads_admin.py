"""Telegram admin commands for website sponsor ads (poster creatives).

Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
Admin allowlist: ADS_ADMIN_CHAT_IDS, or FETCH_ADMIN_CHAT_IDS if unset.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from telegram import Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from newsbot import config

logger = logging.getLogger(__name__)

# Conversation states
WAITING_FIELDS = 1
WAITING_PHOTO = 2
WAITING_REPLACE_PHOTO = 3

_PIPE_SPLIT = re.compile(r"\s*\|\s*")
_DEFAULT_PLACEMENTS = ["home", "homeFeed", "story", "brief", "donate"]
_PLACEHOLDER_IMAGE = (
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d"
    "?w=800&h=500&fit=crop&q=80"
)


def _admin_ids() -> frozenset[int]:
    ids = getattr(config, "ADS_ADMIN_CHAT_IDS", frozenset()) or frozenset()
    if ids:
        return ids
    return getattr(config, "FETCH_ADMIN_CHAT_IDS", frozenset()) or frozenset()


def _is_admin(update: Update) -> bool:
    chat = update.effective_chat
    chat_id = chat.id if chat else 0
    allow = _admin_ids()
    return bool(allow) and chat_id in allow


async def _deny(update: Update) -> None:
    if update.effective_message:
        await update.effective_message.reply_text(
            "Ads admin is limited to operators. Set ADS_ADMIN_CHAT_IDS "
            "(or FETCH_ADMIN_CHAT_IDS)."
        )


def _supabase():
    from workers.db import get_supabase

    return get_supabase()


def _public_storage_url(path: str) -> str:
    base = (config.SUPABASE_URL or "").rstrip("/")
    return f"{base}/storage/v1/object/public/sponsor-creatives/{path}"


async def _upload_telegram_photo(
    context: ContextTypes.DEFAULT_TYPE,
    file_id: str,
) -> str:
    """Download Telegram photo and upload to Supabase Storage. Returns public URL."""
    tg_file = await context.bot.get_file(file_id)
    data = bytes(await tg_file.download_as_bytearray())
    ext = "jpg"
    file_path = getattr(tg_file, "file_path", "") or ""
    if ".png" in file_path.lower():
        ext = "png"
    elif ".webp" in file_path.lower():
        ext = "webp"
    name = f"{uuid.uuid4().hex}.{ext}"
    sb = _supabase()
    mime = f"image/{'jpeg' if ext == 'jpg' else ext}"
    sb.storage.from_("sponsor-creatives").upload(
        name,
        data,
        file_options={"content-type": mime, "upsert": "true"},
    )
    return _public_storage_url(name)


async def ad_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_admin(update):
        await _deny(update)
        return
    await update.effective_message.reply_text(
        "Sponsor ads (website AdBands)\n\n"
        "/ad_list — active + paused sponsors\n"
        "/ad_add — start add flow (brand | line | CTA | url), then send a photo\n"
        "/ad_pause <id> — deactivate\n"
        "/ad_on <id> — activate\n"
        "/ad_set <id> weight=2 — or placements=home,story\n"
        "/ad_photo <id> — replace poster (then send photo)\n"
        "/ad_cancel — cancel current flow\n\n"
        "Add example after /ad_add:\n"
        "ABA Bank | Pay faster in PP | Open account | https://example.com"
    )


async def ad_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_admin(update):
        await _deny(update)
        return
    try:
        sb = _supabase()
        result = (
            sb.table("sponsors")
            .select("id, brand, active, weight, placements, image_url")
            .order("updated_at", desc=True)
            .limit(40)
            .execute()
        )
    except Exception:
        logger.exception("ad_list failed")
        await update.effective_message.reply_text(
            "Could not load sponsors — check SUPABASE_URL / SERVICE_ROLE_KEY "
            "and migration 008_sponsors.sql."
        )
        return

    rows = result.data or []
    if not rows:
        await update.effective_message.reply_text("No sponsors yet. Use /ad_add.")
        return

    lines: list[str] = []
    for row in rows:
        status = "ON" if row.get("active") else "OFF"
        short = str(row.get("id", ""))[:8]
        brand = row.get("brand") or "?"
        weight = row.get("weight") or 1
        lines.append(f"[{status}] {brand} · w={weight} · id={short}…")
    await update.effective_message.reply_text("\n".join(lines)[:4000])


async def ad_pause(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _set_active(update, context, active=False)


async def ad_on(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _set_active(update, context, active=True)


async def _set_active(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    active: bool,
) -> None:
    if not _is_admin(update):
        await _deny(update)
        return
    args = context.args or []
    if not args:
        await update.effective_message.reply_text("Usage: /ad_pause <id-prefix-or-uuid>")
        return
    needle = args[0].strip()
    try:
        sb = _supabase()
        rows = (
            sb.table("sponsors")
            .select("id, brand")
            .execute()
            .data
            or []
        )
        match = next(
            (r for r in rows if str(r["id"]) == needle or str(r["id"]).startswith(needle)),
            None,
        )
        if not match:
            await update.effective_message.reply_text("No sponsor matched that id.")
            return
        sb.table("sponsors").update(
            {"active": active, "updated_by": update.effective_user.id if update.effective_user else None}
        ).eq("id", match["id"]).execute()
    except Exception:
        logger.exception("ad active toggle failed")
        await update.effective_message.reply_text("Update failed — see logs.")
        return
    state = "on" if active else "paused"
    await update.effective_message.reply_text(f"{match['brand']} is now {state}.")


async def ad_set(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_admin(update):
        await _deny(update)
        return
    args = context.args or []
    if len(args) < 2:
        await update.effective_message.reply_text(
            "Usage: /ad_set <id> weight=2\n"
            "   or: /ad_set <id> placements=home,story,brief"
        )
        return
    needle = args[0].strip()
    patch: dict[str, Any] = {}
    for token in args[1:]:
        if "=" not in token:
            continue
        key, val = token.split("=", 1)
        key = key.strip().lower()
        val = val.strip()
        if key == "weight":
            try:
                patch["weight"] = max(1, min(10, int(val)))
            except ValueError:
                await update.effective_message.reply_text("weight must be an integer 1–10")
                return
        elif key == "placements":
            slots = [p.strip() for p in val.split(",") if p.strip()]
            bad = [p for p in slots if p not in _DEFAULT_PLACEMENTS]
            if bad:
                await update.effective_message.reply_text(
                    f"Unknown placements: {', '.join(bad)}. "
                    f"Use: {', '.join(_DEFAULT_PLACEMENTS)}"
                )
                return
            patch["placements"] = slots or list(_DEFAULT_PLACEMENTS)
    if not patch:
        await update.effective_message.reply_text("Nothing to update.")
        return
    try:
        sb = _supabase()
        rows = sb.table("sponsors").select("id, brand").execute().data or []
        match = next(
            (r for r in rows if str(r["id"]) == needle or str(r["id"]).startswith(needle)),
            None,
        )
        if not match:
            await update.effective_message.reply_text("No sponsor matched that id.")
            return
        if update.effective_user:
            patch["updated_by"] = update.effective_user.id
        sb.table("sponsors").update(patch).eq("id", match["id"]).execute()
    except Exception:
        logger.exception("ad_set failed")
        await update.effective_message.reply_text("Update failed — see logs.")
        return
    await update.effective_message.reply_text(f"Updated {match['brand']}: {patch}")


async def ad_add_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not _is_admin(update):
        await _deny(update)
        return ConversationHandler.END
    context.user_data.pop("pending_ad", None)
    await update.effective_message.reply_text(
        "Send one line:\n"
        "Brand | pitch line | CTA | https://link\n\n"
        "Then I’ll ask for a poster photo.\n"
        "/ad_cancel to abort."
    )
    return WAITING_FIELDS


async def ad_add_fields(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = (update.effective_message.text or "").strip()
    parts = _PIPE_SPLIT.split(text)
    if len(parts) < 4:
        await update.effective_message.reply_text(
            "Need 4 parts separated by | : Brand | line | CTA | url"
        )
        return WAITING_FIELDS
    brand, line, cta, href = (p.strip() for p in parts[:4])
    if not href.startswith(("http://", "https://", "#")):
        await update.effective_message.reply_text("Link must start with http(s)://")
        return WAITING_FIELDS
    context.user_data["pending_ad"] = {
        "brand": brand,
        "line": line,
        "cta": cta or "Learn more",
        "href": href,
    }
    await update.effective_message.reply_text(
        "Now send a poster photo (or an https image URL).\n"
        "Or /ad_skip to use a placeholder image."
    )
    return WAITING_PHOTO


async def ad_add_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    pending = context.user_data.get("pending_ad")
    if not pending:
        await update.effective_message.reply_text("No pending ad — start with /ad_add.")
        return ConversationHandler.END

    image_url = _PLACEHOLDER_IMAGE
    photos = update.effective_message.photo if update.effective_message else None
    if photos:
        try:
            image_url = await _upload_telegram_photo(context, photos[-1].file_id)
        except Exception:
            logger.exception("sponsor photo upload failed")
            await update.effective_message.reply_text(
                "Photo upload failed — using placeholder. Check Storage bucket "
                "sponsor-creatives + service role."
            )
    elif update.effective_message and update.effective_message.text:
        url = update.effective_message.text.strip()
        if url.startswith("http://") or url.startswith("https://"):
            image_url = url
        else:
            await update.effective_message.reply_text(
                "Send a photo, an https image URL, or /ad_skip."
            )
            return WAITING_PHOTO

    return await _insert_pending(update, context, pending, image_url)


async def ad_skip_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    pending = context.user_data.get("pending_ad")
    if not pending:
        await update.effective_message.reply_text("No pending ad — start with /ad_add.")
        return ConversationHandler.END
    return await _insert_pending(update, context, pending, _PLACEHOLDER_IMAGE)


async def _insert_pending(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    pending: dict[str, str],
    image_url: str,
) -> int:
    try:
        sb = _supabase()
        row = {
            "brand": pending["brand"],
            "line": pending["line"],
            "cta": pending["cta"],
            "href": pending["href"],
            "image_url": image_url,
            "active": True,
            "weight": 1,
            "placements": list(_DEFAULT_PLACEMENTS),
            "updated_by": update.effective_user.id if update.effective_user else None,
        }
        result = sb.table("sponsors").insert(row).execute()
        created = (result.data or [None])[0]
    except Exception:
        logger.exception("sponsor insert failed")
        await update.effective_message.reply_text(
            "Insert failed — run migration 008_sponsors.sql and check service role."
        )
        context.user_data.pop("pending_ad", None)
        return ConversationHandler.END

    context.user_data.pop("pending_ad", None)
    sid = str(created.get("id", ""))[:8] if created else "?"
    await update.effective_message.reply_text(
        f"Live: {pending['brand']} (id {sid}…)\n"
        "Website AdBands pick it up within ~1 minute."
    )
    return ConversationHandler.END


async def ad_photo_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not _is_admin(update):
        await _deny(update)
        return ConversationHandler.END
    args = context.args or []
    if not args:
        await update.effective_message.reply_text("Usage: /ad_photo <id>")
        return ConversationHandler.END
    needle = args[0].strip()
    try:
        sb = _supabase()
        rows = sb.table("sponsors").select("id, brand").execute().data or []
        match = next(
            (r for r in rows if str(r["id"]) == needle or str(r["id"]).startswith(needle)),
            None,
        )
    except Exception:
        logger.exception("ad_photo lookup failed")
        await update.effective_message.reply_text("Lookup failed.")
        return ConversationHandler.END
    if not match:
        await update.effective_message.reply_text("No sponsor matched that id.")
        return ConversationHandler.END
    context.user_data["replace_photo_id"] = match["id"]
    context.user_data["replace_photo_brand"] = match["brand"]
    await update.effective_message.reply_text(
        f"Send a new poster photo for {match['brand']} (or an https image URL)."
    )
    return WAITING_REPLACE_PHOTO


async def ad_photo_receive(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    sponsor_id = context.user_data.get("replace_photo_id")
    brand = context.user_data.get("replace_photo_brand", "sponsor")
    if not sponsor_id:
        await update.effective_message.reply_text("No pending photo replace — use /ad_photo <id>.")
        return ConversationHandler.END

    image_url = None
    photos = update.effective_message.photo if update.effective_message else None
    if photos:
        try:
            image_url = await _upload_telegram_photo(context, photos[-1].file_id)
        except Exception:
            logger.exception("replace photo upload failed")
            await update.effective_message.reply_text("Upload failed.")
            return ConversationHandler.END
    elif update.effective_message and update.effective_message.text:
        url = update.effective_message.text.strip()
        if url.startswith("http://") or url.startswith("https://"):
            image_url = url
    if not image_url:
        await update.effective_message.reply_text("Send a photo or https image URL.")
        return WAITING_REPLACE_PHOTO

    try:
        sb = _supabase()
        sb.table("sponsors").update(
            {
                "image_url": image_url,
                "updated_by": update.effective_user.id if update.effective_user else None,
            }
        ).eq("id", sponsor_id).execute()
    except Exception:
        logger.exception("replace photo update failed")
        await update.effective_message.reply_text("DB update failed.")
        return ConversationHandler.END

    context.user_data.pop("replace_photo_id", None)
    context.user_data.pop("replace_photo_brand", None)
    await update.effective_message.reply_text(f"Poster updated for {brand}.")
    return ConversationHandler.END


async def ad_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.pop("pending_ad", None)
    context.user_data.pop("replace_photo_id", None)
    context.user_data.pop("replace_photo_brand", None)
    if update.effective_message:
        await update.effective_message.reply_text("Cancelled.")
    return ConversationHandler.END


def build_ads_conversation_handler() -> ConversationHandler:
    """ConversationHandler for /ad_add and /ad_photo flows."""
    return ConversationHandler(
        entry_points=[
            CommandHandler("ad_add", ad_add_start),
            CommandHandler("ad_photo", ad_photo_start),
        ],
        states={
            WAITING_FIELDS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, ad_add_fields),
            ],
            WAITING_PHOTO: [
                CommandHandler("ad_skip", ad_skip_photo),
                MessageHandler(filters.PHOTO, ad_add_photo),
                MessageHandler(filters.TEXT & ~filters.COMMAND, ad_add_photo),
            ],
            WAITING_REPLACE_PHOTO: [
                MessageHandler(filters.PHOTO, ad_photo_receive),
                MessageHandler(filters.TEXT & ~filters.COMMAND, ad_photo_receive),
            ],
        },
        fallbacks=[CommandHandler("ad_cancel", ad_cancel)],
        allow_reentry=True,
    )


def register_ads_handlers(app: Any) -> None:
    """Attach ads admin commands to the Telegram Application."""
    app.add_handler(build_ads_conversation_handler())
    for name, handler in (
        ("ad_help", ad_help),
        ("ad_list", ad_list),
        ("ad_pause", ad_pause),
        ("ad_on", ad_on),
        ("ad_set", ad_set),
    ):
        app.add_handler(CommandHandler(name, handler))
