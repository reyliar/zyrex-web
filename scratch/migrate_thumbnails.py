"""
Thumbnail Migration Script
Downloads all existing product thumbnails and uploads them to R2 CDN (thumbnail.zyrexediting.xyz).
Run on VPS where bot.py has DB access.
Usage: python migrate_thumbnails.py
"""
import sqlite3
import os
import json
import time
import requests
from urllib.parse import urlparse

DB_PATH = "data/zyrex.db"
THUMBNAIL_API = "https://zyrexediting.xyz/api/thumbnails/upload"
CDN_BASE = "https://thumbnail.zyrexediting.xyz"

def get_all_products():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, thumbnail FROM products WHERE thumbnail IS NOT NULL AND thumbnail != ''")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def upload_to_cdn(image_url, product_id):
    """Download image and upload to R2 via Worker API."""
    try:
        # Check if already on CDN
        if "thumbnail.zyrexediting.xyz" in image_url:
            return image_url
        
        # Download the image
        resp = requests.get(image_url, timeout=30, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        if resp.status_code != 200:
            print(f"  ❌ Failed to download: HTTP {resp.status_code}")
            return None
        
        # Determine extension
        ext = "jpg"
        content_type = resp.headers.get("Content-Type", "")
        if "png" in content_type:
            ext = "png"
        elif "gif" in content_type:
            ext = "gif"
        elif "webp" in content_type:
            ext = "webp"
        else:
            # Try from URL
            path = urlparse(image_url).path
            if "." in path:
                ext = path.rsplit(".", 1)[-1].split("?")[0].lower()
                if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
                    ext = "jpg"
        
        filename = f"{product_id}.{ext}"
        
        # Upload to R2 via Worker
        import base64
        b64 = base64.b64encode(resp.content).decode()
        upload_resp = requests.post(THUMBNAIL_API, json={
            "filename": filename,
            "data": b64
        }, timeout=30)
        
        if upload_resp.status_code == 200:
            data = upload_resp.json()
            if data.get("success"):
                return f"{CDN_BASE}/{filename}"
        
        print(f"  ❌ Upload failed: {upload_resp.status_code} {upload_resp.text[:100]}")
        return None
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None

def update_product_thumbnail(product_id, new_url):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE products SET thumbnail = ? WHERE id = ?", (new_url, product_id))
    conn.commit()
    conn.close()

def main():
    print("🔍 Fetching products...")
    products = get_all_products()
    total = len(products)
    print(f"📦 Found {total} products with thumbnails\n")
    
    migrated = 0
    skipped = 0
    failed = 0
    
    for i, p in enumerate(products):
        pid = p["id"]
        name = p["name"]
        old_url = p["thumbnail"]
        
        # Skip if already on CDN
        if "thumbnail.zyrexediting.xyz" in old_url:
            skipped += 1
            continue
        
        print(f"[{i+1}/{total}] {name} ({pid})")
        print(f"  📷 {old_url[:80]}...")
        
        new_url = upload_to_cdn(old_url, pid)
        if new_url:
            update_product_thumbnail(pid, new_url)
            print(f"  ✅ → {new_url}")
            migrated += 1
        else:
            failed += 1
            print(f"  ⏭️  Skipped (keeping original)")
        
        time.sleep(0.5)  # Rate limit
    
    print(f"\n{'='*50}")
    print(f"✅ Migrated: {migrated}")
    print(f"⏭️  Already on CDN: {skipped}")
    print(f"❌ Failed: {failed}")
    print(f"📦 Total: {total}")

if __name__ == "__main__":
    main()
