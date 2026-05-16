import ast
with open(r'C:\Users\ordi2525778\Documents\extract.io.prod\backend\scraper.py', 'r') as f:
    source = f.read()
try:
    ast.parse(source)
    print("Syntax OK")
    print(f"Size: {len(source)} chars")
except SyntaxError as e:
    print(f"Syntax Error: {e}")