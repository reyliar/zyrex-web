"""Download one leak's FFX presets from Zyrex's token-gated source API."""
from __future__ import annotations

import argparse
import os
import re
import urllib.parse
import urllib.request
from urllib.error import HTTPError
from pathlib import Path

API = "https://zyrexediting.xyz/api/installer/ffx-source"


def request(product_id: str, token: str, file_key: str = "") -> bytes:
    query = {"id": product_id}
    if file_key:
        query["file"] = file_key
    req = urllib.request.Request(
        f"{API}?{urllib.parse.urlencode(query)}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/octet-stream" if file_key else "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "Zyrex-Installer-Backfill/1.0",
        },
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
    try:
        listing = __import__("json").loads(request(args.preset_id, token).decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", "replace").strip().replace("\n", " ")[:400]
        raise SystemExit(f"Could not list FFX source for {args.preset_id}: HTTP {error.code} {detail}") from error
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
        try:
            data = request(args.preset_id, token, key)
        except HTTPError as error:
            detail = error.read().decode("utf-8", "replace").strip().replace("\n", " ")[:400]
            raise SystemExit(f"FFX source download failed for {name}: HTTP {error.code} {detail}") from error
        if len(data) < 12 or data[:4] != b"RIFX" or data[8:12] != b"FaFX":
            raise SystemExit(f"Invalid After Effects preset received: {name}")
        (args.output / name).write_bytes(data)
    print(f"Downloaded {len(files)} FFX files for {args.preset_id}.")


if __name__ == "__main__":
    main()
