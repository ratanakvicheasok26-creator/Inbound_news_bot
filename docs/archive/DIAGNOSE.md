# Telegram News Bot Diagnosis Report

## Overview

During the investigation of the Telegram news bot, several critical issues were identified. These issues explain why the bot continued to repost articles, lost state after deployment, and behaved inconsistently after Railway restarts.

---

# Primary Root Cause

The main issue was **state inconsistency**.

The project already introduced a new persistence layer (`state.py`) capable of storing data using either:

- Redis (recommended)
- Local JSON files (fallback)

However, the bot implementation never fully migrated to this new system.

As a result:

- Subscriber data was stored using `state.py`
- Posted article IDs were still stored directly in local JSON files

This split persistence caused the bot to lose track of previously posted articles whenever the application restarted or redeployed.

---

# Detailed Findings

## 1. bot.py Was Accidentally Duplicated

### Problem

`bot.py` contained two complete copies of itself.

The file repeated:

- module docstring
- helper functions
- broadcast logic
- fetch logic
- persistence functions

Python silently keeps only the **last definition** of duplicated functions.

Examples included:

- `load_subscribers()`
- `save_subscribers()`
- `load_posted_ids()`
- `save_posted_ids()`
- `broadcast()`
- `fetch_and_post()`

### Impact

- First implementations were ignored.
- Code became difficult to reason about.
- Merge conflicts introduced hidden bugs.

---

## 2. Mixed Persistence Layer

### Expected Design

```
state.py
├── RedisState
└── FileState
```

Every persistence operation should go through:

```python
state.get_state()
```

### Actual Implementation

Subscribers:

```
news_bot.py
    ↓
state.get_state()
```

Posted IDs:

```
bot.py
    ↓
json.load()
json.dump()
```

The two systems were completely separate.

### Impact

The bot remembered subscribers but forgot which articles had already been posted.

This directly caused duplicate Telegram posts.

---

## 3. Direct JSON File Access

Several functions bypassed the abstraction layer entirely.

Examples:

```python
load_posted_ids()
save_posted_ids()
load_subscribers()
save_subscribers()
```

These functions manually accessed files such as:

```
posted.json
subscribers.json
```

instead of using

```python
state.get_state()
```

### Impact

When deployed on Railway:

- local files disappear after restart
- posted IDs reset
- duplicates are sent again

---

## 4. Broken Merge Artifacts

The uploaded `bot.py` still contained unresolved merge fragments.

Examples included:

- orphaned async code
- duplicated function signatures
- missing function definitions
- undefined constants
- undefined helper functions

Notable examples:

```
_prepare_digest()
```

```
StoryPost
```

```
_cluster_to_story()
```

```
MAX_URGENT_POSTS_PER_RUN
```

These objects were referenced but not properly defined within the file.

---

## 5. Duplicate Function Definitions

Multiple important functions appeared more than once.

For example:

```
fetch_and_post()
```

was implemented multiple times.

Python keeps only the final version.

This creates confusion during maintenance because earlier implementations never execute.

---

## 6. Urgent Posting Function Was Missing

`news_bot.py` attempted to import

```python
fetch_urgent_and_post()
```

However, the uploaded project did not contain a valid implementation.

Instead, there were only partial fragments left behind after the merge.

---

## 7. Missing Import

`news_bot.py` used

```python
dt_time
```

without importing it.

Required import:

```python
from datetime import time as dt_time
```

Without this import the scheduler would fail during startup.

---

## 8. Urgent Job Was Never Scheduled

Although the code defined

```python
urgent_job()
```

it was never registered with the job queue.

Only daily digest jobs were scheduled.

Expected registration:

```python
run_repeating(...)
```

Without scheduling, urgent monitoring would never execute automatically.

---

## 9. Incorrect Posting Flow

Originally, article IDs could be marked as posted before message delivery was confirmed.

Safer sequence:

```
Fetch article
        ↓
Broadcast to Telegram
        ↓
If broadcast succeeds
        ↓
Store article ID
```

This prevents permanently skipping articles when Telegram delivery fails.

---

# Deployment Concerns

Even after fixing the code, another deployment issue remained.

If Railway does **not** provide:

```
REDIS_URL
```

then

```
state.py
```

automatically falls back to

```
FileState
```

which stores JSON locally.

Since Railway containers have ephemeral storage:

- redeploy
- restart
- crash

all erase local persistence.

Result:

- posted history disappears
- duplicate posts resume

---

# Recommended Solution

## Rewrite bot.py

Instead of patching the damaged file:

- remove duplicated code
- remove merge artifacts
- keep only one implementation of each function

---

## Centralize Persistence

Every read/write operation should use:

```python
state.get_state()
```

including:

- subscribers
- posted IDs
- future persistent state

No direct JSON operations should remain in `bot.py`.

---

## Use Redis

Configure:

```
REDIS_URL
```

inside Railway.

This allows state to survive:

- deployments
- restarts
- crashes

---

## Register All Scheduled Jobs

Ensure both:

- digest jobs
- urgent monitoring jobs

are properly added to the scheduler.

---

## Confirm Broadcast Before Saving State

Only save article IDs after successful Telegram delivery.

---

# Summary

The duplicate posting issue was not caused by a single bug but by several interacting problems:

1. `bot.py` was accidentally duplicated during a merge.
2. Persistence was split between `state.py` and direct JSON files.
3. Posted article IDs bypassed Redis entirely.
4. Local JSON files were erased after Railway restarts.
5. Merge artifacts left incomplete and duplicated functions.
6. Missing imports and unscheduled jobs created additional runtime issues.

The long-term fix is to fully adopt the centralized persistence layer (`state.py`) backed by Redis, remove duplicate code, and ensure all scheduling and posting logic is cleanly implemented.