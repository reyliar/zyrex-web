"""Fetch a public Zyrex leak record and package its locally produced files."""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

APP_ROOT = Path(__file__).resolve().parent
SAMPLE_ID = "preset-mvng96tn"
SAMPLE_SOURCE = Path(r"C:\Users\alkim\Documents\EFFECTS - zyrexediting.xyz\EFFECTS")
sys.path.insert(0, str(APP_ROOT))
import ffx_credit as credit  # noqa: E402

BRAND = "zyrexediting.xyz"
SITE = "https://zyrexediting.xyz"

# After Effects stores the format version of the saving release in the RIFX head chunk
# (byte 24). Installers show it next to every preset so a member can see whether their
# own After Effects can open the pack before anything is copied.
AE_MIN_BY_FORMAT = ((99, "2026"), (97, "2025"), (95, "2024"), (93, "2023"))

# The installer encrypts the pack's real payload, but pictures, videos and code files are
# not payload: they are how a member reads the instructions, and shipping them inside the
# app only inflates the build. Everything else (projects, archives, mogrts, presets) is
# paid content and is encrypted and delivered.
IMAGE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".jpe", ".jfif", ".webp", ".gif", ".bmp", ".dib", ".svg",
    ".ico", ".tif", ".tiff", ".heic", ".heif", ".avif", ".psd", ".psb",
}
VIDEO_EXTENSIONS = {
    ".mp4", ".m4v", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".mpg", ".mpeg",
    ".3gp", ".ogv", ".mts", ".m2ts",
}
CODE_EXTENSIONS = {
    ".json", ".jsonc", ".json5", ".jsonl", ".ndjson", ".js", ".mjs", ".cjs", ".jsx",
    ".ts", ".tsx", ".py", ".pyw", ".html", ".htm", ".xhtml", ".css", ".scss", ".sass",
    ".less", ".md", ".markdown", ".rst", ".txt", ".yml", ".yaml", ".toml", ".ini",
    ".cfg", ".conf", ".properties", ".xml", ".xsl", ".xslt", ".csv", ".tsv", ".sh",
    ".bash", ".zsh", ".fish", ".bat", ".cmd", ".ps1", ".psd1", ".psm1", ".c", ".h",
    ".cc", ".cpp", ".cxx", ".hpp", ".cs", ".java", ".kt", ".php", ".rb", ".go", ".rs",
    ".swift", ".lua", ".pl", ".r", ".sql", ".url", ".webloc", ".lnk", ".desktop", ".lock",
}
# Everything the installer can hold is embedded in one executable, so the release fails
# to upload past 96 MB. A pack with a huge archive keeps its presets and reports what was
# left out rather than producing an installer nobody can download.
ASSET_MAX_FILE_BYTES = 40 * 1024 * 1024
ASSET_BUDGET_BYTES = 60 * 1024 * 1024
IGNORED_FILENAMES = {
    "leaked by zyrex.txt", "visit for more resources.url", "visit for more resources!.url",
    "visit for more leaks.url", "visit for more leaks!.url", "thumbs.db", "desktop.ini", ".ds_store",
}


def ffx_format_version(data: bytes) -> int:
    if len(data) < 32 or data[:4] != b"RIFX" or data[8:12] != b"FaFX":
        return 0
    return int.from_bytes(data[24:28], "big")


def ae_min_label(format_version: int) -> str:
    for threshold, label in AE_MIN_BY_FORMAT:
        if format_version >= threshold:
            return label
    return "2022 or older" if format_version else ""


def excluded_reason(name: str) -> str:
    """Why a file never travels inside the installer payload, empty when it does."""
    base = PurePosixPath(str(name or "")).name
    lowered = base.casefold()
    if not base or lowered in IGNORED_FILENAMES:
        return "watermark"
    suffix = PurePosixPath(base).suffix.casefold()
    if suffix in IMAGE_EXTENSIONS:
        return "image"
    if suffix in VIDEO_EXTENSIONS:
        return "video"
    if suffix in CODE_EXTENSIONS:
        return "code"
    return ""


def branded_asset_name(name: str) -> str:
    """`Project.aep` -> `Project - zyrexediting.xyz.aep`, without renaming twice."""
    parts = list(PurePosixPath(str(name)).parts)
    base = parts[-1]
    if BRAND.casefold() in base.casefold():
        return str(PurePosixPath(*parts))
    suffix = PurePosixPath(base).suffix
    stem = base[: -len(suffix)] if suffix else base
    parts[-1] = f"{stem} - {BRAND}{suffix}"
    return str(PurePosixPath(*parts))



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


def collect_source_files(source: Path) -> tuple[list[Path], list[Path], list[dict]]:
    """Split the leak folder into presets, encrypted assets, and anything left out."""
    presets: list[Path] = []
    assets: list[Path] = []
    skipped: list[dict] = []
    for path in sorted(source.rglob("*"), key=lambda p: str(p).casefold()):
        try:
            if not path.is_file():
                continue
        except OSError:
            continue
        relative = PurePosixPath(path.relative_to(source).as_posix())
        if any(part.startswith(".") for part in relative.parts):
            continue
        suffix = relative.suffix.casefold()
        if suffix == ".ffx":
            presets.append(path)
            continue
        reason = excluded_reason(relative.name)
        if reason:
            skipped.append({"name": str(relative), "reason": reason, "bytes": 0})
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size > ASSET_MAX_FILE_BYTES:
            skipped.append({"name": str(relative), "reason": "too-large", "bytes": size})
            continue
        assets.append(path)
    return presets, assets, skipped


def build_payload(product_id: str, source: Path, output: Path) -> dict:
    product = fetch_product(product_id)
    if not source.is_dir():
        raise FileNotFoundError(f"FFX source folder not found: {source}")
    originals, asset_paths, skipped = collect_source_files(source)
    if not originals:
        raise ValueError(f"No .ffx presets found in: {source}")
    credit.load_known_effect_names(credit.default_asset_path("ffx-effect-names.json"))
    credit.load_template_library(credit.default_asset_path("assets", "ffx-effect-templates.json"))
    prepared: list[tuple[str, bytes, str]] = []
    details: list[dict] = []
    effect_credit = filename_credit = 0
    used: set[str] = set()
    for original in originals:
        relative = PurePosixPath(original.relative_to(source).as_posix())
        raw = original.read_bytes()
        if len(raw) < 12 or raw[:4] != b"RIFX" or raw[8:12] != b"FaFX":
            raise ValueError(f"Not a valid After Effects preset: {original.name}")
        # Crediting may upgrade the head to the AE 2024 format, so compatibility is read
        # from the bytes After Effects originally wrote.
        format_version = ffx_format_version(raw)
        try:
            output_bytes, report = credit.credit_ffx_bytes(raw, original.name)
        except Exception as error:
            output_bytes, report = raw, {"filename_fallback": True, "reason": str(error)}
        fallback = bool(report.get("no_editable_names") or report.get("filename_fallback"))
        if fallback:
            relative = relative.with_name(f"{original.stem} - {BRAND}{original.suffix}")
            filename_credit += 1
            mode = "filename-fallback"
        else:
            effect_credit += 1
            mode = "effect-name"
            if BRAND.encode() not in output_bytes:
                raise ValueError(f"FFX credit could not be verified for {original.name}")
        if BRAND.casefold() not in str(relative).casefold() and BRAND.encode() not in output_bytes:
            raise ValueError(f"No Zyrex credit was applied to {original.name}")
        name = str(relative)
        key = name.casefold()
        if key in used:
            raise ValueError(f"Duplicate preset name after credit processing: {name}")
        used.add(key)
        prepared.append((name, output_bytes, mode))
        details.append({
            "name": name,
            "credit_mode": mode,
            "bytes": len(output_bytes),
            "format_version": format_version,
            "ae_min": ae_min_label(format_version),
        })

    # Non-preset files travel as they are, only renamed so every delivered file carries the
    # brand. They are encrypted by the installer like the presets, but never content-credited:
    # rewriting a project or an archive would corrupt it.
    asset_entries: list[tuple[str, bytes]] = []
    asset_details: list[dict] = []
    asset_bytes = 0
    for original in asset_paths:
        relative = PurePosixPath(original.relative_to(source).as_posix())
        try:
            data = original.read_bytes()
        except OSError as error:
            skipped.append({"name": str(relative), "reason": f"unreadable: {error}", "bytes": 0})
            continue
        if asset_bytes + len(data) > ASSET_BUDGET_BYTES:
            skipped.append({"name": str(relative), "reason": "budget", "bytes": len(data)})
            continue
        name = branded_asset_name(str(relative))
        if name.casefold() in used:
            skipped.append({"name": str(relative), "reason": "duplicate", "bytes": len(data)})
            continue
        used.add(name.casefold())
        asset_bytes += len(data)
        asset_entries.append((name, data))
        asset_details.append({"name": name, "original": str(relative), "bytes": len(data)})

    manifest = {
        "product_id": product_id,
        "leak_name": product["name"],
        "product": product,
        "count": len(prepared),
        "asset_count": len(asset_entries),
        "asset_bytes": asset_bytes,
        "brand": BRAND,
        "effect_name_credited": effect_credit,
        "filename_credited": filename_credit,
        "files": details,
        "assets": asset_details,
        "skipped": skipped,
    }
    if effect_credit + filename_credit != len(prepared):
        raise ValueError("Every FFX preset must receive an effect-name or filename credit before app generation.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        for name, data, _ in prepared:
            archive.writestr("presets/" + name, data)
        for name, data in asset_entries:
            archive.writestr("files/" + name, data)
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
