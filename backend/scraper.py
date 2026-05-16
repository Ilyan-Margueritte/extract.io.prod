import re
import json
import asyncio
import logging
import requests
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from pydantic import BaseModel
import socket
import ipaddress
import dns.resolver
from fastapi import HTTPException
from typing import List, Optional, Set, Dict
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)

# --- Disposable email domains ---
DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "10minutemail.com",
    "temp-mail.org", "throwaway.email", "guerrillamailblock.com",
    "yopmail.com", "dispostable.com", "mailnesia.com",
    "trash-mail.com", "temp-mail.com", "fakeinbox.com",
    "getairmail.com", "spambog.com", "spamgourmet.com",
    "mohmal.com", "sharklasers.com", "guerrillamail.net",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.ph",
    "pokemail.net", "spamex.com",
    "messagebeamer.de", "maildrop.cc", "mt2009.net",
    "wegwerfmail.de", "weg-werf-email.de", "rcpt.at",
    "deadaddress.com", "mailcatch.com", "spambox.us",
}


def is_safe_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Check if an IP address is safe to connect to (not private/reserved)"""
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_unspecified)


def validate_email_syntax(email: str) -> bool:
    """Basic email syntax validation"""
    pattern = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    return bool(re.match(pattern, email))


def check_mx_record(domain: str) -> bool:
    """Check if domain has valid MX records (can receive email)"""
    try:
        dns.resolver.resolve(domain, 'MX')
        return True
    except Exception:
        return False


def is_disposable_email(email: str) -> bool:
    """Check if email is from a known disposable/temporary provider"""
    domain = email.split('@')[-1].lower().strip() if '@' in email else ''
    return domain in DISPOSABLE_DOMAINS


def validate_email(email: str) -> dict:
    """
    Validate email with syntax + MX + disposable check.
    Returns dict with 'email', 'is_valid', 'reason' keys.
    """
    email = email.lower().strip()
    reason = None

    if not validate_email_syntax(email):
        reason = "invalid_syntax"
    elif is_disposable_email(email):
        reason = "disposable"
    else:
        domain = email.split('@')[-1]
        if not check_mx_record(domain):
            reason = "no_mx_record"

    return {
        "email": email,
        "is_valid": reason is None,
        "reason": reason
    }


# --- SÉCURITÉ : Patch contre l'enchaînement SSRF & DNS Rebinding ---
_orig_connect = socket.socket.connect


def _safe_connect(self, address):
    host = address[0]
    try:
        ip = ipaddress.ip_address(host)
        if not is_safe_ip(ip):
            raise ConnectionRefusedError(f"SSRF bloqué : IP privée {host}")
    except ValueError:
        pass
    return _orig_connect(self, address)


socket.socket.connect = _safe_connect


class StoreInfo(BaseModel):
    name: Optional[str] = None
    emails: List[str] = []
    valid_emails: List[str] = []
    invalid_emails: List[str] = []
    phones: List[str] = []
    social_links: Dict[str, str] = {}
    addresses: List[str] = []
    prices: List[Dict] = []
    products: List[Dict] = []
    url: str
    status: str = "success"


def clean_and_extract(html, source_url):
    soup = BeautifulSoup(html, 'html.parser')
    for script in soup(["script", "style"]):
        script.extract()
    text = soup.get_text(separator=' ')

    # --- EMAILS with validation ---
    email_regex = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
    raw_emails = set(re.findall(email_regex, text))
    raw_emails = {e.lower() for e in raw_emails
                  if not e.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.js', '.css', '.woff', '.ttf'))}

    valid_emails = []
    invalid_emails = []
    for email in raw_emails:
        result = validate_email(email)
        if result["is_valid"]:
            valid_emails.append(result["email"])
        else:
            invalid_emails.append(result["email"])
            logger.debug(f"Invalid email {email}: {result['reason']}")

    for a in soup.find_all('a', href=True):
        href_val = a['href'].lower().strip()
        if href_val.startswith('mailto:'):
            e = href_val.replace('mailto:', '').split('?')[0].strip()
            if '@' in e and '.' in e:
                result = validate_email(e.lower())
                if result["is_valid"] and result["email"] not in valid_emails:
                    valid_emails.append(result["email"])
                elif not result["is_valid"] and result["email"] not in invalid_emails:
                    invalid_emails.append(result["email"])

    # --- PHONES ---
    phones = set()

    for a in soup.find_all('a', href=True):
        href_val = a['href'].lower().strip()
        if href_val.startswith('tel:'):
            p = href_val.replace('tel:', '').strip()
            if len(re.sub(r'\D', '', p)) >= 10:
                phones.add(p)

    phone_patterns = [
        r'(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}',
        r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        r'\+?\d{10,14}'
    ]

    for pattern in phone_patterns:
        found = re.findall(pattern, text)
        for p in found:
            if len(re.sub(r'\D', '', p)) >= 10:
                phones.add(p.strip())

    phones = {p for p in phones if not p.startswith(('123456', '012345'))}

    # --- STORE NAME ---
    name = None
    title_tag = soup.find('title')
    if title_tag:
        name = title_tag.text.strip().split('|')[0].split('-')[0].strip()

    meta_site_name = soup.find('meta', property='og:site_name')
    if meta_site_name:
        name = meta_site_name['content']

    # --- SOCIALS & LINKS ---
    social_links = {}
    contact_links = []
    social_platforms = ['instagram.com', 'facebook.com', 'twitter.com', 'x.com',
                        'linkedin.com', 'pinterest.com', 'youtube.com', 'tiktok.com']

    for a in soup.find_all('a', href=True):
        href = a['href'].lower()
        full_url = urljoin(source_url, a['href'])
        for platform in social_platforms:
            if platform in href:
                plat_name = platform.split('.')[0]
                if plat_name == 'x':
                    plat_name = 'twitter'
                if plat_name not in social_links:
                    social_links[plat_name] = full_url
        if any(keyword in href for keyword in ['contact', 'about', 'propos', 'mentions', 'legal', 'info',
                                                'politique', 'privacy', 'confidentialite', 'terms', 'conditions',
                                                'shipping', 'livraison', 'expedition', 'sav', 'support', 'help', 'aide']):
            contact_links.append(full_url)

    # --- ADDRESSES ---
    addresses = extract_addresses(soup, source_url, html)

    # --- PRICES ---
    prices = extract_prices(soup, html)

    # --- PRODUCTS ---
    products = extract_products(soup, source_url)

    return name, list(valid_emails), list(invalid_emails), phones, social_links, \
           list(set(contact_links)), addresses, prices, products


def extract_addresses(soup, source_url, raw_text=None):
    """Extraire les adresses postales via plusieurs heuristiques."""
    addresses = set()
    text = raw_text if raw_text else soup.get_text(separator=' ')

    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                for item in [data] + data.get('@graph', []) if '@graph' in data else [data]:
                    addr = item.get('address')
                    if isinstance(addr, dict):
                        street = addr.get('streetAddress', '')
                        city = addr.get('addressLocality', '')
                        postal = addr.get('postalCode', '')
                        region = addr.get('addressRegion', '')
                        country = addr.get('addressCountry', '')
                        full = ', '.join(filter(None, [street, f"{postal} {city}", region, country]))
                        if full and len(full) > 5:
                            addresses.add(full.strip())
                    elif isinstance(addr, str) and len(addr) > 5:
                        addresses.add(addr.strip())
        except Exception:
            pass

    french_pattern = r'\d{1,5}\s+[Rr]ue\s+[^,<]+,?\s*\d{4,5}'
    for match in re.finditer(french_pattern, text):
        addr = match.group(0).strip()
        if 10 < len(addr) < 80:
            addresses.add(addr)

    us_pattern = r'\b\d{1,5}\s+\w[\w\s]{3,40}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Circle|Way)\b'
    for match in re.finditer(us_pattern, text, re.IGNORECASE):
        addresses.add(match.group(1).strip())

    false_positive_words = ['panier', 'cart', 'empty', 'vide', 'menu', 'footer',
                           'header', 'button', 'btn', 'link', 'copyright']
    filtered = []
    for addr in addresses:
        addr_lower = addr.lower()
        if any(word in addr_lower for word in false_positive_words):
            continue
        if addr.isdigit():
            continue
        if len(addr) < 8:
            continue
        filtered.append(addr)

    return filtered


def extract_prices(soup, html_text):
    """Extraire les prix via regex et JSON-LD."""
    prices = []

    price_patterns = [
        r'(\d{1,3}[,\.]\d{2})\s*€',
        r'€\s*(\d{1,3}[,\.]\d{2})',
        r'(\d{1,3}[,\.]\d{2})\s*(?:EUR|eur|euros?)\b',
    ]

    for pattern in price_patterns:
        for match in re.finditer(pattern, html_text):
            amount_str = match.group(1).replace(',', '.')
            try:
                amount = float(re.sub(r'[^\d.]', '', amount_str))
                if 0 < amount < 10000:
                    prices.append({'amount': amount, 'currency': 'EUR'})
            except ValueError:
                continue

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

    seen = set()
    unique = []
    for p in prices:
        key = f"{p['amount']:.2f}_{p.get('currency', 'EUR')}"
        if key not in seen:
            seen.add(key)
            unique.append(p)

    return unique[:5]


def extract_products(soup, source_url):
    """Extraire les produits via JSON-LD et CSS heuristics."""
    products = []

    # 1. JSON-LD Product
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
                            'sku': str(item.get('sku', ''))
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

    # 2. CSS class patterns — filtrage strict anti-faux-positifs
    false_positive_names = {
        'aide', 'help', 'contact', 'retours', 'returns', 'expédition',
        'shipping', 'livraison', 'conditions', 'terms', 'privacy',
        'confidentialité', 'politique', 'about', 'à propos', 'mentions',
        'statut de la commande', 'order status', 'panier', 'cart',
        'account', 'compte', 'se connecter', 'sign in', 'register',
        "s'inscrire", 'nos marques', 'brands', 'guide', 'faq',
        'service client', 'customer service', 'suivre', 'track',
        'wishlist', 'favoris', 'soldes', 'promotions', 'new', 'nouveau',
        'connexion', 'login', 'logout', 'déconnexion', 'sitemap',
        'cgv', 'cgu', 'données personnelles', 'rgpd', 'cookies',
        'parrainage', 'affiliate', 'partenaires', 'wholesale',
        'professional', 'press', 'media', 'jobs', 'careers',
        'gift card', 'carte cadeau', 'chèque cadeau', 'code promo'
    }

    product_selectors = ['product', 'produit', 'shop-item', 'product-card', 'product-item', 'product-card-container']
    seen_names = set()

    for selector in product_selectors:
        for el in soup.find_all(class_=re.compile(r'\b' + selector + r'\b', re.IGNORECASE)):
            name_el = el.find(['h1', 'h2', 'h3', 'h4', 'a', 'span'])
            if name_el:
                name = name_el.get_text(strip=True)
                name_lower = name.lower()

                if not name or len(name) < 3 or len(name) > 100:
                    continue
                if name_lower in false_positive_names:
                    continue
                if any(fp in name_lower for fp in ['aide', 'retou', 'expédit', 'livrais', 'condit', 'confid',
                                                    'mention', 'politiqu', 'statut', 'command', 'panier',
                                                    'compte', 'connect', 'sinsncr', 'sinscrir']):
                    continue
                if name in seen_names:
                    continue
                seen_names.add(name)

                price_el = el.find(class_=re.compile(r'\b(price|prix|cost|amount|product-price|product_price)\b', re.IGNORECASE))
                price_val = None
                if price_el:
                    price_text = price_el.get_text(strip=True)
                    price_match = re.search(r'[\$€£]\s*(\d{1,3}[,\.]\d{2})', price_text)
                    if not price_match:
                        price_match = re.search(r'(\d{1,3}[,\.]\d{2})\s*(?:€|eur|usd|\$|£)', price_text)
                    if not price_match:
                        price_match = re.search(r'(\d{1,3}[,\.]\d{2})', price_text)
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
                if len(products) >= 10:
                    return products
        if len(products) >= 10:
            break

    return products[:10]


def validate_url(url: str) -> tuple[str, str]:
    """Validate URL and return (hostname, resolved_ip) if safe"""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL scheme. Only http and https are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL hostname.")

    try:
        ip_address = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(ip_address)
        if not is_safe_ip(ip):
            raise HTTPException(status_code=400, detail="Access to private or reserved IP addresses is not allowed.")
        return hostname, ip_address
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve hostname.")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address.")


async def scrape_store(url: str) -> StoreInfo:
    url = url.strip()
    if not url.startswith('http'):
        url = 'https://' + url

    hostname, resolved_ip = validate_url(url)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    base_domain = urlparse(url).netloc

    all_emails = set()
    all_valid_emails = []
    all_invalid_emails = []
    all_phones = set()
    all_socials = {}
    all_addresses = []
    all_prices = []
    all_products = []
    store_name = base_domain
    visited = {url.rstrip('/')}

    # --- PHASE 1: Crawl with Requests (FAST) ---
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            name, valid_emails, invalid_emails, phones, socials, contacts, addresses, prices, products = clean_and_extract(response.text, url)
            all_emails.update(valid_emails)
            all_valid_emails.extend(valid_emails)
            all_invalid_emails.extend(invalid_emails)
            all_phones.update(phones)
            all_socials.update(socials)
            all_addresses.extend(addresses)
            all_prices.extend(prices)
            all_products.extend(products)
            if name:
                store_name = name

            root_domain = base_domain.replace('www.', '')
            internal_contacts = []
            for link in contacts:
                link_netloc = urlparse(link).netloc
                if (link_netloc == root_domain or link_netloc.endswith('.' + root_domain)) and link.rstrip('/') not in visited:
                    internal_contacts.append(link)

            for link in internal_contacts[:8]:
                try:
                    visited.add(link.rstrip('/'))
                    sub_res = requests.get(link, headers=headers, timeout=5)
                    if sub_res.status_code == 200:
                        _, s_valid, s_invalid, s_phones, s_socials, _ = clean_and_extract(sub_res.text, link)
                        all_emails.update(s_valid)
                        all_valid_emails.extend(s_valid)
                        all_invalid_emails.extend(s_invalid)
                        all_phones.update(s_phones)
                        all_socials.update(s_socials)
                except Exception as e:
                    logger.debug(f"Subpage scrape error for {link}: {e}")
                    continue
    except Exception as e:
        logger.error(f"Phase 1 scrape error: {e}")

    all_valid_emails = list(dict.fromkeys(all_valid_emails))
    all_invalid_emails = list(dict.fromkeys(all_invalid_emails))

    if all_emails and all_phones:
        return StoreInfo(
            name=store_name,
            emails=all_valid_emails,
            valid_emails=all_valid_emails,
            invalid_emails=all_invalid_emails,
            phones=list(all_phones),
            social_links=all_socials,
            addresses=all_addresses,
            prices=all_prices,
            products=all_products,
            url=url
        )

    # --- PHASE 2: Deep crawl with Playwright ---
    try:
        playwright_browser = await async_playwright().start()
        try:
            browser = await playwright_browser.chromium.launch(headless=True, args=['--no-sandbox'])
        except NotImplementedError:
            browser = await playwright_browser.chromium.launch(headless=False)

        context = await browser.new_context(user_agent=headers["User-Agent"])
        page = await context.new_page()

        dns_cache = {}

        async def handle_route(route):
            request_url = route.request.url
            try:
                parsed = urlparse(request_url)
                req_hostname = parsed.hostname
                if req_hostname:
                    if req_hostname not in dns_cache:
                        dns_cache[req_hostname] = socket.gethostbyname(req_hostname)
                    req_ip = dns_cache[req_hostname]
                    if not is_safe_ip(ipaddress.ip_address(req_ip)):
                        await route.abort()
                        return
            except Exception:
                await route.abort()
                return
            await route.continue_()

        await context.route("**", handle_route)

        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(2)

        content = await page.content()
        name, valid_emails, invalid_emails, phones, socials, contacts, addresses, prices, products = clean_and_extract(content, url)

        all_emails.update(valid_emails)
        all_valid_emails.extend(valid_emails)
        all_invalid_emails.extend(invalid_emails)
        all_phones.update(phones)
        all_socials.update(socials)
        all_addresses.extend(addresses)
        all_prices.extend(prices)
        all_products.extend(products)
        if name:
            store_name = name

        if not all_emails and contacts:
            for link in contacts[:2]:
                if link.rstrip('/') not in visited:
                    try:
                        await page.goto(link, wait_until="domcontentloaded", timeout=10000)
                        await asyncio.sleep(1)
                        c_content = await page.content()
                        _, c_valid, c_invalid, c_phones, c_socials, _, c_addresses, c_prices, c_products = clean_and_extract(c_content, link)
                        all_emails.update(c_valid)
                        all_valid_emails.extend(c_valid)
                        all_invalid_emails.extend(c_invalid)
                        all_phones.update(c_phones)
                        all_socials.update(c_socials)
                        all_addresses.extend(c_addresses)
                        all_prices.extend(c_prices)
                        all_products.extend(c_products)
                    except Exception as e:
                        logger.debug(f"Playwright contact page error for {link}: {e}")

        await browser.close()
    except Exception as e:
        logger.error(f"Phase 2 scrape error: {e}")

    return StoreInfo(
        name=store_name,
        emails=all_valid_emails,
        valid_emails=all_valid_emails,
        invalid_emails=all_invalid_emails,
        phones=list(all_phones),
        social_links=all_socials,
        addresses=all_addresses,
        prices=all_prices,
        products=all_products,
        url=url
    )