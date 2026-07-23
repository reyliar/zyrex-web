import urllib.request
import ssl

url = "https://zyrexediting.xyz/upload.html"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"})
try:
    with urllib.request.urlopen(req, context=ctx) as resp:
        html = resp.read().decode('utf-8')
        print("Live upload.html length:", len(html))
        print("Has 'Scan Store' button:", "Scan Store" in html)
        print("Has 'creator-studio-panel':", "creator-studio-panel" in html)
        print("Has 'scanCreatorLinks':", "scanCreatorLinks" in html)
        print("Has 'openCreatorWizard':", "openCreatorWizard" in html)
        print("Has 'setPlatFilter':", "setPlatFilter" in html)
except Exception as e:
    print("Fetch error:", e)
