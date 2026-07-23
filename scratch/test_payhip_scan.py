import urllib.request
import re
import json
import ssl

url = "https://payhip.com/m1keysvfx"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, context=ctx) as resp:
        html = resp.read().decode('utf-8')
        print("Payhip HTML length:", len(html))
        
        # Extract product cards
        prods = []
        seen = set()
        for m in re.finditer(r'href="(/b/[a-zA-Z0-9_]+|https?://payhip\.com/b/[a-zA-Z0-9_]+)"', html):
            p_url = m.group(1)
            if p_url.startswith("/"): p_url = "https://payhip.com" + p_url
            if p_url not in seen:
                seen.add(p_url)
                prods.append(p_url)
        print("Product URLs found:", prods[:10])
except Exception as e:
    print("Fetch error:", e)
