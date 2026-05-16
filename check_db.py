import sqlite3
conn = sqlite3.connect("C:/Users/ordi2525778/Documents/extract.io.prod/backend/extract_io.db")
cursor = conn.cursor()
cursor.execute("SELECT id, result FROM scrape_jobs WHERE id = 9")
row = cursor.fetchone()
print("ID:", row[0])
print("Result:", row[1])
conn.close()