import re
import asyncio
import requests
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from pydantic import BaseModel
import socket
import ipaddress
from fastapi import HTTPException
from typing import List, Optional, Set, Dict
from urllib.parse import urljoin, urlparse

def is_safe_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Check if an IP address is safe to connect to (not private/reserved)"""
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_unspecified)

# --- SÉCURITÉ : Patch contre l'enchaînement SSRF & DNS Rebinding ---
# Cela valide l'IP au moment de la vraie connexion TCP, après résolution DNS finale.
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
    phones: List[str] = []
    social_links: Dict[str, str] = {}
    url: str
    status: str = "success"

def clean_and_extract(html, source_url):
    soup = BeautifulSoup(html, 'html.parser')
    for script in soup(["script", "style"]):
        script.extract()
    text = soup.get_text(separator=' ')

    # Emails
    email_regex = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
    emails = set(re.findall(email_regex, text))
    emails = {e.lower() for e in emails if not e.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.js', '.css', '.woff', '.ttf'))}

    # Phones (Improved Regex for French and International formats)
    phones = set()
    
    # 1. Look for 'mailto:' & 'tel:' links
    for a in soup.find_all('a', href=True):
        href_val = a['href'].lower().strip()
        if href_val.startswith('tel:'):
            p = href_val.replace('tel:', '').strip()
            if len(re.sub(r'\D', '', p)) >= 10:
                phones.add(p)
        elif href_val.startswith('mailto:'):
            # Extract email from mailto
            e = href_val.replace('mailto:', '').split('?')[0].strip()
            if '@' in e and '.' in e:
                emails.add(e.lower())

    # 2. Advanced Regex
    # Matches patterns like: +33 1 23 45 67 89, 06.12.34.56.78, 01-23-45-67-89, etc.
    # Also matches more general US/Intl patterns
    phone_patterns = [
        r'(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}', # French
        r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', # Intl / US
        r'\+?\d{10,14}' # Raw digits
    ]
    
    for pattern in phone_patterns:
        found = re.findall(pattern, text)
        for p in found:
            # Basic validation: must have at least 10 digits
            if len(re.sub(r'\D', '', p)) >= 10:
                phones.add(p.strip())
    
    # Clean up phones (standardize a bit if possible, but keep as found if unsure)
    phones = {p for p in phones if not p.startswith(('123456', '012345'))} # Filter obvious dummy numbers

    # Store Name
    name = None
    title_tag = soup.find('title')
    if title_tag:
        name = title_tag.text.strip().split('|')[0].split('-')[0].strip()
    
    meta_site_name = soup.find('meta', property='og:site_name')
    if meta_site_name:
        name = meta_site_name['content']

    # Socials & Links
    social_links = {}
    contact_links = []
    social_platforms = ['instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'pinterest.com', 'youtube.com', 'tiktok.com']
    
    for a in soup.find_all('a', href=True):
        href = a['href'].lower()
        full_url = urljoin(source_url, a['href'])
        for platform in social_platforms:
            if platform in href:
                plat_name = platform.split('.')[0]
                if plat_name == 'x': plat_name = 'twitter'
                if plat_name not in social_links:
                    social_links[plat_name] = full_url
        if any(keyword in href for keyword in ['contact', 'about', 'propos', 'mentions', 'legal', 'info', 'politique', 'privacy', 'confidentialite', 'terms', 'conditions', 'shipping', 'livraison', 'expedition', 'sav', 'support', 'help', 'aide']):
            contact_links.append(full_url)
            
    return name, emails, phones, social_links, list(set(contact_links))

def validate_url(url: str) -> tuple[str, str]:
    """Validate URL and return (hostname, resolved_ip) if safe"""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL scheme. Only http and https are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL hostname.")

    try:
        # Resolve hostname to IP
        ip_address = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(ip_address)

        # Check if IP is private/reserved
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

    # SSRF Validation - get resolved IP for later verification
    hostname, resolved_ip = validate_url(url)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    base_domain = urlparse(url).netloc
    
    all_emails = set()
    all_phones = set()
    all_socials = {}
    store_name = base_domain
    visited = {url.rstrip('/')}

    # --- PHASE 1: Crawl with Requests (FAST) ---
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            name, emails, phones, socials, contacts = clean_and_extract(response.text, url)
            all_emails.update(emails)
            all_phones.update(phones)
            all_socials.update(socials)
            if name: store_name = name

            # Filter and prioritize contacts
            # We want internal links and subdomains (like service.domain.com)
            root_domain = base_domain.replace('www.', '')
            internal_contacts = []
            for link in contacts:
                link_netloc = urlparse(link).netloc
                if (link_netloc == root_domain or link_netloc.endswith('.' + root_domain)) and link.rstrip('/') not in visited:
                    internal_contacts.append(link)
            
            # Visit up to 8 most relevant subpages
            for link in internal_contacts[:8]:
                try:
                    visited.add(link.rstrip('/'))
                    sub_res = requests.get(link, headers=headers, timeout=5)
                    if sub_res.status_code == 200:
                        _, s_emails, s_phones, s_socials, _ = clean_and_extract(sub_res.text, link)
                        all_emails.update(s_emails)
                        all_phones.update(s_phones)
                        all_socials.update(s_socials)
                except:
                    continue
    except:
        pass

    # If we already have enough info, return early
    if all_emails and all_phones:
        return StoreInfo(name=store_name, emails=list(all_emails), phones=list(all_phones), social_links=all_socials, url=url)

    # --- PHASE 2: Deep crawl with Playwright (if info still missing) ---
    async with async_playwright() as p:
        try:
            # --no-sandbox : nécessaire en environnement serveur Linux
            # Tradeoff accepté : le scraping tourne dans un process isolé
            # Ne pas retirer sans tester la compatibilité serveur
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])

            # Create context with request interception to prevent SSRF via DNS rebinding
            context = await browser.new_context(user_agent=headers["User-Agent"])
            page = await context.new_page()

            # Intercept all requests to verify destination IP (prevents DNS rebinding attacks)
            dns_cache = {}

            async def handle_route(route):
                request_url = route.request.url
                try:
                    parsed = urlparse(request_url)
                    req_hostname = parsed.hostname
                    if req_hostname:
                        # DNS Cache to avoid redundant lookups
                        if req_hostname not in dns_cache:
                            dns_cache[req_hostname] = socket.gethostbyname(req_hostname)
                        
                        req_ip = dns_cache[req_hostname]
                        
                        if not is_safe_ip(ipaddress.ip_address(req_ip)):
                            # Block request to private/reserved IP
                            await route.abort()
                            return
                except Exception:
                    # On any error resolving/verifying, block the request
                    await route.abort()
                    return
                await route.continue_()

            await context.route("**", handle_route)

            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(2)

            content = await page.content()
            name, emails, phones, socials, contacts = clean_and_extract(content, url)

            all_emails.update(emails)
            all_phones.update(phones)
            all_socials.update(socials)
            if name: store_name = name

            # Try the main contact page with Playwright if still no email
            if not all_emails and contacts:
                for link in contacts[:2]:
                    if link.rstrip('/') not in visited:
                        try:
                            await page.goto(link, wait_until="domcontentloaded", timeout=10000)
                            await asyncio.sleep(1)
                            c_content = await page.content()
                            _, c_emails, c_phones, c_socials, _ = clean_and_extract(c_content, link)
                            all_emails.update(c_emails)
                            all_phones.update(c_phones)
                            all_socials.update(c_socials)
                        except: pass

            await browser.close()
        except:
            pass

    return StoreInfo(
        name=store_name,
        emails=list(all_emails),
        phones=list(all_phones),
        social_links=all_socials,
        url=url
    )



