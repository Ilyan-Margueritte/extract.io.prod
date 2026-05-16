import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin

html = requests.get("https://uandglam.com", timeout=15).text
soup = BeautifulSoup(html, 'html.parser')
for script in soup(["script", "style"]):
    script.extract()
text = soup.get_text(separator=' ')
print("Text sample len:", len(text))
print("\n---")
email_regex = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
emails = set(re.findall(email_regex, text))
print("Emails found:", emails)

phone_patterns = [
    r'(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}',
    r'(?:(?:\+|00)33|0)[-\s.]?\d{9}',
    r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
    r'\b\d{2}[-.\s]\d{2}[-.\s]\d{2}[-.\s]\d{2}[-.\s]\d{2}\b',
]
phones = set()
for pattern in phone_patterns:
    found = re.findall(pattern, text)
    for p in found:
        if len(re.sub(r'\D', '', p)) >= 10:
            phones.add(p.strip())

# Also search in raw HTML
html_lower = html.lower()
email_regex_raw = r'[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
emails_from_html = set(re.findall(email_regex_raw, html_lower))
emails.update(emails_from_html)
print("Phones found:", phones)
print("All Emails:", emails)