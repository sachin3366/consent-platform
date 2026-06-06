from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class DecisionIn(BaseModel):
    category_name: str  # e.g. "analytics", "marketing"
    accepted: bool


class ConsentIn(BaseModel):
    user_identifier: str  # cookie/session ID from the browser
    domain: str           # e.g. "shop.com"
    decisions: list[DecisionIn]


class CategoryOut(BaseModel):
    id: int
    name: str
    description: str


class DecisionOut(BaseModel):
    category_name: str
    accepted: bool


class ConsentOut(BaseModel):
    id: int
    user_identifier: str
    domain: str
    created_at: datetime
    previous_record_id: Optional[int]
    decisions: list[DecisionOut]


class ConsentQueued(BaseModel):
    status: str = "queued"
    user_identifier: str
    domain: str
