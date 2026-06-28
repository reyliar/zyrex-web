"""
Sync SFTPGo user descriptions with Discord IDs from local bot database.
"""
import urllib.request
import json
import base64
import sqlite3

SFTPGO_API = "https://storage.zyrexediting.xyz/api/v2"
SFTPGO_ADMIN = "reyliar"
SFTPGO_PASS = "coolalkim5501"

# Get SFTPGo auth token
auth_header = base64.b64encode(f"{SFTPGO_ADMIN}:{SFTPGO_PASS}".encode()).decode()
req = urllib.request.Request(f"{SFTPGO_API}/token")
req.add_header("Authorization", f"Basic {auth_header}")
req.add_header("User-Agent", "ZyrexMigrate/1.0")

with urllib.request.urlopen(req) as r:
    token_data = json.loads(r.read().decode())
    token = token_data["access_token"]
    print(f"SFTPGo auth OK")

# Read mappings from local DB
db = sqlite3.connect(r"c:\Users\reyli\Desktop\zyrex-bot\data\zyrex.db")
rows = db.execute("SELECT discord_id, sftpgo_username, display_name FROM cloud_accounts").fetchall()
db.close()

print(f"Found {len(rows)} account(s) to migrate:")
for discord_id, username, display_name in rows:
    print(f"  {username} -> Discord:{discord_id} ({display_name})")

# Update each SFTPGo user's description
for discord_id, username, display_name in rows:
    req2 = urllib.request.Request(f"{SFTPGO_API}/users/{username}")
    req2.add_header("Authorization", f"Bearer {token}")
    req2.add_header("User-Agent", "ZyrexMigrate/1.0")
    try:
        with urllib.request.urlopen(req2) as r2:
            user_data = json.loads(r2.read().decode())
    except Exception as e:
        print(f"  FAIL Get user {username}: {e}")
        continue

    current_desc = user_data.get("description", "") or ""
    if f"discord:{discord_id}" in current_desc:
        print(f"  OK {username} already tagged")
        continue

    parts = [p.strip() for p in current_desc.split("|") if p.strip() and not p.strip().startswith("discord:")]
    if display_name and display_name not in parts:
        parts.insert(0, display_name)
    parts.append(f"discord:{discord_id}")
    new_desc = " | ".join(parts)

    user_data["description"] = new_desc
    update_body = json.dumps(user_data).encode()
    req3 = urllib.request.Request(f"{SFTPGO_API}/users/{username}", method="PUT", data=update_body)
    req3.add_header("Authorization", f"Bearer {token}")
    req3.add_header("Content-Type", "application/json")
    req3.add_header("User-Agent", "ZyrexMigrate/1.0")
    try:
        with urllib.request.urlopen(req3) as r3:
            resp = json.loads(r3.read().decode())
            msg = resp.get("message", "OK")
            print(f"  OK {username} updated: {msg}")
    except Exception as e:
        print(f"  FAIL Update {username}: {e}")

print("Migration complete!")
