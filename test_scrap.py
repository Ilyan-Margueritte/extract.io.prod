import asyncio
from backend.scraper import scrape_store

async def main():
    info = await scrape_store("https://doreandrose.com")
    print("Name:", info.name)
    print("Emails:", info.emails)
    print("Phones:", info.phones)
    print("Socials:", info.social_links)

asyncio.run(main())
