import urllib.request
import urllib.error
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

VPS_URL = "https://storage.zyrexediting.xyz"

def test_vps(method, path, body, headers=None):
    if headers is None:
        headers = {}
    url = f"{VPS_URL}{path}"
    headers["User-Agent"] = "Mozilla/5.0"
    headers["X-Zyrex-Key"] = "zyrex_app_sec_k982f81a7b54c29013e9a"
    headers["X-User-ID"] = "1267876255718703182" # m3iiverse discord id
    data = json.dumps(body).encode('utf-8') if body else None
    if data:
        headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    print(f"\n=== Testing {method} {path} directly on VPS ===")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            print(f"Status: {resp.status}")
            txt = resp.read().decode('utf-8')
            print(f"Response: {txt}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError Status: {e.code}")
        txt = e.read().decode('utf-8')
        print(f"Error Response: {txt}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_vps("POST", "/api/products/transfer", {
        "product_id": "test",
        "source_editor": "_tuyou",
        "source_resource": "BEBE CC",
        "destination_editor": "TEST411"
    })
