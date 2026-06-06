import redis
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_TTL = 300  # seconds — cache expires after 5 minutes even without invalidation

redis_client = redis.from_url(REDIS_URL, decode_responses=True)


def cache_key(user_identifier: str, domain: str) -> str:
    return f"latest:{user_identifier}:{domain}"
