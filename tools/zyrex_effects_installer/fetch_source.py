"""Download one leak's FFX presets from Zyrex's token-gated source API."""
from __future__ import annotations

import argparse
import os
import re
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError
from pathlib import Path, PurePosixPath

API = "https://zyrexediting.xyz/api/installer/ffx-source"
# Cloudflare rate limits the zone when many matrix jobs fetch at once, so each file
# download waits briefly and retries a throttled response instead of failing the leak.
FILE_PAUSE_SECONDS = 0.25
RETRY_STATUSES = {429, 500, 502, 503, 504}


def request(product_id: str, token: str, file_key: str = "") -> bytes:
    query = {"id": product_id}
    if file_key:
        query["file"] = file_key
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/octet-stream" if file_key else "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": "Zyrex-Installer-Backfill/1.0",
    }
    url = f"{API}?{urllib.parse.urlencode(query)}"
    last_error = "source request did not run"
    for attempt in range(1, 7):
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                return response.read()
        except HTTPError as error:
            last_error = error
            if error.code not in RETRY_STATUSES or attempt == 6:
                raise
            try:
                retry_after = float(error.headers.get("Retry-After") or 0)
            except (TypeError, ValueError):
                retry_after = 0.0
            time.sleep(min(90.0, retry_after or attempt * 10))
        except URLError as error:
            last_error = error
            if attempt == 6:
                raise
            time.sleep(attempt * 5)
    raise last_error


def safe_relative_name(value: str) -> str:
    raw = value.replace("\\", "/")
    parts = [part for part in PurePosixPath(raw).parts if part not in {"", "."}]
    if not parts or any(part == ".." for part in parts):
        raise ValueError(f"Unexpected source path: {value}")
    parts = [re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", part).strip(" .") for part in parts]
    name = "/".join(part for part in parts if part)
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
        name = safe_relative_name(str(item.get("name", "")))
        if not key:
            raise SystemExit(f"Invalid FFX source entry: {name}")
        # Production packs may contain the same basename in different folders.
        # Preserve every preset with a deterministic unique filename for the
        # crediting and installer stages instead of dropping the whole leak.
        relative = PurePosixPath(name)
        stem, suffix = relative.stem, relative.suffix
        candidate, duplicate = name, 2
        while candidate.casefold() in seen:
            candidate = str(relative.with_name(f"{stem} ({duplicate}){suffix}"))
            duplicate += 1
        name = candidate
        seen.add(name.casefold())
        try:
            data = request(args.preset_id, token, key)
        except HTTPError as error:
            detail = error.read().decode("utf-8", "replace").strip().replace("\n", " ")[:400]
            raise SystemExit(f"FFX source download failed for {name}: HTTP {error.code} {detail}") from error
        if len(data) < 12 or data[:4] != b"RIFX" or data[8:12] != b"FaFX":
            raise SystemExit(f"Invalid After Effects preset received: {name}")
        target = args.output.joinpath(*PurePosixPath(name).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        time.sleep(FILE_PAUSE_SECONDS)
    print(f"Downloaded {len(files)} FFX files for {args.preset_id}.")


if __name__ == "__main__":
    main()
