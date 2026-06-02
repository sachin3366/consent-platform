from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class ConsentCategory(SQLModel, table=True):
    """A type of cookie/tracking purpose (e.g. analytics, marketing)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: str = ""


class ConsentRecord(SQLModel, table=True):
    """One immutable consent event — never updated, only appended."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_identifier: str = Field(index=True)   # cookie/session ID from the browser
    domain: str = Field(index=True)             # which website this consent belongs to
    created_at: datetime = Field(default_factory=datetime.utcnow)
    previous_record_id: Optional[int] = Field(
        default=None, foreign_key="consentrecord.id"
    )


class ConsentDecision(SQLModel, table=True):
    """The yes/no decision for one category within one ConsentRecord."""
    id: Optional[int] = Field(default=None, primary_key=True)
    consent_record_id: int = Field(foreign_key="consentrecord.id")
    category_id: int = Field(foreign_key="consentcategory.id")
    accepted: bool
