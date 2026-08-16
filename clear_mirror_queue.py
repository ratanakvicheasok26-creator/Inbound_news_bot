"""Clear the Redis mirror queue (backlog after outage).

Run on Railway:
    python clear_mirror_queue.py
"""
import os
import redis
from dotenv import load_dotenv

load_dotenv()

QUEUE_KEY = "newsbot:mirror:queue"
PROCESSING_KEY = "newsbot:mirror:processing"
CLAIMED_KEY = "newsbot:mirror:claimed"
DEADLETTER_KEY = "newsbot:mirror:deadletter"

r = redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)

for key in (QUEUE_KEY, PROCESSING_KEY, CLAIMED_KEY, DEADLETTER_KEY):
    count = r.llen(key)
    r.delete(key)
    print(f"Cleared {key}: {count} items removed")

print("Done. The KM bot will start fresh on next drain tick.")
