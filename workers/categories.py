"""Category normalization for website ingestion.

The website topic pages query `stories.category` with the exact site slugs
declared in `inbound-news-web/src/lib/categories.ts`. The ingestion workers,
however, write raw source taxonomy into that column (GitHub language names,
arXiv codes, Hugging Face pipeline tags, Semantic Scholar / OpenAlex field
names, Lobsters tags, generic API categories, or None).

This module maps raw categories to the 15 site slugs in two stages:
  1. An explicit alias table (`RAW_TO_SLUG`) for every known raw category.
  2. A keyword classifier over title + summary for anything unmapped or None.

It is used by the website pipeline ONLY (workers.dedup, workers.rss_bulk).
It intentionally has NO imports from `newsbot` so the Telegram bot surface is
never coupled to website worker code. The keyword lists mirror the ones used
by the bot but are copied here to keep the dependency one-way.
"""

from __future__ import annotations

from typing import Any

# Must stay in sync with inbound-news-web/src/lib/categories.ts.
SITE_SLUGS: tuple[str, ...] = (
    "ai",
    "cybersecurity",
    "startups",
    "defi",
    "big_tech",
    "hardware",
    "science",
    "regulation",
    "cloud",
    "opensource",
    "gaming",
    "climate",
    "telecom",
    "mobile",
    "regional",
)

SITE_SLUGS_SET: frozenset[str] = frozenset(SITE_SLUGS)


def is_site_slug(slug: str | None) -> bool:
    return slug in SITE_SLUGS_SET


# --- Alias table: raw source categories -> site slug ------------------------
#
# Keys are lowercased raw categories. Covers everything the wired workers
# emit: GitHub Trending languages, arXiv codes, Hugging Face pipeline tags,
# Semantic Scholar / OpenAlex field names, Lobsters tags, Currents / NewsData
# API categories, TerminalFeed categories, sources.yaml categories, plus the
# 15 site slugs themselves (identity).
_RAW_TO_SLUG: dict[str, str] = {s: s for s in SITE_SLUGS}

_RAW_TO_SLUG.update({
    # --- ai ---------------------------------------------------------------
    "artificial intelligence": "ai",
    "artificial intelligence (ai)": "ai",
    "machine learning": "ai",
    "deep learning": "ai",
    "transformer": "ai",
    "ml": "ai",
    "dataset": "ai",
    "cs.ai": "ai",
    "cs.cl": "ai",
    "cs.cv": "ai",
    "cs.lg": "ai",
    "cs.ne": "ai",
    "cs.dl": "ai",
    "stat.ml": "ai",
    # Hugging Face pipeline tags
    "text-generation": "ai",
    "text2text-generation": "ai",
    "text-to-image": "ai",
    "text-to-video": "ai",
    "text-to-speech": "ai",
    "image-text-to-text": "ai",
    "image-to-text": "ai",
    "automatic-speech-recognition": "ai",
    "sentence-similarity": "ai",
    "any-to-any": "ai",
    "feature-extraction": "ai",
    "fill-mask": "ai",
    "image-classification": "ai",
    "image-segmentation": "ai",
    "object-detection": "ai",
    "text-classification": "ai",
    "token-classification": "ai",
    "translation": "ai",
    "summarization": "ai",
    "question-answering": "ai",
    "zero-shot-classification": "ai",
    # --- cybersecurity ----------------------------------------------------
    "cybersecurity": "cybersecurity",
    "security": "cybersecurity",
    "computer security": "cybersecurity",
    "computer security and cryptography": "cybersecurity",
    "cyber": "cybersecurity",
    "nvd": "cybersecurity",
    "cve": "cybersecurity",
    "cryptography": "cybersecurity",
    "cs.cr": "cybersecurity",
    "hacking": "cybersecurity",
    # --- startups ----------------------------------------------------------
    "startups": "startups",
    "startup": "startups",
    "business": "startups",
    "funding": "startups",
    "venture capital": "startups",
    "ecommerce": "startups",
    "edtech": "startups",
    "fintech": "startups",
    "hrtech": "startups",
    "insurtech": "startups",
    "martech": "startups",
    "proptech": "startups",
    "supplychain": "startups",
    # --- defi --------------------------------------------------------------
    "defi": "defi",
    "crypto": "defi",
    "cryptocurrency": "defi",
    "cryptocurrencies": "defi",
    "blockchain": "defi",
    "bitcoin": "defi",
    "ethereum": "defi",
    "web3": "defi",
    "nft": "defi",
    "solana": "defi",
    "stablecoin": "defi",
    # --- big tech ----------------------------------------------------------
    "big tech": "big_tech",
    "technology": "big_tech",
    "tech": "big_tech",
    "enterprise": "big_tech",
    "apple": "big_tech",
    "microsoft": "big_tech",
    "google": "big_tech",
    "amazon": "big_tech",
    "meta": "big_tech",
    "alphabet": "big_tech",
    "tesla": "big_tech",
    "samsung": "big_tech",
    "windows": "big_tech",
    "news": "big_tech",
    # --- hardware ----------------------------------------------------------
    "hardware": "hardware",
    "chip": "hardware",
    "processor": "hardware",
    "gpu": "hardware",
    "cpu": "hardware",
    "semiconductor": "hardware",
    "electronics": "hardware",
    "robotics": "hardware",
    "iot": "hardware",
    "nvidia": "hardware",
    "amd": "hardware",
    "intel": "hardware",
    # --- science -----------------------------------------------------------
    "science": "science",
    "research": "science",
    "computer science": "science",
    "computer science, interdisciplinary applications": "science",
    "compsci": "science",
    "biology": "science",
    "biotech": "science",
    "biotechnology": "science",
    "medicine": "science",
    "health": "science",
    "healthcare": "science",
    "health tech": "science",
    "healthtech": "science",
    "chemistry": "science",
    "physics": "science",
    "mathematics": "science",
    "materials science": "science",
    "psychology": "science",
    "engineering": "science",
    "environmental science": "science",
    "astronomy": "science",
    "quantum": "science",
    "genetics": "science",
    "agritech": "science",
    "geography": "science",
    "economics": "science",
    "philosophy": "science",
    "cs.se": "science",
    "cs.pl": "science",
    "cs.ar": "science",
    "cs.ds": "science",
    "cs.db": "science",
    "cs.ir": "science",
    "cs.ro": "science",
    "cs.sy": "science",
    "cs.lo": "science",
    "cs.hc": "science",
    "cs.cy": "science",
    "cs.gt": "science",
    "cs.it": "science",
    "cs.mm": "science",
    "cs.ms": "science",
    "cs.na": "science",
    "cs.os": "science",
    "cs.cg": "science",
    "hep-th": "science",
    "quant-ph": "science",
    "physics.geo-ph": "science",
    "physics.ao-ph": "science",
    "cond-mat.str-el": "science",
    "math": "science",
    "math.na": "science",
    "stat.me": "science",
    "eess.iv": "science",
    # --- cloud -------------------------------------------------------------
    "cloud": "cloud",
    "aws": "cloud",
    "azure": "cloud",
    "devops": "cloud",
    "kubernetes": "cloud",
    "docker": "cloud",
    "saas": "cloud",
    "infrastructure": "cloud",
    "database": "cloud",
    "databases": "cloud",
    "postgres": "cloud",
    "sql": "cloud",
    "serverless": "cloud",
    # --- opensource --------------------------------------------------------
    "open source": "opensource",
    "opensource": "opensource",
    "github": "opensource",
    "linux": "opensource",
    "foss": "opensource",
    "git": "opensource",
    "developer": "opensource",
    "programming": "opensource",
    "software": "opensource",
    "nocode": "opensource",
    "design": "opensource",
    "web": "opensource",
    "browsers": "opensource",
    "vcs": "opensource",
    "emacs": "opensource",
    "nix": "opensource",
    "compilers": "opensource",
    "osdev": "opensource",
    "openbsd": "opensource",
    "netbsd": "opensource",
    "reversing": "opensource",
    "vibecoding": "opensource",
    "practices": "opensource",
    "plt": "opensource",
    "perl": "opensource",
    # GitHub / Lobsters language tags
    "python": "opensource",
    "typescript": "opensource",
    "javascript": "opensource",
    "rust": "opensource",
    "go": "opensource",
    "c": "opensource",
    "c++": "opensource",
    "c#": "opensource",
    "ruby": "opensource",
    "swift": "opensource",
    "lua": "opensource",
    "css": "opensource",
    "shell": "opensource",
    "lean": "opensource",
    "zig": "opensource",
    "java": "opensource",
    "kotlin": "opensource",
    "dart": "opensource",
    "scala": "opensource",
    "haskell": "opensource",
    "elixir": "opensource",
    "clojure": "opensource",
    "gleam": "opensource",
    "php": "opensource",
    "groovy": "opensource",
    "objective-c": "opensource",
    "assembly": "opensource",
    "nim": "opensource",
    # --- gaming ------------------------------------------------------------
    "gaming": "gaming",
    "games": "gaming",
    "game": "gaming",
    "game dev": "gaming",
    "gamedev": "gaming",
    "gamingdev": "gaming",
    "esports": "gaming",
    # --- climate -----------------------------------------------------------
    "climate": "climate",
    "renewable": "climate",
    "solar": "climate",
    "carbon": "climate",
    "sustainability": "climate",
    "green energy": "climate",
    "ev": "climate",
    # --- telecom -----------------------------------------------------------
    "telecom": "telecom",
    "satellite": "telecom",
    "5g": "telecom",
    "6g": "telecom",
    "starlink": "telecom",
    "broadband": "telecom",
    "isp": "telecom",
    "space": "telecom",
    # --- mobile ------------------------------------------------------------
    "mobile": "mobile",
    "android": "mobile",
    "ios": "mobile",
    "smartphone": "mobile",
    "app store": "mobile",
    "apps": "mobile",
    # --- regional ----------------------------------------------------------
    "regional": "regional",
    "se_asia": "regional",
    "se asia": "regional",
    "southeast asia": "regional",
    "south_east_asia": "regional",
    "cambodia": "regional",
    "asean": "regional",
    "khmer": "regional",
})

# TerminalFeed categories (free, no-key sources wired into ingest_apis).
# "finance_news" (economic indicators) has no site slug — keyword classifier
# decides or it stays None.
_RAW_TO_SLUG.update({
    "cyber-threats": "cybersecurity",
    "crypto-movers": "defi",
    "service-status": "cloud",
    "space-weather": "science",
    "launches": "telecom",
})

# sources.yaml categories -> site slug (used by rss_bulk for feed hinting).
_SOURCES_YAML_TO_SLUG: dict[str, str | None] = {
    "ai": "ai",
    "cybersecurity": "cybersecurity",
    "startups": "startups",
    "crypto": "defi",
    "fintech": "startups",
    "tech": "big_tech",
    "enterprise": "big_tech",
    "apple": "big_tech",
    "windows": "big_tech",
    "business": "startups",
    "hardware": "hardware",
    "robotics": "hardware",
    "iot": "hardware",
    "science": "science",
    "research": "science",
    "biotech": "science",
    "healthtech": "science",
    "agritech": "science",
    "quantum": "science",
    "edtech": "startups",
    "space": "telecom",
    "regulation": "regulation",
    "regtech": "regulation",
    "legaltech": "regulation",
    "cloud": "cloud",
    "saas": "cloud",
    "database": "cloud",
    "linux": "opensource",
    "developer": "opensource",
    "nocode": "opensource",
    "gaming": "gaming",
    "gamingdev": "gaming",
    "climate": "climate",
    "ev": "climate",
    "telecom": "telecom",
    "mobile": "mobile",
    "regional": "regional",
    "se_asia": "regional",
    "cambodia": "regional",
}

_RAW_TO_SLUG.update({k: v for k, v in _SOURCES_YAML_TO_SLUG.items() if v})


# --- Keyword classifier (mirrors newsbot/ai.py, copied to keep deps one-way) -
_KEYWORDS: dict[str, list[str]] = {
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
    "startups": [
        "startup", "startups", "funding", "fundraise", "venture capital",
        "seed round", "series a", "series b", "series c", "ipo",
        "acquisition", "acquired", "unicorn", "y combinator", "valuation",
    ],
    "regional": [
        "cambodia", "phnom penh", "khmer", "asean", "se asia",
        "southeast asia", "singapore", "vietnam", "vietnamese",
        "thailand", "indonesia", "malaysia", "philippines", "myanmar",
        "laos", "brunei", "jakarta", "bangkok", "manila", "ho chi minh",
    ],
}

# Most-specific categories win keyword ties. Lower index = more specific.
_PRIORITY: tuple[str, ...] = (
    "cybersecurity",
    "defi",
    "regional",
    "regulation",
    "climate",
    "gaming",
    "telecom",
    "mobile",
    "hardware",
    "ai",
    "cloud",
    "opensource",
    "science",
    "big_tech",
    "startups",
)

_PRIORITY_INDEX: dict[str, int] = {slug: i for i, slug in enumerate(_PRIORITY)}


def _classify_keywords(title: str | None, summary: str | None) -> str | None:
    text = f"{title or ''} {summary or ''}".lower()
    if not text.strip():
        return None
    scores: dict[str, int] = {}
    for slug, words in _KEYWORDS.items():
        score = sum(1 for w in words if w in text)
        if score > 0:
            scores[slug] = score
    if not scores:
        return None
    return max(
        scores,
        key=lambda s: (scores[s], -_PRIORITY_INDEX[s]),
    )


# Generic raw categories that defer to keyword signal when the title/summary
# is specific (e.g. raw "technology" + "AWS outage" -> cloud, not big_tech).
_WEAK_ALIASES: frozenset[str] = frozenset({
    "technology",
    "tech",
    "news",
    "business",
    "science",
    "health",
    "research",
    "software",
    "apps",
    "web",
    "design",
    "engineering",
})


def normalize_category(
    raw: str | None,
    title: str | None = None,
    summary: str | None = None,
    source_domain: str | None = None,
) -> str | None:
    """Map a raw source category to a site slug.

    Stage 1: alias lookup on the raw category. Generic aliases (weak) defer to
    the keyword classifier when the title/summary carries a stronger signal.
    Stage 2: keyword classifier over title + summary for unmapped / None.

    Returns None when no signal exists (story still shows on home, just not on
    any topic page).
    """
    key = (raw or "").strip().lower()
    if key:
        slug = _RAW_TO_SLUG.get(key)
        if slug:
            # Hugging Face "space" means a Spaces web app, not telecom.
            if key == "space" and source_domain and "huggingface" in source_domain.lower():
                return "ai"
            if key in _WEAK_ALIASES:
                return _classify_keywords(title, summary) or slug
            return slug

    return _classify_keywords(title, summary)


def category_for_sources_yaml(
    raw: str | None,
    title: str | None = None,
    summary: str | None = None,
    source_domain: str | None = None,
) -> str | None:
    """Normalize a sources.yaml category (feed-level hint) to a site slug."""
    return normalize_category(raw, title, summary, source_domain)
