import urllib.request
import http.cookiejar
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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://guns.lol/overbills"
}

api_endpoints = [
    "https://guns.lol/api/name/overbills",
    "https://guns.lol/api/user/overbills",
    "https://guns.lol/api/user?username=overbills",
    "https://guns.lol/api/profile/overbills",
    "https://guns.lol/api/users/overbills",
    "https://guns.lol/api/u/overbills",
]

for url in api_endpoints:
    req = urllib.request.Request(url, headers=headers)
    try:
        with opener.open(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"SUCCESS {url} =>", json.dumps(data, indent=2)[:500])
    except Exception as e:
        print(f"FAILED {url} => {e}")
