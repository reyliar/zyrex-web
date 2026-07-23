import urllib.request
import http.cookiejar
import re
import json
import ssl

cj = http.cookiejar.CookieJar()
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cj),
    urllib.request.HTTPSHandler(context=ctx)
)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def extractStoreLinks(rawText):
    text = str(rawText or "").replace("\\", "").replace("%2F", "/").replace("%3A", ":").replace("&amp;", "&")
    
    p = (re.findall(r'https?://(?:www\.)?payhip\.com/[a-zA-Z0-9_\-\.\/]+', text) or [None])[0] or \
        (re.findall(r'payhip\.com/([a-zA-Z0-9_\-\.]+)', text) and f"https://payhip.com/{re.findall(r'payhip\.com/([a-zA-Z0-9_\-\.]+)', text)[0]}")
        
    b = (re.findall(r'https?://(?:www\.)?boosty\.to/[a-zA-Z0-9_\-\.\/]+', text) or [None])[0] or \
        (re.findall(r'boosty\.to/([a-zA-Z0-9_\-\.]+)', text) and f"https://boosty.to/{re.findall(r'boosty\.to/([a-zA-Z0-9_\-\.]+)', text)[0]}")

    t = (re.findall(r'https?://(?:www\.)?patreon\.com/[a-zA-Z0-9_\-\.\/]+', text) or [None])[0] or \
        (re.findall(r'patreon\.com/([a-zA-Z0-9_\-\.]+)', text) and f"https://patreon.com/{re.findall(r'patreon\.com/([a-zA-Z0-9_\-\.]+)', text)[0]}")

    return {"payhip": p, "boosty": b, "patreon": t}

req = urllib.request.Request("https://guns.lol/ate.ffx", headers=headers)
try:
    with opener.open(req) as resp:
        html = resp.read().decode('utf-8')
        stores = extractStoreLinks(html)
        print("Extracted Stores for guns.lol/ate.ffx:", stores)
except Exception as e:
    print("Fetch error:", e)
