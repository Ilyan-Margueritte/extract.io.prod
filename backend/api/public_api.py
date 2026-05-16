from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import json
import time
import logging
import os

from database import get_db
from models import User, ApiKey, ApiKeyUsage, ScrapeJob
from schemas import PublicScrapeResponse
from auth import get_authenticated_user, security, get_current_user
from scraper import scrape_store
from fastapi.security import HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["Public API"])


class PublicScrapeRequest(BaseModel):
    url: str


def track_api_call(api_key: ApiKey, endpoint: str, ip: str, status_code: int, duration_ms: int, db: Session):
    usage = ApiKeyUsage(
        api_key_id=api_key.id,
        endpoint=endpoint,
        ip_address=ip,
        status_code=status_code,
        duration_ms=duration_ms,
    )
    api_key.last_used = datetime.utcnow()
    db.add(usage)
    db.commit()


async def get_api_key_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    api_key_header = request.headers.get("X-API-Key")
    if not api_key_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header"
        )

    from models import hash_api_key
    key_hash = hash_api_key(api_key_header)
    api_key = db.query(ApiKey).filter(
        ApiKey.key_hash == key_hash,
        ApiKey.is_active == True
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key"
        )

    user = api_key.user

    if os.getenv("APP_ENV") != "development":
        if not user.subscription or user.subscription.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active subscription required"
            )

    request.state.api_key = api_key
    return user


async def get_api_key_or_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Authentification flexible : X-API-Key OU Bearer token (Clerk)"""
    # 1. Try API key first
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        from models import hash_api_key
        key_hash = hash_api_key(api_key_header)
        api_key = db.query(ApiKey).filter(
            ApiKey.key_hash == key_hash,
            ApiKey.is_active == True
        ).first()
        if api_key:
            user = api_key.user
            if os.getenv("APP_ENV") == "development" or (user.subscription and user.subscription.status == "active"):
                request.state.api_key = api_key
                return user
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active subscription required"
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key"
        )

    # 2. Fallback to Clerk token
    return await get_current_user(credentials=credentials, db=db)


@router.post("/scrape", response_model=PublicScrapeResponse)
async def public_scrape(
    request: Request,
    body: PublicScrapeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_api_key_or_user),
):
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    if not url.startswith("http"):
        url = "https://" + url

    api_key: ApiKey = getattr(request.state, "api_key", None)
    start_time = time.time()

    job = ScrapeJob(user_id=user.id, url=url, status="processing")
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        result = await scrape_store(url)
        processing_time = int((time.time() - start_time) * 1000)

        job.status = "completed"
        job.result = json.dumps(result.dict())
        job.processing_time_ms = processing_time
        job.completed_at = datetime.utcnow()

        if api_key:
            track_api_call(api_key, "POST /public/scrape", request.client.host if request.client else "unknown", 200, processing_time, db)

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)[:500]
        job.completed_at = datetime.utcnow()
        processing_time = int((time.time() - start_time) * 1000)

        if api_key:
            track_api_call(api_key, "POST /public/scrape", request.client.host if request.client else "unknown", 500, processing_time, db)

    db.commit()
    db.refresh(job)

    result_data = {}
    if job.result:
        result_data = json.loads(job.result)

    return PublicScrapeResponse(
        id=job.id,
        url=job.url,
        status=job.status,
        result=result_data if result_data else None,
        error_message=job.error_message,
        credits_used=job.credits_used,
        processing_time_ms=job.processing_time_ms,
        created_at=job.created_at.isoformat() if job.created_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        emails=result_data.get("emails", []),
        valid_emails=result_data.get("valid_emails", []),
        invalid_emails=result_data.get("invalid_emails", []),
        phones=result_data.get("phones", []),
        social_links=result_data.get("social_links", {}),
        addresses=result_data.get("addresses", []),
        prices=result_data.get("prices", []),
        products=result_data.get("products", []),
    )


@router.get("/scrape/{job_id}", response_model=PublicScrapeResponse)
def public_get_job(
    job_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_api_key_user),
):
    api_key: ApiKey = request.state.api_key
    start_time = time.time()

    job = db.query(ScrapeJob).filter(
        ScrapeJob.id == job_id,
        ScrapeJob.user_id == user.id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    duration = int((time.time() - start_time) * 1000)
    track_api_call(api_key, "GET /public/scrape/{id}", request.client.host if request.client else "unknown", 200, duration, db)

    return PublicScrapeResponse(
        id=job.id,
        url=job.url,
        status=job.status,
        result=json.loads(job.result) if job.result else None,
        error_message=job.error_message,
        credits_used=job.credits_used,
        processing_time_ms=job.processing_time_ms,
        created_at=job.created_at.isoformat() if job.created_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
    )


@router.get("/api-keys/stats")
def get_api_key_stats(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_api_key_user),
):
    api_key: ApiKey = request.state.api_key

    total_calls = db.query(ApiKeyUsage).filter(
        ApiKeyUsage.api_key_id == api_key.id
    ).count()

    total_errors = db.query(ApiKeyUsage).filter(
        ApiKeyUsage.api_key_id == api_key.id,
        ApiKeyUsage.status_code >= 400
    ).count()

    recent = db.query(ApiKeyUsage).filter(
        ApiKeyUsage.api_key_id == api_key.id
    ).order_by(ApiKeyUsage.created_at.desc()).limit(10).all()

    return {
        "key_prefix": api_key.key_prefix,
        "is_active": api_key.is_active,
        "total_calls": total_calls,
        "total_errors": total_errors,
        "recent_calls": [
            {
                "endpoint": r.endpoint,
                "status_code": r.status_code,
                "duration_ms": r.duration_ms,
                "created_at": r.created_at.isoformat(),
            }
            for r in recent
        ]
    }