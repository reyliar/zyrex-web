import asyncio, aiohttp, re, json

async def test():
    username = "muhostrilogy"
    
    tests = [
        # Try different Instagram API endpoints
        ("IG API v1 info", f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}", {
            "User-Agent": "Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; Google/google; Pixel 6; oriole; qcom; en_US; 458229258)",
            "X-IG-App-ID": "936619743392459",
            "X-IG-WWW-Claim": "0",
            "Accept": "application/json",
        }),
        ("IG API v1 info (web UA)", f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}", {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json",
            "Referer": "https://www.instagram.com/",
        }),
        ("Picuki", f"https://www.picuki.com/profile/{username}", {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        }),
    ]
    
    for name, url, headers in tests:
        print(f"\n=== {name} ===")
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as r:
                    print(f"Status: {r.status}")
                    text = await r.text()
                    print(f"Length: {len(text)}")
                    
                    if r.status == 200:
                        # Look for data
                        if "full_name" in text:
                            m = re.search(r'"full_name"[:\s]*"([^"]+)"', text)
                            print("full_name:", m.group(1) if m else "parsed but no match")
                        if "profile_pic_url" in text:
                            m = re.search(r'"profile_pic_url"[:\s]*"([^"]+)"', text)
                            print("profile_pic:", m.group(1)[:60] if m else "parsed but no match")
                        if "biography" in text:
                            m = re.search(r'"biography"[:\s]*"([^"]*)"', text)
                            print("bio:", m.group(1)[:100] if m else "no match")
                        if "external_url" in text:
                            m = re.search(r'"external_url"[:\s]*"([^"]+)"', text)
                            print("external_url:", m.group(1) if m else "no match")
                        if not any(k in text for k in ["full_name", "profile_pic", "biography"]):
                            print("No useful data found. First 300 chars:", text[:300])
                    else:
                        print("Response:", text[:200])
        except Exception as e:
            print(f"ERROR: {e}")

asyncio.run(test())
