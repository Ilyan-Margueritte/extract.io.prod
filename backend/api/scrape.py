"""
API Router for Scrape Operations
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import json

from database import get_db
from models import User, ScrapeJob, Subscription, Usage
from schemas import ScrapeJobResponse, ScrapeJobListResponse
from auth import get_authenticated_user
from scraper import scrape_store, StoreInfo
import logging

logger = logging.getLogger(__name__)

from pydantic import BaseModel

class ScrapeRequest(BaseModel):
    url: str

class BulkScrapeRequest(BaseModel):
    urls: List[str]

router = APIRouter(prefix="/scrape", tags=["Scraping"])


def get_user_limits(user: User) -> dict:
    """Get user's scraping limits based on subscription"""
    subscription = user.subscription
    if not subscription or subscription.status != "active":
        return Subscription.PLAN_LIMITS["free"]
    return subscription.get_limits()


def check_user_limits(user: User, db: Session) -> tuple[bool, str]:
    """Check if user has an active subscription and remaining quota"""
    import os
    from datetime import timedelta

    # STRICT CHECK: Must have an active subscription
    if not user.subscription or user.subscription.status != "active":
        return False, "Active subscription required. Please upgrade your plan."

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # FIX: Use SELECT FOR UPDATE to prevent race conditions during limit check
    # This locks the user row until the current transaction completes
    db.query(User).filter(User.id == user.id).with_for_update().first()

    limits = get_user_limits(user)

    # Check monthly scrape limit
    if limits["scrapes_per_month"] != -1:
        scrapes_this_month = db.query(ScrapeJob).filter(
            ScrapeJob.user_id == user.id,
            ScrapeJob.created_at >= month_start
        ).count()

        if scrapes_this_month >= limits["scrapes_per_month"]:
            return False, "Monthly scrape limit reached. Please upgrade your plan."

    # Check daily API call limit
    if limits["api_calls_per_day"] != -1:
        api_calls_today = db.query(ScrapeJob).filter(
            ScrapeJob.user_id == user.id,
            ScrapeJob.created_at >= today_start
        ).count()

        if api_calls_today >= limits["api_calls_per_day"]:
            return False, "Daily API call limit reached."

    return True, ""


def update_usage(user: User, db: Session):
    """Update user's usage counters"""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month_start = (month_start + timedelta(days=32)).replace(day=1)

    usage = db.query(Usage).filter(
        Usage.user_id == user.id,
        Usage.period_start == month_start
    ).first()

    if not usage:
        usage = Usage(
            user_id=user.id,
            period_start=month_start,
            period_end=next_month_start,
            scrape_count=0,
            api_calls=0
        )
        db.add(usage)

    usage.scrape_count += 1
    usage.api_calls += 1
    db.commit()


@router.post("", response_model=ScrapeJobResponse)
async def create_scrape_job(
    request: ScrapeRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Create and execute a scrape job synchronously"""
    url = request.url

    # Check limits
    can_scrape, error_msg = check_user_limits(user, db)
    if not can_scrape:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_msg
        )

    # Create job record
    job = ScrapeJob(
        user_id=user.id,
        url=url,
        status="processing"
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Execute scrape
    start_time = datetime.utcnow()
    try:
        result = await scrape_store(url)
        processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        job.status = "completed"
        job.result = json.dumps(result.dict())
        job.processing_time_ms = processing_time
        job.credits_used = 1
        job.completed_at = datetime.utcnow()

        # Update usage
        update_usage(user, db)

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(job)

    return job


@router.post("/bulk", response_model=List[ScrapeJobResponse])
async def create_bulk_scrape_jobs(
    urls: List[str],
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Create multiple scrape jobs (limited by plan)"""
    # Check limits
    can_scrape, error_msg = check_user_limits(user, db)
    if not can_scrape:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_msg
        )

    # Limit bulk size based on plan
    subscription = user.subscription
    plan = subscription.plan if subscription and subscription.status == "active" else "free"

    max_bulk = {"free": 10, "pro": 50, "enterprise": 200}.get(plan, 10)

    if len(urls) > max_bulk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bulk size limited to {max_bulk} URLs for your plan. {len(urls)} provided."
        )

    jobs = []
    for url in urls[:max_bulk]:
        job = ScrapeJob(
            user_id=user.id,
            url=url,
            status="pending"
        )
        db.add(job)
        jobs.append(job)

    db.commit()

    # Return pending jobs (async processing would be handled by worker)
    return jobs


@router.get("/history", response_model=ScrapeJobListResponse)
def get_scrape_history(
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Get user's scrape history"""
    query = db.query(ScrapeJob).filter(ScrapeJob.user_id == user.id)

    if status_filter:
        query = query.filter(ScrapeJob.status == status_filter)

    total = query.count()
    jobs = query.order_by(
        ScrapeJob.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()

    return ScrapeJobListResponse(
        jobs=jobs,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{job_id}", response_model=ScrapeJobResponse)
def get_scrape_job(
    job_id: int,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Get a specific scrape job by ID"""
    job = db.query(ScrapeJob).filter(
        ScrapeJob.id == job_id,
        ScrapeJob.user_id == user.id
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scrape job not found"
        )

    return job


@router.delete("/{job_id}")
def delete_scrape_job(
    job_id: int,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Delete a scrape job"""
    job = db.query(ScrapeJob).filter(
        ScrapeJob.id == job_id,
        ScrapeJob.user_id == user.id
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scrape job not found"
        )

    db.delete(job)
    db.commit()

    return {"message": "Scrape job deleted successfully"}
