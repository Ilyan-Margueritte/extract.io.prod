"""
API Router for Billing and Subscriptions
"""
import stripe
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

from database import get_db
from models import User, Subscription, Invoice
from auth import get_authenticated_user

router = APIRouter(prefix="/billing", tags=["Billing"])
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPES_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Plan configurations
PLANS = {
    "premium_monthly": {
        "price_id": os.getenv("STRIPE_PREMIUM_PRICE_ID"),
        "name": "Premium Mensuel",
        "amount": 499,  # 4.99€ in cents
        "description": "Accès premium mensuel"
    },
    "premium_yearly": {
        "price_id": os.getenv("STRIPE_PREMIUM_YEARLY_PRICE_ID"),
        "name": "Premium Annuel",
        "amount": 4499,  # 44.99€ in cents
        "description": "Accès premium annuel"
    }
}


@router.post("/create-checkout-session")
async def create_checkout_session(
    plan: str,
    coupon_code: str = None,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Checkout Session for a plan"""
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    price_id = PLANS[plan]["price_id"]
    if not price_id:
        raise HTTPException(status_code=500, detail="Price ID not configured")

    # Build session parameters
    session_params = {
        "payment_method_types": ["card"],
        "line_items": [{
            "price": price_id,
            "quantity": 1
        }],
        "mode": "subscription",
        "success_url": f"{FRONTEND_URL}/dashboard?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}",
        "cancel_url": f"{FRONTEND_URL}/pricing",
        "customer_email": user.email,
        "metadata": {
            "user_id": str(user.id),
            "plan": plan
        },
        "subscription_data": {
            "metadata": {
                "user_id": str(user.id),
                "plan": plan
            }
        }
    }

    # Code partenaire - activation directe du premium (pas de paiement Stripe)
    partner_code = os.getenv("PARTNER_CODE", "").upper().strip()
    if coupon_code and coupon_code.upper().strip() == partner_code and partner_code:
        logger.info(f"Code partenaire activé: {coupon_code}")

        if not user.subscription:
            user.subscription = Subscription(user_id=user.id)
            db.add(user.subscription)

        user.subscription.plan = plan
        user.subscription.status = "active"
        user.subscription.current_period_end = datetime.utcnow() + timedelta(days=365)
        db.commit()

        return {
            "url": f"{FRONTEND_URL}/dashboard?partner_code=activated",
            "message": "Premium activé avec le code partenaire"
        }

    # Sinon, utiliser Stripe pour les autres codes promo
    if coupon_code:
        coupon_code = coupon_code.upper().strip()
        logger.info(f"Testing coupon code: {coupon_code}")
        try:
            promotion_codes = stripe.promotion_codes.list(code=coupon_code, limit=1)
            if promotion_codes.data:
                session_params["discounts"] = [{"promotion_code": promotion_codes.data[0].id}]
            else:
                session_params["discounts"] = [{"coupon": coupon_code}]
        except Exception as e:
            logger.error(f"Error applying coupon: {e}")
            session_params["discounts"] = [{"coupon": coupon_code}]

    checkout_session = stripe.checkout.Session.create(**session_params)
    return {"url": checkout_session.url}


@router.get("/portal/{subscription_id}")
async def customer_portal(
    subscription_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Customer Portal Session for managing subscriptions"""
    subscription = user.subscription
    if not subscription or not subscription.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    try:
        portal = stripe.billing_portal.Session.create(
            customer=subscription.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/dashboard"
        )
        return {"url": portal.url}
    except Exception as e:
        logger.error(f"Stripe portal error: {e}")
        raise HTTPException(status_code=500, detail="Could not create portal session")