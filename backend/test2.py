import asyncio
from scraper import scrape_store

async def test():
    r = await scrape_store('uandglam.com')
    print('Name:', r.name)
    print('Emails:', r.emails)
    print('Phones:', r.phones[:3] if r.phones else [])
    print('Addresses:', r.addresses)
    print('Prices:', r.prices)
    if r.products:
        print('Products:')
        for p in r.products[:3]:
            print(f"  - {p.get('name')}: {p.get('price')}")

asyncio.run(test())