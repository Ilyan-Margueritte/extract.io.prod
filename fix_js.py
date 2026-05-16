import re

with open('C:/Users/ordi2525778/Documents/extract.io.prod/frontend/src/components/ScraperTool.jsx', 'r') as f:
    content = f.read()

# Fix the broken lines 140-141
old = """const urls = urlInput.split('\\n').map(u => u.trim()).filter(Boolean)
').map(u => u.trim()).filter(Boolean);"""
new = """const urls = urlInput.split('\\n').map(u => u.trim()).filter(Boolean);"""

content = content.replace(old, new)

with open('C:/Users/ordi2525778/Documents/extract.io.prod/frontend/src/components/ScraperTool.jsx', 'w') as f:
    f.write(content)

print('Fixed!')