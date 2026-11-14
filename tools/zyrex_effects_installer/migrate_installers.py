"""Move installers that were published under installers/<id>/ into each leak folder."""
from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = "https://zyrexediting.xyz"
MIGRATE_API = f"{SITE}/api/installer/migrate"


def migrate(preset_id: str, token: str) -> list[str]:
    query = urllib.parse.urlencode({"id": preset_id})
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Length": "0",
        "User-Agent": "Zyrex-Installer-Migrator/1.0",
    }
    last_error = "migration did not run"
    for attempt in range(1, 4):
        request = urllib.request.Request(f"{MIGRATE_API}?{query}", data=b"", method="POST", headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = json.loads(response.read().decode("utf-8"))
            if result.get("success"):
                return [str(name) for name in result.get("moved") or []]
            last_error = str(result.get("error") or "migration was rejected")
        except urllib.error.HTTPError as error:
            last_error = f"HTTP {error.code}: {error.read().decode('utf-8', 'replace').strip()[:200]}"
            if error.code in {400, 401, 404}:
                break
        except Exception as error:
            last_error = str(error)
        time.sleep(attempt * 3)
    raise SystemExit(f"Could not migrate {preset_id}: {last_error}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", required=True, help="Comma-separated leak IDs")
    args = parser.parse_args()
    token = os.environ.get("FFX_RELEASE_SOURCE_TOKEN", "").strip()
    if not token:
        raise SystemExit("FFX_RELEASE_SOURCE_TOKEN is required to migrate installers.")
    ids = list(dict.fromkeys(part.strip() for part in args.ids.split(",") if part.strip()))
    migrated = 0
    for preset_id in ids:
        moved = migrate(preset_id, token)
        if moved:
            migrated += 1
            print(f"{preset_id}: moved {', '.join(moved)}")
    print(f"Migrated {migrated} installer(s) across {len(ids)} leak(s).")


if __name__ == "__main__":
    main()
