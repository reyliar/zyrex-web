"""Publish one built preset installer to the production R2 bucket through the Worker."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

SITE = "https://zyrexediting.xyz"
PUBLISH_API = f"{SITE}/api/installer/publish"
PLATFORM_FOLDERS = {"windows": "Windows", "macos": "macOS"}
PLATFORM_SUFFIXES = {"windows": ".exe", "macos": ".dmg"}
MAX_ATTEMPTS = 4


def app_version() -> str:
    """The version baked into the build, read from the same app.py PyInstaller bundled."""
    try:
        source = (Path(__file__).resolve().parent / "app.py").read_text(encoding="utf-8")
    except OSError:
        return ""
    match = re.search(r'^VERSION\s*=\s*"(v?\d+(?:\.\d+)*)"', source, re.MULTILINE)
    return match.group(1).lstrip("v") if match else ""


def find_installer(release_root: Path, platform: str) -> Path:
    folder = release_root / PLATFORM_FOLDERS[platform]
    matches = sorted(folder.rglob("*" + PLATFORM_SUFFIXES[platform])) if folder.is_dir() else []
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly one {PLATFORM_SUFFIXES[platform]} under {folder}, found {len(matches)}")
    return matches[0]


def publish(preset_id: str, platform: str, release_id: str, installer: Path, token: str) -> dict:
    query = urllib.parse.urlencode({"id": preset_id, "platform": platform, "release_id": release_id, "name": installer.name})
    payload = installer.read_bytes()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/octet-stream",
        "Content-Length": str(len(payload)),
        "Accept": "application/json",
        "User-Agent": "Zyrex-Installer-Publisher/1.0",
        # The Worker stores this next to the object, so the update check can tell whether a
        # leak already ships the newest build.
        "X-Zyrex-App-Version": app_version(),
    }
    last_error = "publish did not run"
    for attempt in range(1, MAX_ATTEMPTS + 1):
        request = urllib.request.Request(f"{PUBLISH_API}?{query}", data=payload, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                result = json.loads(response.read().decode("utf-8"))
            if result.get("success"):
                return result
            last_error = str(result.get("error") or "publish was rejected")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace").strip()[:300]
            last_error = f"HTTP {error.code}: {detail}"
            if error.code in {400, 401, 404, 413}:
                break
        except Exception as error:  # transient network failures are retried
            last_error = str(error)
        if attempt < MAX_ATTEMPTS:
            time.sleep(attempt * 5)
    raise SystemExit(f"Could not publish {installer.name} for {preset_id} ({platform}): {last_error}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset-id", required=True)
    parser.add_argument("--platform", required=True)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--release-root", required=True, type=Path)
    args = parser.parse_args()
    platform = args.platform.strip().lower()
    if platform not in PLATFORM_SUFFIXES:
        raise SystemExit(f"Unsupported installer platform: {args.platform}")
    token = os.environ.get("FFX_RELEASE_SOURCE_TOKEN", "").strip()
    if not token:
        raise SystemExit("FFX_RELEASE_SOURCE_TOKEN is required to publish installers.")
    installer = find_installer(args.release_root, platform)
    result = publish(args.preset_id, platform, args.release_id, installer, token)
    print(f"Published {installer.name} -> {result.get('key')} ({round(int(result.get('size') or 0) / (1024 * 1024), 2)} MB)")


if __name__ == "__main__":
    main()
