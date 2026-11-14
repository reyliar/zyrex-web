"""Zyrex Effects Installer desktop application."""
from __future__ import annotations
import base64, datetime, json, os, re, secrets, shutil, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request, zipfile
from pathlib import Path
from Crypto.Cipher import AES

SITE = "https://zyrexediting.xyz"
VERSION = "v1.0.0"

def resource(name: str) -> Path:
    root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return root / name

def data_uri(name: str, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(resource(name).read_bytes()).decode('ascii')}"

def render_html() -> str:
    return resource("ui.html").read_text(encoding="utf-8").replace("__ZYREX_LOGO__", data_uri("content.png", "image/png"))

def safe_part(value: str, fallback: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", str(value or ""))
    value = re.sub(r"\s+", " ", value).strip(" .")
    return (value[:96] if value and value not in {".", ".."} else fallback)

def load_embedded():
    manifest = json.loads(resource("metadata.json").read_text(encoding="utf-8"))
    encrypted_payload = resource("payload.enc").read_bytes()
    return manifest, encrypted_payload

def detect_destination() -> Path | None:
    docs = Path.home() / "Documents" / "Adobe"
    if not docs.is_dir():
        return None
    candidates = sorted((p / "User Presets" for p in docs.glob("After Effects*") if p.is_dir()), key=lambda p: p.parent.name.casefold(), reverse=True)
    return candidates[0] if candidates else None

class InstallerAPI:
    def __init__(self):
        self.manifest, self.encrypted_payload = load_embedded()
        self.product = self.manifest.get("product") or {}
        self.destination = detect_destination()
        self.metadata_loading = False
        self.live = False
        self.device_code = ""
        self.access_token = ""
        self.payload_key = b""
        self.discord_user_id = ""
        self.discord_username = ""
        self.installed_folder = None
        self.creator_folder = self._creator_folder()

    @property
    def product_id(self):
        return str(self.manifest.get("product_id") or "")

    @property
    def release_id(self):
        return str(self.manifest.get("release_id") or "")

    def _request(self, path, *, method="GET", body=None, token="", binary=False):
        headers = {"Accept": "application/octet-stream" if binary else "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36", "Origin": SITE, "Referer": SITE + "/", "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty"}
        data = body
        if isinstance(body, dict):
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(f"{SITE}{path}", data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                if binary:
                    return response.read(), response.headers.get("X-Zyrex-Downloaded-At", "")
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")
            if error.code == 202:
                return {"success": True, "pending": True}
            try:
                parsed = json.loads(detail)
                detail = parsed.get("error") or detail
            except Exception:
                pass
            raise RuntimeError(detail or f"Zyrex API returned HTTP {error.code}") from error

    def _creator_folder(self):
        username = str(self.product.get("creator_username") or "").strip().lstrip("@").strip()
        return safe_part(username or self.product.get("creator_nickname"), "Unknown Creator")

    def get_state(self):
        product = self.product
        return {"leak": self.manifest.get("leak_name") or "Preset pack", "creator": ("@" + str(product.get("creator_username", "")).lstrip("@")) if product.get("creator_username") else (product.get("creator_nickname") or "Unknown creator"), "uploader": "Anonymous" if product.get("is_anonymous") else (product.get("uploader_name") or "Zyrex community"), "description": product.get("description", ""), "category": product.get("category", ""), "presetCount": int(self.manifest.get("count") or len(self.manifest.get("files") or [])), "creatorAvatar": product.get("creator_avatar", ""), "uploaderAvatar": "" if product.get("is_anonymous") else product.get("uploader_avatar", ""), "thumbnail": product.get("thumbnail", ""), "destination": str(self.destination) if self.destination else "", "ready": bool(self.destination and self.payload_key), "authenticated": bool(self.access_token and self.payload_key), "username": self.discord_username, "live": self.live, "metadataLoading": self.metadata_loading}

    def start_login(self):
        self.device_code = secrets.token_urlsafe(36)
        result = self._request("/api/installer/auth/start", method="POST", body={"device_code": self.device_code, "product_id": self.product_id, "release_id": self.release_id})
        import webbrowser
        webbrowser.open(str(result.get("authorization_url") or ""))
        return {"success": True, "expires_in": result.get("expires_in", 600)}

    def poll_login(self):
        if not self.device_code:
            return {"success": False, "error": "Start Discord sign-in first."}
        query = urllib.parse.urlencode({"device_code": self.device_code})
        try:
            result = self._request(f"/api/installer/auth/poll?{query}")
            if result.get("pending"):
                return {"success": True, "pending": True}
            self.access_token = str(result.get("access_token") or "")
            self.discord_user_id = str((result.get("user") or {}).get("id") or "")
            self.discord_username = str((result.get("user") or {}).get("username") or "")
            key_query = urllib.parse.urlencode({"id": self.product_id, "release_id": self.release_id})
            key_response = self._request(f"/api/installer/payload-key?{key_query}", token=self.access_token)
            encoded = str(key_response.get("key") or "")
            self.payload_key = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
            return {"success": True, "pending": False, "username": self.discord_username}
        except Exception as error:
            return {"success": False, "error": str(error)}

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
        if not self.access_token or not self.payload_key:
            return {"success": False, "error": "Sign in with Discord before installing presets."}
        folder = self.destination / self.creator_folder / safe_part(self.manifest.get("leak_name"), "Preset pack")
        try:
            from io import BytesIO
            nonce, ciphertext = self.encrypted_payload[:12], self.encrypted_payload[12:]
            cipher = AES.new(self.payload_key, AES.MODE_GCM, nonce=nonce)
            cipher.update(f"{self.product_id}:{self.release_id}".encode("utf-8"))
            plaintext = cipher.decrypt_and_verify(ciphertext[:-16], ciphertext[-16:])
            archive = zipfile.ZipFile(BytesIO(plaintext))
            downloaded_at = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
            folder.mkdir(parents=True, exist_ok=True)
            installed = skipped = 0
            trace_dates = []
            for archived_name in archive.namelist():
                if not archived_name.startswith("presets/") or archived_name.endswith("/"):
                    continue
                relative = Path(*Path(archived_name.replace("\\", "/")).parts[1:])
                if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
                    continue
                name = relative.as_posix()
                target = folder.joinpath(*[safe_part(part, "Preset.ffx") for part in relative.parts])
                if target.exists():
                    skipped += 1
                    continue
                raw = archive.read(archived_name)
                query = urllib.parse.urlencode({"id": self.product_id, "release_id": self.release_id, "name": name})
                data, traced_at = self._request(f"/api/installer/trace?{query}", method="POST", body=raw, token=self.access_token, binary=True)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                installed += 1
                trace_dates.append(f"{name}\t{traced_at or downloaded_at}")
            receipt = folder / "Zyrex Download Attribution.txt"
            receipt.write_text(f"Zyrex preset download\nDiscord username: {self.discord_username}\nDiscord user ID: {self.discord_user_id}\nFFX trace timestamps (UTC):\n" + "\n".join(trace_dates) + "\n", encoding="utf-8")
            self.installed_folder = folder
            return {"success": True, "installed": installed, "skipped": skipped, "folder": str(folder)}
        except Exception as error:
            return {"success": False, "error": f"Could not install presets: {error}"}

    def open_destination(self):
        target = self.installed_folder or self.destination
        if not target or not target.exists():
            return {"success": False, "error": "After Effects User Presets folder was not found."}
        try:
            if sys.platform == "win32": os.startfile(str(target))
            elif sys.platform == "darwin": subprocess.Popen(["open", str(target)])
            else: subprocess.Popen(["xdg-open", str(target)])
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
        probe_key, probe_nonce, probe_aad, probe_data = secrets.token_bytes(32), secrets.token_bytes(12), b"preset-probe:probe-release", b"Zyrex preset payload" * 64
        cipher = AES.new(probe_key, AES.MODE_GCM, nonce=probe_nonce)
        cipher.update(probe_aad)
        sealed, tag = cipher.encrypt_and_digest(probe_data)
        opened = AES.new(probe_key, AES.MODE_GCM, nonce=probe_nonce)
        opened.update(probe_aad)
        assert opened.decrypt_and_verify(sealed, tag) == probe_data
        assert len(api.encrypted_payload) > 28
        html = render_html()
        assert "__ZYREX_LOGO__" not in html and "data:image/png;base64," in html
        assert "__OUTFIT_FONT_DATA__" not in html
        import webview
        assert hasattr(webview, "create_window") and hasattr(webview, "start")
        print(f"OK: {state['leak']} · {state['presetCount']} presets · creator folder {api.creator_folder} · payload {len(api.encrypted_payload)} bytes")
        return
    import webview
    api = InstallerAPI()
    threading.Thread(target=lambda: (time.sleep(2), api.refresh_metadata()), daemon=True).start()
    webview.create_window("Zyrex Effects Installer", html=render_html(), js_api=api, width=900, height=720, min_size=(620, 560), background_color="#100b0e")
    webview.start(debug=False)

if __name__ == "__main__": main()
