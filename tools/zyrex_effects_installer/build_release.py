"""Build one credited leak installer for Windows or macOS."""
from __future__ import annotations

import argparse
import base64
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

from build_payload import build_payload, safe_name

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

PROJECT = Path(__file__).resolve().parent
INSTALLER_API = "https://zyrexediting.xyz/api/installer/build-key"


def get_payload_key(product_id: str, release_id: str) -> bytes:
    token = os.environ.get("FFX_RELEASE_SOURCE_TOKEN", "").strip()
    if not token:
        raise RuntimeError("FFX_RELEASE_SOURCE_TOKEN is required to create a session-gated installer.")
    body = json.dumps({"product_id": product_id, "release_id": release_id}).encode("utf-8")
    request = urllib.request.Request(INSTALLER_API, data=body, method="POST", headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36", "Origin": "https://zyrexediting.xyz", "Referer": "https://zyrexediting.xyz/", "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty"})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.loads(response.read().decode("utf-8"))
    encoded = str(data.get("key") or "")
    if not encoded:
        raise RuntimeError("The Zyrex API did not return an installer payload key.")
    return base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))


def build(product_id: str, source: Path, output_root: Path, release_id: str) -> Path:
    system = platform.system().lower()
    if system not in {"windows", "darwin"}:
        raise RuntimeError(f"Unsupported release platform: {system}")
    output_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f"zyrex-{product_id}-") as temp_name:
        temp = Path(temp_name)
        payload = temp / "payload.zip"
        manifest = build_payload(product_id, source, payload)
        credited = int(manifest.get("effect_name_credited", 0)) + int(manifest.get("filename_credited", 0))
        if not manifest.get("count") or credited != int(manifest["count"]):
            raise RuntimeError("Every FFX must be credited before installer generation starts.")
        leak = safe_name(manifest["leak_name"])
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        payload_key = get_payload_key(product_id, release_id)
        nonce = os.urandom(12)
        aad = f"{product_id}:{release_id}".encode("utf-8")
        encrypted_payload = temp / "payload.enc"
        encrypted_payload.write_bytes(nonce + AESGCM(payload_key).encrypt(nonce, payload.read_bytes(), aad))
        metadata = temp / "metadata.json"
        metadata.write_text(json.dumps({**manifest, "release_id": release_id}, ensure_ascii=False), encoding="utf-8")
        from PIL import Image
        icon_image = Image.open(PROJECT / "content.png").convert("RGBA")
        icon_path = temp / ("content.icns" if system == "darwin" else "content.ico")
        if system == "darwin":
            iconset = temp / "content.iconset"
            iconset.mkdir()
            for size in (16, 32, 64, 128, 256, 512):
                icon_image.resize((size, size), Image.Resampling.LANCZOS).save(iconset / f"icon_{size}x{size}.png")
                icon_image.resize((size * 2, size * 2), Image.Resampling.LANCZOS).save(iconset / f"icon_{size}x{size}@2x.png")
            subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(icon_path)], check=True)
        else:
            icon_image.save(icon_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        stage, work = temp / "dist", temp / "work"
        stage.mkdir()
        work.mkdir()
        data_sep = ";" if system == "windows" else ":"
        args = [
            sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
            "--name", leak, "--distpath", str(stage), "--workpath", str(work),
            "--specpath", str(work), "--add-data", f"{encrypted_payload}{data_sep}.",
            "--add-data", f"{metadata}{data_sep}.",
            "--icon", str(icon_path),
            "--add-data", f"{PROJECT / 'ui.html'}{data_sep}.",
            "--add-data", f"{PROJECT / 'content.png'}{data_sep}.",
            "--add-data", f"{PROJECT / 'outfit-latin.woff2'}{data_sep}.",
            "--add-data", f"{PROJECT / 'outfit-latin-ext.woff2'}{data_sep}.",
        ]
        if system == "darwin":
            args += ["--windowed", "--onedir"]
        elif system == "windows":
            args += ["--windowed", "--onefile"]
        else:
            args += ["--onefile"]
        args.append(str(PROJECT / "app.py"))
        subprocess.run(args, check=True, cwd=PROJECT)

        platform_folder = "Windows" if system == "windows" else "macOS"
        release = output_root / platform_folder / leak
        release.mkdir(parents=True, exist_ok=True)
        creator_note = release / "Leaked by Zyrex.txt"
        creator_note.write_text("Leaked by Zyrex\n", encoding="utf-8")
        more_link = release / "Visit for more resources.url"
        more_link.write_text("[InternetShortcut]\nURL=https://zyrexediting.xyz/leaks\n", encoding="ascii")

        if system == "windows":
            shutil.copy2(stage / f"{leak}.exe", release / f"{leak}.exe")
        else:
            app_bundle = stage / f"{leak}.app"
            if not app_bundle.is_dir():
                raise RuntimeError("PyInstaller did not produce the expected macOS .app bundle.")
            dmg_stage = temp / "dmg"
            dmg_stage.mkdir()
            shutil.copytree(app_bundle, dmg_stage / f"{leak}.app")
            shutil.copy2(creator_note, dmg_stage / creator_note.name)
            shutil.copy2(more_link, dmg_stage / more_link.name)
            dmg_temp = temp / f"{leak}.dmg"
            subprocess.run(["hdiutil", "create", "-volname", leak, "-srcfolder", str(dmg_stage), "-ov", "-format", "UDZO", str(dmg_temp)], check=True)
            shutil.copy2(dmg_temp, release / f"{leak}.dmg")

        expected = {"Leaked by Zyrex.txt", "Visit for more resources.url"}
        expected.add(f"{leak}.exe" if system == "windows" else f"{leak}.dmg")
        actual = {p.name for p in release.iterdir() if p.is_file()}
        if actual != expected:
            raise RuntimeError(f"Release output must contain only {sorted(expected)}; found {sorted(actual)}")
        return release


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset-id", required=True)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output-root", required=True, type=Path)
    parser.add_argument("--release-id", required=True)
    args = parser.parse_args()
    release = build(args.preset_id, args.source, args.output_root, args.release_id)
    print(f"Built {platform.system()} leak installer folder: {release}")


if __name__ == "__main__":
    main()
