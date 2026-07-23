import urllib.request, json, re, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
}

def fetch(url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        r = urllib.request.urlopen(req, timeout=15, context=ctx)
        return r.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return f"ERROR: {e}"

print("=== 1. TikTok @muhostrilogy HTML ===")
html = fetch("https://www.tiktok.com/@muhostrilogy")
if html.startswith("ERROR"):
    print(html)
else:
    print(f"Length: {len(html)}")
    print(f"Has __NEXT_DATA__: {'__NEXT_DATA__' in html}")
    # Check for bioLink patterns
    for pat in [r'"bioLink"\s*:\s*\{[^}]*"link"\s*:\s*"(https?://[^"]+)"',
                r'"bio_link"\s*:\s*\{[^}]*"link"\s*:\s*"(https?://[^"]+)"',
                r'linktr\.ee/[a-zA-Z0-9_.-]+',
                r'guns\.lol/[a-zA-Z0-9_.-]+']:
        m = re.search(pat, html, re.I)
        if m:
            print(f"  Pattern '{pat[:30]}...': {m.group()}")
    # Try to find the __NEXT_DATA__ block
    nd = re.search(r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>([\s\S]*?)</script>', html, re.I)
    if nd:
        try:
            data = json.loads(nd.group(1))
            user = (data.get('props',{}).get('pageProps',{}).get('userInfo',{}) or {}).get('user',{})
            if user:
                bio = user.get('bioLink') or user.get('bio_link', {})
                print(f"  bioLink from JSON: {bio}")
            else:
                print("  No user in __NEXT_DATA__ pageProps")
        except Exception as e:
            print(f"  JSON parse error: {e}")
    else:
        print("  No __NEXT_DATA__ found")

print()
print("=== 2. linktr.ee/muhostrilogy ===")
html2 = fetch("https://linktr.ee/muhostrilogy")
if html2.startswith("ERROR"):
    print(html2)
else:
    print(f"Length: {len(html2)}")
    for store in ['payhip', 'boosty', 'patreon']:
        if store in html2.lower():
            m = re.search(store + r'\.com/[a-zA-Z0-9/_-]+', html2, re.I)
            if m: print(f"  {store}: {m.group()}")
        else:
            print(f"  {store}: NOT FOUND")

print()
print("=== 3. API response ===")
api_resp = fetch("https://zyrexediting.xyz/api/scan-creator-links?url=%40muhostrilogy")
print(api_resp[:500])
