import urllib.request, json, ssl

ctx = ssl._create_unverified_context()

api_key = "72d069e9e0c91b5ee59f9653eeb5aed77b49c3c5c6484e2dec19a415f5953b90"
headers = {"X-API-Key": api_key}

tests = [
    # Instagram endpoints
    ("IG - profile", "https://api.hlx.li/instagram/profile?username=muhostrilogy"),
    ("IG - user", "https://api.hlx.li/instagram/user?username=muhostrilogy"),
    ("IG - info", "https://api.hlx.li/instagram/info?username=muhostrilogy"),
    ("IG - account", "https://api.hlx.li/instagram/account?username=muhostrilogy"),
    # Twitter endpoints
    ("TW - profile", "https://api.hlx.li/twitter/profile?username=muhostrilogy"),
    ("TW - user", "https://api.hlx.li/twitter/user?username=muhostrilogy"),
    # YouTube endpoints
    ("YT - channel url", "https://api.hlx.li/youtube/channel?url=https://www.youtube.com/@muhostrilogy"),
    ("YT - channel user", "https://api.hlx.li/youtube/channel?username=muhostrilogy"),
]

for name, url in tests:
    req = urllib.request.Request(url, headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=8, context=ctx)
        data = json.loads(r.read().decode())
        print(f"[OK] {name}: {str(data)[:200]}")
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] {name}: HTTP {e.code}")
    except Exception as e:
        err = str(e)
        if "timed out" in err or "timeout" in err.lower():
            print(f"[TIMEOUT] {name}")
        else:
            print(f"[ERR] {name}: {err[:80]}")
