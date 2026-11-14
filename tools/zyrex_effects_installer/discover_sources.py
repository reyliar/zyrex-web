"""List existing preset leaks that have production FFX files for backfill builds."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = "https://zyrexediting.xyz"
SOURCE_API = f"{SITE}/api/installer/ffx-source"


def get_json(url: str, token: str = "") -> object:
    headers = {"Accept": "application/json", "Cache-Control": "no-cache", "User-Agent": "Zyrex-Installer-Backfill/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    last_error: Exception | None = None
    for attempt in range(1, 7):
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504} or attempt == 6:
                raise
            try:
                retry_after = float(error.headers.get("Retry-After") or 0)
            except (TypeError, ValueError):
                retry_after = 0.0
            time.sleep(min(90.0, retry_after or attempt * 10))
        except (TimeoutError, urllib.error.URLError) as error:
            last_error = error
            if attempt == 6:
                raise
            time.sleep(attempt * 5)
    raise last_error or RuntimeError("Zyrex API request did not complete.")


def discover() -> list[str]:
    token = os.environ.get("FFX_RELEASE_SOURCE_TOKEN", "").strip()
    if not token:
        raise RuntimeError("FFX_RELEASE_SOURCE_TOKEN must be configured for existing-leak backfill.")

    products: list[dict] = []
    page = 1
    while True:
        query = urllib.parse.urlencode({"type": "preset", "page": page, "limit": 100, "ts": int(time.time())})
        catalog = get_json(f"{SITE}/api/products?{query}")
        if not isinstance(catalog, dict) or not isinstance(catalog.get("items"), list):
            raise RuntimeError(f"Unexpected Zyrex product catalog response on page {page}.")
        items = catalog["items"]
        products.extend(item for item in items if isinstance(item, dict) and item.get("id"))
        if not catalog.get("has_more") or not items:
            break
        page += 1

    eligible: list[str] = []
    for index, product in enumerate(products, start=1):
        product_id = str(product["id"])
        query = urllib.parse.urlencode({"id": product_id})
        for attempt in range(4):
            try:
                listing = get_json(f"{SOURCE_API}?{query}", token)
                if isinstance(listing, dict) and listing.get("id") == product_id and listing.get("files"):
                    eligible.append(product_id)
                break
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    break
                if error.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                raise RuntimeError(f"Could not inspect FFX source for {product_id}: HTTP {error.code}") from error
            except (TimeoutError, urllib.error.URLError):
                if attempt < 3:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                raise
        if index % 25 == 0:
            print(f"Inspected {index}/{len(products)} Zyrex presets; {len(eligible)} contain FFX files.", file=sys.stderr)
        time.sleep(0.2)

    print(f"Found {len(eligible)} existing leak installers to build.", file=sys.stderr)
    return eligible


if __name__ == "__main__":
    print(json.dumps(discover()))
