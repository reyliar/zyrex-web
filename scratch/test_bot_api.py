import urllib.request
import json
import ssl

url = "https://zyre.wispbyte.org/api/scan-creator-links?url=https%3A%2F%2Fwww.tiktok.com%2F%40overbills"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req, context=ctx) as resp:
        print("HTTP Status:", resp.status)
        data = json.loads(resp.read().decode('utf-8'))
        print("Response data:", json.dumps(data, indent=2))
except Exception as e:
    print("Fetch error:", e)
