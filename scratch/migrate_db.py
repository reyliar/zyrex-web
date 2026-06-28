import sqlite3

db_path = r"c:\Users\reyli\Desktop\zyrex-bot\data\zyrex.db"
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check columns in cloud_accounts
    cursor.execute("PRAGMA table_info(cloud_accounts)")
    columns = [row[1] for row in cursor.fetchall()]
    print("Existing columns:", columns)
    
    if "sftpgo_password" not in columns:
        print("Adding sftpgo_password column...")
        conn.execute("ALTER TABLE cloud_accounts ADD COLUMN sftpgo_password TEXT")
        conn.commit()
        print("Column added successfully.")
    
    # Update reyliar password
    conn.execute(
        "UPDATE cloud_accounts SET sftpgo_password = ? WHERE sftpgo_username = ?", 
        ("coolalkim5501", "reyliar")
    )
    conn.commit()
    print("Reyliar password updated.")
    
    # Check reyliar details
    cursor.execute("SELECT * FROM cloud_accounts WHERE sftpgo_username = 'reyliar'")
    row = cursor.fetchone()
    print("Reyliar row:", dict(zip([col[0] for col in cursor.description], row)) if row else "Not found")
    
    # Also verify test product
    cursor.execute("SELECT * FROM products WHERE id = 'test-cinematic-preset'")
    prod = cursor.fetchone()
    print("Test product:", dict(zip([col[0] for col in cursor.description], prod)) if prod else "Not found")
    
    conn.close()
except Exception as e:
    print("Error during migration:", e)
