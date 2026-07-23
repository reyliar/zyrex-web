import urllib.request
import re
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    "https://www.tiktok.com/@mrbeast",
    "https://www.instagram.com/zuck/",
    "https://youtube.com/@MrBeast",
    "https://x.com/elonmusk"
]

def resolve_social(url):
    print("========================================")
    print("Testing URL:", url)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            html = r.read().decode('utf-8', errors='ignore')
            print("HTML len:", len(html))
            
            # Extract og:title, og:image
            og_title = (re.findall(r'<meta\s+property="og:title"\s+content="([^"]+)"', html, re.I) or [""])[0]
            if not og_title:
                og_title = (re.findall(r'<title>([^<]+)</title>', html, re.I) or [""])[0]
                
            og_image = (re.findall(r'<meta\s+property="og:image"\s+content="([^"]+)"', html, re.I) or [""])[0]
            if not og_image:
                og_image = (re.findall(r'<meta\s+name="twitter:image"\s+content="([^"]+)"', html, re.I) or [""])[0]
                
            print("Raw OG Title:", og_title)
            print("Raw OG Image:", og_image[:100] if og_image else "None")

            # Username extraction from URL
            clean_url = url.rstrip('/')
            parts = clean_url.split('/')
            username = parts[-1].replace('@', '')

            # Nickname parsing rules
            nickname = og_title
            # Strip Instagram suffix "• Instagram photos and videos", "on Instagram", etc.
            nickname = re.sub(r'\s*\(?@[\w\.-]+\)?', '', nickname)
            nickname = re.sub(r'\s*[•\|\-\–]\s*(Instagram|TikTok|YouTube|X|Twitter).*', '', nickname, flags=re.I)
            nickname = re.sub(r'^\s*(Instagram|TikTok|YouTube|X|Twitter)\s*:\s*', '', nickname, flags=re.I)
            nickname = nickname.strip()
            if not nickname or nickname.lower() in ['instagram', 'tiktok', 'youtube', 'x', 'twitter', 'login']:
                nickname = username

            print("Parsed Username:", username)
            print("Parsed Nickname:", nickname)

    except Exception as e:
        print("Error:", e)

for u in urls:
    resolve_social(u)
