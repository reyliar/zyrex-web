import urllib.request
import urllib.error
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = "https://zyrexediting.xyz"

def test_endpoint(method, path, body=None, headers=None):
    if headers is None:
        headers = {}
    url = f"{BASE_URL}{path}"
    headers["User-Agent"] = "Mozilla/5.0"
    headers["X-Zyrex-Key"] = "zyrex_app_sec_k982f81a7b54c29013e9a"
    data = json.dumps(body).encode('utf-8') if body else None
    if data:
        headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    print(f"\n--- Testing {method} {path} ---")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            print(f"Status: {resp.status}")
            txt = resp.read().decode('utf-8')
            print(f"Response: {txt[:500]}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError Status: {e.code}")
        txt = e.read().decode('utf-8')
        print(f"Error Response: {txt[:500]}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_endpoint("GET", "/api/sftpgo/detected-resources")
    test_endpoint("GET", "/api/products/destination-editors")
    test_endpoint("POST", "/api/products/create-editor", {"name": "TESTEDITOR"})
    test_endpoint("POST", "/api/products/transfer", {
        "product_id": "test",
        "source_editor": "411editing",
        "source_resource": "Essential Editing Pack",
        "destination_editor": "TESTEDITOR"
    })
