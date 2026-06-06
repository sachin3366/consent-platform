from fastapi import Depends, Header, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import APIClient


def get_api_client(
    x_api_key: str = Header(...),
    session: Session = Depends(get_session),
) -> APIClient:
    client = session.exec(
        select(APIClient).where(APIClient.api_key == x_api_key)
    ).first()
    if not client:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return client
