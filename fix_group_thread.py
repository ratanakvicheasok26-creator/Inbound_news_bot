"""Fix the group_threads Redis entry so English bot sends to the News topic.

Run this from a Railway shell or locally if your Redis is publicly accessible.

Usage:
  python fix_group_thread.py
"""

import os

from dotenv import load_dotenv

load_dotenv(".env.en")
load_dotenv(".env", override=False)

REDIS_URL = os.environ.get("REDIS_URL", "").strip()
CHANNEL_ID = int(os.environ.get("TELEGRAM_CHANNEL_ID", "0"))
THREAD_ID = int(os.environ.get("TELEGRAM_THREAD_ID", "0"))

print(f"REDIS_URL   : {REDIS_URL[:40]}...")
print(f"CHANNEL_ID  : {CHANNEL_ID}")
print(f"THREAD_ID   : {THREAD_ID}")

if not REDIS_URL:
    print("ERROR: REDIS_URL not set.")
    exit(1)
if not CHANNEL_ID:
    print("ERROR: TELEGRAM_CHANNEL_ID not set.")
    exit(1)
if not THREAD_ID:
    print("ERROR: TELEGRAM_THREAD_ID not set.")
    exit(1)

import redis

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
r.ping()
print("\nConnected to Redis ✅")

# Check current state
key = "newsbot:group_threads"
current = r.hgetall(key)
print(f"\nCurrent group_threads ({key}):")
if current:
    for k, v in current.items():
        marker = " ← WRONG (General)" if v == "1" or v == "None" else ""
        marker = " ← THIS CHANNEL" if int(k) == CHANNEL_ID else marker
        print(f"  chat_id={k}  thread_id={v}{marker}")
else:
    print("  (empty)")

# Set the correct mapping
r.hset(key, str(CHANNEL_ID), str(THREAD_ID))
print(f"\n✅ Fixed: group_threads[{CHANNEL_ID}] = {THREAD_ID}")
print(f"The English bot will now send to the News topic (thread #{THREAD_ID}).")

# Verify
updated = r.hgetall(key)
print("\nUpdated group_threads:")
for k, v in updated.items():
    print(f"  chat_id={k}  thread_id={v}")
