import requests
from bs4 import BeautifulSoup
import re

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Test main page
html = requests.get("https://uandglam.com", headers=headers, timeout=15).text
soup = BeautifulSoup(html, 'html.parser')
for script in soup(["script", "style"]):
    script.extract()
text = soup.get_text(separator=' ')

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

print("Main page phones:", phones)

# Test subpages
contact_urls = ["/pages/contact", "/pages/contact-us", "/contact", "/pages/Nous-contacter", "/pages/contact-form"]
for path in contact_urls:
    try:
        sub_res = requests.get("https://uandglam.com" + path, headers=headers, timeout=5)
        if sub_res.status_code == 200:
            soup2 = BeautifulSoup(sub_res.text, 'html.parser')
            for script in soup2(["script", "style"]):
                script.extract()
            text2 = soup2.get_text(separator=' ')
            phones2 = set()
            for pattern in phone_patterns:
                found = re.findall(pattern, text2)
                for p in found:
                    if len(re.sub(r'\D', '', p)) >= 10:
                        phones2.add(p.strip())
            if phones2:
                print(f"Contact page {path} phones:", phones2)
    except:
        pass