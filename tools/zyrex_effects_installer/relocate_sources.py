"""Move each preset leak's FFX source into _source_ffx/ so the folder only ships installers."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

SITE = "https://zyrexediting.xyz"
RELOCATE_API = f"{SITE}/api/installer/relocate-source"
CATALOG_API = f"{SITE}/api/products"


def get_json(url: str, token: str = "") -> object:
    headers = {"Accept": "application/json", "Cache-Control": "no-cache", "User-Agent": "Zyrex-Installer-Relocator/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def preset_ids() -> list[str]:
    ids: list[str] = []
    page = 1
    while True:
        query = urllib.parse.urlencode({"type": "preset", "page": page, "limit": 100, "ts": int(time.time())})
        catalog = get_json(f"{CATALOG_API}?{query}")
        items = catalog.get("items") if isinstance(catalog, dict) else None
        if not isinstance(items, list):
            raise SystemExit("Unexpected product catalog response.")
        ids.extend(str(item["id"]) for item in items if isinstance(item, dict) and item.get("id"))
        if not catalog.get("has_more") or not items:
            break
        page += 1
    return list(dict.fromkeys(ids))


def relocate(preset_id: str, token: str) -> dict:
    query = urllib.parse.urlencode({"id": preset_id})
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Length": "0",
        "User-Agent": "Zyrex-Installer-Relocator/1.0",
    }
    last_error = "relocation did not run"
    for attempt in range(1, 4):
        request = urllib.request.Request(f"{RELOCATE_API}?{query}", data=b"", method="POST", headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = json.loads(response.read().decode("utf-8"))
            if result.get("success"):
                return result
            last_error = str(result.get("error") or "relocation was rejected")
        except urllib.error.HTTPError as error:
            last_error = f"HTTP {error.code}: {error.read().decode('utf-8', 'replace').strip()[:200]}"
            if error.code in {400, 401, 404}:
                break
        except Exception as error:
            last_error = str(error)
        time.sleep(attempt * 3)
    raise SystemExit(f"Could not relocate the source for {preset_id}: {last_error}")


def main() -> None:
    token = os.environ.get("FFX_RELEASE_SOURCE_TOKEN", "").strip()
    if not token:
        raise SystemExit("FFX_RELEASE_SOURCE_TOKEN is required to relocate leak sources.")
    ids = preset_ids()
    relocated = skipped = 0
    leftovers: dict[str, list[str]] = {}
    for index, preset_id in enumerate(ids, start=1):
        result = relocate(preset_id, token)
        if result.get("skipped"):
            skipped += 1
        elif int(result.get("moved") or 0) > 0:
            relocated += 1
        # Only installers and the injected watermark files may remain.
        unexpected = [
            name for name in result.get("remaining") or []
            if not name.lower().endswith((".exe", ".dmg", ".txt", ".url"))
        ]
        if unexpected:
            leftovers[preset_id] = unexpected
        if index % 25 == 0:
            print(f"Inspected {index}/{len(ids)} leaks.", file=sys.stderr)
    print(f"Relocated sources for {relocated} leak(s); skipped {skipped} without an installer.")
    if leftovers:
        print("Leaks still holding other files:")
        for preset_id, names in leftovers.items():
            print(f"  {preset_id}: {', '.join(names[:8])}")


if __name__ == "__main__":
    main()
