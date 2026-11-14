#!/usr/bin/env python3
"""
Standalone macOS script for the 6ure FFX Tools flow.

Default action:
  - choose or receive .ffx files
  - detect editable After Effects effect display names
  - save prefixed copies using "zyrexediting.xyz - "

Examples:
  ./ffx_tool_mac.command MyPreset.ffx
  ./ffx_tool_mac.command --folder ~/Desktop/Presets --output-dir ~/Desktop/Prefixed
  ./ffx_tool_mac.command --rename "S_Flicker=My Flicker" MyPreset.ffx
  ./ffx_tool_mac.command --repair --overwrite BrokenPreset.ffx
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
from pathlib import Path


FFX_TEXT_MIN_CHARS = 3
FFX_TEXT_MAX_CHARS = 96
FFX_CANDIDATE_LIMIT = 180
FFX_EFFECT_NAME_MIN_SCORE = 3
FFX_UTF8_CHUNK_ENCODING = "ffxUtf8Chunk"
FFX_EFFECT_DISPLAY_INSERT_ENCODING = "ffxEffectDisplayInsert"
FFX_RANGE_REMOVE_ENCODING = "ffxRangeRemove"
FFX_TEMPLATE_CONVERSION_ENCODING = "ffxTemplateConversion"
FFX_CREDIT_PREFIX = "zyrexediting.xyz • "
FFX_CREDIT_PREFIX_MARKERS = [FFX_CREDIT_PREFIX, "zyrexediting.xyz \u0387 ", "zyrexediting.xyz \u00b7 "]
FFX_LEGACY_PREFIX_MARKERS = ["6ureleaks.com - ", "6ureleaks.com \u0387 ", "6ureleaks.com \u00b7 "]
FFX_ALL_CREDIT_PREFIX_MARKERS = FFX_CREDIT_PREFIX_MARKERS + FFX_LEGACY_PREFIX_MARKERS

FALLBACK_EFFECT_NAMES = [
    "3D Point Control",
    "Angle Control",
    "Checkbox Control",
    "Color Control",
    "Dropdown Menu Control",
    "Layer Control",
    "Point Control",
    "Slider Control",
    "Looks",
    "Deep Glow",
    "RSMB",
    "RSMB Pro",
    "RSMB Pro Vectors",
    "Twixtor",
    "Twixtor Pro",
    "Colorista V",
    "Cosmo II",
    "Denoiser III",
    "Mojo II",
    "Parametric Curve",
    "Renoiser",
    "Echospaces",
    "Form",
    "Geo",
    "Horizon",
    "Lux",
    "Mir 3",
    "Tao",
    "Trapcode Particular",
    "Sound Keys",
    "S_Glow",
    "S_Flicker",
    "BCC Glow",
]

EFFECT_KEYWORDS = [
    "effect",
    "control",
    "slider",
    "angle",
    "checkbox",
    "dropdown",
    "point",
    "color",
    "fill",
    "stroke",
    "blur",
    "glow",
    "key",
    "matte",
    "mask",
    "warp",
    "distort",
    "transform",
    "levels",
    "curves",
    "exposure",
    "hue",
    "saturation",
    "tint",
    "lumetri",
    "camera",
    "lens",
    "noise",
    "grain",
    "sharpen",
    "time",
    "echo",
    "offset",
    "turbulent",
    "fractal",
    "displacement",
    "expression",
    "preset",
]

EFFECT_PROPERTY_LABELS = {
    "look",
    "strength",
    "amount",
    "intensity",
    "opacity",
    "blend with original",
    "composite original",
    "source",
    "destination",
    "input",
    "output",
    "settings",
    "options",
    "edit",
    "reset",
    "licensing",
    "license",
    "about",
    "preset",
    "presets",
    "mode",
    "type",
    "style",
    "method",
    "quality",
    "channel",
    "channels",
    "view",
    "preview",
    "enabled",
    "use",
    "invert",
    "checkbox",
    "slider",
    "angle",
    "point",
    "center",
    "position",
    "anchor point",
    "scale",
    "rotation",
    "x rotation",
    "y rotation",
    "z rotation",
    "orientation",
    "skew",
    "width",
    "height",
    "size",
    "radius",
    "threshold",
    "tolerance",
    "softness",
    "feather",
    "expansion",
    "contrast",
    "brightness",
    "saturation",
    "gamma",
    "gain",
    "offset",
    "phase",
    "frequency",
    "evolution",
    "random seed",
    "seed",
}

known_names: list[str] = []
known_exact: set[str] = set()
known_search_index: dict | None = None
template_specs: list[dict] = []
runtime_template_specs: list[dict] = []
template_cache: dict[str, bytes] = {}


def normalize_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\x00", "")).strip()


def normalize_effect_key(value) -> str:
    return (
        normalize_text(value)
        .lower()
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def known_scan_key(value) -> str:
    text = normalize_effect_key(value)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def add_known_effect_name(value) -> None:
    global known_search_index
    clean = normalize_text(value)
    key = normalize_effect_key(value)
    if not clean or len(key) < 2 or key in known_exact:
        return
    known_exact.add(key)
    known_names.append(clean)
    known_search_index = None


def load_known_effect_names(path: Path | None) -> None:
    known_names.clear()
    known_exact.clear()
    if path and path.is_file():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            source = payload if isinstance(payload, list) else payload.get("names", [])
            for item in source:
                add_known_effect_name(item if isinstance(item, str) else item.get("name"))
        except Exception as error:
            print(f"Warning: could not load effect names from {path}: {error}", file=sys.stderr)
    if not known_exact:
        for name in FALLBACK_EFFECT_NAMES:
            add_known_effect_name(name)


def is_known_effect_name(value) -> bool:
    key = normalize_effect_key(value)
    return bool(key and key in known_exact)


def get_known_effect_search_index() -> dict:
    global known_search_index
    if known_search_index is not None:
        return known_search_index
    by_key: dict[str, str] = {}
    max_tokens = 0
    for name in known_names:
        key = known_scan_key(name)
        tokens = [token for token in key.split(" ") if token]
        if len(key) < 2 or not tokens:
            continue
        by_key.setdefault(key, name)
        max_tokens = max(max_tokens, len(tokens))
    known_search_index = {"byKey": by_key, "maxTokens": max_tokens}
    return known_search_index


def get_lookup_text(text) -> str:
    value = normalize_text(text).lower()
    value = re.sub(r"[._-]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def is_control_effect_name(text) -> bool:
    return bool(
        re.match(
            r"^(?:3D Point|Angle|Checkbox|Color|Dropdown Menu|Layer|Point|Slider) Control$",
            normalize_text(text),
            re.I,
        )
    )


def is_technical_effect_string(text) -> bool:
    clean = normalize_text(text)
    if re.match(r"^(?:ADBE|Pseudo/|Pseudo |APC|BPC)\b", clean, re.I):
        return True
    if re.match(r"^(?:PF_|PrMr|AEGP|aete|tdta|tdmn|tdsn|Utf8|TEXT)\b", clean, re.I):
        return True
    if re.match(r"^[A-Z0-9_./:-]{6,}$", clean) and not re.search(r"\s", clean):
        return True
    return False


def is_metadata_string(text) -> bool:
    lookup = get_lookup_text(text)
    if not lookup:
        return True
    if re.match(r"^(?:true|false|null|none|undefined|normal|default)$", lookup, re.I):
        return True
    if re.match(r"^(?:\d+|\d+(?:\.\d+)+|\d+(?:\.\d+)?%?)$", lookup):
        return True
    return any(
        item in lookup
        for item in [
            "adobe after effects",
            "animation preset",
            "effect controls",
            "com adobe",
            "xmlns",
            "copyright",
            "www ",
            "http ",
        ]
    )


def is_effect_property_label(text) -> bool:
    clean = normalize_text(text)
    if is_control_effect_name(clean):
        return False
    return get_lookup_text(clean) in EFFECT_PROPERTY_LABELS


def get_known_effect_name_in_text(value) -> str:
    clean = normalize_text(value)
    if not clean or is_metadata_string(clean):
        return ""
    if is_known_effect_name(clean):
        return clean
    if is_technical_effect_string(clean):
        return ""
    text_key = known_scan_key(clean)
    if not text_key:
        return ""
    index = get_known_effect_search_index()
    by_key = index.get("byKey", {})
    if text_key in by_key:
        return by_key[text_key]
    tokens = [token for token in text_key.split(" ") if token]
    max_tokens = min(len(tokens), int(index.get("maxTokens") or len(tokens)))
    for size in range(max_tokens, 0, -1):
        for start in range(0, len(tokens) - size + 1):
            key = " ".join(tokens[start : start + size])
            if key in by_key:
                return by_key[key]
    return ""


def is_printable_byte(byte: int) -> bool:
    return 32 <= byte <= 126


def is_printable_code(code: int) -> bool:
    return code in (9, 10, 13) or 32 <= code <= 126 or 160 <= code <= 0x017F


def is_likely_false_utf16_start(data: bytes, offset: int, encoding: str) -> bool:
    if offset <= 0 or offset + 1 >= len(data):
        return False
    previous = data[offset - 1]
    current = data[offset]
    next_byte = data[offset + 1]
    if encoding == "utf16le":
        return is_printable_byte(previous) and is_printable_byte(current) and next_byte <= 1
    return current <= 1 and is_printable_byte(next_byte) and is_printable_byte(previous)


def read_utf16_code(data: bytes, offset: int, encoding: str) -> int:
    if offset + 1 >= len(data):
        return -1
    if encoding == "utf16le":
        return data[offset] | (data[offset + 1] << 8)
    return (data[offset] << 8) | data[offset + 1]


def read_uint32(data: bytes | bytearray, offset: int) -> int:
    if offset < 0 or offset + 3 >= len(data):
        return 0
    return (
        ((data[offset] or 0) << 24)
        | ((data[offset + 1] or 0) << 16)
        | ((data[offset + 2] or 0) << 8)
        | (data[offset + 3] or 0)
    ) & 0xFFFFFFFF


def write_uint32(data: bytearray, offset: int, value: int) -> None:
    clean = max(0, int(value or 0)) & 0xFFFFFFFF
    data[offset] = (clean >> 24) & 0xFF
    data[offset + 1] = (clean >> 16) & 0xFF
    data[offset + 2] = (clean >> 8) & 0xFF
    data[offset + 3] = clean & 0xFF


def fourcc(data: bytes | bytearray, offset: int) -> str:
    if offset < 0 or offset + 3 >= len(data):
        return ""
    return bytes(data[offset : offset + 4]).decode("latin-1", errors="ignore")


def is_fourcc(value: str) -> bool:
    return bool(re.match(r"^[A-Za-z0-9 _.-]{4}$", value or ""))


def decode_binary_context(data: bytes, start: int, end: int) -> str:
    start = max(0, int(start or 0))
    end = min(len(data), max(start, int(end or start)))
    chars = [chr(byte) if 32 <= byte <= 126 else " " for byte in data[start:end]]
    return re.sub(r"\s+", " ", "".join(chars))


def get_occurrence_context(data: bytes, occurrence: dict) -> dict:
    offset = int(occurrence.get("offset") or 0)
    byte_length = int(occurrence.get("byteLength") or 0)
    return {
        "before": decode_binary_context(data, offset - 260, offset),
        "after": decode_binary_context(data, offset + byte_length, offset + byte_length + 120),
    }


def get_occurrence_role(data: bytes, occurrence: dict) -> str:
    if occurrence.get("role"):
        return occurrence["role"]
    context = get_occurrence_context(data, occurrence)
    before = context["before"]
    after = context["after"]
    tdmn_index = before.lower().rfind("tdmn")
    tdmn_context = before[tdmn_index:] if tdmn_index >= 0 else ""
    if re.search(r"tdmn.{0,180}-000[1-9]\d*.{0,180}pard", tdmn_context, re.I):
        return "property"
    if re.search(r"pard.{0,90}$", before, re.I) and not re.search(r"-0000(?!\d)", tdmn_context, re.I):
        return "property"
    if re.search(r"tdmn.{0,180}-0000(?!\d)", tdmn_context, re.I):
        return "effect"
    if re.search(r"ADBE Effect Parade", f"{before} {after}", re.I) and not re.search(r"pard.{0,90}$", before, re.I):
        return "effect"
    return "unknown"


def get_candidate_score(text, role: str = "unknown", related_effect_text: bool = False) -> int:
    clean = normalize_text(text)
    if len(clean) < FFX_TEXT_MIN_CHARS or len(clean) > FFX_TEXT_MAX_CHARS:
        return -1
    lower = clean.lower()
    if not re.search(r"[a-zA-Z]", clean):
        return -1
    if role == "property":
        return -1
    if re.search(r"-\d{4,}$", clean):
        return -1
    known_exact_match = is_known_effect_name(clean)
    known_embedded = bool(not known_exact_match and get_known_effect_name_in_text(clean))
    known = known_exact_match or known_embedded
    structural_effect = role == "effect"
    follows_effect_name = bool(related_effect_text)
    if not known and not structural_effect and not follows_effect_name:
        return -1
    if not structural_effect and not follows_effect_name and is_metadata_string(clean) and not known:
        return -1
    if re.search(r"[<>{}\[\]\\]", clean):
        return -1
    if not structural_effect and not follows_effect_name and ("http://" in lower or "https://" in lower or "www." in lower):
        return -1
    if not structural_effect and not follows_effect_name and any(
        item in lower
        for item in ["adobe after effects", "animation preset", "com.adobe", "xmlns", "software", "copyright"]
    ):
        return -1

    score = 0
    if structural_effect:
        score += 7
    if follows_effect_name:
        score += 4
    if known_exact_match:
        score += 5
    if known_embedded:
        score += 4
    if is_control_effect_name(clean):
        score += 5
    if re.match(r"^(?:CC|BCC|S_|RG|MBL)\s+[A-Za-z0-9]", clean):
        score += 3
    if not structural_effect and not follows_effect_name and is_technical_effect_string(clean) and not known:
        score -= 4
    if not structural_effect and not follows_effect_name and is_effect_property_label(clean) and not known:
        score -= 3
    score += min(sum(1 for keyword in EFFECT_KEYWORDS if keyword in lower), 4)
    if re.match(r"^[A-Za-z0-9][A-Za-z0-9 ._()/:+\-&#']+$", clean):
        score += 1
    if len(clean) <= 42 and len(clean.split()) <= 6:
        score += 1
    if re.match(r"^[A-Z][A-Za-z0-9 ._()/:+\-&#']+$", clean):
        score += 1
    if "/" in clean:
        score += 1
    if len(clean) > 72:
        score -= 1
    return score


def get_effect_display_name_score(text, candidate_score: int = 0, occurrence: dict | None = None, entry: dict | None = None) -> int:
    clean = normalize_text(text)
    if len(clean) < FFX_TEXT_MIN_CHARS or len(clean) > 64:
        return -1
    if not re.search(r"[a-zA-Z]", clean) or re.search(r"[<>{}\[\]\\]", clean):
        return -1
    words = [word for word in clean.split() if word]
    score = int(candidate_score or 0)
    role = get_occurrence_role(entry["bytes"], occurrence) if occurrence and entry and entry.get("bytes") else "unknown"
    if role == "property":
        return -1
    known_exact_match = is_known_effect_name(clean)
    known_embedded = bool(not known_exact_match and get_known_effect_name_in_text(clean))
    known = known_exact_match or known_embedded
    structural_effect = role == "effect"
    related_effect_text = bool(occurrence and occurrence.get("relatedEffectText"))
    if not known and not structural_effect and not related_effect_text:
        return -1
    if not structural_effect and not related_effect_text and is_metadata_string(clean) and not known:
        return -1
    if not structural_effect and not related_effect_text and is_technical_effect_string(clean) and not known:
        return -1
    if is_effect_property_label(clean) and role != "effect":
        return -1
    if not structural_effect and not related_effect_text and re.match(r"^(?:red giant|maxon|magic bullet)\b", clean, re.I) and not known:
        return -1
    if structural_effect:
        score += 7
    if related_effect_text:
        score += 4
    if role == "unknown" and len(words) > 4:
        score -= 3
    if known_exact_match:
        score += 8
    if known_embedded:
        score += 6
    if is_control_effect_name(clean):
        score += 6
    if re.match(r"^(?:CC|BCC|S_|RG|MBL)\s+[A-Za-z0-9]", clean):
        score += 3
    if len(words) <= 4:
        score += 2
    if re.match(r"^[A-Z][A-Za-z0-9'&.+-]*(?:\s+[A-Z0-9][A-Za-z0-9'&.+-]*)*$", clean):
        score += 2
    if re.search(r"[a-z]", clean) and re.search(r"[A-Z]", clean):
        score += 1
    if re.match(r"^[A-Z\s]+$", clean) and len(words) > 1:
        score -= 2
    return score


def is_structured_text_occurrence(occurrence: dict | None) -> bool:
    return bool(
        occurrence
        and occurrence.get("encoding") == FFX_UTF8_CHUNK_ENCODING
        and occurrence.get("chunkId") in ("tdsn", "fnam")
    )


def is_display_insert_occurrence(occurrence: dict | None) -> bool:
    return bool(occurrence and occurrence.get("encoding") == FFX_EFFECT_DISPLAY_INSERT_ENCODING)


def is_range_remove_occurrence(occurrence: dict | None) -> bool:
    return bool(occurrence and occurrence.get("encoding") == FFX_RANGE_REMOVE_ENCODING)


def is_template_conversion_occurrence(occurrence: dict | None) -> bool:
    return bool(occurrence and occurrence.get("encoding") == FFX_TEMPLATE_CONVERSION_ENCODING)


def is_editable_occurrence(occurrence: dict | None) -> bool:
    if not occurrence:
        return False
    if is_range_remove_occurrence(occurrence):
        return False
    if is_display_insert_occurrence(occurrence):
        return bool(occurrence.get("explicitEditable"))
    if is_template_conversion_occurrence(occurrence):
        return True
    if occurrence.get("protected") or occurrence.get("chunkId") == "tdmn":
        return False
    if occurrence.get("knownFallback"):
        # Fallback scanning may find an effect word inside a path or metadata
        # string (for example "Looks" in a LUT asset URL). Those aren't names.
        raw_text = normalize_text(occurrence.get("rawText"))
        if any(marker in raw_text for marker in ("/", "\\", "{stock}")):
            return False
        return len(raw_text) <= FFX_TEXT_MAX_CHARS
    if is_structured_text_occurrence(occurrence):
        # Edit the two effect display labels. The fnam chunk inside an
        # embedded effect template identifies the effect itself; changing it
        # makes After Effects treat the UTF-8 tag as the effect name.
        return occurrence.get("chunkId") == "tdsn" and occurrence.get("parentListType") in ("besc", "tdgp")
    return bool(occurrence.get("explicitEditable"))


def ranges_overlap(start: int, end: int, ranges: list[dict]) -> bool:
    low, high = 0, len(ranges)
    while low < high:
        middle = (low + high) // 2
        if ranges[middle]["start"] < end:
            low = middle + 1
        else:
            high = middle
    return low > 0 and ranges[low - 1]["end"] > start


def merge_ranges(ranges: list[dict]) -> list[dict]:
    merged: list[dict] = []
    for item in sorted(ranges, key=lambda current: (current["start"], current["end"])):
        start, end = int(item["start"]), int(item["end"])
        if end <= start:
            continue
        if merged and start <= merged[-1]["end"]:
            merged[-1]["end"] = max(merged[-1]["end"], end)
        else:
            merged.append({"start": start, "end": end})
    return merged


def find_excluded_range(index: int, ranges: list[dict], cursor: int) -> tuple[dict | None, int]:
    while cursor < len(ranges) and ranges[cursor]["end"] <= index:
        cursor += 1
    if cursor < len(ranges) and ranges[cursor]["start"] <= index < ranges[cursor]["end"]:
        return ranges[cursor], cursor
    return None, cursor


def make_utf8_payload(text) -> bytes:
    encoded = str(text or "").encode("utf-8")
    pad = 1 if len(encoded) % 2 else 0
    payload = bytearray(8 + len(encoded) + pad)
    payload[0:4] = b"Utf8"
    write_uint32(payload, 4, len(encoded))
    payload[8 : 8 + len(encoded)] = encoded
    return bytes(payload)


def get_utf8_chunk_text(data: bytes, payload_start: int, chunk_size: int) -> dict | None:
    if chunk_size < 8 or fourcc(data, payload_start) != "Utf8":
        return None
    text_length = read_uint32(data, payload_start + 4)
    text_start = payload_start + 8
    text_end = text_start + text_length
    if text_end > payload_start + chunk_size or text_end > len(data):
        return None
    try:
        return {
            "text": normalize_text(data[text_start:text_end].decode("utf-8", errors="replace")),
            "textStart": text_start,
            "textLength": text_length,
        }
    except Exception:
        return None


def get_padded_ascii_chunk_text(data: bytes, payload_start: int, chunk_size: int) -> dict | None:
    if chunk_size <= 0 or payload_start < 0 or payload_start + chunk_size > len(data):
        return None
    text_end = payload_start
    max_end = payload_start + chunk_size
    while text_end < max_end and data[text_end] != 0:
        if not is_printable_byte(data[text_end]):
            return None
        text_end += 1
    if text_end <= payload_start:
        return None
    text = normalize_text(data[payload_start:text_end].decode("latin-1", errors="ignore"))
    if not text:
        return None
    return {
        "text": text,
        "textStart": payload_start,
        "textLength": chunk_size,
        "encoding": "ascii",
        "charCapacity": chunk_size,
    }


def get_protected_path_repair_text(value) -> str:
    clean = normalize_text(value)
    if not clean:
        return ""
    repaired = normalize_text(re.sub("^6ureleaks\\.com\\s*(?:-|\u0387|\u00b7)\\s*", "", clean, flags=re.I))
    if not repaired or repaired == clean or re.match(r"^6ureleaks\.com\b", repaired, re.I):
        return ""
    return repaired


def make_protected_path_repair(file_index: int, chunk_start: int, chunk_size: int, text_info: dict | None) -> dict | None:
    new_name = get_protected_path_repair_text((text_info or {}).get("text", ""))
    if not new_name or len(new_name) > int((text_info or {}).get("charCapacity") or 0):
        return None
    return {
        "fileIndex": file_index,
        "oldName": text_info["text"],
        "newName": new_name,
        "occurrence": {
            "fileIndex": file_index,
            "offset": text_info["textStart"],
            "byteLength": text_info["textLength"],
            "encoding": "ascii",
            "rawText": text_info["text"],
            "charCapacity": text_info["charCapacity"],
            "chunkId": "tdmn",
            "chunkStart": chunk_start,
            "chunkSize": chunk_size,
            "protected": True,
            "repair": True,
        },
    }


def make_known_effect_match(
    file_index: int,
    name,
    text,
    offset: int,
    byte_length: int,
    encoding: str = "ascii",
    chunk_id: str = "",
    role: str = "unknown",
    protected_path: bool = False,
) -> dict | None:
    clean_name = normalize_text(name)
    clean_text = normalize_text(text)
    if not clean_name or not clean_text:
        return None
    return {
        "fileIndex": file_index,
        "name": clean_name,
        "text": clean_text,
        "offset": int(offset or 0),
        "byteLength": int(byte_length or 0),
        "encoding": encoding,
        "chunkId": chunk_id,
        "role": role,
        "protected": bool(protected_path),
    }


def get_known_effect_match_from_text(text, **options) -> dict | None:
    name = get_known_effect_name_in_text(text)
    if not name:
        return None
    return make_known_effect_match(name=name, text=text, **options)


def get_property_path_base(value) -> str:
    return re.sub(r"-\d{4,}$", "", normalize_text(value)).strip()


def is_property_path_name(value) -> bool:
    match = re.search(r"-(\d{4,})$", normalize_text(value))
    return bool(match and not re.match(r"^0+$", match.group(1)))


def is_non_effect_path_name(value) -> bool:
    clean = normalize_text(value)
    return bool(
        re.match(
            r"^ADBE (?:Effect Built In Params|Effect Mask|Effect Parade|Force CPU GPU|Group End|Transform Group|Text )",
            clean,
            re.I,
        )
        or re.match(r"^ADBE End of path sentinel$", clean, re.I)
    )


def make_known_fallback_occurrence(match: dict, file_index: int) -> dict | None:
    name = normalize_text(match.get("name", ""))
    text = normalize_text(match.get("text", ""))
    encoding = str(match.get("encoding") or "").strip()
    byte_length = int(match.get("byteLength") or 0)
    offset = int(match.get("offset") or 0)
    if not name or not text or not byte_length or offset < 0:
        return None
    if match.get("protected") or match.get("chunkId") == "tdmn":
        return None
    if encoding not in ("ascii", "utf16le", "utf16be") or match.get("role") == "property":
        return None
    if is_property_path_name(text):
        return None
    char_capacity = byte_length if encoding == "ascii" else byte_length // 2
    if char_capacity < len(name):
        return None
    return {
        "fileIndex": file_index,
        "offset": offset,
        "byteLength": byte_length,
        "encoding": encoding,
        "rawText": text,
        "charCapacity": char_capacity,
        "chunkId": match.get("chunkId") or "",
        "role": match.get("role") or "known",
        "protected": False,
        "explicitEditable": True,
        "knownFallback": True,
    }


def upgrade_ffx_head_for_utf8_display_names(data: bytes) -> bytes:
    """Mark older presets as AE 2024 format so AE reads credited UTF-8 labels."""
    if len(data) < 36 or fourcc(data, 0) != "RIFX" or fourcc(data, 8) != "FaFX":
        return data
    if fourcc(data, 12) != "head" or read_uint32(data, 16) < 16:
        return data
    version = read_uint32(data, 24)
    if version >= 95:
        return data
    upgraded = bytearray(data)
    # AE 2024's own saved FFX uses version 95 and companion value 5. This
    # header is required for AE to treat the new UTF-8 display-name chunks as
    # labels instead of effect identifiers (which appear as Utf8/Utf9).
    write_uint32(upgraded, 24, 95)
    write_uint32(upgraded, 28, 5)
    return bytes(upgraded)


def make_chunk(chunk_id: str, payload: bytes | bytearray) -> bytes:
    source = bytes(payload or b"")
    output = bytearray(8 + len(source))
    output[0:4] = chunk_id.encode("latin-1")[:4]
    write_uint32(output, 4, len(source))
    output[8:] = source
    return bytes(output)


def concat_bytes(chunks: list[bytes | bytearray | None]) -> bytes:
    return b"".join(bytes(chunk) for chunk in chunks if chunk)


def make_ascii_payload(text, capacity: int = 40) -> bytes:
    clean = normalize_text(text)
    size = max(len(clean) + 1, int(capacity or 40))
    output = bytearray(size)
    for index, char in enumerate(clean[:size]):
        output[index] = ord(char) & 0xFF
    return bytes(output)


def make_tdix_chunk(value: int) -> bytes:
    payload = bytearray(4)
    write_uint32(payload, 0, value)
    return make_chunk("tdix", payload)


def make_tdmn_chunk(text, capacity: int = 40) -> bytes:
    return make_chunk("tdmn", make_ascii_payload(text, capacity))


def make_tdsi_list(tdix_value: int, name: str) -> bytes:
    payload = concat_bytes([b"tdsi", make_tdix_chunk(tdix_value), make_tdmn_chunk(name)])
    return make_chunk("LIST", payload)


def make_tdsp_path_list(names: list[str]) -> bytes:
    count = max(0, min(2, len(names or [])))
    tdot_payload = bytearray(4)
    write_uint32(tdot_payload, 0, 0xFFFFFFFF)
    tdpl_payload = bytearray(4)
    write_uint32(tdpl_payload, 0, count)
    payload = concat_bytes(
        [
            b"tdsp",
            make_chunk("tdot", tdot_payload),
            make_chunk("tdpl", tdpl_payload),
            make_tdsi_list(0xFFFFFFFF, (names or ["ADBE Effect Parade"])[0] or "ADBE Effect Parade"),
            make_tdsi_list(0, (names or ["", ""])[1] if len(names or []) > 1 else ""),
        ]
    )
    return make_chunk("LIST", payload)


def make_effect_display_insert_bytes(effect_match_name: str, display_name: str) -> bytes:
    return concat_bytes(
        [
            make_tdsp_path_list(["ADBE Effect Parade", effect_match_name]),
            make_chunk("tdsn", make_utf8_payload(display_name)),
        ]
    )


def get_tdmn_path_before(data: bytes, offset: int, limit: int = 420) -> list[str]:
    end = max(0, min(len(data), int(offset or 0)))
    start = max(0, end - limit)
    names: list[str] = []
    cursor = start
    while cursor + 8 <= end:
        if fourcc(data, cursor) != "tdmn":
            cursor += 1
            continue
        chunk_size = read_uint32(data, cursor + 4)
        payload_start = cursor + 8
        chunk_end = payload_start + chunk_size
        if 0 < chunk_size <= 180 and chunk_end <= end and chunk_end <= len(data):
            text = normalize_text(decode_binary_context(data, payload_start, chunk_end))
            if text:
                names.append(text)
            cursor = chunk_end
            continue
        cursor += 1
    return names


def get_tdsi_path_name(data: bytes, chunk_start: int, chunk_end: int, file_index: int) -> dict | None:
    if fourcc(data, chunk_start) != "LIST" or fourcc(data, chunk_start + 8) != "tdsi":
        return None
    cursor = chunk_start + 12
    tdix_value = 0
    while cursor + 8 <= chunk_end:
        child_id = fourcc(data, cursor)
        child_size = read_uint32(data, cursor + 4)
        payload_start = cursor + 8
        child_end = payload_start + child_size
        if not is_fourcc(child_id) or child_end > chunk_end or child_end > len(data):
            break
        if child_id == "tdix" and child_size == 4:
            tdix_value = read_uint32(data, payload_start)
        elif child_id == "tdmn":
            text_info = get_padded_ascii_chunk_text(data, payload_start, child_size)
            text = normalize_text((text_info or {}).get("text", ""))
            if text:
                return {
                    "text": text,
                    "tdixValue": tdix_value,
                    "occurrence": {
                        "fileIndex": file_index,
                        "offset": text_info["textStart"],
                        "byteLength": text_info["textLength"],
                        "encoding": "ascii",
                        "rawText": text,
                        "charCapacity": text_info["charCapacity"],
                        "chunkId": "tdmn",
                        "chunkStart": cursor,
                        "chunkSize": child_size,
                        "protected": True,
                    },
                }
        cursor = child_end
    return None


def get_tdsp_path_info(data: bytes, chunk_start: int, chunk_end: int, ancestors: list[dict], file_index: int) -> dict | None:
    if fourcc(data, chunk_start) != "LIST" or fourcc(data, chunk_start + 8) != "tdsp":
        return None
    names: list[dict] = []
    cursor = chunk_start + 12
    while cursor + 8 <= chunk_end:
        child_id = fourcc(data, cursor)
        child_size = read_uint32(data, cursor + 4)
        payload_start = cursor + 8
        child_end = payload_start + child_size
        if not is_fourcc(child_id) or child_end > chunk_end or child_end > len(data):
            break
        if child_id == "LIST" and fourcc(data, payload_start) == "tdsi":
            item = get_tdsi_path_name(data, cursor, child_end, file_index)
            if item:
                names.append(item)
        cursor = child_end
    if len(names) < 2 or not re.match(r"^ADBE Effect Parade$", names[0].get("text", ""), re.I):
        return None
    effect_raw = normalize_text(names[1].get("text", ""))
    if not effect_raw or is_non_effect_path_name(effect_raw) or is_property_path_name(effect_raw):
        return None
    stripped = get_protected_path_repair_text(effect_raw) or effect_raw
    property_base = ""
    for item in names[2:]:
        base = get_property_path_base(item.get("text", ""))
        if base and not is_non_effect_path_name(base) and get_known_effect_name_in_text(base):
            property_base = base
            break
    stripped_key = normalize_effect_key(stripped)
    property_key = normalize_effect_key(property_base)
    property_known_key = normalize_effect_key(get_known_effect_name_in_text(property_base))
    if property_base and (not stripped_key or stripped_key in property_key or (property_known_key and property_known_key in stripped_key)):
        clean_effect_name = property_base
    else:
        clean_effect_name = stripped
    known_name = (
        get_known_effect_name_in_text(effect_raw)
        or get_known_effect_name_in_text(clean_effect_name)
        or clean_effect_name
    )
    # A valid effect-parade path already proves this is an effect. Some plugin
    # match names are absent from the optional name catalogue; use the preserved
    # match name as the visible label and insert a display chunk below.
    if not known_name:
        return None
    return {
        "fileIndex": file_index,
        "chunkStart": chunk_start,
        "chunkEnd": chunk_end,
        "ancestors": ancestors,
        "names": names,
        "effectRaw": effect_raw,
        "cleanEffectName": clean_effect_name,
        "knownName": known_name,
    }


def get_tdsp_raw_path_info(data: bytes, chunk_start: int, chunk_end: int, file_index: int = 0) -> dict | None:
    if fourcc(data, chunk_start) != "LIST" or fourcc(data, chunk_start + 8) != "tdsp":
        return None
    names: list[dict] = []
    cursor = chunk_start + 12
    while cursor + 8 <= chunk_end:
        child_id = fourcc(data, cursor)
        child_size = read_uint32(data, cursor + 4)
        payload_start = cursor + 8
        child_end = payload_start + child_size
        if not is_fourcc(child_id) or child_end > chunk_end or child_end > len(data):
            break
        if child_id == "LIST" and fourcc(data, payload_start) == "tdsi":
            item = get_tdsi_path_name(data, cursor, child_end, file_index)
            if item:
                names.append(item)
        cursor = child_end
    if not names:
        return None
    return {
        "chunkStart": chunk_start,
        "chunkEnd": chunk_end,
        "names": names,
        "isSentinel": any(re.match(r"^ADBE End of path sentinel$", item.get("text", ""), re.I) for item in names),
        "effectName": normalize_text(names[1].get("text", "") if len(names) > 1 else ""),
        "propertyName": normalize_text(names[-1].get("text", "")),
    }


def is_already_prefixed_name(value) -> bool:
    key = normalize_effect_key(value)
    return any(key.startswith(normalize_effect_key(marker)) for marker in FFX_ALL_CREDIT_PREFIX_MARKERS)


def is_currently_credited_name(value) -> bool:
    key = normalize_effect_key(value)
    return any(key.startswith(normalize_effect_key(marker)) for marker in FFX_CREDIT_PREFIX_MARKERS)


def make_unsafe_display_insert_repair(data: bytes, path_info: dict | None, parent_end: int, file_index: int) -> dict | None:
    if not path_info or len(path_info.get("names", [])) != 2 or not path_info.get("cleanEffectName"):
        return None
    display_chunk_start = int(path_info.get("chunkEnd") or 0)
    if display_chunk_start + 8 > parent_end or display_chunk_start + 8 > len(data):
        return None
    if fourcc(data, display_chunk_start) != "tdsn":
        return None
    display_chunk_size = read_uint32(data, display_chunk_start + 4)
    display_payload_start = display_chunk_start + 8
    display_chunk_end = display_payload_start + display_chunk_size
    if display_chunk_size > len(data) or display_chunk_end > parent_end or display_chunk_end > len(data):
        return None
    display_info = get_utf8_chunk_text(data, display_payload_start, display_chunk_size)
    display_text = normalize_text((display_info or {}).get("text", ""))
    if not display_text or not is_already_prefixed_name(display_text):
        return None
    display_known_name = get_known_effect_name_in_text(display_text)
    effect_key = normalize_effect_key(path_info.get("cleanEffectName"))
    display_key = normalize_effect_key(display_known_name)
    path_known_key = normalize_effect_key(path_info.get("knownName"))
    if not display_key or (
        display_key not in effect_key and effect_key not in display_key and path_known_key not in effect_key
    ):
        return None
    next_chunk_start = display_chunk_end
    if next_chunk_start + 8 > parent_end or next_chunk_start + 8 > len(data):
        return None
    if fourcc(data, next_chunk_start) != "LIST" or fourcc(data, next_chunk_start + 8) != "tdsp":
        return None
    next_chunk_end = next_chunk_start + 8 + read_uint32(data, next_chunk_start + 4)
    if next_chunk_end > parent_end or next_chunk_end > len(data):
        return None
    next_path_info = get_tdsp_path_info(data, next_chunk_start, next_chunk_end, path_info.get("ancestors", []), file_index)
    next_effect = normalize_text((next_path_info or {}).get("cleanEffectName") or (next_path_info or {}).get("effectRaw", ""))
    if (
        not next_path_info
        or len(next_path_info.get("names", [])) < 3
        or normalize_effect_key(next_effect) != effect_key
    ):
        return None
    remove_length = display_chunk_end - int(path_info.get("chunkStart") or 0)
    if remove_length <= 0:
        return None
    return {
        "fileIndex": file_index,
        "oldName": display_text,
        "newName": "Remove unsafe display block",
        "occurrence": {
            "fileIndex": file_index,
            "offset": path_info["chunkStart"],
            "byteLength": remove_length,
            "encoding": FFX_RANGE_REMOVE_ENCODING,
            "rawText": display_text,
            "removeStart": path_info["chunkStart"],
            "removeEnd": display_chunk_end,
            "ancestorSizeOffsets": [item["sizeOffset"] for item in path_info.get("ancestors", [])],
            "chunkId": "tdsp+tdsn",
            "repair": True,
        },
    }


def get_structured_text_role(data: bytes, chunk_id: str, parent_list_type: str, chunk_start: int, chunk_size: int) -> str:
    if chunk_id == "tdmn":
        return "internal"
    if chunk_id == "fnam" and parent_list_type == "sspc":
        return "effect"
    if chunk_id == "tdsn" and parent_list_type == "tdbs":
        return "property"
    if chunk_id == "tdsn" and parent_list_type == "besc":
        path_names = get_tdmn_path_before(data, chunk_start)
        last_path_name = path_names[-1] if path_names else ""
        if is_property_path_name(last_path_name) or is_non_effect_path_name(last_path_name):
            return "property"
        if not any(re.search(r"ADBE Effect Parade", name, re.I) for name in path_names):
            return "property"
        return "effect"
    if parent_list_type == "tdsi":
        return "effect"
    context = decode_binary_context(data, chunk_start, chunk_start + min(chunk_size + 120, 280))
    if re.search(r"tdmn.{0,160}-0000(?!\d)", context, re.I):
        return "effect"
    if re.search(r"pard.{0,80}", context, re.I) and not re.search(r"-0000(?!\d)", context, re.I):
        return "property"
    return "unknown"


def make_structured_text_occurrence(
    file_index: int,
    chunk_start: int,
    chunk_id: str,
    parent_list_type: str,
    chunk_size: int,
    ancestors: list[dict],
    text_info: dict,
    data: bytes,
) -> dict:
    encoding = text_info.get("encoding") or FFX_UTF8_CHUNK_ENCODING
    return {
        "fileIndex": file_index,
        "offset": text_info["textStart"],
        "byteLength": text_info["textLength"],
        "encoding": encoding,
        "rawText": text_info["text"],
        "charCapacity": int(text_info.get("charCapacity") or (text_info["textLength"] if encoding == "ascii" else 0)),
        "chunkId": chunk_id,
        "parentListType": parent_list_type,
        "chunkStart": chunk_start,
        "sizeOffset": chunk_start + 4,
        "payloadStart": chunk_start + 8,
        "chunkSize": chunk_size,
        "sizeOffsets": [chunk_start + 4] + [item["sizeOffset"] for item in ancestors],
        "ancestorSizeOffsets": [item["sizeOffset"] for item in ancestors],
        "role": get_structured_text_role(data, chunk_id, parent_list_type, chunk_start, chunk_size),
        "protected": chunk_id == "tdmn",
    }


def scan_structured_text_chunks(data: bytes, file_index: int) -> dict:
    matches: list[dict] = []
    ranges: list[dict] = []
    repairs: list[dict] = []
    known_matches: list[dict] = []
    display_fallbacks: list[dict] = []
    template_fallbacks_by_key: dict[str, dict] = {}
    path_repair_offsets: set[int] = set()
    structured_entries: list[dict] = []
    source_has_full_effect_template = has_list_type(data, "sspc")

    def remember_effect_path_fallback(path_info: dict | None, parent_list_type: str) -> None:
        if not path_info or not path_info.get("knownName") or not path_info.get("cleanEffectName"):
            return
        template_spec = get_template_spec_for_effect_match(path_info["cleanEffectName"])
        if template_spec and not source_has_full_effect_template:
            key = f"{file_index}|{template_spec['key']}"
            if key not in template_fallbacks_by_key:
                text = normalize_text(path_info.get("knownName") or template_spec.get("displayName"))
                template_fallbacks_by_key[key] = {
                    "fileIndex": file_index,
                    "text": text,
                    "effectMatchName": normalize_text(path_info["cleanEffectName"]),
                    "templateKey": template_spec["key"],
                    "occurrence": {
                        "fileIndex": file_index,
                        "offset": 0,
                        "byteLength": len(data),
                        "encoding": FFX_TEMPLATE_CONVERSION_ENCODING,
                        "rawText": text,
                        "charCapacity": 0,
                        "templateKey": template_spec["key"],
                        "effectMatchName": normalize_text(path_info["cleanEffectName"]),
                        "templateDisplayName": template_spec.get("displayName"),
                        "explicitEditable": True,
                        "knownFallback": True,
                    },
                }
        elif parent_list_type in ("besc", "tdgp"):
            # Some FFX files contain the effect's stable tdsp/tdmn match path
            # but omit the user-facing tdsn label. Add a label after that path.
            next_offset = path_info["chunkEnd"]
            next_role = ""
            if next_offset + 8 <= len(data) and fourcc(data, next_offset) == "tdsn":
                next_size = read_uint32(data, next_offset + 4)
                if next_offset + 8 + next_size <= len(data):
                    next_role = get_structured_text_role(data, "tdsn", parent_list_type, next_offset, next_size)
            if next_role != "effect":
                text = normalize_text(path_info.get("knownName") or path_info.get("cleanEffectName"))
                if text:
                    display_fallbacks.append({
                        "fileIndex": file_index,
                        "text": text,
                        "occurrence": {
                            "fileIndex": file_index,
                            "offset": next_offset,
                            "byteLength": 0,
                            "encoding": FFX_EFFECT_DISPLAY_INSERT_ENCODING,
                            "rawText": text,
                            "charCapacity": 0,
                            "effectMatchName": normalize_text(path_info["cleanEffectName"]),
                            "insertOffset": next_offset,
                            "ancestorSizeOffsets": [item["sizeOffset"] for item in path_info.get("ancestors", [])],
                            "explicitEditable": True,
                            "role": "effect",
                        },
                    })
        effect_occurrence = path_info.get("names", [None, None])[1].get("occurrence") if len(path_info.get("names", [])) > 1 else None
        if effect_occurrence and normalize_text(path_info.get("effectRaw")) != normalize_text(path_info.get("cleanEffectName")):
            path_repair_offsets.add(effect_occurrence["chunkStart"])
            repairs.append(
                {
                    "fileIndex": file_index,
                    "oldName": normalize_text(path_info.get("effectRaw")),
                    "newName": normalize_text(path_info.get("cleanEffectName")),
                    "occurrence": {**effect_occurrence, "repair": True},
                }
            )

    def parse_children(start: int, end: int, ancestors: list[dict] | None = None, parent_list_type: str = "") -> None:
        ancestors = ancestors or []
        offset = start
        while offset + 8 <= end and offset + 8 <= len(data):
            chunk_id = fourcc(data, offset)
            chunk_size = read_uint32(data, offset + 4)
            payload_start = offset + 8
            chunk_end = payload_start + chunk_size
            if not is_fourcc(chunk_id) or chunk_size > len(data) or chunk_end > end or chunk_end > len(data):
                offset += 1
                continue
            if chunk_id in ("RIFX", "LIST"):
                list_type = fourcc(data, payload_start)
                if is_fourcc(list_type) and chunk_size >= 4:
                    if list_type == "tdsp":
                        path_info = get_tdsp_path_info(data, offset, chunk_end, ancestors, file_index)
                        unsafe_repair = make_unsafe_display_insert_repair(data, path_info, end, file_index)
                        if unsafe_repair:
                            repairs.append(unsafe_repair)
                            ranges.append({"start": offset, "end": unsafe_repair["occurrence"]["removeEnd"]})
                            offset = unsafe_repair["occurrence"]["removeEnd"]
                            continue
                        remember_effect_path_fallback(path_info, parent_list_type)
                    parse_children(payload_start + 4, chunk_end, [{"sizeOffset": offset + 4}] + ancestors, list_type)
            elif chunk_id == "tdmn":
                text_info = get_padded_ascii_chunk_text(data, payload_start, chunk_size)
                tdmn_text = normalize_text((text_info or {}).get("text", ""))
                if tdmn_text and not is_non_effect_path_name(tdmn_text) and not is_property_path_name(tdmn_text):
                    known_match = get_known_effect_match_from_text(
                        tdmn_text,
                        file_index=file_index,
                        offset=(text_info or {}).get("textStart", payload_start),
                        byte_length=(text_info or {}).get("textLength", chunk_size),
                        encoding="ascii",
                        chunk_id=chunk_id,
                        role="internal",
                        protected_path=True,
                    )
                    if known_match:
                        known_matches.append(known_match)
                repair = None if offset in path_repair_offsets else make_protected_path_repair(file_index, offset, chunk_size, text_info)
                if repair:
                    repairs.append(repair)
                ranges.append({"start": offset, "end": chunk_end})
            elif chunk_id in ("tdsn", "fnam"):
                text_info = get_utf8_chunk_text(data, payload_start, chunk_size)
                if text_info and text_info.get("text") and len(text_info["text"]) >= FFX_TEXT_MIN_CHARS:
                    occurrence = make_structured_text_occurrence(
                        file_index, offset, chunk_id, parent_list_type, chunk_size, ancestors, text_info, data
                    )
                    known_match = get_known_effect_match_from_text(
                        text_info["text"],
                        file_index=file_index,
                        offset=text_info["textStart"],
                        byte_length=text_info["textLength"],
                        encoding=FFX_UTF8_CHUNK_ENCODING,
                        chunk_id=chunk_id,
                        role=occurrence["role"],
                        protected_path=False,
                    )
                    if known_match and known_match.get("role") != "property":
                        known_matches.append(known_match)
                    structured_entries.append({"text": text_info["text"], "occurrence": occurrence})
                    ranges.append({"start": offset, "end": chunk_end})
            offset = chunk_end

    parsed_root = False
    if fourcc(data, 0) == "RIFX" and fourcc(data, 8) == "FaFX":
        parse_children(12, min(len(data), 8 + read_uint32(data, 4)), [{"sizeOffset": 4}], "FaFX")
        parsed_root = True
    if not parsed_root or not structured_entries:
        parse_children(0, len(data), [])

    trusted_effect_texts = {
        normalize_effect_key(entry["text"])
        for entry in structured_entries
        if entry.get("occurrence", {}).get("role") == "effect" and normalize_effect_key(entry["text"])
    }
    for entry in structured_entries:
        related = normalize_effect_key(entry["text"]) in trusted_effect_texts
        entry["occurrence"]["relatedEffectText"] = related
        score = get_candidate_score(entry["text"], entry["occurrence"].get("role", "unknown"), related)
        if score >= 2:
            matches.append({"text": entry["text"], "score": score + 4, "occurrence": entry["occurrence"]})
    return {
        "matches": matches,
        "ranges": ranges,
        "repairs": repairs,
        "knownMatches": known_matches,
        "displayFallbacks": display_fallbacks,
        "templateFallbacks": list(template_fallbacks_by_key.values()),
    }


def make_occurrence(file_index: int, offset: int, byte_length: int, encoding: str, raw_text: str) -> dict:
    return {
        "fileIndex": file_index,
        "offset": offset,
        "byteLength": byte_length,
        "encoding": encoding,
        "rawText": raw_text,
        "charCapacity": byte_length if encoding == "ascii" else byte_length // 2,
    }


def scan_ascii_strings(data: bytes, file_index: int, excluded_ranges: list[dict]) -> list[dict]:
    matches: list[dict] = []
    index = 0
    range_cursor = 0
    while index < len(data):
        excluded, range_cursor = find_excluded_range(index, excluded_ranges, range_cursor)
        if excluded:
            index = excluded["end"]
            continue
        if not is_printable_byte(data[index]):
            index += 1
            continue
        start = index
        chars: list[str] = []
        while index < len(data) and is_printable_byte(data[index]):
            chars.append(chr(data[index]))
            index += 1
        if len(chars) >= FFX_TEXT_MIN_CHARS and not ranges_overlap(start, index, excluded_ranges):
            raw_text = "".join(chars)
            text = normalize_text(raw_text)
            score = get_candidate_score(text)
            if score >= 2:
                matches.append(
                    {"text": text, "score": score, "occurrence": make_occurrence(file_index, start, index - start, "ascii", raw_text)}
                )
    return matches


def scan_utf16_strings(data: bytes, file_index: int, encoding: str, excluded_ranges: list[dict]) -> list[dict]:
    matches: list[dict] = []
    index = 0
    range_cursor = 0
    while index + 1 < len(data):
        excluded, range_cursor = find_excluded_range(index, excluded_ranges, range_cursor)
        if excluded:
            index = excluded["end"]
            continue
        code = read_utf16_code(data, index, encoding)
        if not is_printable_code(code) or is_likely_false_utf16_start(data, index, encoding):
            index += 1
            continue
        start = index
        chars: list[str] = []
        while index + 1 < len(data):
            current = read_utf16_code(data, index, encoding)
            if not is_printable_code(current):
                break
            chars.append(chr(current))
            index += 2
        if len(chars) >= FFX_TEXT_MIN_CHARS and not ranges_overlap(start, index, excluded_ranges):
            raw_text = "".join(chars)
            text = normalize_text(raw_text)
            score = get_candidate_score(text)
            if score >= 2:
                matches.append(
                    {"text": text, "score": score, "occurrence": make_occurrence(file_index, start, index - start, encoding, raw_text)}
                )
    return matches


def scan_known_ascii_segments(data: bytes, file_index: int, excluded_ranges: list[dict]) -> list[dict]:
    matches: list[dict] = []
    index = 0
    range_cursor = 0
    while index < len(data):
        excluded, range_cursor = find_excluded_range(index, excluded_ranges, range_cursor)
        if excluded:
            index = excluded["end"]
            continue
        if not is_printable_byte(data[index]):
            index += 1
            continue
        start = index
        chars: list[str] = []
        while index < len(data) and is_printable_byte(data[index]):
            chars.append(chr(data[index]))
            index += 1
        if len(chars) >= FFX_TEXT_MIN_CHARS and not ranges_overlap(start, index, excluded_ranges):
            raw_text = "".join(chars)
            text = normalize_text(raw_text)
            if text and not is_effect_property_label(text):
                match = get_known_effect_match_from_text(
                    text, file_index=file_index, offset=start, byte_length=index - start, encoding="ascii"
                )
                if match:
                    matches.append(match)
    return matches


def scan_known_utf16_segments(data: bytes, file_index: int, encoding: str, excluded_ranges: list[dict]) -> list[dict]:
    matches: list[dict] = []
    index = 0
    range_cursor = 0
    while index + 1 < len(data):
        excluded, range_cursor = find_excluded_range(index, excluded_ranges, range_cursor)
        if excluded:
            index = excluded["end"]
            continue
        code = read_utf16_code(data, index, encoding)
        if not is_printable_code(code) or is_likely_false_utf16_start(data, index, encoding):
            index += 1
            continue
        start = index
        chars: list[str] = []
        while index + 1 < len(data):
            current = read_utf16_code(data, index, encoding)
            if not is_printable_code(current):
                break
            chars.append(chr(current))
            index += 2
        if len(chars) >= FFX_TEXT_MIN_CHARS and not ranges_overlap(start, index, excluded_ranges):
            raw_text = "".join(chars)
            text = normalize_text(raw_text)
            if text and not is_effect_property_label(text):
                match = get_known_effect_match_from_text(
                    text, file_index=file_index, offset=start, byte_length=index - start, encoding=encoding
                )
                if match:
                    matches.append(match)
    return matches


def dedupe_known_matches(matches: list[dict]) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for match in matches:
        key = "|".join(
            [
                str(match.get("fileIndex")),
                normalize_effect_key(match.get("name")),
                normalize_text(match.get("text")).lower(),
                str(match.get("offset")),
                str(match.get("encoding")),
            ]
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(match)
    return result


def scan_bytes_detailed(data: bytes, file_index: int) -> dict:
    structured = scan_structured_text_chunks(data, file_index)
    ranges = merge_ranges(structured["ranges"])
    known_matches = dedupe_known_matches(
        structured["knownMatches"]
        + scan_known_ascii_segments(data, file_index, ranges)
        + scan_known_utf16_segments(data, file_index, "utf16le", ranges)
        + scan_known_utf16_segments(data, file_index, "utf16be", ranges)
    )
    return {
        "candidates": structured["matches"]
        + scan_ascii_strings(data, file_index, ranges)
        + scan_utf16_strings(data, file_index, "utf16le", ranges)
        + scan_utf16_strings(data, file_index, "utf16be", ranges),
        "repairs": structured["repairs"],
        "knownMatches": known_matches,
        "displayFallbacks": structured["displayFallbacks"],
        "templateFallbacks": structured["templateFallbacks"],
    }


def build_name_catalog(entries: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    occurrence_keys: set[str] = set()

    def add_grouped_occurrence(text, score, occurrence, file_index: int) -> None:
        clean_text = normalize_text(text)
        if not clean_text or not occurrence or not isinstance(file_index, int):
            return
        key = clean_text.lower()
        if key not in grouped:
            grouped[key] = {
                "key": key,
                "text": clean_text,
                "score": 0,
                "occurrences": [],
                "files": set(),
                "encodings": set(),
                "capacity": float("inf"),
                "newName": "",
            }
        item = grouped[key]
        occurrence_key = "|".join(
            [
                key,
                str(file_index),
                str(occurrence.get("offset")),
                str(occurrence.get("byteLength")),
                str(occurrence.get("encoding")),
                str(occurrence.get("chunkId") or ""),
            ]
        )
        if occurrence_key in occurrence_keys:
            return
        occurrence_keys.add(occurrence_key)
        item["score"] = max(item["score"], int(score or 0))
        item["occurrences"].append(occurrence)
        item["files"].add(file_index)
        item["encodings"].add(occurrence.get("encoding"))
        item["capacity"] = min(item["capacity"], int(occurrence.get("charCapacity") or 0))

    for file_index, entry in enumerate(entries):
        for candidate in entry.get("candidates", []):
            text = normalize_text(candidate.get("text"))
            occurrence = candidate.get("occurrence")
            if not text or not is_editable_occurrence(occurrence):
                continue
            display_score = get_effect_display_name_score(text, candidate.get("score", 0), occurrence, entry)
            if display_score < FFX_EFFECT_NAME_MIN_SCORE:
                continue
            add_grouped_occurrence(text, display_score, occurrence, file_index)

        for fallback in entry.get("displayFallbacks", []):
            occurrence = (fallback or {}).get("occurrence")
            if occurrence and is_editable_occurrence(occurrence):
                add_grouped_occurrence(
                    fallback.get("text") or occurrence.get("rawText"),
                    FFX_EFFECT_NAME_MIN_SCORE + 4,
                    occurrence,
                    file_index,
                )

    files_with_editable_names = {file_index for item in grouped.values() for file_index in item["files"]}
    for file_index, entry in enumerate(entries):
        if file_index in files_with_editable_names:
            continue
        for fallback in entry.get("templateFallbacks", []):
            occurrence = (fallback or {}).get("occurrence")
            if occurrence and is_editable_occurrence(occurrence):
                add_grouped_occurrence(
                    fallback.get("text") or occurrence.get("rawText"),
                    FFX_EFFECT_NAME_MIN_SCORE + 4,
                    occurrence,
                    file_index,
                )
        for match in entry.get("knownMatches", []):
            occurrence = make_known_fallback_occurrence(match, file_index)
            if occurrence:
                add_grouped_occurrence(match.get("name"), FFX_EFFECT_NAME_MIN_SCORE, occurrence, file_index)

    sorted_items = sorted(
        grouped.values(),
        key=lambda item: (-item["score"], -len(item["occurrences"]), item["text"].lower()),
    )[:FFX_CANDIDATE_LIMIT]
    output: list[dict] = []
    for index, item in enumerate(sorted_items):
        capacity = item["capacity"] if item["capacity"] != float("inf") else len(item["text"])
        output.append(
            {
                **item,
                "id": f"ffx-name-{index}",
                "files": sorted(item["files"]),
                "encodings": sorted(value for value in item["encodings"] if value),
                "capacity": int(capacity or 0),
            }
        )
    return output


def get_rename_capacity(item: dict) -> int:
    if any(is_structured_text_occurrence(occurrence) for occurrence in item.get("occurrences", [])):
        return 0
    capacities = [int(occurrence.get("charCapacity") or 0) for occurrence in item.get("occurrences", [])]
    capacities = [value for value in capacities if value > 0]
    return min(capacities) if capacities else 0


def can_encode_text_for_occurrence(text: str, occurrence: dict) -> bool:
    if occurrence.get("encoding") == "ascii":
        return all(32 <= ord(char) <= 126 for char in text)
    return True


def get_invalid_rename(item: dict, new_name: str) -> str:
    if not new_name or new_name == item.get("text"):
        return ""
    occurrences = item.get("occurrences", [])
    if not occurrences or any(not is_editable_occurrence(occurrence) for occurrence in occurrences):
        return "internal preset path"
    for occurrence in occurrences:
        if is_structured_text_occurrence(occurrence):
            continue
        if not can_encode_text_for_occurrence(new_name, occurrence):
            return "cannot encode text"
        capacity = int(occurrence.get("charCapacity") or 0)
        if capacity > 0 and len(new_name) > capacity:
            return "new name is longer than the available text slot"
    return ""


def prefix_name(value: str, prefix: str) -> str:
    clean = normalize_text(value)
    for marker in FFX_LEGACY_PREFIX_MARKERS:
        if clean.lower().startswith(marker.lower()):
            clean = normalize_text(clean[len(marker):])
    if is_currently_credited_name(clean):
        return clean
    return f"{prefix}{clean}" if clean else ""


def get_prefix_renames(names: list[dict], prefix: str) -> tuple[list[dict], list[dict]]:
    safe: list[dict] = []
    skipped: list[dict] = []
    for item in names:
        if not item.get("text") or is_currently_credited_name(item["text"]):
            continue
        if not item.get("occurrences") or any(not is_editable_occurrence(occ) for occ in item["occurrences"]):
            continue
        new_name = normalize_text(prefix_name(item["text"], prefix))
        if not new_name or new_name == item["text"]:
            continue
        occurrences_by_file: dict[int, list[dict]] = {}
        for occurrence in item.get("occurrences", []):
            file_index = occurrence.get("fileIndex")
            if isinstance(file_index, int):
                occurrences_by_file.setdefault(file_index, []).append(occurrence)
        safe_occurrences: list[dict] = []
        safe_files: set[int] = set()
        for file_index, occurrences in occurrences_by_file.items():
            scoped_item = {**item, "files": [file_index], "occurrences": occurrences}
            message = get_invalid_rename(scoped_item, new_name)
            if message:
                skipped.append({"item": scoped_item, "newName": new_name, "message": message})
            else:
                safe_occurrences.extend(occurrences)
                safe_files.add(file_index)
        if safe_occurrences:
            safe.append({"item": {**item, "occurrences": safe_occurrences, "files": sorted(safe_files)}, "newName": new_name})
    return safe, skipped


def get_custom_renames(names: list[dict], pairs: list[tuple[str, str]]) -> tuple[list[dict], list[str]]:
    requested = {normalize_effect_key(old): normalize_text(new) for old, new in pairs if normalize_text(old) and normalize_text(new)}
    used: set[str] = set()
    renames: list[dict] = []
    skipped: list[str] = []
    for item in names:
        key = normalize_effect_key(item.get("text"))
        if key not in requested:
            continue
        new_name = requested[key]
        used.add(key)
        message = get_invalid_rename(item, new_name)
        if message:
            skipped.append(f"{item.get('text')}: {message}")
            continue
        renames.append({"item": item, "newName": new_name})
    for old, _new in pairs:
        if normalize_effect_key(old) not in used:
            skipped.append(f"{old}: not detected")
    return renames, skipped


def encode_replacement(occurrence: dict, new_name: str) -> bytes:
    if is_structured_text_occurrence(occurrence):
        return make_utf8_payload(new_name)
    slot_length = int(occurrence.get("byteLength") or 0)
    encoded_length = len(new_name) if occurrence.get("encoding") == "ascii" else len(new_name) * 2
    if not slot_length or encoded_length > slot_length:
        raise ValueError("New name is longer than the editable .ffx text slot.")
    target = bytearray(slot_length)
    if occurrence.get("encoding") == "ascii":
        for index, char in enumerate(new_name):
            target[index] = ord(char) & 0xFF
        return bytes(target)
    for index, char in enumerate(new_name):
        code = ord(char)
        byte_index = index * 2
        if occurrence.get("encoding") == "utf16le":
            target[byte_index] = code & 0xFF
            target[byte_index + 1] = (code >> 8) & 0xFF
        else:
            target[byte_index] = (code >> 8) & 0xFF
            target[byte_index + 1] = code & 0xFF
    return bytes(target)


def translate_offset(offset: int, edits: list[dict]) -> int:
    translated = int(offset or 0)
    for edit in edits or []:
        if edit["end"] <= offset:
            translated += edit["delta"]
    return translated


def translate_insertion_offset(offset: int, edits: list[dict], target_edit: dict) -> int:
    translated = int(offset or 0)
    for edit in edits or []:
        if edit is target_edit:
            break
        if edit["end"] <= offset:
            translated += edit["delta"]
    return translated


def has_unsafe_display_insert_at(data: bytes, occurrence: dict) -> bool:
    start = int(occurrence.get("offset", occurrence.get("removeStart", 0)) or 0)
    if start < 0 or start + 8 > len(data):
        return False
    if fourcc(data, start) != "LIST" or fourcc(data, start + 8) != "tdsp":
        return False
    tdsp_end = start + 8 + read_uint32(data, start + 4)
    if tdsp_end + 8 > len(data) or fourcc(data, tdsp_end) != "tdsn":
        return False
    tdsn_size = read_uint32(data, tdsp_end + 4)
    text_info = get_utf8_chunk_text(data, tdsp_end + 8, tdsn_size)
    return normalize_text((text_info or {}).get("text", "")) == normalize_text(occurrence.get("rawText", ""))


def verify_replacement(data: bytes, replacement: dict) -> bool:
    occurrence = replacement.get("occurrence")
    if is_template_conversion_occurrence(occurrence):
        return has_list_type(data, "sspc") and count_structured_text(data, replacement.get("newName", "")) >= 2
    if is_range_remove_occurrence(occurrence):
        return not has_unsafe_display_insert_at(data, occurrence)
    if is_display_insert_occurrence(occurrence):
        insert_offset = int(replacement.get("outputInsertOffset") or occurrence.get("insertOffset") or 0)
        if insert_offset < 0 or insert_offset + 8 > len(data):
            return False
        if fourcc(data, insert_offset) != "LIST" or fourcc(data, insert_offset + 8) != "tdsp":
            return False
        tdsp_size = read_uint32(data, insert_offset + 4)
        tdsn_offset = insert_offset + 8 + tdsp_size
        if fourcc(data, tdsn_offset) != "tdsn":
            return False
        tdsn_size = read_uint32(data, tdsn_offset + 4)
        text_info = get_utf8_chunk_text(data, tdsn_offset + 8, tdsn_size)
        return (text_info or {}).get("text") == normalize_text(replacement.get("newName", ""))
    if is_structured_text_occurrence(occurrence):
        payload_start = int(replacement.get("outputPayloadStart") or translate_offset(occurrence.get("payloadStart", 0), replacement.get("edits", [])))
        payload_size = read_uint32(data, payload_start - 4)
        text_info = get_utf8_chunk_text(data, payload_start, payload_size)
        return (text_info or {}).get("text") == normalize_text(replacement.get("newName", ""))
    offset = int((occurrence or {}).get("offset") or 0)
    expected = encode_replacement(occurrence, replacement.get("newName", ""))
    return offset >= 0 and offset + len(expected) <= len(data) and data[offset : offset + len(expected)] == expected


def verify_output(output: dict) -> bool:
    data = output.get("bytes") or b""
    replacements = output.get("replacements") or []
    return bool(replacements and all(verify_replacement(data, replacement) for replacement in replacements))


def sanitize_output_file_name(name: str) -> str:
    base = re.split(r"[\\/]", str(name or "preset.ffx"))[-1]
    base = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", base).strip()
    base = re.sub(r"[ .]+$", "", base) or "preset.ffx"
    return base if re.search(r"\.ffx$", base, re.I) else f"{base}.ffx"


def get_output_name(name: str, suffix: str = "-renamed") -> str:
    clean = sanitize_output_file_name(name)
    clean_suffix = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "", str(suffix or "-renamed")).strip() or "-renamed"
    return re.sub(r"\.ffx$", f"{clean_suffix}.ffx", clean, flags=re.I)


def get_occurrence_edit_start(occurrence: dict) -> int:
    if is_structured_text_occurrence(occurrence):
        return int(occurrence.get("payloadStart") or 0)
    if is_display_insert_occurrence(occurrence):
        return int(occurrence.get("insertOffset") or 0)
    if is_range_remove_occurrence(occurrence):
        return int(occurrence.get("removeStart", occurrence.get("offset", 0)) or 0)
    if is_template_conversion_occurrence(occurrence):
        return 0
    return int(occurrence.get("offset") or 0)


def build_output_for_file(file_index: int, entries: list[dict], renames: list[dict], suffix: str, allow_protected_repairs: bool = False) -> dict | None:
    entry = entries[file_index]
    source = entry.get("bytes")
    if not source:
        return None
    replacements: list[dict] = []
    for rename in renames:
        for occurrence in rename.get("item", {}).get("occurrences", []):
            if occurrence.get("fileIndex") != file_index:
                continue
            allow_repair = bool(allow_protected_repairs and occurrence.get("repair"))
            if not allow_repair and not is_editable_occurrence(occurrence):
                continue
            replacements.append({"occurrence": occurrence, "newName": rename.get("newName")})

    template_replacement = next((item for item in replacements if is_template_conversion_occurrence(item.get("occurrence"))), None)
    if template_replacement:
        return build_template_conversion_output(file_index, entries, template_replacement, suffix)

    replacements.sort(key=lambda item: get_occurrence_edit_start(item["occurrence"]))
    edits: list[dict] = []
    size_deltas: dict[int, int] = {}
    absolute_sizes: dict[int, int] = {}

    for replacement in replacements:
        occurrence = replacement["occurrence"]
        new_name = replacement["newName"]
        if is_range_remove_occurrence(occurrence):
            start = int(occurrence.get("removeStart", occurrence.get("offset", 0)) or 0)
            end = int(occurrence.get("removeEnd") or (start + int(occurrence.get("byteLength") or 0)))
            if end <= start or end > len(source):
                continue
            delta = start - end
            edits.append({"start": start, "end": end, "bytes": b"", "delta": delta, "replacement": replacement})
            for size_offset in occurrence.get("ancestorSizeOffsets", []):
                size_deltas[size_offset] = size_deltas.get(size_offset, 0) + delta
            continue
        if is_display_insert_occurrence(occurrence):
            start = int(occurrence.get("insertOffset") or 0)
            if start <= 0 or start > len(source):
                continue
            insert_bytes = make_effect_display_insert_bytes(occurrence.get("effectMatchName", ""), new_name)
            edits.append({"start": start, "end": start, "bytes": insert_bytes, "delta": len(insert_bytes), "replacement": replacement})
            for size_offset in occurrence.get("ancestorSizeOffsets", []):
                size_deltas[size_offset] = size_deltas.get(size_offset, 0) + len(insert_bytes)
            for repair in occurrence.get("internalRepairs", []):
                repair_name = normalize_text(repair.get("newName", ""))
                if not repair_name:
                    continue
                repair_bytes = encode_replacement(repair, repair_name)
                repair_start = int(repair.get("offset") or 0)
                repair_end = repair_start + int(repair.get("byteLength") or 0)
                if repair_end <= repair_start or repair_end > len(source):
                    continue
                edits.append(
                    {
                        "start": repair_start,
                        "end": repair_end,
                        "bytes": repair_bytes,
                        "delta": len(repair_bytes) - (repair_end - repair_start),
                        "replacement": {"occurrence": repair, "newName": repair_name, "internalRepair": True},
                    }
                )
            continue
        if is_structured_text_occurrence(occurrence):
            start = int(occurrence.get("payloadStart") or 0)
            old_size = int(occurrence.get("chunkSize") or 0)
            new_bytes = make_utf8_payload(new_name)
            end = start + old_size
            if not old_size or start < 8 or end > len(source):
                continue
            delta = len(new_bytes) - old_size
            edits.append({"start": start, "end": end, "bytes": new_bytes, "delta": delta, "replacement": replacement})
            absolute_sizes[int(occurrence["sizeOffset"])] = len(new_bytes)
            for size_offset in occurrence.get("ancestorSizeOffsets", []):
                size_deltas[size_offset] = size_deltas.get(size_offset, 0) + delta
            continue
        new_bytes = encode_replacement(occurrence, new_name)
        start = int(occurrence.get("offset") or 0)
        end = start + int(occurrence.get("byteLength") or 0)
        if end <= start or end > len(source):
            continue
        edits.append({"start": start, "end": end, "bytes": new_bytes, "delta": len(new_bytes) - (end - start), "replacement": replacement})

    edits.sort(key=lambda item: item["start"])
    chunks: list[bytes] = []
    cursor = 0
    non_overlapping: list[dict] = []
    for edit in edits:
        if edit["start"] < cursor:
            continue
        chunks.append(source[cursor : edit["start"]])
        chunks.append(edit["bytes"])
        cursor = edit["end"]
        non_overlapping.append(edit)
    chunks.append(source[cursor:])
    if not non_overlapping:
        return None
    output = bytearray(b"".join(chunks))

    for offset, size in absolute_sizes.items():
        write_uint32(output, translate_offset(offset, non_overlapping), size)
    for offset, delta in size_deltas.items():
        write_uint32(output, translate_offset(offset, non_overlapping), read_uint32(source, offset) + delta)

    verified_replacements: list[dict] = []
    for edit in non_overlapping:
        replacement = edit["replacement"]
        occurrence = replacement.get("occurrence", {})
        if is_display_insert_occurrence(occurrence):
            verified_replacements.append(
                {**replacement, "outputInsertOffset": translate_insertion_offset(occurrence.get("insertOffset", 0), non_overlapping, edit)}
            )
        elif is_structured_text_occurrence(occurrence):
            verified_replacements.append(
                {**replacement, "outputPayloadStart": translate_offset(occurrence.get("payloadStart", 0), non_overlapping)}
            )
        else:
            verified_replacements.append(
                {**replacement, "occurrence": {**occurrence, "offset": translate_offset(occurrence.get("offset", 0), non_overlapping)}}
            )

    result = {
        "bytes": bytes(output),
        "fileName": get_output_name(entry["name"], suffix),
        "applied": len(verified_replacements),
        "fileIndex": file_index,
        "entry": entry,
        "replacements": verified_replacements,
    }
    if not verify_output(result):
        raise RuntimeError(f"Could not verify changed effect name inside {entry['name']}.")
    return result


def build_repair_output_for_file(file_index: int, entries: list[dict], repairs: list[dict], suffix: str = "-repaired") -> dict | None:
    renames = [
        {"item": {"text": repair.get("oldName"), "occurrences": [repair["occurrence"]]}, "newName": repair.get("newName")}
        for repair in repairs
        if repair.get("fileIndex") == file_index and repair.get("occurrence") and repair.get("newName")
    ]
    if not renames:
        return None
    return build_output_for_file(file_index, entries, renames, suffix, allow_protected_repairs=True)


def normalize_template_spec(spec: dict) -> dict | None:
    key = str(spec.get("key") or "").strip()
    effect_match_names = []
    for name in spec.get("effectMatchNames", []) or []:
        clean = normalize_text(name)
        if clean and clean not in effect_match_names:
            effect_match_names.append(clean)
    display_names = []
    for name in [spec.get("displayName")] + list(spec.get("displayNames", []) or []):
        clean = normalize_text(name)
        if clean and clean not in display_names:
            display_names.append(clean)
    display_name = normalize_text(spec.get("displayName") or (display_names[0] if display_names else "") or (effect_match_names[0] if effect_match_names else ""))
    if not key or not effect_match_names or not display_name:
        return None
    return {
        **spec,
        "key": key,
        "displayName": display_name,
        "displayNames": display_names or [display_name],
        "effectMatchNames": effect_match_names,
    }


def load_template_library(path: Path | None) -> None:
    template_specs.clear()
    if not path or not path.is_file():
        return
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for item in payload.get("templates", []) if isinstance(payload, dict) else []:
            spec = normalize_template_spec(item)
            if spec:
                template_specs.append(spec)
    except Exception as error:
        print(f"Warning: could not load template library from {path}: {error}", file=sys.stderr)


def get_template_spec_list() -> list[dict]:
    return template_specs + runtime_template_specs


def get_template_spec_by_key(key: str) -> dict | None:
    clean = str(key or "").strip()
    return next((spec for spec in get_template_spec_list() if spec.get("key") == clean), None)


def get_template_spec_for_effect_match(value) -> dict | None:
    key = normalize_effect_key(value)
    if not key:
        return None
    return next(
        (
            spec
            for spec in get_template_spec_list()
            if any(normalize_effect_key(name) == key for name in spec.get("effectMatchNames", []))
        ),
        None,
    )


def is_template_supported_effect(value) -> bool:
    return bool(get_template_spec_for_effect_match(value))


def load_template_bytes(template_key: str) -> bytes:
    spec = get_template_spec_by_key(template_key)
    if not spec:
        raise RuntimeError("FFX template is not configured for this effect.")
    if spec["key"] in template_cache:
        return template_cache[spec["key"]]
    data: bytes | None = None
    if isinstance(spec.get("bytes"), (bytes, bytearray)):
        data = bytes(spec["bytes"])
    elif spec.get("base64Data"):
        data = base64.b64decode(str(spec["base64Data"]).encode("ascii"))
    elif spec.get("url"):
        url_path = Path(str(spec["url"]))
        if not url_path.is_absolute():
            url_path = Path(__file__).resolve().parent / url_path
        data = url_path.read_bytes()
    if not data:
        raise RuntimeError(f"FFX template {spec['key']} is empty.")
    if fourcc(data, 0) != "RIFX" or fourcc(data, 8) != "FaFX":
        raise RuntimeError(f"FFX template {spec['key']} is not a valid preset.")
    template_cache[spec["key"]] = data
    return data


def ensure_templates_for_renames(renames: list[dict]) -> None:
    keys: set[str] = set()
    for rename in renames:
        for occurrence in rename.get("item", {}).get("occurrences", []):
            if is_template_conversion_occurrence(occurrence) and occurrence.get("templateKey"):
                keys.add(occurrence["templateKey"])
    for key in keys:
        load_template_bytes(key)


def get_root_end(data: bytes) -> int:
    if fourcc(data, 0) == "RIFX" and fourcc(data, 8) == "FaFX":
        return min(len(data), 8 + read_uint32(data, 4))
    return len(data)


def get_besc_range(data: bytes) -> dict | None:
    root_end = get_root_end(data)
    if fourcc(data, 0) != "RIFX" or fourcc(data, 8) != "FaFX":
        return None
    offset = 12
    while offset + 8 <= root_end:
        chunk_id = fourcc(data, offset)
        chunk_size = read_uint32(data, offset + 4)
        payload_start = offset + 8
        chunk_end = payload_start + chunk_size
        if not is_fourcc(chunk_id) or chunk_end > root_end or chunk_end > len(data):
            break
        if chunk_id == "LIST" and fourcc(data, payload_start) == "besc":
            return {"chunkStart": offset, "chunkEnd": chunk_end, "contentStart": payload_start + 4, "contentEnd": chunk_end}
        offset = chunk_end
    return None


def get_direct_children(data: bytes, start: int, end: int) -> list[dict]:
    children: list[dict] = []
    offset = max(0, int(start or 0))
    limit = min(len(data), int(end or len(data)))
    while offset + 8 <= limit:
        chunk_id = fourcc(data, offset)
        chunk_size = read_uint32(data, offset + 4)
        payload_start = offset + 8
        chunk_end = payload_start + chunk_size
        if not is_fourcc(chunk_id) or chunk_size > len(data) or chunk_end > limit or chunk_end > len(data):
            break
        children.append(
            {
                "chunkId": chunk_id,
                "chunkSize": chunk_size,
                "payloadStart": payload_start,
                "chunkStart": offset,
                "chunkEnd": chunk_end,
                "listType": fourcc(data, payload_start) if chunk_id == "LIST" else "",
            }
        )
        offset = chunk_end
    return children


def get_template_display_names(spec: dict, occurrence: dict | None = None) -> set[str]:
    names = [spec.get("displayName")] + list(spec.get("displayNames", []) or [])
    if occurrence:
        names.extend([occurrence.get("rawText"), occurrence.get("templateDisplayName")])
    return {normalize_text(name) for name in names if normalize_text(name)}


def make_runtime_template_key(file_index: int, effect_match_name: str) -> str:
    effect_key = re.sub(r"[^a-z0-9]+", "_", normalize_effect_key(effect_match_name)).strip("_") or "effect"
    return f"runtime_{file_index}_{effect_key}"


def get_full_effect_template_infos(data: bytes, file_index: int = 0) -> list[dict]:
    besc = get_besc_range(data)
    if not besc or not has_list_type(data, "sspc"):
        return []
    infos: list[dict] = []
    pending_path = None
    pending_display = ""
    for child in get_direct_children(data, besc["contentStart"], besc["contentEnd"]):
        if child["chunkId"] == "LIST" and child["listType"] == "tdsp":
            path_info = get_tdsp_raw_path_info(data, child["chunkStart"], child["chunkEnd"], file_index)
            if (
                path_info
                and not path_info["isSentinel"]
                and len(path_info["names"]) == 2
                and re.match(r"^ADBE Effect Parade$", path_info["names"][0].get("text", ""), re.I)
                and path_info["effectName"]
                and not is_non_effect_path_name(path_info["effectName"])
                and not is_property_path_name(path_info["effectName"])
            ):
                pending_path = path_info
                pending_display = ""
        elif child["chunkId"] == "tdsn" and pending_path and not pending_display:
            text_info = get_utf8_chunk_text(data, child["payloadStart"], child["chunkSize"])
            pending_display = normalize_text((text_info or {}).get("text", ""))
        elif child["chunkId"] == "LIST" and child["listType"] == "sspc" and pending_path:
            effect_match_name = normalize_text(pending_path.get("effectName", ""))
            known_name = get_known_effect_name_in_text(pending_display) or get_known_effect_name_in_text(effect_match_name) or effect_match_name
            display_name = normalize_text(known_name or pending_display or effect_match_name)
            if effect_match_name and display_name:
                infos.append(
                    {
                        "key": make_runtime_template_key(file_index, effect_match_name),
                        "displayName": display_name,
                        "displayNames": list(dict.fromkeys([pending_display, display_name, effect_match_name])),
                        "effectMatchNames": [effect_match_name],
                        "bytes": data,
                        "runtime": True,
                        "sourceFileIndex": file_index,
                    }
                )
            pending_path = None
            pending_display = ""
    return [spec for spec in (normalize_template_spec(item) for item in infos) if spec]


def refresh_runtime_template_specs(entries: list[dict]) -> None:
    runtime_template_specs.clear()
    for key in list(template_cache):
        if str(key).startswith("runtime_"):
            del template_cache[key]
    specs_by_effect: dict[str, dict] = {}
    for file_index, entry in enumerate(entries):
        data = entry.get("bytes")
        if not data:
            continue
        for spec in get_full_effect_template_infos(data, file_index):
            effect_key = normalize_effect_key((spec.get("effectMatchNames") or [""])[0])
            if effect_key and effect_key not in specs_by_effect:
                specs_by_effect[effect_key] = spec
    runtime_template_specs.extend(specs_by_effect.values())


def extract_source_property_chunks(data: bytes, file_index: int = 0, effect_match_name: str = "") -> dict[str, bytes]:
    besc = get_besc_range(data)
    if not besc:
        return {}
    paths: list[dict] = []
    tdbs_chunks: list[dict] = []
    for child in get_direct_children(data, besc["contentStart"], besc["contentEnd"]):
        if child["chunkId"] == "LIST" and child["listType"] == "tdsp":
            path_info = get_tdsp_raw_path_info(data, child["chunkStart"], child["chunkEnd"], file_index)
            if path_info and not path_info["isSentinel"]:
                paths.append(path_info)
        elif child["chunkId"] == "LIST" and child["listType"] == "tdbs":
            tdbs_chunks.append(child)
    chunks_by_property: dict[str, bytes] = {}
    effect_filter_key = normalize_effect_key(effect_match_name)
    for path_info, chunk in zip(paths, tdbs_chunks):
        effect_name = normalize_text(path_info.get("effectName", ""))
        property_name = normalize_text(path_info.get("propertyName", ""))
        if not property_name or not effect_name or len(path_info.get("names", [])) < 3:
            continue
        if not is_template_supported_effect(effect_name):
            continue
        if effect_filter_key and normalize_effect_key(effect_name) != effect_filter_key:
            continue
        chunks_by_property[property_name] = data[chunk["chunkStart"] : chunk["chunkEnd"]]
    return chunks_by_property


def apply_binary_edits(source: bytes, edits: list[dict], absolute_sizes: dict[int, int], size_deltas: dict[int, int]) -> dict:
    ordered = sorted(edits or [], key=lambda item: item["start"])
    chunks: list[bytes] = []
    non_overlapping: list[dict] = []
    cursor = 0
    for edit in ordered:
        if edit["start"] < cursor or edit["end"] < edit["start"] or edit["end"] > len(source):
            continue
        chunks.append(source[cursor : edit["start"]])
        chunks.append(edit.get("bytes", b""))
        cursor = edit["end"]
        non_overlapping.append(edit)
    chunks.append(source[cursor:])
    output = bytearray(b"".join(chunks))
    for offset, size in absolute_sizes.items():
        write_uint32(output, translate_offset(offset, non_overlapping), size)
    for offset, delta in size_deltas.items():
        write_uint32(output, translate_offset(offset, non_overlapping), read_uint32(source, offset) + delta)
    return {"bytes": bytes(output), "edits": non_overlapping}


def get_text_chunk_edit(source: bytes, offset: int, chunk_size: int, new_name: str, ancestors: list[dict]) -> dict | None:
    payload_start = offset + 8
    end = payload_start + chunk_size
    if end > len(source):
        return None
    new_bytes = make_utf8_payload(new_name)
    return {
        "start": payload_start,
        "end": end,
        "bytes": new_bytes,
        "delta": len(new_bytes) - chunk_size,
        "sizeOffset": offset + 4,
        "ancestorSizeOffsets": [item["sizeOffset"] for item in ancestors or []],
    }


def build_template_conversion_bytes(source_bytes: bytes, template_bytes: bytes, occurrence: dict, new_name: str, file_index: int = 0) -> dict:
    spec = get_template_spec_by_key(occurrence.get("templateKey"))
    if not spec:
        raise RuntimeError("FFX template is not configured for this effect.")
    property_chunks = extract_source_property_chunks(source_bytes, file_index, occurrence.get("effectMatchName", ""))
    edits: list[dict] = []
    size_deltas: dict[int, int] = {}
    absolute_sizes: dict[int, int] = {}
    root_end = get_root_end(template_bytes)
    display_names = get_template_display_names(spec, occurrence)

    def add_size_delta(offset: int, delta: int) -> None:
        if isinstance(offset, int) and offset >= 0 and delta:
            size_deltas[offset] = size_deltas.get(offset, 0) + delta

    def parse_children(start: int, end: int, ancestors: list[dict] | None = None, parent_list_type: str = "") -> None:
        ancestors = ancestors or []
        offset = start
        last_tdmn = ""
        while offset + 8 <= end and offset + 8 <= len(template_bytes):
            chunk_id = fourcc(template_bytes, offset)
            chunk_size = read_uint32(template_bytes, offset + 4)
            payload_start = offset + 8
            chunk_end = payload_start + chunk_size
            if not is_fourcc(chunk_id) or chunk_size > len(template_bytes) or chunk_end > end or chunk_end > len(template_bytes):
                offset += 1
                continue
            if chunk_id == "tdmn":
                text_info = get_padded_ascii_chunk_text(template_bytes, payload_start, chunk_size)
                last_tdmn = normalize_text((text_info or {}).get("text", ""))
            elif chunk_id in ("tdsn", "fnam"):
                text_info = get_utf8_chunk_text(template_bytes, payload_start, chunk_size)
                text = normalize_text((text_info or {}).get("text", ""))
                is_display_slot = text in display_names and (
                    (chunk_id == "fnam" and parent_list_type == "sspc") or (chunk_id == "tdsn" and parent_list_type != "tdbs")
                )
                if is_display_slot:
                    edit = get_text_chunk_edit(template_bytes, offset, chunk_size, new_name, ancestors)
                    if edit:
                        edits.append(edit)
                        absolute_sizes[edit["sizeOffset"]] = len(edit["bytes"])
                        for size_offset in edit["ancestorSizeOffsets"]:
                            add_size_delta(size_offset, edit["delta"])
            elif chunk_id == "LIST":
                list_type = fourcc(template_bytes, payload_start)
                if list_type == "tdbs" and parent_list_type == "tdgp" and last_tdmn and last_tdmn in property_chunks:
                    replacement_bytes = property_chunks[last_tdmn]
                    delta = len(replacement_bytes) - (chunk_end - offset)
                    edits.append({"start": offset, "end": chunk_end, "bytes": replacement_bytes, "delta": delta})
                    for ancestor in ancestors:
                        add_size_delta(ancestor["sizeOffset"], delta)
                    offset = chunk_end
                    continue
                if is_fourcc(list_type) and chunk_size >= 4:
                    parse_children(payload_start + 4, chunk_end, [{"sizeOffset": offset + 4}] + ancestors, list_type)
            elif chunk_id == "RIFX":
                list_type = fourcc(template_bytes, payload_start)
                if is_fourcc(list_type) and chunk_size >= 4:
                    parse_children(payload_start + 4, chunk_end, [{"sizeOffset": offset + 4}] + ancestors, list_type)
            offset = chunk_end

    parse_children(12, root_end, [{"sizeOffset": 4}], "FaFX")
    applied = apply_binary_edits(template_bytes, edits, absolute_sizes, size_deltas)
    return {**applied, "appliedCount": len(applied["edits"]), "propertyCount": len(property_chunks)}


def has_list_type(data: bytes, target_type: str) -> bool:
    root_end = get_root_end(data)
    found = False

    def parse_children(start: int, end: int) -> None:
        nonlocal found
        offset = start
        while not found and offset + 8 <= end and offset + 8 <= len(data):
            chunk_id = fourcc(data, offset)
            chunk_size = read_uint32(data, offset + 4)
            payload_start = offset + 8
            chunk_end = payload_start + chunk_size
            if not is_fourcc(chunk_id) or chunk_end > end or chunk_end > len(data):
                break
            if chunk_id in ("LIST", "RIFX"):
                list_type = fourcc(data, payload_start)
                if list_type == target_type:
                    found = True
                    return
                if is_fourcc(list_type) and chunk_size >= 4:
                    parse_children(payload_start + 4, chunk_end)
            offset = chunk_end

    parse_children(0, root_end)
    return found


def count_structured_text(data: bytes, expected_text: str) -> int:
    clean = normalize_text(expected_text)
    if not clean:
        return 0
    root_end = get_root_end(data)
    count = 0

    def parse_children(start: int, end: int) -> None:
        nonlocal count
        offset = start
        while offset + 8 <= end and offset + 8 <= len(data):
            chunk_id = fourcc(data, offset)
            chunk_size = read_uint32(data, offset + 4)
            payload_start = offset + 8
            chunk_end = payload_start + chunk_size
            if not is_fourcc(chunk_id) or chunk_end > end or chunk_end > len(data):
                break
            if chunk_id in ("tdsn", "fnam"):
                text_info = get_utf8_chunk_text(data, payload_start, chunk_size)
                if normalize_text((text_info or {}).get("text", "")) == clean:
                    count += 1
            elif chunk_id in ("LIST", "RIFX"):
                list_type = fourcc(data, payload_start)
                if is_fourcc(list_type) and chunk_size >= 4:
                    parse_children(payload_start + 4, chunk_end)
            offset = chunk_end

    parse_children(0, root_end)
    return count


def build_template_conversion_output(file_index: int, entries: list[dict], replacement: dict, suffix: str) -> dict | None:
    entry = entries[file_index]
    occurrence = replacement.get("occurrence")
    spec = get_template_spec_by_key((occurrence or {}).get("templateKey"))
    if not entry.get("bytes") or not spec:
        return None
    template_bytes = load_template_bytes(spec["key"])
    new_name = normalize_text(replacement.get("newName", ""))
    if not new_name:
        return None
    converted = build_template_conversion_bytes(entry["bytes"], template_bytes, occurrence, new_name, file_index)
    verified_replacement = {**replacement, "templateConverted": True}
    result = {
        "bytes": converted["bytes"],
        "fileName": get_output_name(entry["name"], suffix),
        "applied": max(1, converted.get("appliedCount") or 0),
        "fileIndex": file_index,
        "entry": entry,
        "replacements": [verified_replacement],
    }
    if not verify_output(result):
        raise RuntimeError(f"Could not verify converted full-effect preset for {entry['name']}.")
    return result


def default_asset_path(*parts: str) -> Path | None:
    candidates = []
    script_dir = Path(__file__).resolve().parent
    cwd = Path.cwd()
    for base in [script_dir, cwd, script_dir.parent, cwd.parent]:
        candidates.append(base.joinpath(*parts))
        candidates.append(base / "Developer Files" / "Source Code" / Path(*parts))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def choose_files_with_osascript() -> list[Path]:
    script = [
        'set pickedFiles to choose file with prompt "Select After Effects .ffx preset files" of type {"ffx"} with multiple selections allowed',
        'set outputText to ""',
        "repeat with pickedFile in pickedFiles",
        "set outputText to outputText & POSIX path of pickedFile & linefeed",
        "end repeat",
        "return outputText",
    ]
    try:
        result = subprocess.run(
            ["osascript", *sum([["-e", line] for line in script], [])],
            check=True,
            text=True,
            capture_output=True,
        )
        return [Path(line.strip()) for line in result.stdout.splitlines() if line.strip()]
    except Exception:
        return []


def choose_folder_with_osascript(prompt: str) -> Path | None:
    script = [
        f'set pickedFolder to choose folder with prompt "{prompt}"',
        "return POSIX path of pickedFolder",
    ]
    try:
        result = subprocess.run(
            ["osascript", *sum([["-e", line] for line in script], [])],
            check=True,
            text=True,
            capture_output=True,
        )
        value = result.stdout.strip()
        return Path(value) if value else None
    except Exception:
        return None


def collect_ffx_paths(paths: list[str], folders: list[str], choose_folder: bool) -> list[Path]:
    found: list[Path] = []

    def add_path(path: Path) -> None:
        if path.is_dir():
            found.extend(sorted(item for item in path.rglob("*.ffx") if item.is_file()))
        elif path.is_file() and path.suffix.lower() == ".ffx":
            found.append(path)

    for raw in paths:
        add_path(Path(raw).expanduser())
    for raw in folders or []:
        add_path(Path(raw).expanduser())
    if choose_folder:
        folder = choose_folder_with_osascript("Select a folder that contains .ffx presets")
        if folder:
            add_path(folder)
    if not found and platform.system() == "Darwin":
        found.extend(choose_files_with_osascript())
    deduped: list[Path] = []
    seen: set[Path] = set()
    for path in found:
        resolved = path.expanduser().resolve()
        if resolved in seen or not resolved.is_file() or resolved.suffix.lower() != ".ffx":
            continue
        seen.add(resolved)
        deduped.append(resolved)
    return deduped


def scan_entries(paths: list[Path]) -> tuple[list[dict], list[dict]]:
    entries: list[dict] = []
    for index, path in enumerate(paths):
        data = path.read_bytes()
        scan = scan_bytes_detailed(data, index)
        entries.append(
            {
                "path": path,
                "name": path.name,
                "size": len(data),
                "bytes": data,
                "candidates": scan["candidates"],
                "repairs": scan["repairs"],
                "knownMatches": scan["knownMatches"],
                "displayFallbacks": scan["displayFallbacks"],
                "templateFallbacks": scan["templateFallbacks"],
            }
        )
    refresh_runtime_template_specs(entries)
    return entries, build_name_catalog(entries)


def all_repairs(entries: list[dict]) -> list[dict]:
    repairs: list[dict] = []
    for file_index, entry in enumerate(entries):
        for repair in entry.get("repairs", []):
            repairs.append({**repair, "fileIndex": file_index})
    return repairs


def rename_file_indexes(renames: list[dict]) -> set[int]:
    indexes: set[int] = set()
    for rename in renames:
        for file_index in rename.get("item", {}).get("files", []):
            if isinstance(file_index, int) and file_index >= 0:
                indexes.add(file_index)
    return indexes


def unique_output_path(folder: Path, file_name: str) -> Path:
    target = folder / sanitize_output_file_name(file_name)
    if not target.exists():
        return target
    stem = target.stem
    suffix = target.suffix or ".ffx"
    counter = 2
    while True:
        candidate = folder / f"{stem} ({counter}){suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def save_outputs(outputs: list[dict], output_dir: Path | None, overwrite: bool) -> list[Path]:
    saved: list[Path] = []
    if overwrite:
        for output in outputs:
            target = Path(output["entry"]["path"])
            temp_name = f".{target.name}.sixure-ffx-tmp"
            temp_path = target.with_name(temp_name)
            with open(temp_path, "wb") as handle:
                handle.write(output["bytes"])
            os.replace(temp_path, target)
            saved.append(target)
        return saved
    if output_dir is None and platform.system() == "Darwin":
        output_dir = choose_folder_with_osascript("Choose a folder for the converted .ffx files")
    if output_dir is None:
        output_dir = Path.home() / "Desktop" / "ffx-prefixed"
    output_dir = output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    for output in outputs:
        target = unique_output_path(output_dir, output["fileName"])
        target.write_bytes(output["bytes"])
        saved.append(target)
    return saved


def credit_ffx_bytes(data: bytes, file_name: str = "preset.ffx") -> tuple[bytes, dict]:
    """Return a verified credited FFX copy; leave the input untouched on any unsafe case."""
    if data and fourcc(data, 0) == "RIFX" and fourcc(data, 8) == "Egg!":
        return data, {"already_credited": False, "not_ffx": True, "unsupported_container": True, "effects": 0, "replacements": 0}
    if not data or fourcc(data, 0) != "RIFX" or fourcc(data, 8) != "FaFX":
        is_known_other_format = (
            data.startswith((b"%PDF-", b"\x89PNG\r\n\x1a\n", b"[{000214A0-"))
            or (len(data) >= 8 and data[4:8] == b"ftyp")
            or (b"\x00" not in data[:4096] and sum(byte < 9 or 13 < byte < 32 for byte in data[:4096]) < max(1, len(data[:4096]) // 20))
        )
        if is_known_other_format:
            return data, {"already_credited": False, "not_ffx": True, "effects": 0, "replacements": 0}
        raise ValueError("Not a valid After Effects FFX preset")
    load_known_effect_names(default_asset_path("ffx-effect-names.json"))
    templates_path = default_asset_path("assets", "ffx-effect-templates.json")
    load_template_library(templates_path)
    with tempfile.TemporaryDirectory(prefix="zyrex-ffx-credit-") as temp_dir:
        source_path = Path(temp_dir) / sanitize_output_file_name(file_name)
        source_path.write_bytes(data)
        entries, names = scan_entries([source_path])
        if not names:
            return data, {"already_credited": False, "no_editable_names": True, "effects": 0, "replacements": 0}
        uncredited = [item for item in names if not is_currently_credited_name(item.get("text", ""))]
        if not uncredited:
            return data, {"already_credited": True, "effects": len(names), "replacements": 0}
        renames, skipped = get_prefix_renames(names, FFX_CREDIT_PREFIX)
        if skipped:
            details = ", ".join(f"{item['item'].get('text')}: {item.get('message')}" for item in skipped[:3])
            raise ValueError(f"Some detected effect names cannot be safely credited ({details})")
        if not renames:
            return data, {"already_credited": False, "no_editable_names": True, "effects": 0, "replacements": 0}
        ensure_templates_for_renames(renames)
        output = build_output_for_file(0, entries, renames, "-credited")
        if not output or not verify_output(output):
            raise ValueError("FFX credit replacement failed output verification")
        credited = upgrade_ffx_head_for_utf8_display_names(output["bytes"])
        if b"zyrexediting.xyz" not in credited:
            raise ValueError("The resulting FFX file is missing the Zyrex credit marker")
        return credited, {"already_credited": False, "effects": len(renames), "replacements": int(output.get("applied", 0))}


def open_folder(path: Path) -> None:
    try:
        if platform.system() == "Darwin":
            subprocess.run(["open", str(path)], check=False)
        elif platform.system() == "Windows":
            os.startfile(str(path))  # type: ignore[attr-defined]
        else:
            subprocess.run(["xdg-open", str(path)], check=False)
    except Exception:
        pass


def print_scan_summary(entries: list[dict], names: list[dict]) -> None:
    occurrence_count = sum(len(item.get("occurrences", [])) for item in names)
    repair_count = len(all_repairs(entries))
    print(f"Scanned {len(entries)} .ffx file(s).")
    print(f"Detected {len(names)} editable effect name(s), {occurrence_count} occurrence(s).")
    if repair_count:
        print(f"Detected {repair_count} protected-path repair item(s).")
    for item in names:
        files = ", ".join(entries[index]["name"] for index in item.get("files", []) if 0 <= index < len(entries))
        print(f"  - {item['text']} ({files})")


def parse_rename_pairs(values: list[str]) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for value in values or []:
        if "=" not in value:
            raise ValueError(f"--rename expects OLD=NEW, got: {value}")
        old, new = value.split("=", 1)
        pairs.append((normalize_text(old), normalize_text(new)))
    return pairs


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Credit After Effects FFX effect names for Zyrex Editing.")
    parser.add_argument("paths", nargs="*", help=".ffx files or folders. If omitted on macOS, a file picker opens.")
    parser.add_argument("--folder", action="append", default=[], help="Scan a folder recursively for .ffx files.")
    parser.add_argument("--choose-folder", action="store_true", help="Open a macOS folder picker and scan it recursively.")
    parser.add_argument("--output-dir", help="Folder for saved copies. If omitted on macOS, a folder picker opens.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite original .ffx files instead of saving copies.")
    parser.add_argument("--prefix", default=FFX_CREDIT_PREFIX, help="Prefix used by the default credit action.")
    parser.add_argument("--rename", action="append", default=[], help='Custom rename in OLD=NEW form. Repeat as needed.')
    parser.add_argument("--repair", action="store_true", help="Repair protected internal paths instead of prefixing names.")
    parser.add_argument("--list", action="store_true", help="Only scan and print detected names.")
    parser.add_argument("--dry-run", action="store_true", help="Build and verify outputs without writing files.")
    parser.add_argument("--open-output", action="store_true", help="Open the output folder after saving copies.")
    parser.add_argument("--effect-names", help="Path to ffx-effect-names.json.")
    parser.add_argument("--templates", help="Path to assets/ffx-effect-templates.json.")
    parser.add_argument("--no-templates", action="store_true", help="Disable full-effect template conversion fallback.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    effect_names_path = Path(args.effect_names).expanduser() if args.effect_names else default_asset_path("ffx-effect-names.json")
    templates_path = None if args.no_templates else (Path(args.templates).expanduser() if args.templates else default_asset_path("assets", "ffx-effect-templates.json"))
    load_known_effect_names(effect_names_path)
    if templates_path:
        load_template_library(templates_path)

    paths = collect_ffx_paths(args.paths, args.folder, args.choose_folder)
    if not paths:
        print("No .ffx files were selected.", file=sys.stderr)
        return 1

    print(f"Using {len(known_names)} known effect names.")
    if template_specs:
        print(f"Using {len(template_specs)} FFX template conversion preset(s).")

    entries, names = scan_entries(paths)
    print_scan_summary(entries, names)
    if args.list:
        return 0

    output_suffix = "-prefixed"
    outputs: list[dict] = []
    skipped_messages: list[str] = []

    if args.repair:
        repairs = all_repairs(entries)
        if not repairs:
            print("No protected internal paths need repair.")
            return 0
        output_suffix = "-repaired"
        for file_index in sorted({repair["fileIndex"] for repair in repairs}):
            output = build_repair_output_for_file(file_index, entries, repairs, output_suffix)
            if output:
                outputs.append(output)
    else:
        rename_pairs = parse_rename_pairs(args.rename)
        if rename_pairs:
            renames, skipped_messages = get_custom_renames(names, rename_pairs)
            output_suffix = "-renamed"
        else:
            prefix_value = str(args.prefix if args.prefix is not None else FFX_CREDIT_PREFIX).replace("\x00", "")
            renames, skipped = get_prefix_renames(names, prefix_value)
            skipped_messages = [f"{item['item'].get('text')}: {item.get('message')}" for item in skipped]
        if not renames:
            if names and all(is_currently_credited_name(item.get("text", "")) for item in names):
                print("All detected effect names already carry the Zyrex credit.")
                return 0
            if not names:
                print("No safely editable effect display names were found; the source file was left unchanged.")
                return 0
            print("No safe editable names are ready to convert.", file=sys.stderr)
            for message in skipped_messages[:12]:
                print(f"Skipped: {message}", file=sys.stderr)
            return 1
        ensure_templates_for_renames(renames)
        for file_index in sorted(rename_file_indexes(renames)):
            output = build_output_for_file(file_index, entries, renames, output_suffix)
            if output:
                outputs.append(output)

    if skipped_messages:
        for message in skipped_messages[:12]:
            print(f"Skipped: {message}")
        if len(skipped_messages) > 12:
            print(f"Skipped {len(skipped_messages) - 12} more item(s).")

    if not outputs:
        print("No output files were prepared.", file=sys.stderr)
        return 1

    total_replacements = sum(output.get("applied", 0) for output in outputs)
    print(f"Prepared {len(outputs)} output file(s), {total_replacements} verified replacement(s).")

    if args.dry_run:
        print("Dry run complete. No files were written.")
        return 0

    output_dir = Path(args.output_dir).expanduser() if args.output_dir else None
    saved = save_outputs(outputs, output_dir, args.overwrite)
    print("Saved:")
    for path in saved:
        print(f"  {path}")
    if args.open_output and saved and not args.overwrite:
        open_folder(saved[0].parent)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1)
