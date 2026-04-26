"""
API Router for Authentication (Clerk Integration)
"""
from fastapi import APIRouter, Depends
from models import User
from auth import get_current_user
from schemas import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information from Clerk session"""
    return current_user
