import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

celery_app = Celery(
    "consent",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks"],
)
