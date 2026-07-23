import urllib.request
import re
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 1. Test Boosty public posts API
boosty_api = "https://api.boosty.to/v1/blog/ate.ffx/post/?limit=20"
req = urllib.request.Request(boosty_api, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
try:
    with urllib.request.urlopen(req, context=ctx) as r:
        data = json.loads(r.read().decode('utf-8'))
        print("=== BOOSTY API RESPONSE ===")
        posts = data.get("data", [])
        print("Total Boosty posts found:", len(posts))
        for p in posts[:5]:
            title = p.get("title") or "Post " + str(p.get("id"))
            post_id = p.get("id")
            post_url = f"https://boosty.to/ate.ffx/posts/{post_id}"
            teaser = p.get("teaser", [])
            img = ""
            for t in teaser:
                if t.get("type") == "image":
                    img = t.get("url")
                    break
            print(f" -> Post ID: {post_id} | Title: {title} | Image: {img} | URL: {post_url}")
except Exception as e:
    print("Boosty API error:", e)

# 2. Test Patreon public posts / API
patreon_api = "https://www.patreon.com/api/posts?filter[campaign_id]=patreon&page[count]=20"
req2 = urllib.request.Request("https://www.patreon.com/ate_ffx", headers={"User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req2, context=ctx) as r:
        html = r.read().decode('utf-8')
        print("=== PATREON PAGE HTML ===")
        print("Patreon HTML length:", len(html))
        posts = re.findall(r'https?://(?:www\.)?patreon\.com/posts/[a-zA-Z0-9_\-]+', html)
        print("Patreon posts in HTML:", set(posts))
except Exception as e:
    print("Patreon page error:", e)
