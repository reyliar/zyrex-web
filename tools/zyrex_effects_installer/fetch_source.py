"""Download one leak's FFX presets from Zyrex's token-gated source API."""
from __future__ import annotations

import argparse
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://zyrexediting.xyz/api/installer/ffx-source"


def request(product_id: str, token: str, file_key: str = "") -> bytes:
    query = {"id": product_id}
    if file_key:
        query["file"] = file_key
    req = urllib.request.Request(
        f"{API}?{urllib.parse.urlencode(query)}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/octet-stream" if file_key else "application/json"},
    )
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()


def safe_filename(value: str) -> str:
    name = Path(value.replace("\\", "/")).name
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip(" .")
    if not name or not name.lower().endswith(".ffx"):
        raise ValueError(f"Unexpected source filename: {value}")
    return name


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset-id", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    token = os.environ.get("FFX_RELEASE_SOURCE_TOKEN", "").strip()
    if not token:
        raise SystemExit("FFX_RELEASE_SOURCE_TOKEN is not configured in GitHub Actions.")
    listing = __import__("json").loads(request(args.preset_id, token).decode("utf-8"))
    files = listing.get("files") if isinstance(listing, dict) else None
    if not isinstance(files, list) or not files:
        raise SystemExit(f"No FFX source files are available for {args.preset_id}.")
    args.output.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    for item in files:
        key = str(item.get("key", ""))
        name = safe_filename(str(item.get("name", "")))
        if not key or name.casefold() in seen:
            raise SystemExit(f"Invalid or duplicate FFX source entry: {name}")
        seen.add(name.casefold())
        data = request(args.preset_id, token, key)
        if len(data) < 12 or data[:4] != b"RIFX" or data[8:12] != b"FaFX":
            raise SystemExit(f"Invalid After Effects preset received: {name}")
        (args.output / name).write_bytes(data)
    print(f"Downloaded {len(files)} FFX files for {args.preset_id}.")


if __name__ == "__main__":
    main()
