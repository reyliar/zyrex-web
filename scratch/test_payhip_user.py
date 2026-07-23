import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Test passing different parameters to BOT_API scan-creator-links
variants = [
    "https://payhip.com/aenyxr",
    "https://payhip.com/aenyxr?page=2",
    "https://payhip.com/aenyxr?p=2",
    "https://payhip.com/aenyxr?offset=12",
    "https://payhip.com/aenyxr?start=12",
    "https://payhip.com/aenyxr?limit=100",
    "https://payhip.com/aenyxr?show=100",
    "https://payhip.com/aenyxr?all=1",
    "https://payhip.com/aenyxr/all",
    "https://payhip.com/aenyxr/products",
    "https://payhip.com/aenyxr/items",
    "https://payhip.com/aenyxr/collection/all",
    "https://payhip.com/aenyxr/collection/all?page=2",
]

for url in variants:
    api_url = f"https://zyre.wispbyte.org/api/scan-creator-links?url={urllib.parse.quote(url)}"
    req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            d = json.loads(r.read().decode('utf-8'))
            prods = d.get('products', [])
            first3 = [p['url'].split('/')[-1] for p in prods[:3]] if prods else []
            last3 = [p['url'].split('/')[-1] for p in prods[-3:]] if prods else []
            print(f"{url:48} => count: {len(prods):2} | first: {first3} | last: {last3}")
    except Exception as e:
        print(f"{url:48} => error: {e}")
