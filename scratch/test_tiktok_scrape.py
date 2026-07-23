import urllib.request
import re
import ssl

url = "https://www.tiktok.com/@overbills"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, context=ctx) as resp:
        html = resp.read().decode('utf-8')
        print("HTML length:", len(html))
        titles = re.findall(r'<title>(.*?)</title>', html)
        print("Titles:", titles)
        scripts = re.findall(r'<script[^>]*id="([^"]+)"', html)
        print("Script IDs:", scripts)
except Exception as e:
    print("Fetch error:", e)
