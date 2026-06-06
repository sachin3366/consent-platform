from sqlmodel import Session, select

from app.cache import cache_key, redis_client
from app.celery_app import celery_app
from app.database import engine
from app.models import ConsentCategory, ConsentDecision, ConsentRecord


@celery_app.task
def write_consent_record(user_identifier: str, domain: str, decisions: list[dict]):
    with Session(engine) as session:
        previous = session.exec(
            select(ConsentRecord)
            .where(ConsentRecord.user_identifier == user_identifier)
            .where(ConsentRecord.domain == domain)
            .order_by(ConsentRecord.id.desc())
        ).first()

        record = ConsentRecord(
            user_identifier=user_identifier,
            domain=domain,
            previous_record_id=previous.id if previous else None,
        )
        session.add(record)
        session.flush()

        for d in decisions:
            category = session.exec(
                select(ConsentCategory).where(ConsentCategory.name == d["category_name"])
            ).first()
            if category:
                session.add(ConsentDecision(
                    consent_record_id=record.id,
                    category_id=category.id,
                    accepted=d["accepted"],
                ))

        session.commit()
        redis_client.delete(cache_key(user_identifier, domain))
