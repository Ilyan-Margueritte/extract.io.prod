"""
API Router for API Key Management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os

from database import get_db
from models import User, ApiKey, ApiKeyUsage
from schemas import ApiKeyCreate, ApiKeyResponse, ApiKeyWithSecret, ApiKeyStats
from auth import get_current_user

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


def require_premium_subscription(user: User):
    """Verify user has an active premium subscription (skip in dev mode)"""
    if os.getenv("APP_ENV") == "development":
        return
    if not user.subscription or user.subscription.status != "active" or not user.subscription.plan.startswith("premium"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required. Please upgrade your plan to use API keys."
        )


@router.get("", response_model=List[ApiKeyResponse])
def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API keys for the current user"""
    require_premium_subscription(current_user)
    api_keys = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id
    ).order_by(ApiKey.created_at.desc()).all()
    return api_keys


@router.post("", response_model=ApiKeyWithSecret, status_code=status.HTTP_201_CREATED)
def create_api_key(
    key_data: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API key"""
    require_premium_subscription(current_user)
    api_key, secret_key = ApiKey.create(
        user_id=current_user.id,
        name=key_data.name
    )

    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    return ApiKeyWithSecret(
        id=api_key.id,
        key_prefix=api_key.key_prefix,
        name=api_key.name,
        is_active=api_key.is_active,
        last_used=api_key.last_used,
        created_at=api_key.created_at,
        secret_key=secret_key  # Only shown once!
    )


@router.delete("/{key_id}")
def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an API key"""
    api_key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.user_id == current_user.id
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    db.delete(api_key)
    db.commit()

    return {"message": "API key deleted successfully"}


@router.post("/{key_id}/toggle")
def toggle_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle API key active status"""
    api_key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.user_id == current_user.id
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    api_key.is_active = not api_key.is_active
    db.commit()
    db.refresh(api_key)

    return {"message": f"API key {'activated' if api_key.is_active else 'deactivated'}"}


@router.get("/stats/all", response_model=List[ApiKeyStats])
def get_all_api_key_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get stats for all API keys of the current user"""
    api_keys = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id
    ).order_by(ApiKey.created_at.desc()).all()

    result = []
    for key in api_keys:
        total_calls = db.query(ApiKeyUsage).filter(
            ApiKeyUsage.api_key_id == key.id
        ).count()

        total_errors = db.query(ApiKeyUsage).filter(
            ApiKeyUsage.api_key_id == key.id,
            ApiKeyUsage.status_code >= 400
        ).count()

        result.append(ApiKeyStats(
            id=key.id,
            key_prefix=key.key_prefix,
            name=key.name,
            is_active=key.is_active,
            last_used=key.last_used,
            created_at=key.created_at,
            total_calls=total_calls,
            total_errors=total_errors,
        ))

    return result
