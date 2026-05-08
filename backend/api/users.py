"""
API Router for User Management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserUpdate
from auth import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me")
def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    from schemas import SubscriptionInUser
    sub = None
    if current_user.subscription:
        sub = SubscriptionInUser(
            plan=current_user.subscription.plan,
            status=current_user.subscription.status
        )
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at,
        "subscription": sub
    }


@router.put("/me")
def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile"""
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name

    db.commit()
    db.refresh(current_user)

    from schemas import SubscriptionInUser
    sub = None
    if current_user.subscription:
        sub = SubscriptionInUser(
            plan=current_user.subscription.plan,
            status=current_user.subscription.status
        )
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at,
        "subscription": sub
    }


@router.delete("/me")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete user account"""
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}
