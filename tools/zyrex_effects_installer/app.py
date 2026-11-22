"""Zyrex Effects Installer desktop application."""
from __future__ import annotations
import base64, json, os, re, secrets, shutil, subprocess, sys, tempfile, threading, time, urllib.error, urllib.parse, urllib.request, zipfile
from pathlib import Path
from Crypto.Cipher import AES

SITE = "https://zyrexediting.xyz"
VERSION = "v1.0.3"
# Every build ships inside a specific leak folder, so an update can only be served once that
# leak's own installer has been rebuilt. The Worker reports both numbers and the app waits
# instead of downloading a build that is still the old version.
APP_NAME = "Zyrex Effects Installer"

def installer_platform() -> str:
    return "macos" if sys.platform == "darwin" else "windows" if sys.platform == "win32" else "linux"

def version_tuple(value) -> tuple[int, ...]:
    parts = re.findall(r"\d+", str(value or ""))
    return tuple(int(part) for part in parts[:4]) or (0,)

def version_gt(left, right) -> bool:
    """Compare `v1.0.10` against `v1.0.9` numerically instead of as text."""
    a, b = version_tuple(left), version_tuple(right)
    width = max(len(a), len(b))
    return a + (0,) * (width - len(a)) > b + (0,) * (width - len(b))

def resource(name: str) -> Path:
    root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return root / name

def data_uri(name: str, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(resource(name).read_bytes()).decode('ascii')}"

def render_html() -> str:
    return resource("ui.html").read_text(encoding="utf-8").replace("__ZYREX_LOGO__", data_uri("content.png", "image/png"))

LEGACY_TRACE_MARKER = b'encoding="base64url-utf8"'
# A build before v1.0.1 hid the account in zero-width characters inside the effect names.
# After Effects renders those names, so such a preset loads but applies nothing; a reinstall
# has to replace it rather than skip it.
BROKEN_TRACE_MARKERS = (
    b"\xe2\x80\x8b", b"\xe2\x80\x8c", b"\xe2\x80\x8d", b"\xe2\x81\xa0", b"\xe2\x81\xa2", b"\xe2\x81\xa4",
)

def needs_repair(data: bytes) -> bool:
    if LEGACY_TRACE_MARKER in data:
        return True
    return any(marker in data for marker in BROKEN_TRACE_MARKERS)

def strip_legacy_trace(data: bytes) -> bytes | None:
    """Blank the old encoded trace block so a fresh one can take its place.

    Builds before v1.0.1 stored the account as a hex token and a base64 username. The block
    sits in the metadata packet at the end of the file and is replaced by spaces, which keeps
    the byte length identical and turns the removed bytes into usable padding.
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

_ca_bundle: str | None = None

def ca_bundle() -> str:
    """Path to a CA bundle the frozen app can trust.

    A PyInstaller one-file build on macOS has no OpenSSL trust store of its own, so every
    HTTPS call failed with CERTIFICATE_VERIFY_FAILED and nothing ever reached the API. The
    bundle ships next to the app (cacert.pem, copied from certifi at build time) and is
    preferred over any system store, because a stock macOS /etc/ssl/cert.pem can be stale.
    """
    global _ca_bundle
    if _ca_bundle is not None:
        return _ca_bundle
    candidates = []
    configured = str(os.environ.get("ZYREX_CA_BUNDLE") or "").strip()
    if configured:
        candidates.append(Path(configured))
    # The shipped bundle always exists in a frozen build, so it is tried before anything
    # the host system happens to provide.
    candidates.append(resource("cacert.pem"))
    try:
        import certifi
        candidates.append(Path(certifi.where()))
    except Exception:
        pass
    candidates.append(Path(sys.prefix) / "ssl" / "cacert.pem")
    candidates.append(Path("/etc/ssl/cert.pem"))
    candidates.append(Path("/usr/local/etc/openssl/cert.pem"))
    candidates.append(Path("/opt/homebrew/etc/openssl@3/cert.pem"))
    for candidate in candidates:
        try:
            if candidate.is_file() and candidate.stat().st_size > 1024:
                _ca_bundle = str(candidate)
                return _ca_bundle
        except OSError:
            continue
    _ca_bundle = ""
    return _ca_bundle

def ssl_context():
    import ssl
    bundle = ca_bundle()
    if bundle:
        # Every TLS client in the process (urllib, pywebview, requests) must agree on the
        # same store; setdefault would let an inherited, broken value win.
        os.environ["SSL_CERT_FILE"] = bundle
        os.environ["REQUESTS_CA_BUNDLE"] = bundle
        os.environ["CURL_CA_BUNDLE"] = bundle
        os.environ.pop("SSL_CERT_DIR", None)
        try:
            context = ssl.create_default_context(cafile=bundle)
            # A host that only ships an empty OpenSSL default store still verifies against
            # the shipped bundle, and the platform roots are added on top.
            context.load_default_certs()
            return context
        except Exception:
            pass
    return ssl.create_default_context()

def network_error_message(error) -> str:
    """Turn a connection failure into something a member can act on."""
    detail = str(getattr(error, "reason", error) or "")
    if "CERTIFICATE_VERIFY_FAILED" in detail or "certificate verify failed" in detail.lower():
        return "This device could not verify zyrexediting.xyz. Connect once to the internet without a proxy or VPN, then open the installer again."
    if "timed out" in detail.lower():
        return "zyrexediting.xyz did not answer in time. Check your connection and try again."
    return f"Could not reach zyrexediting.xyz: {public_error(detail)}"

def archive_launch_path(*candidates_override) -> str:
    """The archive path when the app was started straight out of a .zip.

    ZIP files do not run in place: Explorer and Finder hand out a temporary copy, so the
    presets land in a throw-away folder and the app cannot update or delete itself.
    """
    candidates = list(candidates_override) or [
        getattr(sys, "executable", ""), getattr(sys, "_MEIPASS", ""), str(Path(__file__)),
    ]
    for raw in candidates:
        text = str(raw or "").strip()
        if not text:
            continue
        lowered = text.replace("\\", "/").lower()
        # ".../Temp1_Zyrex.zip/Zyrex.exe" (Windows Explorer) and ".../pack.zip/app" (macOS).
        if re.search(r"\.zip(?:/|$)", lowered):
            return text
    return ""

def show_archive_warning(archive_path: str) -> None:
    message = (
        "This installer was opened from inside a ZIP file.\n\n"
        "Windows and macOS run a temporary copy, so the presets would be installed from a "
        "folder that disappears afterwards and the app could not clean up after itself.\n\n"
        "Extract the ZIP first (right click \u2192 Extract All), then open the installer "
        "from the extracted folder."
    )
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, message, "Zyrex Effects Installer", 0x00000010)
            return
        except Exception:
            pass
    if sys.platform == "darwin":
        try:
            script = 'display alert "Zyrex Effects Installer" message "%s" as critical' % message.replace('"', '\\"').replace("\n", "\\n")
            subprocess.run(["osascript", "-e", script], check=False)
            return
        except Exception:
            pass
    print(message)

# After Effects writes its RIFX "head" chunk version into every preset it saves. The app
# compares that number with the maxima below so a pack built in a newer AE is flagged
# before anything is copied. 95 = AE 2024, 97 = AE 2025, and each release adds two.
AE_FORMAT_STEP = 2
AE_FORMAT_BASE_YEAR = 2024
AE_FORMAT_BASE = 95
AE_FORMAT_KNOWN = {2022: 91, 2023: 93, 2024: 95, 2025: 97, 2026: 99}

def ae_max_format(year: int | None) -> int:
    if not year:
        return 0
    if year in AE_FORMAT_KNOWN:
        return AE_FORMAT_KNOWN[year]
    if year > max(AE_FORMAT_KNOWN):
        return AE_FORMAT_BASE + (year - AE_FORMAT_BASE_YEAR) * AE_FORMAT_STEP
    return max(0, AE_FORMAT_KNOWN[2023] - (2023 - year) * AE_FORMAT_STEP)

def ae_min_label(format_version: int) -> str:
    for threshold, label in ((99, "2026"), (97, "2025"), (95, "2024"), (93, "2023")):
        if format_version >= threshold:
            return label
    return "2022 or older" if format_version else ""

def ae_year_from_name(name: str) -> int | None:
    text = str(name or "")
    year = re.search(r"(20\d{2})", text)
    if year:
        return int(year.group(1))
    # Premiere-style names ("After Effects 24.0") map 24 -> 2024, 26 -> 2026.
    version = re.search(r"(?:^|\s)(\d{2})(?:\.\d+)?", text)
    if version:
        major = int(version.group(1))
        if 15 <= major <= 40:
            return 2000 + major
    return None

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

PROTECTED_DESTINATIONS = "a folder you own, such as Documents"
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
    """The application bundle itself is never writable (Program Files, /Applications)."""
    try:
        resolved = str(Path(path).resolve()).casefold()
    except OSError:
        resolved = str(path).casefold()
    if sys.platform == "darwin":
        return resolved.startswith("/applications/") or resolved.startswith("/system") or resolved.startswith("/library/")
    if sys.platform != "win32":
        return False
    for variable in ("ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "SystemRoot", "ProgramData"):
        root = str(os.environ.get(variable) or "").strip().casefold()
        if root and (resolved == root or resolved.startswith(root + "\\")):
            return True
    return False

def hidden_startup_info():
    """A STARTUPINFO that asks Windows for a hidden window, or None elsewhere."""
    if sys.platform != "win32":
        return None
    try:
        startup = subprocess.STARTUPINFO()
        startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow = subprocess.SW_HIDE
        return startup
    except Exception:
        return None

def hidden_process_flags() -> int:
    if sys.platform != "win32":
        return 0
    return getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

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
    if sys.platform == "darwin":
        # On macOS the app lives in /Applications and its preferences in Application
        # Support, so a fresh install has no folder in Documents yet.
        for base in (Path("/Applications"), Path("/Applications/Adobe After Effects"),
                     Path.home() / "Library" / "Application Support" / "Adobe",
                     Path.home() / "Library" / "Preferences" / "Adobe"):
            try:
                if base.is_dir():
                    names.update(entry.name.replace(".app", "") for entry in base.glob("After Effects*"))
                    names.update(entry.name for entry in base.glob("Adobe After Effects*") if entry.is_dir())
            except OSError:
                continue
    def sort_key(name: str):
        digits = re.findall(r"\d+", name)
        return (int(digits[0]) if digits else 0, name)
    return sorted(((sort_key(name)[0], name) for name in names), reverse=True)

def user_presets_for(version_name: str, create: bool = True) -> Path | None:
    documents = documents_root()
    name = version_folder_name(version_name)
    if not documents or not AE_FOLDER_PATTERN.match(name):
        return None
    target = documents / "Adobe" / name / "User Presets"
    if not target.is_dir():
        if not create:
            return None
        try:
            target.mkdir(parents=True, exist_ok=True)
        except OSError:
            return None
    return target if is_writable(target) else None

def fallback_destination() -> Path | None:
    """Anywhere the member can write, for a machine without After Effects.

    The app no longer insists on the After Effects folder: User Presets is only the
    default, and the pack can be saved to any folder the member picks.
    """
    documents = documents_root()
    if not documents:
        return None
    target = documents / "Zyrex"
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
    # No After Effects at all: default to a normal folder instead of blocking the install.
    return fallback_destination()

def is_user_presets_path(path: Path | None) -> bool:
    return bool(path) and "user presets" in str(path).casefold()

def resolve_destination(raw) -> tuple[Path | None, str]:
    """The member's own folder is the destination; only AE folders are corrected."""
    path = Path(str(raw or "").strip())
    if not str(raw or "").strip():
        return None, "No folder was selected."
    if is_protected(path):
        # Picking the app folder (or its Plug-ins) is a common slip; point at the real one.
        version = next((version_folder_name(ancestor.name) for ancestor in path.parents if AE_FOLDER_PATTERN.match(ancestor.name)), version_folder_name(path.name))
        fallback = user_presets_for(version) if AE_FOLDER_PATTERN.match(version) else None
        if fallback:
            return fallback, ""
        return None, "That folder belongs to the After Effects installation and Windows blocks writes there. Choose a folder you can save to."
    if not path.is_dir():
        return None, "That folder no longer exists."
    if (path / "User Presets").is_dir():
        return (path / "User Presets", "") if is_writable(path / "User Presets") else resolve_writable_or_error(path / "User Presets")
    if AE_FOLDER_PATTERN.match(path.name):
        # An After Effects year folder is never a preset location on its own, so the files
        # would be invisible to After Effects. Only this case is redirected.
        version_folder = user_presets_for(path.name)
        if version_folder:
            return version_folder, ""
        return None, "Could not create the User Presets folder there. Choose a folder you can save to."
    if not is_writable(path):
        return None, "That folder does not allow saving files. Choose a folder you can write to."
    return path, ""

def resolve_writable_or_error(path: Path) -> tuple[Path | None, str]:
    if is_writable(path):
        return path, ""
    return None, "That folder does not allow saving files. Choose a folder you can write to."

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
        # The API refuses installer calls from a build older than the current minimum, so
        # the app has to know about it and offer the update instead of failing silently.
        self.update_required = False
        self.latest_version = VERSION
        self.update_ready = False
        self.update_info = {}

    @property
    def product_id(self):
        return str(self.manifest.get("product_id") or "")

    @property
    def release_id(self):
        return str(self.manifest.get("release_id") or "")

    def _request(self, path, *, method="GET", body=None, token="", binary=False, timeout=35):
        headers = {"Accept": "application/octet-stream" if binary else "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36", "Origin": SITE, "Referer": SITE + "/", "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", "X-Zyrex-App-Version": VERSION, "X-Zyrex-App-Platform": installer_platform()}
        data = body
        if isinstance(body, dict):
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(f"{SITE}{path}", data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout, context=ssl_context()) as response:
                if binary:
                    return response.read(), response.headers.get("X-Zyrex-Downloaded-At", "")
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")
            if error.code == 202:
                return {"success": True, "pending": True}
            code = ""
            try:
                parsed = json.loads(detail)
                code = str(parsed.get("code") or "")
                detail = parsed.get("error") or detail
                if code == "UPGRADE_REQUIRED":
                    # Older builds cannot unlock anything any more; remember it so the UI
                    # can offer the update instead of showing a dead end.
                    self.update_required = True
                    self.latest_version = str(parsed.get("latest") or self.latest_version)
            except Exception:
                pass
            raise RuntimeError(detail or f"Zyrex API returned HTTP {error.code}") from error
        except urllib.error.URLError as error:
            raise RuntimeError(network_error_message(error)) from error

    def check_update(self):
        """Ask the Worker which build is current and whether this leak has it yet."""
        try:
            info = self._request(f"/api/installer/version?id={urllib.parse.quote(self.product_id)}&release_id={urllib.parse.quote(self.release_id)}&platform={installer_platform()}")
        except Exception as error:
            return {"success": False, "error": public_error(error)}
        if not isinstance(info, dict) or not info.get("success", True):
            return {"success": False, "error": "Could not check for updates."}
        latest = str(info.get("latest") or VERSION)
        leak_version = str(info.get("leak_version") or "")
        self.latest_version = latest
        self.update_info = dict(info)
        self.update_required = bool(info.get("update_required")) or version_gt(info.get("minimum"), VERSION)
        # An update is only offered when the leak's own installer already contains it,
        # otherwise the download would install the same old build again.
        self.update_ready = version_gt(latest, VERSION) and (
            not leak_version or not version_gt(latest, leak_version)
        )
        return {
            "success": True,
            "current": VERSION,
            "latest": latest,
            "minimum": str(info.get("minimum") or ""),
            "leakVersion": leak_version,
            "updateRequired": bool(self.update_required),
            "updateReady": bool(self.update_ready),
            "notes": str(info.get("notes") or ""),
        }

    def apply_update(self):
        """Download the rebuilt installer for this leak, start it, then delete this copy."""
        if not self.access_token:
            return {"success": False, "error": "Sign in with Discord first, then try the update again."}
        info = self.check_update()
        if not info.get("success"):
            return {"success": False, "error": info.get("error") or "Could not reach the update server."}
        if not info.get("updateReady"):
            return {"success": False, "error": f"The {info.get('latest') or 'new'} build for this pack is still being prepared. Try again in a minute."}
        query = urllib.parse.urlencode({"id": self.product_id, "release_id": self.release_id, "platform": installer_platform()})
        try:
            payload, _ = self._request(f"/api/installer/update?{query}", token=self.access_token, binary=True, timeout=300)
        except Exception as error:
            return {"success": False, "error": public_error(error)}
        suffix = ".dmg" if sys.platform == "darwin" else ".exe"
        target = Path(tempfile.gettempdir()) / f"Zyrex-{self.latest_version.lstrip('v')}{suffix}"
        try:
            target.write_bytes(payload)
        except OSError as error:
            return {"success": False, "error": public_error(error)}
        try:
            if sys.platform == "darwin":
                subprocess.Popen(["open", str(target)], start_new_session=True, close_fds=True)
            elif sys.platform == "win32":
                subprocess.Popen([str(target)], creationflags=hidden_process_flags(), startupinfo=hidden_startup_info(), close_fds=True)
            else:
                target.chmod(0o755)
                subprocess.Popen([str(target)], start_new_session=True, close_fds=True)
        except Exception as error:
            return {"success": False, "error": f"The update was downloaded but could not start: {public_error(error)}"}
        self.log_event("update", from_version=VERSION, to_version=self.latest_version)
        self._quit_window(delay=0.4)
        return {"success": True, "started": str(target), "version": self.latest_version}

    def _creator_folder(self):
        username = str(self.product.get("creator_username") or "").strip().lstrip("@").strip()
        return safe_part(username or self.product.get("creator_nickname"), "Unknown Creator")

    def get_state(self):
        product = self.product
        presets_default = is_user_presets_path(self.destination)
        return {"leak": self.manifest.get("leak_name") or "Preset pack", "creator": ("@" + str(product.get("creator_username", "")).lstrip("@")) if product.get("creator_username") else (product.get("creator_nickname") or "Unknown creator"), "uploader": "Anonymous" if product.get("is_anonymous") else (product.get("uploader_name") or "Zyrex community"), "description": product.get("description", ""), "category": product.get("category", ""), "presetCount": int(self.manifest.get("count") or len(self.manifest.get("files") or [])), "assetCount": int(self.manifest.get("asset_count") or len(self.manifest.get("assets") or [])), "creatorAvatar": product.get("creator_avatar", ""), "uploaderAvatar": "" if product.get("is_anonymous") else product.get("uploader_avatar", ""), "thumbnail": product.get("thumbnail", ""), "destination": str(self.destination) if self.destination else "", "destinationPresets": presets_default, "ready": bool(self.destination and self.payload_key), "signedIn": bool(self.access_token), "eligible": bool(self.access.get("allowed")), "access": dict(self.access), "authenticated": bool(self.access_token and self.payload_key), "username": self.discord_username, "live": self.live, "metadataLoading": self.metadata_loading, "progress": dict(self.progress), "version": VERSION, "aeVersion": self.ae_year() or 0, "updateRequired": bool(self.update_required), "latestVersion": self.latest_version}

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
            with urllib.request.urlopen(request, timeout=12, context=ssl_context()) as response:
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
        if self.update_required:
            return {"success": False, "upgradeRequired": True, "latest": self.latest_version, "error": f"This installer is out of date. Update to {self.latest_version} to install this pack."}
        if not self.destination:
            self.destination = detect_destination()
        if not self.destination:
            return {"success": False, "needsFolder": True, "error": "No save folder was found. Choose where the pack should go to continue."}
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
            if self.update_required:
                return {"success": False, "upgradeRequired": True, "latest": self.latest_version, "error": f"This installer is out of date. Update to {self.latest_version} to install this pack."}
            return {"success": False, "accessRequired": True, "code": self.access.get("code") or "ACCESS_REQUIRED", "error": self.key_error or self.access.get("error") or "Could not unlock this pack."}
        # The destination is the member's own folder now, so it may not exist yet.
        try:
            self.destination.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass
        if not is_writable(self.destination):
            # The old folder can become read-only (moved to Program Files, drive removed).
            self.destination = None
            return {"success": False, "needsFolder": True, "error": "Files cannot be saved in the folder this installer remembered. Choose another folder."}
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
            asset_entries = [name for name in archive.namelist() if name.startswith("files/") and not name.endswith("/")]
            self.progress.update({"total": len(entries) + len(asset_entries), "stage": "Installing"})
            folder.mkdir(parents=True, exist_ok=True)
            installed = skipped = refreshed = failed = assets_saved = 0
            first_error = ""
            for archived_name in asset_entries:
                # Project files, archives and extras are delivered encrypted but untouched:
                # only their name carries the brand, so nothing is content-credited.
                relative = Path(*Path(archived_name.replace("\\", "/")).parts[1:])
                if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
                    continue
                self.progress["name"] = relative.name
                target = folder.joinpath(*[safe_part(part, "file") for part in relative.parts])
                try:
                    if target.is_file():
                        skipped += 1
                        self.progress["done"] += 1
                        continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.read(archived_name))
                    assets_saved += 1
                except OSError as write_error:
                    failed += 1
                    first_error = first_error or f"{relative.name}: {write_error.strerror or write_error}"
                self.progress["done"] += 1
            for archived_name in entries:
                relative = Path(*Path(archived_name.replace("\\", "/")).parts[1:])
                if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
                    continue
                name = relative.as_posix()
                self.progress["name"] = relative.name
                target = folder.joinpath(*[safe_part(part, "Preset.ffx") for part in relative.parts])
                raw = archive.read(archived_name)
                if target.is_file():
                    # A preset written by an older build carries the retired trace forms and
                    # After Effects refuses to apply it, so those are rebuilt from the clean
                    # bytes inside this installer instead of being skipped.
                    try:
                        existing = target.read_bytes()
                    except OSError as read_error:
                        failed += 1
                        first_error = first_error or f"{relative.name}: {read_error.strerror or read_error}"
                        self.progress["done"] += 1
                        continue
                    if not needs_repair(existing):
                        skipped += 1
                        self.progress["done"] += 1
                        continue
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
            summary = {"installed": installed, "skipped": skipped, "failed": failed, "assets": assets_saved, "total": len(entries) + len(asset_entries), "duration_ms": duration}
            if first_error:
                summary["error"] = first_error
            self.log_event("complete", **summary)
            # Files are what the member came for, so only a run that saved nothing fails.
            if not installed and not assets_saved and failed:
                return {
                    "success": False,
                    "error": f"None of the files could be saved. Close After Effects (it locks the preset files) and run the installer again. First problem: {first_error}",
                }
            return {"success": True, "installed": installed, "skipped": skipped, "refreshed": refreshed, "failed": failed, "assets": assets_saved, "firstError": first_error, "folder": str(folder)}
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

    def ae_year(self) -> int | None:
        """The newest After Effects the member has installed, if any."""
        years = []
        for _sort_key, name in after_effects_versions():
            year = ae_year_from_name(name)
            if year:
                years.append(year)
        if not years and self.destination:
            for ancestor in [self.destination, *self.destination.parents]:
                year = ae_year_from_name(ancestor.name)
                if year:
                    years.append(year)
                    break
        return max(years) if years else None

    def preset_compatibility(self):
        """Every FFX in the pack with the After Effects version it needs.

        The list is read from the installer's own manifest, so it is available before the
        pack is unlocked and nothing is written until the member confirms.
        """
        files = self.manifest.get("files") or []
        year = self.ae_year()
        user_max = ae_max_format(year)
        rows = []
        for item in files:
            name = str(item.get("name") or "")
            format_version = int(item.get("format_version") or 0)
            required = str(item.get("ae_min") or ae_min_label(format_version))
            compatible = None
            if format_version and user_max:
                compatible = format_version <= user_max
            rows.append({
                "name": name,
                "file": name.split("/")[-1],
                "format": format_version,
                "aeMin": required,
                "compatible": compatible,
            })
        return {
            "success": True,
            "userVersion": year or 0,
            "userMaxFormat": user_max,
            "count": len(rows),
            "incompatible": sum(1 for row in rows if row["compatible"] is False),
            "unknown": sum(1 for row in rows if row["compatible"] is None),
            "files": rows,
        }

    def remove_app(self):
        """Delete this installer and quit, after the presets are already in place."""
        target = Path(sys.executable).resolve()
        bundle = None
        if sys.platform == "darwin":
            bundle = next((parent for parent in target.parents if parent.suffix == ".app"), None)
        removal_target = bundle or target
        manual = "This copy lives in a folder it cannot clean up by itself, so delete it by hand."
        try:
            if sys.platform == "darwin":
                # macOS keeps the inode alive, so the bundle can disappear while it runs.
                shutil.rmtree(removal_target, ignore_errors=True)
                if removal_target.exists():
                    return {"success": False, "error": manual}
                shutil.rmtree(self._config_dir(), ignore_errors=True)
            elif sys.platform == "win32":
                if is_protected(removal_target):
                    return {"success": False, "error": manual}
                # Windows locks a running executable, so a detached shell waits for the exit
                # and retries before clearing the one-file extraction folder as well.
                scratch = str(getattr(sys, "_MEIPASS", "") or "")
                script = Path(tempfile.gettempdir()) / f"zyrex-remove-{os.getpid()}.cmd"
                script.write_text(
                    "@echo off\r\n"
                    "setlocal\r\n"
                    "set tries=0\r\n"
                    ":wait\r\n"
                    "ping -n 2 127.0.0.1 >nul\r\n"
                    "set /a tries+=1\r\n"
                    f'del /f /q "{target}" 2>nul\r\n'
                    f'if not exist "{target}" goto done\r\n'
                    "if %tries% lss 15 goto wait\r\n"
                    ":done\r\n"
                    f'rmdir /s /q "{self._config_dir()}" 2>nul\r\n'
                    + (f'rmdir /s /q "{scratch}" 2>nul\r\n' if scratch else "")
                    + 'del /f /q "%~f0"\r\n',
                    encoding="utf-8",
                )
                subprocess.Popen(
                    ["cmd.exe", "/c", str(script)],
                    # The window must never flash: a hidden console plus a hidden startup
                    # window keeps the deletion invisible to the member.
                    creationflags=hidden_process_flags(),
                    startupinfo=hidden_startup_info(),
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    close_fds=True,
                )
            else:
                removal_target.unlink(missing_ok=True)
        except Exception as error:
            return {"success": False, "error": f"The app could not delete itself: {public_error(error)}"}
        self.log_event("self-remove", target=str(removal_target))
        self._quit_window(delay=0.5)
        return {"success": True, "removed": str(removal_target)}

    @staticmethod
    def _config_dir() -> Path:
        return config_path().parent

    @staticmethod
    def _quit_window(delay: float = 0.0) -> None:
        """Close the window and make sure the process really ends so the file unlocks."""
        def quit_now():
            try:
                import webview
                windows = getattr(webview, "windows", None) or []
                for window in windows:
                    try:
                        window.destroy()
                    except Exception:
                        pass
            except Exception:
                pass
            os._exit(0)

        if delay > 0:
            threading.Timer(delay, quit_now).start()
        else:
            quit_now()

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
        # A preset written by an older build must be recognised as broken, because After
        # Effects refuses to apply the hidden characters it carries.
        sample = (b'<rdf:Description><zyrex:Trace xmlns:zyrex="x">1-13b908f6a3c41014-9</zyrex:Trace>'
                  b'<zyrex:Username encoding="base64url-utf8">cmV5bGlhcg</zyrex:Username>'
                  b'<zyrex:DownloadedAt>2026-11-14T17:20:47.580Z</zyrex:DownloadedAt></rdf:Description>' + b" " * 256)
        blanked = strip_legacy_trace(sample)
        assert blanked is not None and len(blanked) == len(sample)
        assert b"<zyrex:Trace" not in blanked and b"</zyrex:DownloadedAt>" not in blanked
        assert needs_repair(sample) is True
        assert needs_repair("zyrexediting.xyz \u2022 Exposure\u2062\u200b".encode("utf-8")) is True
        assert needs_repair("zyrexediting.xyz \u2022 Exposure".encode("utf-8")) is False
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
        # v1.0.2: the app refuses to run from inside a ZIP, lists the payload's presets with
        # the After Effects version each one needs, and can delete itself afterwards.
        assert archive_launch_path("C:\\Temp\\Temp1_pack.zip\\Zyrex.exe"), "zip launch not detected"
        assert archive_launch_path("/tmp/pack.zip/Zyrex.app/Contents/MacOS/Zyrex"), "zip app launch not detected"
        assert archive_launch_path("C:\\Apps\\Zyrex.exe") == "" and archive_launch_path("/Applications/Zyrex.app") == ""
        assert ae_max_format(2023) == 93 and ae_max_format(2024) == 95 and ae_max_format(2025) == 97 and ae_max_format(2026) == 99
        assert ae_max_format(2027) > ae_max_format(2026)
        assert ae_min_label(95) == "2024" and ae_min_label(97) == "2025" and ae_min_label(99) == "2026"
        assert ae_year_from_name("After Effects 2026") == 2026
        assert ae_year_from_name("After Effects 24.0") == 2024
        report = api.preset_compatibility()
        assert report["success"] is True and report["count"] == state["presetCount"], report
        assert "files" in report and all("aeMin" in row for row in report["files"])
        assert callable(getattr(api, "remove_app", None)) and callable(getattr(api, "preset_compatibility", None))
        assert VERSION == "v1.0.3" and VERSION in html
        for marker in ("ffxSheet", "removeSheet", "updateSheet", "wipeScreen", "changeFolder", "preset_compatibility", "remove_app", "apply_update"):
            assert marker in html, marker
        # v1.0.3: the destination is the member's own folder, the API refuses old builds,
        # and the app can update itself to whatever the Worker reports as current.
        assert callable(getattr(api, "check_update", None)) and callable(getattr(api, "apply_update", None))
        assert isinstance(state.get("destinationPresets"), bool)
        assert version_gt("v1.0.10", "v1.0.9") and not version_gt("v1.0.9", "v1.0.10")
        assert version_gt("1.1", "v1.0.99") and not version_gt("v1.0.3", "1.0.3")
        assert installer_platform() in {"windows", "macos", "linux"}
        target = Path(os.environ.get("TEMP") or os.environ.get("TMPDIR") or "/tmp") / "zyrex-self-test-destination"
        target.mkdir(parents=True, exist_ok=True)
        chosen, reason = resolve_destination(target)
        assert chosen == target and reason == "", (chosen, reason)
        # An After Effects year folder is the one place that is still corrected, because a
        # preset saved there is invisible to After Effects.
        assert resolve_destination("")[0] is None
        assert hidden_startup_info() is not None or sys.platform != "win32"
        assert "assetCount" in state
        # The vendored bundle is what makes HTTPS work on a frozen macOS build.
        assert Path(resource("cacert.pem")).is_file(), "cacert.pem is missing from the bundle"
        # A frozen macOS build has no trust store of its own, so the CA bundle and the
        # verifying context are pinned here — without them every request failed with
        # CERTIFICATE_VERIFY_FAILED and nothing reached the API.
        bundle = ca_bundle()
        assert bundle and Path(bundle).is_file(), f"no CA bundle found (looked in {sys.prefix})"
        assert Path(bundle).stat().st_size > 1024
        context = ssl_context()
        import ssl
        assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname is True
        assert context.cert_store_stats().get("x509_ca", 0) > 10, context.cert_store_stats()
        assert "verify" in network_error_message(urllib.error.URLError(Exception("CERTIFICATE_VERIFY_FAILED: unable to get local issuer"))).lower()
        # The online check only runs where the sandbox has network access; the bundle test
        # above already proves verification is configured.
        if os.environ.get("ZYREX_SKIP_NETWORK") != "1":
            try:
                with urllib.request.urlopen(urllib.request.Request(f"{SITE}/api/installer/status?id=self-test", headers={"User-Agent": "Zyrex-Self-Test"}), timeout=20, context=context) as probe:
                    assert probe.status < 500
            except urllib.error.HTTPError as error:
                assert error.code in {400, 404}, f"unexpected HTTPS status {error.code}"
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
    # Pin the trust store before any TLS handshake, so every library in the process
    # (urllib, pywebview, requests) agrees on the bundled certificate authorities.
    ssl_context()
    blocked = archive_launch_path()
    if blocked:
        show_archive_warning(blocked)
        return
    import webview
    api = InstallerAPI()
    threading.Thread(target=lambda: (time.sleep(2), api.refresh_metadata()), daemon=True).start()
    # The API refuses builds older than the current minimum, so the check runs on every
    # launch and the UI shows the update prompt before the member tries to install.
    threading.Thread(target=lambda: (time.sleep(2.4), api.check_update()), daemon=True).start()
    webview.create_window("Zyrex Effects Installer", html=render_html(), js_api=api, width=900, height=720, min_size=(620, 560), background_color="#100b0e")
    webview.start(debug=False)

if __name__ == "__main__": main()
