import requests

resp = requests.get("https://uandglam.com", timeout=15)
print("Status:", resp.status_code)
print("Has info@:", "info@" in resp.text)
print("Has 07 75:", "07 75" in resp.text)
print("Has contact:", "contact" in resp.text[:5000])

# Check specific section
if "info@" in resp.text:
    idx = resp.text.find("info@")
    print("Context:", resp.text[idx-50:idx+50])