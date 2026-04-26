"""
API Router for Billing and Subscriptions
"""
import stripe
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import User, Subscription, Invoice
from auth import get_authenticated_user

router = APIRouter(prefix="/billing", tags=["Billing"])

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Plan configurations
PLANS = {
    "premium": {
        "price_id": os.getenv("STRIPE_PREMIUM_PRICE_ID"),
        "name": "Premium Plan"
    }
}

@router.post("/create-checkout-session")
async def create_checkout_session(
    plan: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Checkout Session for a plan"""
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    price_id = PLANS[plan]["price_id"]
    if not price_id:
        raise HTTPException(status_code=500, detail="Price ID not configured")

    try:
        # Get or create Stripe Customer
        subscription = user.subscription
        customer_id = subscription.stripe_customer_id if subscription else None

        if not customer_id:
            # Create new customer in Stripe
            customer = stripe.Customer.create(
                email=user.email,
                name=user.full_name,
                metadata={"user_id": user.id}
            )
            customer_id = customer.id
            
            # Save customer ID to user's subscription record (or create it)
            if not subscription:
                subscription = Subscription(user_id=user.id, stripe_customer_id=customer_id)
                db.add(subscription)
            else:
                subscription.stripe_customer_id = customer_id
            db.commit()

        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{FRONTEND_URL}/success",
            cancel_url=f"{FRONTEND_URL}/pricing",
            metadata={
                "user_id": user.id,
                "plan": plan
            }
        )
        return {"url": checkout_session.url}
    except stripe.error.StripeError as e:
        # Generic Stripe error
        raise HTTPException(status_code=400, detail=f"Stripe Error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

@router.post("/create-portal-session")
async def create_portal_session(
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Customer Portal Session for managing subscriptions"""
    subscription = user.subscription
    if not subscription or not subscription.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active billing record found")

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=subscription.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/dashboard/settings"
        )
        return {"url": portal_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db)
):
    """Handle Stripe webhooks"""
    payload = await request.body()
    
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        await handle_checkout_completed(session, db)
    
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        handle_subscription_updated(subscription, db)
        
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        await handle_subscription_deleted(subscription, db)
        
    elif event['type'] == 'invoice.paid':
        invoice = event['data']['object']
        handle_invoice_paid(invoice, db)

    return {"status": "success"}
    
async def sync_clerk_metadata(clerk_id: str, plan: str):
    """Update Clerk user metadata to reflect subscription status"""
    CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
    if not CLERK_SECRET_KEY or not clerk_id:
        return

    async with httpx.AsyncClient() as client:
        try:
            await client.patch(
                f"https://api.clerk.com/v1/users/{clerk_id}/metadata",
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
                json={
                    "public_metadata": {
                        "plan": plan
                    }
                }
            )
        except Exception as e:
            print(f"Error syncing Clerk metadata: {e}")

async def handle_checkout_completed(session, db: Session):
    """Process a completed checkout session"""
    user_id = session.metadata.get("user_id")
    plan = session.metadata.get("plan")
    stripe_sub_id = session.subscription
    
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        subscription = user.subscription if user else None
        
        if subscription:
            subscription.plan = plan
            subscription.stripe_subscription_id = stripe_sub_id
            subscription.status = "active"
            db.commit()
            
            # Sync to Clerk for frontend
            if user.clerk_id:
                await sync_clerk_metadata(user.clerk_id, plan)

def handle_subscription_updated(stripe_sub, db: Session):
    """Update local subscription record from Stripe"""
    subscription = db.query(Subscription).filter(
        Subscription.stripe_subscription_id == stripe_sub.id
    ).first()
    
    if subscription:
        # Use .get() or getattr to safely access attributes from the Stripe object
        subscription.status = getattr(stripe_sub, 'status', 'active')
        current_end = getattr(stripe_sub, 'current_period_end', None)
        if current_end:
            subscription.current_period_end = datetime.fromtimestamp(current_end)
        subscription.cancel_at_period_end = getattr(stripe_sub, 'cancel_at_period_end', False)
        db.commit()

async def handle_subscription_deleted(stripe_sub, db: Session):
    """Handle subscription cancellation"""
    subscription = db.query(Subscription).filter(
        Subscription.stripe_subscription_id == stripe_sub.id
    ).first()
    
    if subscription:
        subscription.plan = "free"
        subscription.status = "free"
        subscription.stripe_subscription_id = None
        db.commit()
        
        # Sync to Clerk
        user = db.query(User).filter(User.id == subscription.user_id).first()
        if user and user.clerk_id:
            await sync_clerk_metadata(user.clerk_id, "free")

def handle_invoice_paid(stripe_invoice, db: Session):
    """Handle invoice payment success"""
    customer_id = stripe_invoice.customer
    subscription = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
    
    if subscription:
        invoice = Invoice(
            user_id=subscription.user_id,
            stripe_invoice_id=stripe_invoice.id,
            amount=stripe_invoice.amount_paid / 100.0,
            currency=stripe_invoice.currency.upper(),
            status="paid",
            pdf_url=stripe_invoice.invoice_pdf,
            paid_at=datetime.utcnow()
        )
        db.add(invoice)
        db.commit()
