"""
Clerk Authentication for Extract.io SaaS
"""
import os
import httpx
from typing import Optional
from jose import jwt, JWTError, jwk
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User, Subscription

security = HTTPBearer(auto_error=False)

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_API_URL = os.getenv("CLERK_API_URL", "https://api.clerk.com/v1")

# JWKS verification for better security and flexibility
_jwks_cache = None

async def get_jwks():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    
    jwks_url = os.getenv("CLERK_JWKS_URL")
    if not jwks_url:
        return None
        
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(jwks_url)
            if response.status_code == 200:
                _jwks_cache = response.json()
                return _jwks_cache
        except Exception as e:
            print(f"Error fetching JWKS: {e}")
    return None

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user from Clerk JWT token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    
    try:
        # 1. Try local PEM validation if available
        CLERK_PUBLIC_KEY = os.getenv("CLERK_PUBLIC_KEY")
        if CLERK_PUBLIC_KEY and "placeholder" not in CLERK_PUBLIC_KEY:
            payload = jwt.decode(
                token, 
                CLERK_PUBLIC_KEY, 
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
        else:
            # 2. Try JWKS validation
            jwks_data = await get_jwks()
            if jwks_data:
                # Find the matching key in JWKS
                header = jwt.get_unverified_header(token)
                kid = header.get("kid")
                
                public_key = None
                for key_data in jwks_data.get("keys", []):
                    if key_data.get("kid") == kid:
                        public_key = jwk.construct(key_data)
                        break
                
                if public_key:
                    payload = jwt.decode(
                        token, 
                        public_key.to_pem().decode('utf-8'), 
                        algorithms=["RS256"],
                        options={"verify_aud": False}
                    )
                else:
                    raise Exception(f"No matching key found in JWKS for kid: {kid}")
            else:
                raise Exception("JWT signature verification failed: No Public Key or JWKS URL configured.")
        clerk_id = payload.get("sub")
        
        if not clerk_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")

        # Check if user exists in our local DB, if not, create them (Sync with Clerk)
        user = db.query(User).filter(User.clerk_id == clerk_id).first()
        
        if not user:
            # First time user - Fetch full details from Clerk API
            email = payload.get("email")
            full_name = payload.get("name", "User")
            
            if not email:
                async with httpx.AsyncClient() as client:
                    try:
                        response = await client.get(
                            f"{CLERK_API_URL}/users/{clerk_id}",
                            headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
                        )
                        if response.status_code == 200:
                            clerk_user = response.json()
                            # Get primary email
                            email_id = clerk_user.get("primary_email_address_id")
                            emails = clerk_user.get("email_addresses", [])
                            email = next((e["email_address"] for e in emails if e["id"] == email_id), None)
                            
                            if not email and emails:
                                email = emails[0]["email_address"]
                            
                            first_name = clerk_user.get("first_name", "")
                            last_name = clerk_user.get("last_name", "")
                            if first_name or last_name:
                                full_name = f"{first_name} {last_name}".strip()
                    except Exception as e:
                        print(f"Error fetching user from Clerk: {e}")

            user = User(
                email=email or f"user_{clerk_id}@clerk.com",
                clerk_id=clerk_id,
                full_name=full_name,
                is_active=True
            )
            
            # Create free subscription
            subscription = Subscription(
                plan="free",
                status="free"
            )
            user.subscription = subscription
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid session: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_authenticated_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get authenticated user from either Clerk token or API key"""
    # 1. Try API key first (from X-API-Key header)
    api_key = request.headers.get("X-API-Key")
    if api_key:
        from models import hash_api_key, ApiKey
        key_hash = hash_api_key(api_key)
        db_api_key = db.query(ApiKey).filter(ApiKey.key_hash == key_hash, ApiKey.is_active == True).first()
        if db_api_key:
            return db_api_key.user

    # 2. Try Clerk token
    return await get_current_user(credentials=credentials, db=db)
