# Test extractors standalone
from scraper import extract_prices, extract_products, extract_addresses
import requests
from bs4 import BeautifulSoup

url = 'https://uandglam.com'
resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
try:
    html = resp.content.decode('utf-8')
except:
    html = resp.content.decode('latin-1')

soup = BeautifulSoup(html, 'html.parser')

print("Testing extractors...")

# Test extract_prices
prices = extract_prices(soup, html)
print(f"Prices: {len(prices)}")
for p in prices:
    print(f"  {p}")

# Test extract_products
products = extract_products(soup, url)
print(f"\nProducts: {len(products)}")
for p in products[:2]:
    print(f"  {p.get('name')}: {p.get('price')}")

# Test extract_addresses
addrs = extract_addresses(soup, url, html)
print(f"\nAddresses: {addrs}")

print("\nAll extractors working!")