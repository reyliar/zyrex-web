import urllib.request, re, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://linktr.ee/muhostrilogy'
}

# Linktree has a public JSON API endpoint: https://linktr.ee/api/profiles/muhostrilogy/page
url = 'https://linktr.ee/api/profiles/muhostrilogy/page'
print("Fetching Linktree API:", url)

try:
    req = urllib.request.Request(url, headers=HEADERS)
    r = urllib.request.urlopen(req, timeout=10, context=ctx)
    data = json.loads(r.read().decode('utf-8'))
    print("Status 200 OK!")
    # Search for payhip/boosty/patreon links in the JSON response
    data_str = json.dumps(data)
    stores = re.findall(r'https?://(?:www\.)?(?:payhip\.com|boosty\.to|patreon\.com)/[a-zA-Z0-9_/-]+', data_str, re.I)
    print("Stores found in Linktree API:", list(set(stores)))
    # Print links in profile
    links = data.get('links', [])
    print(f"Total links on page: {len(links)}")
    for l in links:
        print(f"  Link: title='{l.get('title')}' url='{l.get('url')}'")
except Exception as e:
    print("Error:", e)
