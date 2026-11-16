"""Download one leak's FFX presets from Zyrex's token-gated source API."""
from __future__ import annotations

import argparse
import json
import os
import re
import struct
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
# A full backfill used to spend one request per preset; the bundle answers a whole pack
# in a single request, which keeps the zone's daily quota intact.
BUNDLE_MAGIC = b"ZYXSRC1\n"


def request(product_id: str, token: str, file_key: str = "", bundle: bool = False) -> bytes:
    query = {"id": product_id}
    if file_key:
        query["file"] = file_key
    if bundle:
        query["bundle"] = "1"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/octet-stream" if (file_key or bundle) else "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": "Zyrex-Installer-Backfill/1.0",
    }
    url = f"{API}?{urllib.parse.urlencode(query)}"
    last_error = "source request did not run"
    for attempt in range(1, 7):
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
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


def parse_bundle(payload: bytes) -> list[tuple[str, bytes]]:
    """Read the Worker's bundle: magic, count, then name length, data length, name, data."""
    if not payload.startswith(BUNDLE_MAGIC):
        raise ValueError("unexpected source bundle header")
    offset = len(BUNDLE_MAGIC)
    (count,) = struct.unpack_from(">I", payload, offset)
    offset += 4
    files: list[tuple[str, bytes]] = []
    for _ in range(count):
        name_length, size = struct.unpack_from(">II", payload, offset)
        offset += 8
        name = payload[offset:offset + name_length].decode("utf-8")
        offset += name_length
        files.append((name, payload[offset:offset + size]))
        offset += size
    return files


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


def unique_name(name: str, seen: set[str]) -> str:
    """Production packs may contain the same basename in different folders."""
    relative = PurePosixPath(name)
    stem, suffix = relative.stem, relative.suffix
    candidate, duplicate = name, 2
    while candidate.casefold() in seen:
        candidate = str(relative.with_name(f"{stem} ({duplicate}){suffix}"))
        duplicate += 1
    seen.add(candidate.casefold())
    return candidate


def write_source(output: Path, name: str, data: bytes, seen: set[str]) -> str:
    """Write one preset; returns a reason when the source file is unusable."""
    if len(data) < 12:
        return f"{name} (only {len(data)} bytes)"
    if data[:4] != b"RIFX" or data[8:12] != b"FaFX":
        return f"{name} (starts with {data[:4]!r})"
    target = output.joinpath(*PurePosixPath(unique_name(name, seen)).parts)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return ""


def skip_unusable(skipped: list[str], preset_id: str) -> None:
    if not skipped:
        return
    # One broken production file used to fail the whole leak, leaving it without an
    # installer forever. The rest of the pack still ships, and the skips stay visible
    # in the build log.
    print(f"Skipped {len(skipped)} unusable source file(s) for {preset_id}: " + "; ".join(skipped[:8]))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset-id", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    token = os.environ.get("FFX_RELEASE_SOURCE_TOKEN", "").strip()
    if not token:
        raise SystemExit("FFX_RELEASE_SOURCE_TOKEN is not configured in GitHub Actions.")
    args.output.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()

    bundled = None
    try:
        bundled = parse_bundle(request(args.preset_id, token, bundle=True))
    except (HTTPError, URLError, ValueError, struct.error) as error:
        # Any bundle problem falls back to the per-file flow, so a Worker that predates
        # the bundle endpoint can never break a build.
        print(f"Source bundle unavailable ({error}); falling back to per-file download.")

    skipped: list[str] = []
    if bundled:
        for name, data in bundled:
            reason = write_source(args.output, safe_relative_name(name), data, seen)
            if reason:
                skipped.append(reason)
        skip_unusable(skipped, args.preset_id)
        written = len(bundled) - len(skipped)
        if not written:
            raise SystemExit(f"No usable FFX presets are available for {args.preset_id}.")
        print(f"Downloaded {written} FFX files for {args.preset_id} in one request.")
        return

    try:
        listing = json.loads(request(args.preset_id, token).decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", "replace").strip().replace("\n", " ")[:400]
        raise SystemExit(f"Could not list FFX source for {args.preset_id}: HTTP {error.code} {detail}") from error
    files = listing.get("files") if isinstance(listing, dict) else None
    if not isinstance(files, list) or not files:
        raise SystemExit(f"No FFX source files are available for {args.preset_id}.")
    for item in files:
        key = str(item.get("key", ""))
        name = safe_relative_name(str(item.get("name", "")))
        if not key:
            raise SystemExit(f"Invalid FFX source entry: {name}")
        try:
            data = request(args.preset_id, token, key)
        except HTTPError as error:
            detail = error.read().decode("utf-8", "replace").strip().replace("\n", " ")[:400]
            raise SystemExit(f"FFX source download failed for {name}: HTTP {error.code} {detail}") from error
        reason = write_source(args.output, name, data, seen)
        if reason:
            skipped.append(reason)
        time.sleep(FILE_PAUSE_SECONDS)
    skip_unusable(skipped, args.preset_id)
    written = len(files) - len(skipped)
    if not written:
        raise SystemExit(f"No usable FFX presets are available for {args.preset_id}.")
    print(f"Downloaded {written} FFX files for {args.preset_id}.")


if __name__ == "__main__":
    main()
