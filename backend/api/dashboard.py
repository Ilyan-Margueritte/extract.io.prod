"""
API Router for Dashboard and Statistics
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from database import get_db
from models import User, ScrapeJob, Usage, Subscription
from schemas import DashboardStats, UsageResponse
from auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics for the current user"""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Get subscription and limits
    subscription = current_user.subscription or Subscription(plan="free", status="free")
    limits = subscription.get_limits()

    # Count scrapes this month
    scrapes_this_month = db.query(ScrapeJob).filter(
        ScrapeJob.user_id == current_user.id,
        ScrapeJob.created_at >= month_start
    ).count()

    # Calculate remaining scrapes
    if limits["scrapes_per_month"] == -1:  # Unlimited
        scrapes_remaining = -1
    else:
        scrapes_remaining = max(0, limits["scrapes_per_month"] - scrapes_this_month)

    # Get total scrapes
    total_scrapes = db.query(ScrapeJob).filter(
        ScrapeJob.user_id == current_user.id
    ).count()

    # Get API calls today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    api_calls_today = db.query(func.count(ScrapeJob.id)).filter(
        ScrapeJob.user_id == current_user.id,
        ScrapeJob.created_at >= today_start
    ).scalar() or 0

    return DashboardStats(
        total_scrapes=total_scrapes,
        scrapes_this_month=scrapes_this_month,
        scrapes_remaining=scrapes_remaining,
        api_calls_today=api_calls_today,
        plan=subscription.plan,
        subscription_status=subscription.status
    )


@router.get("/usage", response_model=UsageResponse)
def get_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current period usage"""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month_start = (month_start + timedelta(days=32)).replace(day=1)

    # Get or create usage record
    usage = db.query(Usage).filter(
        Usage.user_id == current_user.id,
        Usage.period_start == month_start
    ).first()

    if not usage:
        usage = Usage(
            user_id=current_user.id,
            period_start=month_start,
            period_end=next_month_start,
            scrape_count=0,
            api_calls=0
        )
        db.add(usage)
        db.commit()
        db.refresh(usage)

    # Get limits
    subscription = current_user.subscription or Subscription(plan="free", status="free")
    limits = subscription.get_limits()

    # Calculate percentage used
    if limits["scrapes_per_month"] == -1:
        percentage_used = 0.0
    else:
        percentage_used = (usage.scrape_count / limits["scrapes_per_month"]) * 100

    return UsageResponse(
        period_start=usage.period_start,
        period_end=usage.period_end,
        scrape_count=usage.scrape_count,
        api_calls=usage.api_calls,
        limit_scrapes=limits["scrapes_per_month"],
        limit_api_calls=limits["api_calls_per_day"],
        percentage_used=round(percentage_used, 2)
    )
