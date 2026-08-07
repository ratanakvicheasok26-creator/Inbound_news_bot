"""AI-powered story rewriting via shared AI router with structured JSON output and template rendering.

Uses shared.ai_router for 3-tier provider fallback with key rotation:
  Tier 1: Groq (3 keys) → Tier 2: OpenRouter (3 keys) → Tier 3: Gemini (3 keys)
"""

from __future__ import annotations

import html
import json
import logging
import re
import time
from typing import Any

import httpx

from newsbot.config import (
    DIGEST_MIN_SOURCES,
    GROQ_MAX_TOKENS,
    LINK_CAP_NORMAL,
    LINK_CAP_URGENT,
    NEWS_CATEGORIES_SET,
    NEWS_LANGUAGE,
    URGENCY_LEVELS_SET,
)
from newsbot.feeds import Entry
from shared.ai_router import get_router

__all__ = [
    "render_template",
    "trim_for_caption",
    "collect_links",
    "pick_image_url",
    "rewrite_with_ai",
    "KhmerTranslationFailed",
    "ContentRejected",
]

logger = logging.getLogger(__name__)

_MAX_TELEGRAM_LENGTH: int = 4096
_CAPTION_MAX: int = 1024

_REQUIRED_JSON_KEYS = ("urgency", "headline", "summary", "category")

_OG_IMAGE_RE = re.compile(
    r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
# Khmer Unicode block — used to detect when the model ignored language instructions.
_KHMER_RE = re.compile(r"[\u1780-\u17FF]")


class ContentRejected(Exception):
    """Raised when the AI flags a cluster as spam/advertising/non-news content."""


class KhmerTranslationFailed(Exception):
    """Raised when km mode cannot produce Khmer body text (avoid posting English)."""


def _contains_khmer(text: str) -> bool:
    return bool(text and _KHMER_RE.search(text))


def _khmer_body_ok(headline: str, summary: str) -> bool:
    """Headline and summary must both include Khmer script (brands may stay Latin)."""
    return _contains_khmer(headline) and _contains_khmer(summary)


_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|li|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub("", text)
    text = re.sub(r"<[^>]*$", "", text)
    text = html.unescape(html.unescape(text))
    return re.sub(r"[ \t]+", " ", text).strip()


def _html_escape(text: str) -> str:
    return html.escape(text, quote=False)


def _parse_ai_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    match = re.search(r"\{.*?\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError("Could not parse AI output as JSON")


def _validate_ai_data(data: dict) -> tuple[bool, str | None]:
    for key in _REQUIRED_JSON_KEYS:
        if key not in data:
            return False, f"Missing required key: '{key}'"
        if not isinstance(data[key], str) or not data[key].strip():
            return False, f"Key '{key}' must be a non-empty string"

    if data["urgency"] not in URGENCY_LEVELS_SET:
        return False, f"Invalid urgency level: '{data['urgency']}'"

    if data["category"] not in NEWS_CATEGORIES_SET:
        return False, f"Invalid category: '{data['category']}'"

    for key in ("key_points", "tags"):
        if key in data and not isinstance(data[key], list):
            return False, f"Key '{key}' must be a list"

    return True, None


def _sanitize_ai_data(data: dict) -> dict:
    _STRING_KEYS = ("headline", "summary", "tldr")
    _LIST_KEYS = ("key_points", "tags")
    for key in _STRING_KEYS:
        if key in data and isinstance(data[key], str):
            data[key] = _strip_html(data[key])
    for key in _LIST_KEYS:
        if key in data and isinstance(data[key], list):
            data[key] = [_strip_html(item) for item in data[key] if isinstance(item, str)]
    return data


def _bullet_list(items: list[str], limit: int = 4) -> str:
    return "\n".join(f"▸ {_html_escape(item)}" for item in items[:limit])


_CATEGORY_LABELS: dict[str, str] = {
    "startups": "Startups",
    "ai": "AI & ML",
    "cybersecurity": "Cybersecurity",
    "defi": "DeFi & Crypto",
    "big_tech": "Big Tech",
    "hardware": "Hardware & Devices",
    "science": "Science & Research",
    "regulation": "Regulation & Policy",
    "cloud": "Cloud & DevOps",
    "opensource": "Open Source",
    "gaming": "Gaming",
    "climate": "Climate Tech",
    "telecom": "Telecom & Space",
    "mobile": "Mobile & Apps",
    "regional": "SE Asia Tech",
}


_URGENCY_BADGES: dict[str, str] = {
    "breaking": "\U0001f534 CRITICAL",
    "alert": "\U0001f7e1 ALERT",
    "analysis": "\U0001f535 Analysis",
    "market": "\U0001f4b0 Market",
    "explainer": "\U0001f4d6 Explainer",
}

_TLDR_LABEL = "TL;DR:"

_LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    "en": "Write all output text in English.",
    "km": (
        "Write the headline, summary, key_points, and tldr in natural, fluent Khmer (ភាសាខ្មែរ). "
        "Keep brand names, company names, product names, people's names, and technical acronyms in "
        "their original English form (e.g. SpaceX, ChatGPT, AI, GPU). "
        "Write numbers as digits (e.g. 500, 7%). "
        "If a technical term has no common Khmer equivalent, keep it in English inside the Khmer "
        "sentence instead of switching the whole sentence to English. "
        "Never output an entire sentence in English. "
        "Keep urgency, category, and tags values in English."
    ),
}


def _render_template(data: dict) -> str:
    """Render AI-structured data into a formatted Telegram HTML message."""
    headline = _html_escape(str(data.get("headline", "Untitled")))
    summary = _html_escape(str(data.get("summary", "")))
    key_points = data.get("key_points", [])
    tldr = _html_escape(str(data.get("tldr", "")))
    urgency = data.get("urgency", "analysis")

    badge = _URGENCY_BADGES.get(urgency, "")
    if badge:
        sections: list[str] = [f"<b>{badge} \u2014 Inbound Reports</b>", ""]
    else:
        sections = []

    sections.append(f"<b>{headline}</b>")
    sections.append("")
    sections.append(summary)

    if key_points:
        sections.append("")
        sections.append(_bullet_list(key_points))

    if tldr and urgency == "explainer":
        sections.append("")
        sections.append(f"<b>{_TLDR_LABEL}</b> {tldr}")

    text = "\n".join(sections)
    if len(text) > _MAX_TELEGRAM_LENGTH:
        text = text[: _MAX_TELEGRAM_LENGTH - 1].rsplit("\n", 1)[0] + "\n..."

    return text


render_template = _render_template


_COMPACT_MAX_SENTENCES = 3


def _build_compact_prompt(cluster: list[Entry]) -> str:
    headlines = "\n".join(
        f"- [{e.source_name}] {e.title}: {_strip_html(e.summary)[:200]}"
        for e in cluster[:5]
    )
    language_note = _LANGUAGE_INSTRUCTIONS.get(NEWS_LANGUAGE, _LANGUAGE_INSTRUCTIONS["en"])
    return f"""You are a tech news bot writing a compact 2-3 sentence summary.

Summarise the following tech news story in at most {_COMPACT_MAX_SENTENCES} sentences.
Focus on: what happened, at a high level \u2014 who, what, why it matters.
- Plain text only, no markdown, no HTML, no bold, no headlines, no bullet points.
- Do not simply repeat article titles.
- Report facts only \u2014 no opinions, no speculation.
- {language_note}

Stories covering the same event:
{headlines}"""


def rewrite_compact(cluster: list[Entry]) -> str:
    prompt = _build_compact_prompt(cluster)
    router = get_router()
    raw_output, provider = router.call(prompt, max_tokens=GROQ_MAX_TOKENS)

    if provider != "none":
        logger.info("Compact rewrite via %s", provider)

    if raw_output is None:
        primary = cluster[0]
        summary = _strip_html((primary.summary or "No summary available.")[:200])
        return _translate_to_khmer(summary, router)

    output = raw_output.strip()
    sentences = output.split(". ")
    if len(sentences) > _COMPACT_MAX_SENTENCES:
        output = ". ".join(sentences[:_COMPACT_MAX_SENTENCES]) + "."
    return output


def _build_compact_prompt_khmer(cluster: list[Entry]) -> str:
    headlines = "\n".join(
        f"- [{e.source_name}] {e.title}: {_strip_html(e.summary)[:200]}"
        for e in cluster[:5]
    )
    return f"""You are a tech news bot writing a compact Khmer summary for a Telegram channel.

Write this tech news in natural, fluent Khmer (ភាសាខ្មែរ):
- "title": concise Khmer translation of the headline (max ~120 characters)
- "summary": 2-3 sentence Khmer summary of what happened and why it matters

Rules:
- Keep brand names, company names, product names, people's names, and acronyms in English
- Write numbers as digits (e.g. 500, 7%)
- If a technical term has no Khmer equivalent, keep it in English inside the Khmer sentence
- Never output a whole sentence in English
- Plain text only — no HTML, no markdown, no bold

Reply with ONLY valid JSON, no preamble, no code fences:
{{"title": "...", "summary": "..."}}

Stories covering the same event:
{headlines}"""


def rewrite_compact_khmer(cluster: list[Entry]) -> tuple[str, str]:
    """Return (khmer_title, khmer_summary) for batched digests in km mode.

    Never returns an English-only body. If translation cannot produce Khmer
    script in both fields, raises KhmerTranslationFailed so the mirror can
    requeue instead of posting English to the Khmer channel.
    """
    prompt = _build_compact_prompt_khmer(cluster)
    router = get_router()
    raw_output, provider = router.call(prompt, max_tokens=GROQ_MAX_TOKENS)
    primary = cluster[0]
    en_title = (primary.title or "Untitled").strip() or "Untitled"
    en_summary = _strip_html((primary.summary or "No summary available.")[:200])

    title = ""
    summary = ""
    if raw_output:
        try:
            data = _parse_ai_json(raw_output)
            title = _strip_html(str(data.get("title", "") or "")).strip()
            summary = _strip_html(str(data.get("summary", "") or "")).strip()
            if title and not summary:
                summary = _translate_to_khmer(en_summary, router)
            elif summary and not title:
                title = _translate_to_khmer(en_title, router)
            if title and summary and _khmer_body_ok(title, summary):
                logger.info("Compact Khmer rewrite via %s", provider)
                return title, summary
            if title and summary:
                # Model returned valid JSON but ignored Khmer instructions.
                logger.warning(
                    "Compact Khmer rewrite via %s lacked Khmer script — translating",
                    provider,
                )
        except Exception:
            logger.debug("Compact Khmer rewrite parse failed", exc_info=True)
            title, summary = "", ""

    # Translate whichever fields still lack Khmer (AI English, partial, or total fail).
    if not title or not _contains_khmer(title):
        title = _translate_to_khmer(title or en_title, router)
    if not summary or not _contains_khmer(summary):
        summary = _translate_to_khmer(summary or en_summary, router)

    if not _khmer_body_ok(title, summary):
        raise KhmerTranslationFailed(
            f"Compact Khmer translation failed for '{en_title[:80]}'"
        )
    return title, summary


def trim_for_caption(text: str, limit: int = _CAPTION_MAX) -> str:
    if len(text) <= limit:
        return text
    truncated = text[: limit - 1].rsplit("\n", 1)[0]
    if len(truncated) < limit // 2:
        truncated = text[: limit - 1]
    return truncated.rstrip() + "..."


def collect_links(cluster: list[Entry], urgent: bool = False) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = []
    seen: set[str] = set()
    for entry in cluster:
        if entry.link not in seen:
            seen.add(entry.link)
            links.append((entry.link, entry.source_name))
    cap = LINK_CAP_URGENT if urgent else LINK_CAP_NORMAL
    return links[:cap]


def _fetch_og_image(url: str) -> str | None:
    """Fallback: fetch og:image from the article page when RSS has no image."""
    try:
        resp = httpx.get(
            url,
            timeout=3,
            follow_redirects=True,
            headers={"User-Agent": "InboundNewsBot/1.0"},
        )
        resp.raise_for_status()
        match = _OG_IMAGE_RE.search(resp.text)
        return match.group(1) if match else None
    except Exception:
        return None


def pick_image_url(cluster: list[Entry]) -> str | None:
    for entry in cluster:
        if entry.image_url:
            return entry.image_url
    if cluster:
        return _fetch_og_image(cluster[0].link)
    return None


def _build_prompt(cluster: list[Entry], source_note: str) -> str:
    headlines = "\n".join(
        f"- [{e.source_name}] {e.title}: {_strip_html(e.summary)[:200]}"
        for e in cluster[:5]
    )
    language_note = _LANGUAGE_INSTRUCTIONS.get(NEWS_LANGUAGE, _LANGUAGE_INSTRUCTIONS["en"])
    return f"""You are a tech news bot writing concise posts for a Telegram channel.

FIRST, check: is this legitimate tech/business/security/science news, or is it spam,
an advertisement, a listing, or unrelated non-news content?

If it is NOT legitimate news, respond with ONLY this JSON:
{{"reject": true, "reason": "brief reason"}}

Otherwise, return a JSON object with these fields:

{{
  "urgency": "breaking|alert|analysis|market|explainer",
  "category": "startups|ai|cybersecurity|defi|big_tech|hardware|science|regulation|cloud|opensource|gaming|climate|telecom|mobile|regional",
  "headline": "clear, concise headline",
  "summary": "1-2 sentence summary focused on what happened and why it matters",
  "key_points": ["point 1", "point 2", "point 3"],
  "tldr": "one-sentence TL;DR (only for explainer urgency)",
  "tags": ["Topic1", "Topic2"]
}}

Urgency classification:
- "breaking": active exploit, major outage, critical vulnerability being exploited NOW
- "alert": vulnerability disclosed, breach, action required, deadline
- "analysis": regulation, governance, policy, research report, trend
- "market": price action, trading volume, ETF flows, token launches, funding rounds
- "explainer": education, how something works, deep dive, tutorial

Rules:
- Report facts only \u2014 no opinions, no speculation, no buy/sell advice
- Never closely mirror any single article's wording
- If sources disagree, note it in context
- No HTML tags in any field \u2014 plain text only
- Return ONLY valid JSON, no preamble, no markdown code fences
- {language_note}
{source_note}

Stories covering the same event:
{headlines}"""


_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "cybersecurity": [
        "security", "hack", "breach", "vulnerability", "ransomware",
        "cyber", "malware", "zero-day", "exploit", "phishing",
    ],
    "defi": [
        "defi", "crypto", "bitcoin", "ethereum", "blockchain",
        "token", "web3", "nft", "solana", "stablecoin",
    ],
    "science": [
        "research", "study", "scientist", "discovery",
        "lab", "experiment", "physics", "biology",
    ],
    "regulation": [
        "regulat", "ban", "law", "policy", "congress",
        "eu", "government", "compliance", "antitrust",
    ],
    "cloud": [
        "cloud", "aws", "azure", "devops", "kubernetes",
        "docker", "saas", "infrastructure",
    ],
    "opensource": [
        "open source", "open-source", "github", "linux",
        "foss", "git",
    ],
    "gaming": [
        "game", "gaming", "playstation", "xbox", "nintendo",
        "esports", "steam",
    ],
    "climate": [
        "climate", "renewable", "solar", "carbon",
        "sustainability", "green energy", "ev ",
    ],
    "telecom": [
        "satellite", "5g", "6g", "telecom", "starlink",
        "broadband", "isp",
    ],
    "hardware": [
        "chip", "processor", "gpu", "cpu", "device",
        "hardware", "semiconductor", "robotics",
        "nvidia", "amd", "intel",
    ],
    "big_tech": [
        "google", "apple", "microsoft", "amazon", "meta",
        "alphabet", "tesla",
    ],
    "mobile": [
        "android", "ios", "app store",
        "mobile", "smartphone",
    ],
    "ai": [
        "artificial intelligence", "machine learning", "llm",
        "gpt", "openai", "anthropic", "deepmind", "chatbot",
        "neural", "deep learning",
    ],
}


def _guess_category(cluster: list[Entry]) -> str:
    """Best-effort category guess from title/summary when AI is unavailable."""
    text = " ".join(
        f"{e.title or ''} {e.summary or ''}" for e in cluster
    ).lower()
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return cat
    return "startups"


def _fallback_data(cluster: list[Entry], urgent: bool) -> dict:
    primary = cluster[0]
    urgency = "alert" if urgent else "analysis"
    source_names = list(dict.fromkeys(e.source_name for e in cluster))

    title = (primary.title or "").strip() or "Untitled Story"
    summary = (primary.summary or "No summary available.")[:200]

    return {
        "urgency": urgency,
        "category": _guess_category(cluster),
        "headline": title,
        "summary": summary,
        "key_points": [f"Reported by: {', '.join(source_names[:3])}"],
        "tags": ["News"],
        "published_date": primary.published_date or "",
    }


def _translate_to_khmer(text: str, router) -> str:
    """Best-effort single-text Khmer translation (used on fallback paths).

    Returns the translation when it contains Khmer script; otherwise returns
    the original text unchanged so callers can detect failure via _contains_khmer.
    """
    if NEWS_LANGUAGE != "km" or not text:
        return text
    prompt = (
        "Translate this tech news text into Khmer (ភាសាខ្មែរ). "
        "Keep brand names, company names, product names, and numbers as-is. "
        "Write natural Khmer — never reply with an entire English sentence. "
        "Reply with only the translation, no quotes, no commentary.\n\n"
        f"{text[:800]}"
    )
    try:
        result, provider = router.call(prompt, max_tokens=400)
        if result and result.strip():
            translated = _strip_html(result.strip())
            if _contains_khmer(translated):
                logger.info("Fallback text translated to Khmer via %s", provider)
                return translated
            logger.warning(
                "Fallback Khmer translation via %s still lacked Khmer script",
                provider,
            )
    except Exception:
        logger.debug("Fallback Khmer translation failed", exc_info=True)
    return text


def _khmerize_list_field(items: list, router) -> list:
    """Translate list items that lack Khmer script (key_points)."""
    out: list = []
    for item in items:
        if not isinstance(item, str) or not item.strip():
            continue
        if _contains_khmer(item):
            out.append(item.strip())
        else:
            translated = _translate_to_khmer(item.strip(), router)
            if _contains_khmer(translated):
                out.append(translated)
            # Drop English-only bullets rather than posting them on KM.
    return out


def _khmerize_fallback(data: dict, router) -> dict:
    """Translate headline/summary/key_points/tldr to Khmer after a failed rewrite.

    Returns the best-effort dict. Callers must still check _khmer_body_ok.
    """
    if NEWS_LANGUAGE != "km":
        return data
    out = dict(data)
    headline = str(out.get("headline") or "").strip()
    summary = str(out.get("summary") or "").strip()
    if not headline and not summary:
        return out

    if not _khmer_body_ok(headline, summary):
        prompt = (
            "Translate the following tech news into Khmer (ភាសាខ្មែរ). "
            "Keep brand names, company names, product names, and numbers as-is. "
            "Never output an entire sentence in English. "
            'Reply with ONLY valid JSON like {"headline": "...", "summary": "..."}, '
            "no preamble, no markdown fences.\n\n"
            f"Headline: {headline}\nSummary: {summary[:500]}"
        )
        try:
            result, provider = router.call(prompt, max_tokens=400)
            if result:
                parsed = _parse_ai_json(result)
                if isinstance(parsed, dict):
                    if isinstance(parsed.get("headline"), str) and parsed["headline"].strip():
                        out["headline"] = _strip_html(parsed["headline"].strip())
                    if isinstance(parsed.get("summary"), str) and parsed["summary"].strip():
                        out["summary"] = _strip_html(parsed["summary"].strip())
                    logger.info(
                        "Fallback headline/summary translated to Khmer via %s", provider
                    )
        except Exception:
            logger.debug("Fallback Khmer JSON translation failed", exc_info=True)

        # Field-by-field rescue if JSON translate still left Latin-only text.
        if not _contains_khmer(str(out.get("headline") or "")):
            out["headline"] = _translate_to_khmer(headline, router)
        if not _contains_khmer(str(out.get("summary") or "")):
            out["summary"] = _translate_to_khmer(summary, router)

    key_points = out.get("key_points")
    if isinstance(key_points, list) and key_points:
        out["key_points"] = _khmerize_list_field(key_points, router)

    tldr = str(out.get("tldr") or "").strip()
    if tldr and not _contains_khmer(tldr):
        translated_tldr = _translate_to_khmer(tldr, router)
        if _contains_khmer(translated_tldr):
            out["tldr"] = translated_tldr
        else:
            out["tldr"] = ""

    return out


def rewrite_with_ai(cluster: list[Entry], urgent: bool = False, header: str | None = None) -> str:
    links = collect_links(cluster, urgent=urgent)

    source_note = ""
    if len(links) < DIGEST_MIN_SOURCES:
        source_note = (
            f"\nNote: only {len(links)} source(s) available so far "
            f"(prefer {DIGEST_MIN_SOURCES}+ when possible)."
        )

    source_names = list(dict.fromkeys(e.source_name for e in cluster))
    source_name_str = source_names[0] if source_names else "Unknown"

    prompt = _build_prompt(cluster, source_note)
    router = get_router()
    raw_output, provider = router.call(prompt, max_tokens=GROQ_MAX_TOKENS)

    used_fallback = False
    if raw_output is None:
        logger.warning("All AI providers exhausted \u2014 using hardcoded fallback")
        data = _fallback_data(cluster, urgent)
        used_fallback = True
    else:
        try:
            data = _parse_ai_json(raw_output)
            if provider != "groq":
                logger.info("Rewrote via %s fallback (earlier tier(s) unavailable)", provider)
        except ValueError:
            logger.warning(
                "Failed to parse %s output as JSON, using fallback. Raw: %.200s",
                provider, raw_output,
            )
            data = _fallback_data(cluster, urgent)
            used_fallback = True

    if isinstance(data, dict) and data.get("reject"):
        title = cluster[0].title if cluster else "?"
        reason = data.get("reason", "unspecified")
        logger.warning("AI rejected content as non-news (%s): %.100s", reason, title)
        raise ContentRejected(reason)

    data = _sanitize_ai_data(data)

    is_valid, reason = _validate_ai_data(data)
    if not is_valid:
        logger.warning("AI output validation failed (%s), using fallback", reason)
        data = _fallback_data(cluster, urgent)
        used_fallback = True
        is_valid, _ = _validate_ai_data(data)
        if not is_valid:
            logger.error("Fallback data also failed validation \u2014 using hardcoded minimal data")
            data = {
                "urgency": "alert",
                "category": _guess_category(cluster),
                "headline": cluster[0].title or "Untitled Story",
                "summary": (cluster[0].summary or "No summary available.")[:200],
                "key_points": [],
                "tags": [],
            }

    # km: gate English "success" AND English fallbacks — never post Latin-only bodies.
    if NEWS_LANGUAGE == "km":
        headline = str(data.get("headline") or "")
        summary = str(data.get("summary") or "")
        if used_fallback or not _khmer_body_ok(headline, summary):
            if not used_fallback:
                logger.warning(
                    "AI rewrite via %s lacked Khmer script — forcing translation",
                    provider,
                )
            data = _khmerize_fallback(data, router)
        if not _khmer_body_ok(str(data.get("headline") or ""), str(data.get("summary") or "")):
            title = cluster[0].title if cluster else "?"
            raise KhmerTranslationFailed(
                f"Khmer translation failed for '{str(title)[:80]}'"
            )

    data["source_name"] = source_name_str

    if urgent and data.get("urgency") not in ("breaking", "alert"):
        data["urgency"] = "alert"

    rendered = _render_template(data)
    if header:
        rendered = f"{header}\n\n{rendered}"

    return rendered
