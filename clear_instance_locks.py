"""Script to clear stale instance locks in Redis.

Run this script to release the single-instance locks if the bot is stuck
in a restart loop on Railway due to stale locks.
"""

import os
from dotenv import load_dotenv

load_dotenv(".env.km")
load_dotenv(".env.en")
load_dotenv(".env", override=False)

REDIS_URL = os.environ.get("REDIS_URL", "").strip()
if not REDIS_URL:
    print("ERROR: REDIS_URL not set in environment.")
    exit(1)

import redis

try:
    r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    r.ping()
    print("Connected to Redis ✅")

    keys_to_clear = ["newsbot:instance_lock:km", "newsbot:instance_lock:en", "newsbot:instance_lock"]
    for key in keys_to_clear:
        deleted = r.delete(key)
        if deleted:
            print(f"Cleared lock key: {key}")
        else:
            print(f"Lock key was not active: {key}")

    print("\nDone! You can now restart your Railway bot services.")

except Exception as e:
    print(f"Error connecting to Redis: {e}")
