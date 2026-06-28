"""Test SFTPGo WebDAV file listing for a user."""
import urllib.request
import json
import base64

SFTPGO_BASE = "https://storage.zyrexediting.xyz"
SFTPGO_API = f"{SFTPGO_BASE}/api/v2"
USER = "reyliar"
PASS = "coolalkim5501"

# Get user token
auth = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
req = urllib.request.Request(f"{SFTPGO_API}/token")
req.add_header("Authorization", f"Basic {auth}")
req.add_header("User-Agent", "Debug/1.0")
with urllib.request.urlopen(req) as r:
    token = json.loads(r.read().decode())["access_token"]
print(f"User token: {token[:20]}...")

# PROPFIND body
PROPFIND_BODY = """<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:resourcetype/>
    <D:getlastmodified/>
    <D:getcontentlength/>
    <D:displayname/>
  </D:prop>
</D:propfind>"""

# Test paths
paths = ["/", "/reyliar/", "/reyliar/gesfxz/"]
for path in paths:
    url = f"{SFTPGO_BASE}{path}"
    print(f"\n=== PROPFIND {url} ===")
    try:
        req2 = urllib.request.Request(url, method="PROPFIND", data=PROPFIND_BODY.encode())
        req2.add_header("Authorization", f"Bearer {token}")
        req2.add_header("Depth", "1")
        req2.add_header("Content-Type", "application/xml")
        req2.add_header("User-Agent", "Debug/1.0")
        with urllib.request.urlopen(req2) as r2:
            content = r2.read().decode()
            print(f"Status: {r2.status}")
            print(content[:2000])
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.reason}")
        body = e.read().decode()
        print(f"Body: {body[:500]}")
    except Exception as e:
        print(f"Failed: {e}")
