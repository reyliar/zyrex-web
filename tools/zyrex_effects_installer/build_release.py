"""Build one credited leak installer for Windows or macOS."""
from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from build_payload import build_payload, safe_name

PROJECT = Path(__file__).resolve().parent


def build(product_id: str, source: Path, output_root: Path) -> Path:
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
        stage, work = temp / "dist", temp / "work"
        stage.mkdir()
        work.mkdir()
        data_sep = ";" if system == "windows" else ":"
        args = [
            sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
            "--name", leak, "--distpath", str(stage), "--workpath", str(work),
            "--specpath", str(work), "--add-data", f"{payload}{data_sep}.",
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
    args = parser.parse_args()
    release = build(args.preset_id, args.source, args.output_root)
    print(f"Built {platform.system()} leak installer folder: {release}")


if __name__ == "__main__":
    main()
