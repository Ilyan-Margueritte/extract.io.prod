"""
Extract.io SaaS - Main FastAPI Application
"""
import os
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Validation des variables d'environnement critiques
REQUIRED_ENV_VARS = [
    "CLERK_PUBLIC_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "API_KEY_PEPPER",
    "DATABASE_URL",
]
for var in REQUIRED_ENV_VARS:
    if not os.getenv(var):
        raise RuntimeError(f"Variable d'environnement manquante : {var}")

from database import engine, Base, get_db
from sqlalchemy.orm import Session
from models import User
from api import auth as auth_router, users, dashboard, api_keys, scrape, billing
from auth import get_authenticated_user
from scraper import StoreInfo

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup: Create database tables
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
    yield
    # Shutdown: Cleanup if needed
    logger.info("Shutting down...")


app = FastAPI(
    title="Extract.io API",
    description="SaaS API for contact extraction from e-commerce websites",
    version="2.0.0",
    lifespan=lifespan
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests and their duration"""
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {duration:.3f}s")
    return response

# Enable CORS for frontend (Must be outermost middleware)
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [origin.strip() for origin in allowed_origins_raw.split(",")]
logger.info(f"CORS Allowed Origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CORS is already handled by CORSMiddleware above. 
# Removing dynamic force_cors_middleware for security.


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Include routers
app.include_router(auth_router.router, prefix="/v1")
app.include_router(users.router, prefix="/v1")
app.include_router(dashboard.router, prefix="/v1")
app.include_router(api_keys.router, prefix="/v1")
app.include_router(scrape.router, prefix="/v1")
app.include_router(billing.router, prefix="/v1")


# Legacy endpoints (for backward compatibility) - NOW PROTECTED
@app.post("/scrape", response_model=StoreInfo)
async def legacy_scrape_endpoint(
    request: scrape.ScrapeRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Legacy scrape endpoint (will be deprecated)"""
    return await scrape.create_scrape_job(request=request, user=user, db=db)

@app.post("/scrape-bulk", response_model=list[StoreInfo])
async def legacy_scrape_bulk_endpoint(
    request: scrape.BulkScrapeRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Legacy bulk scrape endpoint (will be deprecated)"""
    return await scrape.create_bulk_scrape_jobs(urls=request.urls, user=user, db=db)


@app.get("/")
async def root():
    """API health check"""
    return {
        "name": "Extract.io API",
        "version": "2.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
