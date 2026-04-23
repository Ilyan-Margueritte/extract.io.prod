from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scraper import scrape_store, StoreInfo
from typing import List
import asyncio
import uvicorn

app = FastAPI(title="Store Scraper API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeRequest(BaseModel):
    url: str

class BulkScrapeRequest(BaseModel):
    urls: List[str]

def format_url(url: str):
    url = url.strip()
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url

@app.post("/scrape", response_model=StoreInfo)
async def scrape_endpoint(request: ScrapeRequest):
    url = format_url(request.url)
    if not url:
        raise HTTPException(status_code=400, detail="URL invalide")
    
    try:
        result = await scrape_store(url)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scrape-bulk", response_model=List[StoreInfo])
async def scrape_bulk_endpoint(request: BulkScrapeRequest):
    urls = [format_url(url) for url in request.urls if format_url(url)]
    if not urls:
        raise HTTPException(status_code=400, detail="Aucune URL valide fournie")
    
    # Limit concurrency to avoid being blocked or overloading
    semaphore = asyncio.Semaphore(5)
    
    async def limited_scrape(url):
        async with semaphore:
            return await scrape_store(url)
    
    tasks = [limited_scrape(url) for url in urls]
    results = await asyncio.gather(*tasks)
    return results

if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support() # Important when running Pyinstaller on Mac/Windows/Linux just in case
    uvicorn.run(app, host="127.0.0.1", port=8000)

