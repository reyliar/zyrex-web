import urllib.request, json, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

api_key = "72d069e9e0c91b5ee59f9653eeb5aed77b49c3c5c6484e2dec19a415f5953b90"
headers = {
    "X-API-Key": api_key,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

endpoints = [
    ("TikTok profile", "https://api.hlx.li/tiktok/profile?username=muhostrilogy&limit=1"),
    ("Instagram profile", "https://api.hlx.li/instagram/profile?username=muhostrilogy"),
    ("Twitter profile", "https://api.hlx.li/twitter/profile?username=muhostrilogy"),
    ("YouTube channel", "https://api.hlx.li/youtube/channel?url=https://www.youtube.com/@muhostrilogy"),
]

for name, url in endpoints:
    print(f"\n=== {name} ===")
    req = urllib.request.Request(url, headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=15, context=ctx)
        data = json.loads(r.read().decode('utf-8'))
        print(json.dumps(data, indent=2)[:800])
    except Exception as e:
        print(f"Error: {e}")
