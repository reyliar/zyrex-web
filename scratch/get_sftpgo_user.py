import urllib.request
import json
import base64

# Load settings
SFTPGO_API = "https://storage.zyrexediting.xyz/api/v2"
SFTPGO_ADMIN = "reyliar"
SFTPGO_PASS = "coolalkim5501"

# Get Auth Token
auth_header = base64.b64encode(f"{SFTPGO_ADMIN}:{SFTPGO_PASS}".encode()).decode()
req = urllib.request.Request(f"{SFTPGO_API}/token")
req.add_header("Authorization", f"Basic {auth_header}")
req.add_header("User-Agent", "Mozilla/5.0")

try:
    with urllib.request.urlopen(req) as r:
        token_data = json.loads(r.read().decode())
        token = token_data["access_token"]
        
    # Get user details
    req2 = urllib.request.Request(f"{SFTPGO_API}/users/dvmonaep")
    req2.add_header("Authorization", f"Bearer {token}")
    req2.add_header("User-Agent", "Mozilla/5.0")
    
    with urllib.request.urlopen(req2) as r2:
        user_data = json.loads(r2.read().decode())
        print(json.dumps(user_data, indent=2))
except Exception as e:
    print("Error:", e)
