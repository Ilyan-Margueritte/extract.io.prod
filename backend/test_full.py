# Full test of scraper with all features
from scraper import clean_and_extract
import requests

url = 'https://uandglam.com'
resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
try:
    html = resp.content.decode('utf-8')
except:
    html = resp.content.decode('latin-1')

name, emails, phones, socials, contacts, addresses, prices, products = clean_and_extract(html, url)
print(f"Name: {name}")
print(f"Emails: {emails}")
print(f"Phones: {list(phones)[:3]}...")
print(f"Social Links: {socials}")
print(f"Contacts: {contacts[:2]}...")
print(f"Addresses: {addresses}")
print(f"Prices: {len(prices)}")
for p in prices:
    print(f"  {p}")
print(f"Products: {len(products)}")
for p in products[:2]:
    print(f"  {p}")