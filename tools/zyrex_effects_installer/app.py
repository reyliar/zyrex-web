"""Zyrex Effects Installer desktop application."""
from __future__ import annotations
import json, os, re, shutil, subprocess, sys, threading, time, urllib.parse, urllib.request, zipfile
from pathlib import Path

SITE = "https://zyrexediting.xyz"
VERSION = "v1.0.0"

def resource(name: str) -> Path:
    root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return root / name

def safe_part(value: str, fallback: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", str(value or ""))
    value = re.sub(r"\s+", " ", value).strip(" .")
    return (value[:96] if value and value not in {".", ".."} else fallback)

def load_embedded():
    with zipfile.ZipFile(resource("payload.zip")) as zf:
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        presets = [(Path(name).name, zf.read(name)) for name in zf.namelist() if name.startswith("presets/") and not name.endswith("/")]
    return manifest, presets

def detect_destination() -> Path | None:
    docs = Path.home() / "Documents" / "Adobe"
    if not docs.is_dir():
        return None
    candidates = sorted((p / "User Presets" for p in docs.glob("After Effects*") if p.is_dir()), key=lambda p: p.parent.name.casefold(), reverse=True)
    return candidates[0] if candidates else None

class InstallerAPI:
    def __init__(self):
        self.manifest, self.presets = load_embedded()
        self.product = self.manifest.get("product") or {}
        self.destination = detect_destination()
        self.metadata_loading = False
        self.live = False
        self.lock = threading.Lock()
        self.creator_folder = self._creator_folder()

    def _creator_folder(self):
        username = str(self.product.get("creator_username") or "").strip().lstrip("@").strip()
        return safe_part(username or self.product.get("creator_nickname"), "Unknown Creator")

    def get_state(self):
        product = self.product
        return {"leak": self.manifest.get("leak_name") or "Preset pack", "creator": ("@" + str(product.get("creator_username", "")).lstrip("@")) if product.get("creator_username") else (product.get("creator_nickname") or "Unknown creator"), "uploader": "Anonymous" if product.get("is_anonymous") else (product.get("uploader_name") or "Zyrex community"), "description": product.get("description", ""), "category": product.get("category", ""), "presetCount": len(self.presets), "creatorAvatar": product.get("creator_avatar", ""), "uploaderAvatar": "" if product.get("is_anonymous") else product.get("uploader_avatar", ""), "thumbnail": product.get("thumbnail", ""), "destination": str(self.destination) if self.destination else "", "ready": bool(self.destination and self.presets), "live": self.live, "metadataLoading": self.metadata_loading}

    def refresh_metadata(self):
        if self.live or self.metadata_loading:
            return self.get_state()
        self.metadata_loading = True
        try:
            query = urllib.parse.urlencode({"id": self.manifest.get("product_id", "")})
            request = urllib.request.Request(f"{SITE}/api/products?{query}", headers={"Accept": "application/json", "User-Agent": "Zyrex-Effects-Installer/1.0"})
            with urllib.request.urlopen(request, timeout=12) as response:
                product = json.loads(response.read().decode("utf-8"))
            if isinstance(product, dict) and product.get("id") == self.manifest.get("product_id"):
                # Embedded data remains an immediate fallback if the API is unavailable.
                for key in ("name", "creator_nickname", "creator_username", "creator_avatar", "uploader_name", "uploader_avatar", "description", "thumbnail", "category", "is_anonymous"):
                    if key in product and product[key] is not None:
                        self.product[key] = product[key]
                self.live = True
                self.creator_folder = self._creator_folder()
        except Exception:
            pass
        finally:
            self.metadata_loading = False
        return self.get_state()

    def install(self):
        if not self.destination:
            self.destination = detect_destination()
        if not self.destination:
            return {"success": False, "error": "After Effects User Presets folder was not found. Install After Effects and try again."}
        folder = self.destination / self.creator_folder / safe_part(self.manifest.get("leak_name"), "Preset pack")
        try:
            folder.mkdir(parents=True, exist_ok=True)
            installed = skipped = 0
            for name, data in self.presets:
                target = folder / safe_part(name, "Preset.ffx")
                if target.exists():
                    skipped += 1
                    continue
                target.write_bytes(data)
                installed += 1
            return {"success": True, "installed": installed, "skipped": skipped, "folder": str(folder)}
        except Exception as error:
            return {"success": False, "error": f"Could not install presets: {error}"}

    def open_destination(self):
        if not self.destination or not self.destination.exists():
            return {"success": False, "error": "After Effects User Presets folder was not found."}
        try:
            if sys.platform == "win32": os.startfile(str(self.destination))
            elif sys.platform == "darwin": subprocess.Popen(["open", str(self.destination)])
            else: subprocess.Popen(["xdg-open", str(self.destination)])
            return {"success": True}
        except Exception as error: return {"success": False, "error": str(error)}

    def open_leak(self):
        url = f"{SITE}/leak?id={urllib.parse.quote(str(self.manifest.get('product_id', '')))}"
        import webbrowser
        webbrowser.open(url)
        return {"success": True}

def main():
    if "--self-test" in sys.argv:
        api = InstallerAPI()
        state = api.get_state()
        assert state["presetCount"] > 0 and state["leak"]
        print(f"OK: {state['leak']} · {state['presetCount']} presets · creator folder {api.creator_folder}")
        return
    import webview
    html = resource("ui.html").read_text(encoding="utf-8").replace("__ZYREX_LOGO__", "content.png")
    api = InstallerAPI()
    threading.Thread(target=lambda: (time.sleep(2), api.refresh_metadata()), daemon=True).start()
    webview.create_window("Zyrex Effects Installer", html=html, js_api=api, width=900, height=720, min_size=(620, 560), background_color="#100b0e")
    webview.start(debug=False)

if __name__ == "__main__": main()
