import re
import asyncio
import requests
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from pydantic import BaseModel
from typing import List, Optional, Set, Dict
from urllib.parse import urljoin, urlparse

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
    email_regex = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = set(re.findall(email_regex, text))
    emails = {e.lower() for e in emails if not e.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.js', '.css'))}

    # Phones (Improved Regex for French and International formats)
    phones = set()
    
    # 1. Look for 'tel:' links
    for a in soup.find_all('a', href=True):
        if a['href'].startswith('tel:'):
            p = a['href'].replace('tel:', '').strip()
            if len(re.sub(r'\D', '', p)) >= 10:
                phones.add(p)

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
    social_platforms = ['instagram.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'pinterest.com', 'youtube.com', 'tiktok.com']
    
    for a in soup.find_all('a', href=True):
        href = a['href'].lower()
        full_url = urljoin(source_url, a['href'])
        for platform in social_platforms:
            if platform in href:
                plat_name = platform.split('.')[0]
                if plat_name not in social_links:
                    social_links[plat_name] = full_url
        if any(keyword in href for keyword in ['contact', 'about', 'propos', 'mentions', 'legal', 'info']):
            contact_links.append(full_url)
            
    return name, emails, phones, social_links, list(set(contact_links))

async def scrape_store(url: str) -> StoreInfo:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
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
            # We only want internal links to avoid leaving the site
            internal_contacts = []
            for link in contacts:
                if urlparse(link).netloc == base_domain and link.rstrip('/') not in visited:
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
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            context = await browser.new_context(user_agent=headers["User-Agent"])
            page = await context.new_page()
            
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



