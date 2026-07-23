import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://zyrexediting.xyz/api/scan-creator-links?url=https://boosty.to/ate.ffx"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req, context=ctx) as r:
        data = json.loads(r.read().decode('utf-8'))
        print("=== BOOSTY SCAN API RESPONSE FROM CLOUDFLARE ===")
        print("Success:", data.get("success"))
        print("Found:", data.get("found"))
        print("Platform:", data.get("platform"))
        prods = data.get("products", [])
        print("Total products:", len(prods))
        for p in prods[:5]:
            print("Product:", json.dumps(p, indent=2))
except Exception as e:
    print("Error:", e)
