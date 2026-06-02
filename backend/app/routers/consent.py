from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import ConsentCategory, ConsentDecision, ConsentRecord
from app.schemas import ConsentIn, ConsentOut, DecisionOut

router = APIRouter(prefix="/consent", tags=["consent"])


@router.post("", response_model=ConsentOut, status_code=201)
def record_consent(payload: ConsentIn, session: Session = Depends(get_session)):
    # Find the most recent record for this user+domain to link the chain
    previous = session.exec(
        select(ConsentRecord)
        .where(ConsentRecord.user_identifier == payload.user_identifier)
        .where(ConsentRecord.domain == payload.domain)
        .order_by(ConsentRecord.id.desc())
    ).first()

    # Create the new immutable consent record
    record = ConsentRecord(
        user_identifier=payload.user_identifier,
        domain=payload.domain,
        previous_record_id=previous.id if previous else None,
    )
    session.add(record)
    session.flush()  # sends INSERT to DB so record.id is assigned — but not committed yet

    # Create one decision row per category in the payload
    decisions_out = []
    for d in payload.decisions:
        category = session.exec(
            select(ConsentCategory).where(ConsentCategory.name == d.category_name)
        ).first()
        if not category:
            raise HTTPException(status_code=400, detail=f"Unknown category: '{d.category_name}'")

        session.add(ConsentDecision(
            consent_record_id=record.id,
            category_id=category.id,
            accepted=d.accepted,
        ))
        decisions_out.append(DecisionOut(category_name=d.category_name, accepted=d.accepted))

    session.commit()
    session.refresh(record)

    return ConsentOut(
        id=record.id,
        user_identifier=record.user_identifier,
        domain=record.domain,
        created_at=record.created_at,
        previous_record_id=record.previous_record_id,
        decisions=decisions_out,
    )


@router.get("/latest", response_model=ConsentOut)
def get_latest_consent(
    user_identifier: str, domain: str, session: Session = Depends(get_session)
):
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

    # Fetch decisions joined with category names
    rows = session.exec(
        select(ConsentDecision, ConsentCategory)
        .join(ConsentCategory, ConsentDecision.category_id == ConsentCategory.id)
        .where(ConsentDecision.consent_record_id == record.id)
    ).all()

    decisions_out = [
        DecisionOut(category_name=cat.name, accepted=dec.accepted)
        for dec, cat in rows
    ]

    return ConsentOut(
        id=record.id,
        user_identifier=record.user_identifier,
        domain=record.domain,
        created_at=record.created_at,
        previous_record_id=record.previous_record_id,
        decisions=decisions_out,
    )
