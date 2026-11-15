"""Zyrex Effects Installer desktop application."""
from __future__ import annotations
import base64, json, os, re, secrets, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request, zipfile
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

LEGACY_TRACE_MARKER = b'encoding="base64url-utf8"'

def strip_legacy_trace(data: bytes) -> bytes | None:
    """Blank the old encoded trace block so the Worker can write the readable one.

    Older builds stored the account as a hex token and a base64 username. The block sits in
    the metadata packet at the end of the file and is replaced by spaces, which keeps the
    byte length identical and turns the removed bytes into usable padding.
    """
    start = data.rfind(b"<zyrex:Trace")
    if start < 0 or start < len(data) - 8192:
        return None
    close_at = data.find(b"</zyrex:Trace>", start)
    if close_at < 0:
        return None
    end = close_at + len(b"</zyrex:Trace>")
    # The old format appended the username and the date as sibling tags, in this order.
    for opening, closing in ((b"<zyrex:Username", b"</zyrex:Username>"), (b"<zyrex:DownloadedAt", b"</zyrex:DownloadedAt>")):
        if not data.startswith(opening, end):
            continue
        trailer_close = data.find(closing, end)
        if trailer_close < 0:
            break
        end = trailer_close + len(closing)
    return data[:start] + b" " * (end - start) + data[end:]

def safe_part(value: str, fallback: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", str(value or ""))
    value = re.sub(r"\s+", " ", value).strip(" .")
    return (value[:96] if value and value not in {".", ".."} else fallback)

def public_error(error) -> str:
    """One short sentence for the member instead of a Python traceback."""
    if isinstance(error, OSError) and getattr(error, "strerror", ""):
        return str(error.strerror)[:200]
    text = str(error) or error.__class__.__name__
    return " ".join(text.split())[:300]

def load_embedded():
    manifest = json.loads(resource("metadata.json").read_text(encoding="utf-8"))
    encrypted_payload = resource("payload.enc").read_bytes()
    return manifest, encrypted_payload

def config_path() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME") or (Path.home() / ".config"))
    return base / "Zyrex" / "installer.json"

PROTECTED_DESTINATIONS = "Documents › Adobe › After Effects … › User Presets"
AE_FOLDER_PATTERN = re.compile(r"^(?:adobe )?after effects(?: \d{4})?$", re.IGNORECASE)

def version_folder_name(name: str) -> str:
    """`Adobe After Effects 2025` is the app folder; Documents uses `After Effects 2025`."""
    return re.sub(r"^adobe\s+", "", str(name or "").strip(), flags=re.IGNORECASE)

def documents_root() -> Path | None:
    """The real Documents folder, which OneDrive and non-English Windows relocate."""
    if sys.platform == "win32":
        try:
            import ctypes, uuid
            class Guid(ctypes.Structure):
                _fields_ = [("data1", ctypes.c_ulong), ("data2", ctypes.c_ushort), ("data3", ctypes.c_ushort), ("data4", ctypes.c_ubyte * 8)]
            folder_id = Guid.from_buffer_copy(uuid.UUID("FDD39AD0-238F-46AF-ADB4-6C85480369C7").bytes_le)
            value = ctypes.c_wchar_p()
            if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(folder_id), 0, None, ctypes.byref(value)) == 0:
                resolved = value.value
                ctypes.windll.ole32.CoTaskMemFree(value)
                if resolved and Path(resolved).is_dir():
                    return Path(resolved)
        except Exception:
            pass
    guesses = [Path.home() / "Documents"]
    for variable in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
        base = str(os.environ.get(variable) or "").strip()
        if base:
            guesses.append(Path(base) / "Documents")
    for guess in guesses:
        try:
            if guess.is_dir():
                return guess
        except OSError:
            continue
    return None

def is_protected(path: Path) -> bool:
    """After Effects lives in Program Files on Windows, which is never writable."""
    if sys.platform != "win32":
        return False
    try:
        resolved = str(Path(path).resolve()).casefold()
    except OSError:
        resolved = str(path).casefold()
    for variable in ("ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "SystemRoot", "ProgramData"):
        root = str(os.environ.get(variable) or "").strip().casefold()
        if root and (resolved == root or resolved.startswith(root + "\\")):
            return True
    return False

def is_writable(path: Path) -> bool:
    try:
        if not path.is_dir():
            return False
        probe = path / f".zyrex-write-{os.getpid()}.tmp"
        probe.write_bytes(b"zyrex")
        probe.unlink()
        return True
    except OSError:
        return False

def after_effects_versions() -> list[tuple[int, str]]:
    """Installed After Effects version folder names, newest first."""
    names = set()
    documents = documents_root()
    if documents:
        adobe = documents / "Adobe"
        if adobe.is_dir():
            names.update(entry.name for entry in adobe.glob("After Effects*") if entry.is_dir())
    roaming = str(os.environ.get("APPDATA") or "").strip()
    if roaming and (Path(roaming) / "Adobe").is_dir():
        names.update(entry.name for entry in (Path(roaming) / "Adobe").glob("After Effects*") if entry.is_dir())
    def sort_key(name: str):
        digits = re.findall(r"\d+", name)
        return (int(digits[0]) if digits else 0, name)
    return sorted(((sort_key(name)[0], name) for name in names), reverse=True)

def user_presets_for(version_name: str, create: bool = True) -> Path | None:
    documents = documents_root()
    if not documents or not AE_FOLDER_PATTERN.match(version_name or ""):
        return None
    target = documents / "Adobe" / version_name / "User Presets"
    if not target.is_dir():
        if not create:
            return None
        try:
            target.mkdir(parents=True, exist_ok=True)
        except OSError:
            return None
    return target if is_writable(target) else None

def detect_destination() -> Path | None:
    saved = load_saved_destination()
    if saved:
        return saved
    versions = after_effects_versions()
    # Existing folders win, so a machine with 2024 and 2025 keeps using whichever already
    # holds presets instead of a folder this installer creates.
    for _version, name in versions:
        found = user_presets_for(name, create=False)
        if found:
            return found
    # After Effects is installed but never saved a preset: create the folder it expects.
    for _version, name in versions:
        if re.search(r"\b(?:19|20)\d{2}\b", name):
            created = user_presets_for(name)
            if created:
                return created
    return None

def resolve_destination(raw) -> tuple[Path | None, str]:
    """Map whatever the member picked onto a writable User Presets folder."""
    path = Path(str(raw or "").strip())
    if not str(raw or "").strip():
        return None, "No folder was selected."
    if is_protected(path):
        # Picking the app folder (or its Plug-ins) is a common slip; point at the real one.
        version = next((version_folder_name(ancestor.name) for ancestor in path.parents if AE_FOLDER_PATTERN.match(ancestor.name)), version_folder_name(path.name))
        fallback = user_presets_for(version) if AE_FOLDER_PATTERN.match(version) else None
        if fallback:
            return fallback, ""
        return None, f"That folder belongs to the After Effects installation and Windows blocks writes there. Choose {PROTECTED_DESTINATIONS}."
    if not path.is_dir():
        return None, "That folder no longer exists."
    if (path / "User Presets").is_dir():
        return (path / "User Presets", "") if is_writable(path / "User Presets") else resolve_writable_or_error(path / "User Presets")
    if AE_FOLDER_PATTERN.match(path.name):
        version_folder = user_presets_for(path.name)
        if version_folder:
            return version_folder, ""
        return None, f"Could not create the User Presets folder there. Choose {PROTECTED_DESTINATIONS}."
    if not is_writable(path):
        return None, f"Windows does not allow saving presets in that folder. Choose {PROTECTED_DESTINATIONS}."
    return path, ""

def resolve_writable_or_error(path: Path) -> tuple[Path | None, str]:
    if is_writable(path):
        return path, ""
    return None, f"Windows does not allow saving presets in that folder. Choose {PROTECTED_DESTINATIONS}."

def load_saved_destination() -> Path | None:
    try:
        data = json.loads(config_path().read_text(encoding="utf-8"))
    except Exception:
        return None
    value = str((data or {}).get("destination") or "").strip()
    if not value:
        return None
    # A remembered folder can become unusable (moved, deleted, or back in Program Files),
    # so it is re-validated instead of trusted blindly on the next launch.
    resolved, _reason = resolve_destination(value)
    return resolved

def save_destination(path: Path) -> None:
    try:
        target = config_path()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"destination": str(path)}, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass

def normalize_access(raw) -> dict:
    """Shape the Worker's access verdict so the UI can rely on flat fields."""
    data = raw if isinstance(raw, dict) else {}
    return {
        "allowed": data.get("allowed") is True,
        "verified": data.get("verified"),
        "pass": data.get("pass"),
        "code": str(data.get("code") or ""),
        "error": str(data.get("error") or ""),
        "unlock_url": str(data.get("unlock_url") or "/access"),
    }

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
        self.key_error = ""
        self.access = normalize_access(None)
        self.discord_user_id = ""
        self.discord_username = ""
        self.installed_folder = None
        self.creator_folder = self._creator_folder()
        self.progress = {"active": False, "done": 0, "total": 0, "name": "", "stage": ""}

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
        return {"leak": self.manifest.get("leak_name") or "Preset pack", "creator": ("@" + str(product.get("creator_username", "")).lstrip("@")) if product.get("creator_username") else (product.get("creator_nickname") or "Unknown creator"), "uploader": "Anonymous" if product.get("is_anonymous") else (product.get("uploader_name") or "Zyrex community"), "description": product.get("description", ""), "category": product.get("category", ""), "presetCount": int(self.manifest.get("count") or len(self.manifest.get("files") or [])), "creatorAvatar": product.get("creator_avatar", ""), "uploaderAvatar": "" if product.get("is_anonymous") else product.get("uploader_avatar", ""), "thumbnail": product.get("thumbnail", ""), "destination": str(self.destination) if self.destination else "", "ready": bool(self.destination and self.payload_key), "signedIn": bool(self.access_token), "eligible": bool(self.access.get("allowed")), "access": dict(self.access), "authenticated": bool(self.access_token and self.payload_key), "username": self.discord_username, "live": self.live, "metadataLoading": self.metadata_loading, "progress": dict(self.progress)}

    def log_event(self, event, **fields):
        if not self.access_token:
            return
        payload = {"event": event, "product_id": self.product_id, "product_name": str(self.manifest.get("leak_name") or ""), "version": VERSION, "platform": sys.platform, **fields}
        try:
            self._request("/api/installer/log", method="POST", body=payload, token=self.access_token)
        except Exception:
            pass

    def start_login(self):
        self.device_code = secrets.token_urlsafe(36)
        result = self._request("/api/installer/auth/start", method="POST", body={"device_code": self.device_code, "product_id": self.product_id, "release_id": self.release_id})
        import webbrowser
        webbrowser.open(str(result.get("authorization_url") or ""))
        return {"success": True, "expires_in": result.get("expires_in", 600)}

    def _fetch_payload_key(self) -> bool:
        """Ask the Worker for the pack key.

        The key is only released to a member who holds both the verified role and an
        active download pass, so a refusal here is a normal outcome, not a crash.
        """
        if not self.access_token:
            return False
        query = urllib.parse.urlencode({"id": self.product_id, "release_id": self.release_id})
        self.key_error = ""
        try:
            response = self._request(f"/api/installer/payload-key?{query}", token=self.access_token)
        except Exception as error:
            self.payload_key = b""
            self.key_error = str(error)
            return False
        encoded = str(response.get("key") or "")
        self.payload_key = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)) if encoded else b""
        return bool(self.payload_key)

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
            self.access = normalize_access(result.get("access"))
            # An older Worker does not return a verdict; a released key still proves
            # the account passed the gates, so the app stays usable across deploys.
            if self.access["allowed"] or not self.access["code"]:
                if self._fetch_payload_key():
                    self.access["allowed"] = True
            return {"success": True, "pending": False, "username": self.discord_username, "access": self.access}
        except Exception as error:
            return {"success": False, "error": str(error)}

    def refresh_access(self):
        if not self.access_token:
            return {"success": False, "error": "Sign in with Discord first."}
        query = urllib.parse.urlencode({"id": self.product_id, "release_id": self.release_id})
        try:
            result = self._request(f"/api/installer/access?{query}", token=self.access_token)
        except Exception as error:
            return {"success": False, "error": str(error)}
        self.access = normalize_access(result.get("access"))
        if self.access["allowed"] and not self.payload_key:
            self._fetch_payload_key()
        return {"success": True, "access": self.access, "state": self.get_state()}

    def open_access(self):
        import webbrowser
        webbrowser.open(SITE + "/access")
        return {"success": True}

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
            return {"success": False, "needsFolder": True, "error": "After Effects User Presets folder was not found. Choose the folder to continue."}
        if not self.access_token:
            return {"success": False, "error": "Sign in with Discord before installing presets."}
        # Both gates are re-checked here so a member whose pass lapsed or whose role was
        # removed cannot decrypt the pack with a token they signed in with earlier.
        if not self.access.get("allowed"):
            self.refresh_access()
        if not self.access.get("allowed"):
            self.log_event("access-denied", code=self.access.get("code") or "ACCESS_REQUIRED", verified=self.access.get("verified"), pass_ok=self.access.get("pass"))
            return {
                "success": False,
                "accessRequired": True,
                "code": self.access.get("code") or "ACCESS_REQUIRED",
                "error": self.access.get("error") or "You need the Verified role and an active download pass to install this pack.",
            }
        if not self.payload_key and not self._fetch_payload_key():
            return {"success": False, "accessRequired": True, "code": self.access.get("code") or "ACCESS_REQUIRED", "error": self.key_error or self.access.get("error") or "Could not unlock this pack."}
        if not is_writable(self.destination):
            # The old folder can become read-only (moved to Program Files, drive removed).
            self.destination = None
            return {"success": False, "needsFolder": True, "error": f"Presets cannot be saved in the folder this installer remembered. Choose {PROTECTED_DESTINATIONS}."}
        folder = self.destination / self.creator_folder / safe_part(self.manifest.get("leak_name"), "Preset pack")
        started = time.monotonic()
        self.progress = {"active": True, "done": 0, "total": 0, "name": "", "stage": "Preparing"}
        self.log_event("start")
        try:
            from io import BytesIO
            nonce, ciphertext = self.encrypted_payload[:12], self.encrypted_payload[12:]
            cipher = AES.new(self.payload_key, AES.MODE_GCM, nonce=nonce)
            cipher.update(f"{self.product_id}:{self.release_id}".encode("utf-8"))
            plaintext = cipher.decrypt_and_verify(ciphertext[:-16], ciphertext[-16:])
            archive = zipfile.ZipFile(BytesIO(plaintext))
            entries = [name for name in archive.namelist() if name.startswith("presets/") and not name.endswith("/")]
            self.progress.update({"total": len(entries), "stage": "Installing"})
            folder.mkdir(parents=True, exist_ok=True)
            installed = skipped = refreshed = failed = 0
            first_error = ""
            for archived_name in entries:
                relative = Path(*Path(archived_name.replace("\\", "/")).parts[1:])
                if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
                    continue
                name = relative.as_posix()
                self.progress["name"] = relative.name
                target = folder.joinpath(*[safe_part(part, "Preset.ffx") for part in relative.parts])
                raw = archive.read(archived_name)
                if target.is_file():
                    # A preset installed by an older build still carries the encoded trace
                    # block; strip it so this install can write the readable one.
                    try:
                        existing = target.read_bytes()
                    except OSError as read_error:
                        failed += 1
                        first_error = first_error or f"{relative.name}: {read_error.strerror or read_error}"
                        self.progress["done"] += 1
                        continue
                    if LEGACY_TRACE_MARKER not in existing:
                        skipped += 1
                        self.progress["done"] += 1
                        continue
                    stripped = strip_legacy_trace(existing)
                    if stripped is None:
                        skipped += 1
                        self.progress["done"] += 1
                        continue
                    raw = stripped
                    refreshed += 1
                # The Worker stamps the Discord account and UTC download time into the
                # preset's own metadata packet, so no sidecar receipt file is written.
                query = urllib.parse.urlencode({"id": self.product_id, "release_id": self.release_id, "name": name})
                data, _ = self._request(f"/api/installer/trace?{query}", method="POST", body=raw, token=self.access_token, binary=True)
                # A preset After Effects is holding open (or an antivirus lock) must not
                # abort the rest of the pack; the file is counted and reported instead.
                try:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
                except OSError as write_error:
                    failed += 1
                    first_error = first_error or f"{relative.name}: {write_error.strerror or write_error}"
                    self.progress["done"] += 1
                    continue
                installed += 1
                self.progress["done"] += 1
            self.installed_folder = folder
            self.progress.update({"active": False, "stage": "Completed", "name": ""})
            duration = int((time.monotonic() - started) * 1000)
            summary = {"installed": installed, "skipped": skipped, "failed": failed, "total": len(entries), "duration_ms": duration}
            if first_error:
                summary["error"] = first_error
            self.log_event("complete", **summary)
            if not installed and failed:
                return {
                    "success": False,
                    "error": f"None of the presets could be saved. Close After Effects (it locks the preset files) and run the installer again. First problem: {first_error}",
                }
            return {"success": True, "installed": installed, "skipped": skipped, "refreshed": refreshed, "failed": failed, "firstError": first_error, "folder": str(folder)}
        except Exception as error:
            self.progress.update({"active": False, "stage": "Failed", "name": ""})
            self.log_event("error", error=public_error(error), installed=0, skipped=0, total=self.progress.get("total", 0), duration_ms=int((time.monotonic() - started) * 1000))
            return {"success": False, "error": f"Could not install presets: {public_error(error)}"}

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

    def choose_destination(self):
        """Let the member point the installer at their own User Presets folder."""
        import webview
        windows = getattr(webview, "windows", None) or []
        if not windows:
            return {"success": False, "error": "The window is not ready yet."}
        folder_dialog = getattr(getattr(webview, "FileDialog", None), "FOLDER", 20)
        documents = documents_root()
        start = str(self.destination or (documents / "Adobe" if documents else Path.home()))
        try:
            picked = windows[0].create_file_dialog(folder_dialog, directory=start)
        except Exception as error:
            return {"success": False, "error": f"Could not open the folder picker: {error}"}
        if not picked:
            return {"success": False, "cancelled": True}
        chosen, reason = resolve_destination(picked[0])
        if not chosen:
            return {"success": False, "error": reason or "That folder cannot be used."}
        self.destination = chosen
        save_destination(chosen)
        return {"success": True, "destination": str(chosen), "state": self.get_state()}

    def exit_app(self):
        try:
            import webview
            windows = getattr(webview, "windows", None) or []
            if not windows:
                return {"success": False, "error": "The window is not ready yet."}
            windows[0].destroy()
            return {"success": True}
        except Exception as error:
            return {"success": False, "error": str(error)}

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
        # The legacy trace block must blank cleanly while keeping the preset's byte length.
        sample = (b'<rdf:Description><zyrex:Trace xmlns:zyrex="x">1-13b908f6a3c41014-9</zyrex:Trace>'
                  b'<zyrex:Username encoding="base64url-utf8">cmV5bGlhcg</zyrex:Username>'
                  b'<zyrex:DownloadedAt>2026-11-14T17:20:47.580Z</zyrex:DownloadedAt></rdf:Description>' + b" " * 256)
        blanked = strip_legacy_trace(sample)
        assert blanked is not None and len(blanked) == len(sample)
        assert b"<zyrex:Trace" not in blanked and b"</zyrex:DownloadedAt>" not in blanked
        import webview
        assert hasattr(webview, "create_window") and hasattr(webview, "start")
        assert callable(getattr(api, "choose_destination", None)) and callable(getattr(api, "exit_app", None))
        assert getattr(getattr(webview, "FileDialog", None), "FOLDER", 20) is not None or hasattr(webview, "FOLDER_DIALOG")
        # No window exists during the self-test, so both window-bound calls must fail softly.
        assert api.choose_destination().get("success") is False and api.exit_app().get("success") is False
        assert "primaryAction" in html and "exit_app" in html
        # The access verdict is the only thing standing between a member and the pack
        # key, so its flattened shape is pinned here.
        denied = normalize_access({"allowed": False, "code": "NOT_VERIFIED", "verified": False, "pass": None})
        assert denied["allowed"] is False and denied["code"] == "NOT_VERIFIED" and denied["unlock_url"] == "/access"
        assert denied["verified"] is False and denied["pass"] is None
        assert normalize_access(None)["allowed"] is False
        assert normalize_access({"allowed": True})["allowed"] is True
        assert callable(getattr(api, "refresh_access", None)) and callable(getattr(api, "open_access", None))
        assert "access" in state and "eligible" in state and "signedIn" in state
        # The chosen folder must survive a restart, so the config round trip is checked here.
        import tempfile
        with tempfile.TemporaryDirectory() as scratch:
            global config_path
            original, config_path = config_path, lambda: Path(scratch) / "installer.json"
            try:
                saved = Path(scratch) / "User Presets"
                saved.mkdir()
                assert load_saved_destination() is None
                save_destination(saved)
                assert load_saved_destination() == saved
            finally:
                config_path = original
        assert config_path().name == "installer.json" and config_path().parent.name == "Zyrex"
        # A destination that cannot be written must never be used, because the fold into
        # User Presets is only skipped when the folder really is writable.
        with tempfile.TemporaryDirectory() as scratch:
            plain = Path(scratch) / "User Presets"
            plain.mkdir()
            assert is_writable(plain) and not is_protected(plain)
            assert resolve_destination(plain) == (plain, "")
            year = Path(scratch) / "After Effects 2025"
            year.mkdir()
            inside = year / "User Presets"
            inside.mkdir()
            assert resolve_destination(year) == (inside, "")
            loose = year / "Loose"
            loose.mkdir()
            mapped, reason = resolve_destination(loose)
            assert mapped == loose and reason == ""
            protected = resolve_destination(Path(os.environ.get("ProgramFiles") or "C:/Program Files") / "Adobe")
            if os.environ.get("ProgramFiles"):
                assert protected[0] is None and "Windows blocks writes" in protected[1], protected
            assert resolve_destination("")[0] is None
        # A signed-in member without both gates must be refused before any decryption.
        api.destination = Path(tempfile.gettempdir())
        api.access_token = "self-test-token"
        api.access = normalize_access({"allowed": False, "code": "NOT_VERIFIED", "verified": False})
        api.refresh_access = lambda: {"success": False}
        api.log_event = lambda *args, **kwargs: None
        refused = api.install()
        assert refused.get("success") is False and refused.get("accessRequired") is True and refused.get("code") == "NOT_VERIFIED"
        if sys.stdout:
            print(f"OK: {state['leak']} · {state['presetCount']} presets · creator folder {api.creator_folder} · payload {len(api.encrypted_payload)} bytes")
        return
    import webview
    api = InstallerAPI()
    threading.Thread(target=lambda: (time.sleep(2), api.refresh_metadata()), daemon=True).start()
    webview.create_window("Zyrex Effects Installer", html=render_html(), js_api=api, width=900, height=720, min_size=(620, 560), background_color="#100b0e")
    webview.start(debug=False)

if __name__ == "__main__": main()
