"""
Rename existing audio files in R2 to "Title - Uploader.ext" format.
Run on the VPS where the bot runs (needs access to bot API and R2 credentials).

Usage: python rename_audio_files.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

BOT_API = os.environ.get("BOT_API", "http://127.0.0.1:12988")
WORKER_URL = os.environ.get("WORKER_URL", "https://zyrexediting.xyz")

def fetch_json(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def main():
    print("Fetching all audio products...")
    try:
        data = fetch_json(f"{BOT_API}/api/products?type=audio")
    except Exception as e:
        print(f"ERROR: Cannot reach bot API at {BOT_API}: {e}")
        print("Make sure the bot is running and BOT_API is set correctly.")
        sys.exit(1)

    if not isinstance(data, list) or len(data) == 0:
        print("No audio products found.")
        return

    print(f"Found {len(data)} audio products.\n")

    renamed = 0
    skipped = 0

    for p in data:
        pid = p.get("id", "?")
        name = (p.get("name") or "Audio").strip()
        author = (p.get("author_name") or "Zyrex").strip()
        file_url = (p.get("file_url") or "").strip()

        if not file_url:
            print(f"  SKIP {pid}: no file_url")
            skipped += 1
            continue

        # Check if already in correct format
        safe_name = name.replace('/', '_').replace('\\', '_')[:60]
        safe_author = author.replace('/', '_').replace('\\', '_')[:30]
        expected_pattern = f"{safe_name} - {safe_author}"
        if expected_pattern in file_url:
            print(f"  OK   {pid}: already {expected_pattern}")
            skipped += 1
            continue

        # Extract old R2 key from URL
        # URL format: https://zyrexediting.xyz/api/audio/stream/{oldname}
        old_key = file_url.split("/api/audio/stream/")[-1].split("?")[0]
        if not old_key:
            print(f"  SKIP {pid}: cannot parse old filename from {file_url}")
            skipped += 1
            continue

        # Get extension from old filename
        ext = old_key.split(".")[-1] if "." in old_key else "mp3"
        if ext not in ("mp3", "wav", "flac", "ogg", "aac", "m4a"):
            ext = "mp3"

        new_filename = f"{safe_name} - {safe_author}.{ext}"
        new_url = f"{WORKER_URL}/api/audio/stream/{new_filename}"

        print(f"  RENAME {pid}:")
        print(f"    Old: {old_key}")
        print(f"    New: {new_filename}")
        print(f"    URL: {new_url}")

        try:
            # Call rename endpoint on Worker
            rename_url = f"{WORKER_URL}/api/audio/rename"
            req = urllib.request.Request(
                rename_url,
                data=json.dumps({"old_key": f"audio/{old_key}", "new_key": f"audio/{new_filename}"}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode())
                if result.get("success"):
                    # Update product in bot DB
                    update_url = f"{BOT_API}/api/products/update-field"
                    update_req = urllib.request.Request(
                        update_url,
                        data=json.dumps({"id": pid, "field": "file_url", "value": new_url}).encode(),
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                    with urllib.request.urlopen(update_req) as ur:
                        print(f"    OK: renamed + product updated")
                        renamed += 1
                else:
                    print(f"    FAIL: {result.get('error', 'unknown')}")
                    skipped += 1
        except Exception as e:
            print(f"    ERROR: {e}")
            skipped += 1

    print(f"\nDone. Renamed: {renamed}, Skipped: {skipped}")
    print("Restart the bot after running this script to rebuild the index.")

if __name__ == "__main__":
    main()
