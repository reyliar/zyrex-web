"""Fetch a public Zyrex leak record and package its locally produced FFX files."""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent
SAMPLE_ID = "preset-mvng96tn"
SAMPLE_SOURCE = Path(r"C:\Users\alkim\Documents\EFFECTS - zyrexediting.xyz\EFFECTS")
sys.path.insert(0, str(APP_ROOT))
import ffx_credit as credit  # noqa: E402

BRAND = "zyrexediting.xyz"
SITE = "https://zyrexediting.xyz"


def fetch_product(product_id: str) -> dict:
    query = urllib.parse.urlencode({"id": product_id})
    request = urllib.request.Request(f"{SITE}/api/products?{query}", headers={"Accept": "application/json", "User-Agent": "Zyrex-Installer-Builder/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        product = json.loads(response.read().decode("utf-8"))
    if not isinstance(product, dict) or product.get("id") != product_id:
        raise ValueError(f"Zyrex did not return the requested leak ID: {product_id}")
    if not str(product.get("name") or "").strip():
        raise ValueError("The leak is missing its public name.")
    return {
        "id": product_id,
        "name": str(product.get("name") or "").strip(),
        "creator_nickname": str(product.get("creator_nickname") or "").strip(),
        "creator_username": str(product.get("creator_username") or "").strip(),
        "creator_social_url": str(product.get("creator_social_url") or "").strip(),
        "creator_avatar": str(product.get("creator_avatar") or "").strip(),
        "uploader_name": str(product.get("uploader_name") or product.get("author_name") or "").strip(),
        "uploader_avatar": str(product.get("uploader_avatar") or product.get("author_avatar") or "").strip(),
        "description": str(product.get("description") or product.get("desc") or "").strip(),
        "thumbnail": str(product.get("thumbnail") or product.get("cdn_thumbnail") or "").strip(),
        "category": str(product.get("category") or "").strip(),
        "is_anonymous": product.get("is_anonymous") is True,
    }


def safe_name(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    if not value or value in {".", ".."}:
        raise ValueError("Leak name cannot be used as a Windows filename.")
    if re.fullmatch(r"(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", value):
        value = f"_{value}"
    return value[:96]


def build_payload(product_id: str, source: Path, output: Path) -> dict:
    product = fetch_product(product_id)
    if not source.is_dir():
        raise FileNotFoundError(f"FFX source folder not found: {source}")
    originals = sorted(source.rglob("*.ffx"), key=lambda p: str(p).casefold())
    if not originals:
        raise ValueError(f"No .ffx presets found in: {source}")
    credit.load_known_effect_names(credit.default_asset_path("ffx-effect-names.json"))
    credit.load_template_library(credit.default_asset_path("assets", "ffx-effect-templates.json"))
    prepared: list[tuple[str, bytes, str]] = []
    effect_credit = filename_credit = 0
    used: set[str] = set()
    for original in originals:
        raw = original.read_bytes()
        if len(raw) < 12 or raw[:4] != b"RIFX" or raw[8:12] != b"FaFX":
            raise ValueError(f"Not a valid After Effects preset: {original.name}")
        try:
            output_bytes, report = credit.credit_ffx_bytes(raw, original.name)
        except Exception as error:
            output_bytes, report = raw, {"filename_fallback": True, "reason": str(error)}
        fallback = bool(report.get("no_editable_names") or report.get("filename_fallback"))
        if fallback:
            name = f"{original.stem} - {BRAND}{original.suffix}"
            filename_credit += 1
            mode = "filename-fallback"
        else:
            name = original.name
            effect_credit += 1
            mode = "effect-name"
            if BRAND.encode() not in output_bytes:
                raise ValueError(f"FFX credit could not be verified for {original.name}")
        if BRAND.casefold() not in name.casefold() and BRAND.encode() not in output_bytes:
            raise ValueError(f"No Zyrex credit was applied to {original.name}")
        key = name.casefold()
        if key in used:
            raise ValueError(f"Duplicate preset name after credit processing: {name}")
        used.add(key)
        prepared.append((name, output_bytes, mode))

    manifest = {
        "product_id": product_id,
        "leak_name": product["name"],
        "product": product,
        "count": len(prepared),
        "effect_name_credited": effect_credit,
        "filename_credited": filename_credit,
        "files": [{"name": name, "credit_mode": mode, "bytes": len(data)} for name, data, mode in prepared],
    }
    if effect_credit + filename_credit != len(prepared):
        raise ValueError("Every FFX preset must receive an effect-name or filename credit before app generation.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        for name, data, _ in prepared:
            archive.writestr("presets/" + name, data)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset-id", default=SAMPLE_ID, help="Published leak ID on zyrexediting.xyz")
    parser.add_argument("--source", type=Path, default=SAMPLE_SOURCE, help="Production folder containing the leak's FFX files")
    parser.add_argument("--payload", type=Path, default=APP_ROOT / "payload.zip")
    args = parser.parse_args()
    manifest = build_payload(args.preset_id, args.source, args.payload)
    print(json.dumps(manifest, ensure_ascii=True, indent=2))
    print(f"Payload: {args.payload} ({args.payload.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
