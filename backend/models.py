"""
SQLAlchemy models for Extract.io SaaS
"""
import uuid
import hashlib
import hmac
import os
import bcrypt
from datetime import datetime, timedelta
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, ForeignKey,
    Text, Float, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from database import Base


def generate_api_key():
    """Generate a random API key"""
    return f"ek_{uuid.uuid4().hex}"


def hash_api_key(key: str) -> str:
    """Hash an API key for storage with pepper"""
    pepper = os.getenv("API_KEY_PEPPER")
    if not pepper:
        raise RuntimeError("API_KEY_PEPPER est manquant. Définis-le dans .env")
    return hashlib.sha256((key + pepper).encode()).hexdigest()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    clerk_id = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")
    scrape_jobs = relationship("ScrapeJob", back_populates="user", cascade="all, delete-orphan")
    usage_records = relationship("Usage", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password: str):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode(), salt).decode('utf-8')

    def verify_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return bcrypt.checkpw(password.encode(), self.password_hash.encode('utf-8'))

    def has_active_subscription(self) -> bool:
        return self.subscription and self.subscription.status == "active"

    @property
    def plan(self) -> str:
        if self.subscription and self.subscription.status == "active":
            return self.subscription.plan
        return "free"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    plan = Column(String(50), default="free")
    stripe_customer_id = Column(String(255), unique=True, nullable=True)
    stripe_subscription_id = Column(String(255), unique=True, nullable=True)
    status = Column(String(50), default="free")
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    cancelled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="subscription")

    PLAN_LIMITS = {
        "free": {"scrapes_per_month": 0, "api_calls_per_day": 0},
        "premium_monthly": {"scrapes_per_month": -1, "api_calls_per_day": -1},
        "premium_yearly": {"scrapes_per_month": -1, "api_calls_per_day": -1}
    }

    def get_limits(self) -> dict:
        if self.plan and self.plan.startswith("premium"):
            return {"scrapes_per_month": -1, "api_calls_per_day": -1}
        return self.PLAN_LIMITS.get(self.plan, self.PLAN_LIMITS["free"])


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key_hash = Column(String(64), unique=True, nullable=False, index=True)
    key_prefix = Column(String(8), nullable=False)
    name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    last_used = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="api_keys")

    @classmethod
    def create(cls, user_id: int, name: str = None):
        key = generate_api_key()
        api_key = cls(
            user_id=user_id,
            key_hash=hash_api_key(key),
            key_prefix=key[:8],
            name=name
        )
        return api_key, key

    def verify(self, key: str) -> bool:
        return hmac.compare_digest(self.key_hash, hash_api_key(key))


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    url = Column(Text, nullable=False)
    status = Column(String(50), default="pending")
    result = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    credits_used = Column(Integer, default=1)
    processing_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="scrape_jobs")

    __table_args__ = (
        Index("ix_scrape_jobs_user_created", "user_id", "created_at"),
    )


class Usage(Base):
    __tablename__ = "usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    scrape_count = Column(Integer, default=0)
    api_calls = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="usage_records")

    __table_args__ = (
        UniqueConstraint("user_id", "period_start", name="uq_usage_user_period"),
        Index("ix_usage_user_period", "user_id", "period_start"),
    )


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stripe_invoice_id = Column(String(255), unique=True, nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="EUR")
    status = Column(String(50), default="pending")
    pdf_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)

    user = relationship("User")


class ApiKeyUsage(Base):
    __tablename__ = "api_key_usage"

    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=False)
    endpoint = Column(String(255), nullable=False)
    ip_address = Column(String(45), nullable=True)
    status_code = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    api_key = relationship("ApiKey")