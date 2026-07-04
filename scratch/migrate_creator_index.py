"""
Creator Index Migration Script
Extracts usernames from all products' social media URLs and uploads the index to R2.
Run on VPS where bot.py has DB access.
Usage: python migrate_creator_index.py
"""
import sqlite3
import os
import json
import re
import requests

DB_PATH = "data/zyrex.db"
INDEX_API = "https://zyrexediting.xyz/api/data/creators.json"

def get_all_products():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, creator_social_url, creator_username, creator_nickname, author_name FROM products")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def extract_usernames(product):
    """Extract all possible usernames from a product record."""
    usernames = set()
    
    social_url = (product.get("creator_social_url") or "").strip()
    creator_username = (product.get("creator_username") or "").strip()
    creator_nickname = (product.get("creator_nickname") or "").strip()
    author_name = (product.get("author_name") or "").strip()
    
    # 1. From creator_username field
    if creator_username:
        usernames.add(creator_username.lower())
    
    # 2. From social URL patterns
    if social_url:
        url_lower = social_url.lower()
        patterns = [
            r'tiktok\.com/@([a-zA-Z0-9_.-]+)',
            r'instagram\.com/([a-zA-Z0-9_.-]+)',
            r'x\.com/([a-zA-Z0-9_.-]+)',
            r'twitter\.com/([a-zA-Z0-9_.-]+)',
            r'youtube\.com/@([a-zA-Z0-9_.-]+)',
        ]
        for pattern in patterns:
            m = re.search(pattern, url_lower)
            if m:
                usernames.add(m.group(1).lower())
    
    # 3. Fallback: use nickname or author_name
    if not usernames:
        fallback = creator_nickname or author_name
        if fallback:
            usernames.add(fallback.lower())
    
    return usernames

def main():
    print("🔍 Fetching products from database...")
    products = get_all_products()
    total = len(products)
    print(f"📦 Found {total} products\n")

    index = {}
    indexed_count = 0

    for p in products:
        pid = p["id"]
        usernames = extract_usernames(p)
        if usernames:
            for uname in usernames:
                if not uname:
                    continue
                if uname not in index:
                    index[uname] = []
                if pid not in index[uname]:
                    index[uname].append(pid)
            indexed_count += 1
    
    unique_usernames = len(index)
    print(f"✅ Indexed {indexed_count}/{total} products → {unique_usernames} unique creators\n")

    # Upload to R2 via Worker API
    print(f"📤 Uploading index to {INDEX_API}...")
    try:
        payload = {"index": index, "count": unique_usernames}
        resp = requests.post(INDEX_API, json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("success"):
                print("✅ Creator index uploaded to R2 successfully!")
            else:
                print(f"❌ Upload failed: {data}")
        else:
            print(f"❌ HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ Upload error: {e}")

    # Also save locally for debugging
    local_path = os.path.join(os.path.dirname(__file__), "creator_index.json")
    with open(local_path, "w", encoding="utf-8") as f:
        json.dump({"index": index, "count": unique_usernames}, f, indent=2, ensure_ascii=False)
    print(f"💾 Local copy saved to {local_path}")

if __name__ == "__main__":
    main()
