import re

with open('backend/scraper.py', 'r') as f:
    content = f.read()

# 1. Add import json
content = content.replace(
    "import re\nimport asyncio\nimport requests",
    "import re\nimport json\nimport asyncio\nimport requests"
)

# 2. Update StoreInfo to include addresses, prices, products
old_store = """class StoreInfo(BaseModel):
    name: Optional[str] = None
    emails: List[str] = []
    phones: List[str] = []
    social_links: Dict[str, str] = {}
    url: str
    status: str = "success"
"""

new_store = """class StoreInfo(BaseModel):
    name: Optional[str] = None
    emails: List[str] = []
    phones: List[str] = []
    social_links: Dict[str, str] = {}
    addresses: List[str] = []
    prices: List[Dict] = []
    products: List[Dict] = []
    url: str
    status: str = "success"
"""

content = content.replace(old_store, new_store)

# 3. Update scrape_store to add all_addresses, all_prices, all_products init
old_init = """    all_socials = {}
    store_name = base_domain"""

new_init = """    all_socials = {}
    all_addresses = []
    all_prices = []
    all_products = []
    store_name = base_domain"""

content = content.replace(old_init, new_init)

# 4. Update clean_and_extract return statement
old_return = """    return name, emails, phones, social_links, list(set(contact_links))"""

new_return = """    # --- ADDRESSES ---
    addresses = []
    # TODO: Implement address extraction

    # --- PRICES ---
    prices = extract_prices(soup, html)

    # --- PRODUCTS ---
    products = extract_products(soup, source_url)

    return name, emails, phones, social_links, list(set(contact_links)), \\
           addresses, prices, products"""

content = content.replace(old_return, new_return)

# 5. Update main return in scrape_store to include addresses, prices, products
old_main_return = "return StoreInfo(\n        name=store_name,\n        emails=list(all_emails),\n        phones=list(all_phones),\n        social_links=all_socials,\n        url=url\n    )"

new_main_return = "return StoreInfo(\n        name=store_name,\n        emails=list(all_emails),\n        phones=list(all_phones),\n        social_links=all_socials,\n        addresses=all_addresses,\n        prices=all_prices,\n        products=all_products,\n        url=url\n    )"

content = content.replace(old_main_return, new_main_return)

# 6. Update early return in scrape_store
old_early_return = "return StoreInfo(name=store_name, emails=list(all_emails), phones=list(all_phones), social_links=all_socials, url=url)"

new_early_return = "return StoreInfo(name=store_name, emails=list(all_emails), phones=list(all_phones), social_links=all_socials, addresses=all_addresses, prices=all_prices, products=all_products, url=url)"

content = content.replace(old_early_return, new_early_return)

# 7. Update clean_and_extract call in scrape_store to unpack new returns
old_unpack = "name, emails, phones, socials, contacts = clean_and_extract(response.text, url)"
new_unpack = "name, emails, phones, socials, contacts, addresses, prices, products = clean_and_extract(response.text, url)"
content = content.replace(old_unpack, new_unpack)

# 8. Add unpacking updates after clean_and_extract
old_updates = "all_emails.update(emails)\n            all_phones.update(phones)\n            all_socials.update(socials)\n            if name: store_name = name"

new_updates = "all_emails.update(emails)\n            all_phones.update(phones)\n            all_socials.update(socials)\n            all_addresses.extend(addresses)\n            all_prices.extend(prices)\n            all_products.extend(products)\n            if name: store_name = name"

content = content.replace(old_updates, new_updates)

# 9. Add new extraction functions at the end of the file
extraction_functions = '''
def extract_prices(soup, html_text):
    """Extraire les prix du HTML via plusieurs heuristiques."""
    prices = []

    # 1. Regex patterns for price formats: 29,90€, €29.90, 29.90 EUR
    price_patterns = [
        r'(\\d{1,3}[,.]\\d{2})\\s*€',      # 29,90€ or 29.90€
        r'€\\s*(\\d{1,3}[,.]\\d{2})',      # €29.90
        r'(\\d{1,3}[,.]\\d{2})\\s*(?:EUR|eur|euros?)\\b',  # 29.90 EUR
    ]

    for pattern in price_patterns:
        for match in re.finditer(pattern, html_text):
            amount_str = match.group(1).replace(',', '.')
            try:
                amount = float(re.sub(r'[^\\d.]', '', amount_str))
                if 0 < amount < 10000:
                    prices.append({
                        'amount': amount,
                        'currency': 'EUR'
                    })
            except ValueError:
                continue

    # 2. JSON-LD price specifications (Product.offers.price)
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                items = [data] + data.get('@graph', []) if '@graph' in data else [data]
                for item in items:
                    if isinstance(item, dict):
                        offers = item.get('offers', {})
                        if isinstance(offers, dict):
                            price_val = offers.get('price')
                            if price_val:
                                currency = offers.get('priceCurrency', 'EUR')
                                try:
                                    prices.append({
                                        'amount': float(price_val),
                                        'currency': currency
                                    })
                                except (ValueError, TypeError):
                                    pass
        except Exception:
            pass

    # Deduplicate
    seen = set()
    unique = []
    for p in prices:
        key = f"{p['amount']:.2f}_{p.get('currency', 'EUR')}"
        if key not in seen:
            seen.add(key)
            unique.append(p)

    return unique[:5]


def extract_products(soup, source_url):
    """Extraire les produits du HTML via plusieurs heuristiques."""
    products = []

    # 1. JSON-LD Product items
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                items = [data] + data.get('@graph', []) if '@graph' in data else [data]
                for item in items:
                    if isinstance(item, dict) and item.get('@type') == 'Product':
                        prod = {
                            'name': item.get('name', ''),
                            'price': None,
                            'image_url': None,
                            'url': item.get('url') or item.get('@id'),
                            'sku': item.get('sku', '')
                        }
                        offers = item.get('offers', {})
                        if offers and isinstance(offers, dict):
                            price_val = offers.get('price')
                            if price_val:
                                prod['price'] = {
                                    'amount': float(price_val),
                                    'currency': offers.get('priceCurrency', 'EUR')
                                }
                        images = item.get('image', [])
                        if images and isinstance(images, list):
                            prod['image_url'] = images[0] if isinstance(images[0], str) else None
                        if prod['name']:
                            products.append(prod)
        except Exception:
            pass

    # 2. CSS class patterns for product containers
    product_selectors = ['product', 'produit', 'item', 'card', 'article', 'shop-item']
    seen_names = set()
    for selector in product_selectors:
        for el in soup.find_all(class_=re.compile(selector, re.IGNORECASE)):
            name_el = el.find(['h1', 'h2', 'h3', 'a'])
            if name_el:
                name = name_el.get_text(strip=True)
                if name and len(name) > 2 and name not in seen_names:
                    seen_names.add(name)
                    price_el = el.find(class_=re.compile('price|prix|cost|amount', re.IGNORECASE))
                    price_val = None
                    if price_el:
                        price_text = price_el.get_text(strip=True)
                        price_match = re.search(r'(\\d{1,3}[,.]\\d{2})', price_text)
                        if price_match:
                            price_val = {
                                'amount': float(price_match.group(1).replace(',', '.')),
                                'currency': 'EUR'
                            }

                    products.append({
                        'name': name,
                        'price': price_val,
                        'image_url': None,
                        'url': source_url,
                        'sku': ''
                    })
                    if len(products) >= 5:
                        return products
        if len(products) >= 5:
            break

    return products[:5]
'''

# Add extraction functions before the final return statement in scrape_store
content = content.replace(
    "    # Log summary",
    extraction_functions + "\n    # Log summary"
)

with open('backend/scraper_modified.py', 'w') as f:
    f.write(content)

print("Modified file written to scraper_modified.py")
print(f"Total size: {len(content)} chars")

# Verify syntax
try:
    import ast
    with open('backend/scraper_modified.py', 'r') as f:
        source = f.read()
    ast.parse(source)
    print("Syntax: OK")
except SyntaxError as e:
    print(f"Syntax Error: {e}")