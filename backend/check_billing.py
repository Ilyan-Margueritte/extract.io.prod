import ast
with open(r'C:\Users\ordi2525778\Documents\extract.io.prod\backend\api\billing.py', 'r') as f:
    source = f.read()
try:
    ast.parse(source)
    print("billing.py: Syntax OK")
except SyntaxError as e:
    print(f"Syntax Error: {e}")