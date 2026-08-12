# Fixes Applied

## Date: Jul 23, 2026

---

## Issues

1. **Raw HTML appearing in Telegram messages** — RSS feeds (e.g., Medium) return HTML in their `<summary>` fields (`<div class="medium-feed-item">`, `<img src="...">`, etc.). This HTML was flowing into the AI prompt and sometimes appearing verbatim in the final output, rendered as visible tags like `<div>` in Telegram.

2. **Missing Khmer translation** — The AI model sometimes omitted `_km` fields from its JSON response, causing the Khmer section to silently fall back to English text.

---

## Changes

### `newsbot/feeds.py`

- Added `_strip_html()` function that:
  - Converts `<br>` and block-level closing tags (`</p>`, `</div>`, etc.) to newlines
  - Removes all remaining HTML tags
  - Decodes common HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`)
  - Collapses excess whitespace
- Applied `_strip_html()` to `Entry.summary` at collection time (line ~260), so RSS HTML never enters the pipeline

### `newsbot/ai.py`

- Added `_strip_html()` function (same logic as feeds.py) as a safety net
- Added `_sanitize_ai_data()` function that strips HTML from all string fields and list items in the AI output dict before rendering
- Called `_sanitize_ai_data()` in `_process_ai_output()` after JSON parsing, before validation
- Applied `_strip_html()` to summaries in `_build_prompt()` so HTML-contaminated input never reaches the AI
- Strengthened the AI prompt with two critical rules:
  - `ALL _km fields MUST contain Khmer text, never English`
  - `Do NOT include any HTML tags in any field — plain text only`

---

## Defense Layers

| Layer | Location | Purpose |
|-------|----------|---------|
| 1 | `feeds.py` `_strip_html()` on Entry.summary | Prevents RSS HTML from entering the pipeline |
| 2 | `ai.py` `_strip_html()` in `_build_prompt()` | Ensures clean input to the AI model |
| 3 | `ai.py` `_sanitize_ai_data()` on AI output | Strips any HTML the AI still includes in its response |
| 4 | AI prompt rules | Instructs the model to avoid HTML and always provide Khmer |

---

## Test Results

- 111 of 112 tests pass
- 1 pre-existing failure (`test_returns_separate_stories` — expects `DIGEST_MAX_STORIES=10`, config has `5`) — unrelated to these changes
