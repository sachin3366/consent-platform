import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.auth import get_api_client
from app.cache import CACHE_TTL, cache_key, redis_client
from app.database import get_session
from app.jurisdictions import CategoryRule, RULES, SUPPORTED
from app.models import APIClient, ConsentCategory, ConsentDecision, ConsentRecord
from app.schemas import (
    CategoryOut, ConsentIn, ConsentOut, ConsentQueued, DecisionOut,
    JurisdictionCategoryRule, JurisdictionRules,
)
from app.tasks import write_consent_record

router = APIRouter(prefix="/consent", tags=["consent"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(session: Session = Depends(get_session)):
    return session.exec(select(ConsentCategory)).all()


@router.get("/rules/{jurisdiction}", response_model=JurisdictionRules)
def get_jurisdiction_rules(jurisdiction: str, session: Session = Depends(get_session)):
    jurisdiction = jurisdiction.upper()
    if jurisdiction not in SUPPORTED:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown jurisdiction '{jurisdiction}'. Supported: {SUPPORTED}",
        )
    config = RULES[jurisdiction]
    categories = session.exec(select(ConsentCategory)).all()

    return JurisdictionRules(
        jurisdiction=jurisdiction,
        banner_title=config.banner_title,
        banner_subtitle=config.banner_subtitle,
        requires_opt_in=config.requires_opt_in,
        button_label=config.button_label,
        categories=[
            JurisdictionCategoryRule(
                name=cat.name,
                description=cat.description,
                default_accepted=config.category_rules.get(
                    cat.name, CategoryRule(default_accepted=False, locked=False)
                ).default_accepted,
                locked=config.category_rules.get(
                    cat.name, CategoryRule(default_accepted=False, locked=False)
                ).locked,
                label=config.category_rules.get(cat.name, CategoryRule(False, False)).label,
            )
            for cat in categories
        ],
    )


@router.post("", response_model=ConsentQueued, status_code=202)
def record_consent(
    payload: ConsentIn,
    client: APIClient = Depends(get_api_client),
):
    if payload.domain != client.domain:
        raise HTTPException(status_code=403, detail="Domain not authorized for this API key")

    write_consent_record.delay(
        payload.user_identifier,
        payload.domain,
        [d.model_dump() for d in payload.decisions],
        payload.jurisdiction,
    )
    return ConsentQueued(user_identifier=payload.user_identifier, domain=payload.domain)


@router.get("/history", response_model=list[ConsentOut])
def get_consent_history(
    user_identifier: str,
    domain: str,
    session: Session = Depends(get_session),
    client: APIClient = Depends(get_api_client),
):
    if domain != client.domain:
        raise HTTPException(status_code=403, detail="Domain not authorized for this API key")
    records = session.exec(
        select(ConsentRecord)
        .where(ConsentRecord.user_identifier == user_identifier)
        .where(ConsentRecord.domain == domain)
        .order_by(ConsentRecord.id.desc())
    ).all()

    if not records:
        raise HTTPException(
            status_code=404,
            detail="No consent records found for this user and domain.",
        )

    history = []
    for record in records:
        rows = session.exec(
            select(ConsentDecision, ConsentCategory)
            .join(ConsentCategory, ConsentDecision.category_id == ConsentCategory.id)
            .where(ConsentDecision.consent_record_id == record.id)
        ).all()

        history.append(ConsentOut(
            id=record.id,
            user_identifier=record.user_identifier,
            domain=record.domain,
            created_at=record.created_at,
            previous_record_id=record.previous_record_id,
            decisions=[
                DecisionOut(category_name=cat.name, accepted=dec.accepted)
                for dec, cat in rows
            ],
        ))

    return history


@router.get("/latest", response_model=ConsentOut)
def get_latest_consent(
    user_identifier: str,
    domain: str,
    session: Session = Depends(get_session),
    client: APIClient = Depends(get_api_client),
):
    if domain != client.domain:
        raise HTTPException(status_code=403, detail="Domain not authorized for this API key")

    key = cache_key(user_identifier, domain)

    # Cache hit — return immediately without touching PostgreSQL
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)

    # Cache miss — query PostgreSQL
    record = session.exec(
        select(ConsentRecord)
        .where(ConsentRecord.user_identifier == user_identifier)
        .where(ConsentRecord.domain == domain)
        .order_by(ConsentRecord.id.desc())
    ).first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No consent record found for this user and domain.",
        )

    rows = session.exec(
        select(ConsentDecision, ConsentCategory)
        .join(ConsentCategory, ConsentDecision.category_id == ConsentCategory.id)
        .where(ConsentDecision.consent_record_id == record.id)
    ).all()

    result = ConsentOut(
        id=record.id,
        user_identifier=record.user_identifier,
        domain=record.domain,
        created_at=record.created_at,
        previous_record_id=record.previous_record_id,
        decisions=[
            DecisionOut(category_name=cat.name, accepted=dec.accepted)
            for dec, cat in rows
        ],
    )

    # Store in Redis — expires automatically after CACHE_TTL seconds
    redis_client.setex(key, CACHE_TTL, result.model_dump_json())

    return result
