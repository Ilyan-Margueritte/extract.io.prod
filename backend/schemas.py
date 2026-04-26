"""
Pydantic schemas for Extract.io SaaS API
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


# === Auth Schemas ===

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenRefresh(BaseModel):
    refresh_token: str


# === User Schemas ===

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: Optional[str]
    is_active: bool
    is_verified: bool
    created_at: datetime
    plan: str = "free"


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


# === Subscription Schemas ===

class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    cancel_at_period_end: bool
    limits: Dict[str, int]

    class Config:
        from_attributes = True


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str


# === API Key Schemas ===

class ApiKeyCreate(BaseModel):
    name: Optional[str] = None


class ApiKeyResponse(BaseModel):
    id: int
    key_prefix: str
    name: Optional[str]
    is_active: bool
    last_used: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ApiKeyWithSecret(ApiKeyResponse):
    secret_key: str  # Only shown once at creation


# === Scrape Job Schemas ===

import json

class ScrapeJobResponse(BaseModel):
    id: int
    url: str
    status: str
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    credits_used: int
    processing_time_ms: Optional[int]
    created_at: datetime
    completed_at: Optional[datetime]

    @field_validator('result', mode='before')
    @classmethod
    def parse_result(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return v

    class Config:
        from_attributes = True


class ScrapeJobListResponse(BaseModel):
    jobs: List[ScrapeJobResponse]
    total: int
    page: int
    page_size: int


# === Usage Schemas ===

class UsageResponse(BaseModel):
    period_start: datetime
    period_end: datetime
    scrape_count: int
    api_calls: int
    limit_scrapes: int
    limit_api_calls: int
    percentage_used: float

    class Config:
        from_attributes = True


# === Invoice Schemas ===

class InvoiceResponse(BaseModel):
    id: int
    amount: float
    currency: str
    status: str
    pdf_url: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime]

    class Config:
        from_attributes = True


# === Dashboard Schemas ===

class DashboardStats(BaseModel):
    total_scrapes: int
    scrapes_this_month: int
    scrapes_remaining: int
    api_calls_today: int
    plan: str
    subscription_status: str
