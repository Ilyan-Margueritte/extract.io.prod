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
    clerk_id = Column(String(255), unique=True, index=True, nullable=True) # For Clerk.com Auth
    password_hash = Column(String(255), nullable=True) # Optional if using Clerk
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")
    scrape_jobs = relationship("ScrapeJob", back_populates="user", cascade="all, delete-orphan")
    usage_records = relationship("Usage", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password: str):
        """Hash and set password using bcrypt"""
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode(), salt).decode('utf-8')

    def verify_password(self, password: str) -> bool:
        """Verify password against hash using bcrypt"""
        if not self.password_hash:
            return False
        return bcrypt.checkpw(password.encode(), self.password_hash.encode('utf-8'))

    def has_active_subscription(self) -> bool:
        """Check if user has an active subscription"""
        return self.subscription and self.subscription.status == "active"

    @property
    def plan(self) -> str:
        """Get user's subscription plan"""
        if self.subscription and self.subscription.status == "active":
            return self.subscription.plan
        return "free"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    plan = Column(String(50), default="free")  # free, premium
    stripe_customer_id = Column(String(255), unique=True, nullable=True)
    stripe_subscription_id = Column(String(255), unique=True, nullable=True)
    status = Column(String(50), default="free")  # free, active, cancelled, past_due
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    cancelled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="subscription")

    # Plan limits
    PLAN_LIMITS = {
        "free": {"scrapes_per_month": 0, "api_calls_per_day": 0},
        "premium": {"scrapes_per_month": -1, "api_calls_per_day": -1}  # -1 = unlimited
    }

    def get_limits(self) -> dict:
        """Get limits for current plan"""
        return self.PLAN_LIMITS.get(self.plan, self.PLAN_LIMITS["free"])


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key_hash = Column(String(64), unique=True, nullable=False, index=True)
    key_prefix = Column(String(8), nullable=False)  # For display purposes (e.g., "ek_a1b2")
    name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    last_used = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="api_keys")

    @classmethod
    def create(cls, user_id: int, name: str = None):
        """Create a new API key and return the key and the model"""
        key = generate_api_key()
        api_key = cls(
            user_id=user_id,
            key_hash=hash_api_key(key),
            key_prefix=key[:8],
            name=name
        )
        return api_key, key

    def verify(self, key: str) -> bool:
        """Verify if the provided key matches this API key using timing-safe comparison"""
        return hmac.compare_digest(self.key_hash, hash_api_key(key))


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    url = Column(Text, nullable=False)
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    result = Column(Text, nullable=True)  # JSON string of the result
    error_message = Column(Text, nullable=True)
    credits_used = Column(Integer, default=1)
    processing_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationship
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

    # Relationship
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
    status = Column(String(50), default="pending")  # pending, paid, failed, refunded
    pdf_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)

    # Relationship
    user = relationship("User")
