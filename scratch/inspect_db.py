import sqlite3

try:
    conn = sqlite3.connect(r"c:\Users\reyli\Desktop\zyrex-bot\data\zyrex.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    for t in tables:
        print(f"Table: {t[0]}")
        print(f"SQL Schema:\n{t[1]}\n")
            
    conn.close()
except Exception as e:
    print("Error:", e)
