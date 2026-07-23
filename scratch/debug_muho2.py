import urllib.request, json, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36'}

def fetch(url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        r = urllib.request.urlopen(req, timeout=20, context=ctx)
        return r.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return "ERROR: " + str(e)

print("=== HLX Resolve for @muhostrilogy ===")
resp = fetch("https://zyrexediting.xyz/api/hlx/resolve?url=https://www.tiktok.com/@muhostrilogy")
print(resp)
print()

print("=== scan-creator-links (new version check) ===")
resp2 = fetch("https://zyrexediting.xyz/api/scan-creator-links?url=%40muhostrilogy")
data = json.loads(resp2)
print(json.dumps(data, indent=2))
print()

# Check if new version is deployed (should have 'username' field)
print("=== Version check (has username field?) ===")
print("Has 'username' field:", 'username' in data)
print("Has 'storeUrl' field:", 'storeUrl' in data)
