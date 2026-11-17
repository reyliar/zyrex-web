# Zyrex leak preset installer

Each Windows and macOS installer is built for one published leak ID. It shows the leak thumbnail, description, creator `@username`, and uploader. The application bundle contains only encrypted preset bytes and public metadata; it cannot read or install any `.ffx` preset until the user signs in with Discord through Zyrex.

After sign-in, the app receives a short-lived product-scoped token from the Worker, retrieves the release key, decrypts the pack in memory, and asks the Worker to trace each `.ffx` before writing it. The Worker only releases that key to a member who holds **both** the `Verified` role in the Discord server **and** an active download pass (or the unlimited ad-free role), exactly like the site's own download flow — the `payload-key`, `trace`, installer-download and `ffx-source` endpoints all re-check the pair on every call, so a revoked role or an expired pass stops an install immediately and an encrypted pack in someone's hands stays unreadable. A member who signs in without both sees **Unlock download access**, which opens the Access page and re-checks automatically while they finish an offer. Presets are installed under `User Presets/<creator username>/<leak name>/`, with all original subfolders preserved. Existing files are kept. Each preset's own `<zyrex:Trace>` XMP element records the Discord ID, the Discord username and the UTC download time **in plain text**, reusing the packet's existing padding so the file length never changes. Nothing inside the preset body is modified — the chunk tree and every display string stay byte-identical to what the creator exported, because After Effects renders those strings and a hidden character in one of them fails its text engine (`Unable to draw string. GDI Status: GenericError`), which makes the preset apply nothing. No sidecar receipt or extra file is created; a preset without a metadata packet is installed untraced rather than edited.

The install screen shows a progress bar driven by `get_state().progress` (`done`, `total`, current file name, stage). A preset written by an older build still carries the retired trace forms (the base64 block or the zero-width marks); the installer recognises it as broken and rebuilds it from the clean bytes inside the installer, so re-installing over an existing folder repairs it instead of skipping it. Each install reports `start`, `complete`, `error` and `access-denied` events to `POST /api/installer/log`; the founder-only panel at `/admin-app-logs` lists them with a search field (Discord ID, username, leak, event, IP, date).

The release folder contains exactly three entries:

- `Windows/<Leak name>/`: `<Leak name>.exe`
- `macOS/<Leak name>/`: `<Leak name>.dmg`
- Both platform folders include `Leaked by Zyrex.txt` and `Visit for more resources.url`.

The app is version `v1.0.0`; its icon is generated from `content.png`. Its detected After Effects destination is clickable; after install, the primary button turns into a green **Exit** button that closes the app, and the notification shows the exact preset folder. Destination detection uses the real Windows Documents folder (so OneDrive-redirected and non-English installs work) and creates `User Presets` when After Effects exists but never saved one; on macOS it scans `/Applications`, the per-user Applications folder and `~/Library/Application Support/Adobe` for `Adobe After Effects <year>`. When no folder can be found the primary button becomes **Choose After Effects folder**, the destination row turns amber (`is-missing`) and the notice explains the problem *before* any sign-in: picking the folder **continues the flow automatically** (sign-in → access check → install) instead of dropping the member back to the start. An `After Effects <year>` folder is mapped to its `User Presets`, and a folder inside the After Effects installation (`Program Files`, `/Applications`, `/Library`, `/System`) is refused with the correct path instead of failing later. The chosen path is stored in `%LOCALAPPDATA%\Zyrex\installer.json` (`~/Library/Application Support` on macOS), re-validated on every launch, and reused. A preset that After Effects is holding open no longer aborts the pack: the remaining presets are installed, the locked ones are counted in the completion message, and every failure is logged. The executable does not contain plaintext FFX files or the decryption key.

## Bundle layout

The distributed app is a single file on both platforms (`<Leak name>.exe`, `<Leak name>.dmg` containing a one-file `.app`). To keep it small:

- `ui.html` inlines the logo as a data URI, so no loose asset files are read at runtime.
- AES-256-GCM decryption uses pycryptodome; `cryptography` stays a build-time dependency only for encrypting the payload.
- `pyihooks/hook-Crypto.py` ships only the AES/ECB/CTR/GHASH backends instead of every pycryptodome module.
- Unused stdlib and packaging modules (`tkinter`, `setuptools`, `unittest`, `PIL`, ...) are excluded in `build_release.py`.

## HTTPS trust (macOS and Windows)

A PyInstaller one-file bundle does not inherit an OpenSSL trust store, so on macOS every request used to die with `CERTIFICATE_VERIFY_FAILED`, which also meant no `start`/`complete`/`error` event ever reached `/api/installer/log`. The build now copies `certifi.where()` into the bundle as `cacert.pem` (`--add-data cacert.pem`), and the app builds one verifying `ssl.SSLContext` for every `urlopen` call:

1. `ZYREX_CA_BUNDLE` (escape hatch for a corporate proxy),
2. `certifi.where()`,
3. the bundled `cacert.pem` next to the executable,
4. `sys.prefix/ssl/cacert.pem`,
5. `/etc/ssl/cert.pem`.

`ca_bundle()` also exports `SSL_CERT_FILE` and `REQUESTS_CA_BUNDLE` with `os.environ.setdefault`, so pywebview and any library that opens its own TLS connection uses the same roots. Certificate verification is never disabled: a failure is reported to the member as a readable message ("the installer could not verify zyrexediting.xyz …") instead of a raw traceback. `build_release.py` raises if `certifi` is missing, and `--self-test` asserts the bundle exists, holds real CAs, verifies certificates and can reach the API over HTTPS (`ZYREX_SKIP_NETWORK=1` skips only the live probe).

## Automatic release flow

`.github/workflows/release.yml` builds Windows and macOS artifacts. Product publishing triggers it using `repository_dispatch`; `workflow_dispatch` can build one leak by ID or backfill every existing preset leak with production FFX files. Both platform builds use the same release ID and Worker-derived encryption key. The combined artifact contains separate `Windows/` and `macOS/` folders. Failed IDs can be rebuilt and merged with a successful base run by setting `preset_ids` and `base_run_id`.

A full backfill builds ~130 leaks twice, so the source transfer matters for the zone's daily request budget: `fetch_source.py` asks for `GET /api/installer/ffx-source?id=…&bundle=1`, which returns the whole pack in one response (a small length-prefixed stream) instead of one request per preset. A pack over 48 MB, or any Worker that does not answer the bundle, falls back to the original per-file download automatically. Fresh installers cost about three Worker requests per platform instead of one per preset.

Required credentials:

- `FFX_RELEASE_SOURCE_TOKEN`: shared Worker/GitHub Actions secret for the build-only source and encryption-key endpoints.
- `FFX_RELEASE_GITHUB_TOKEN`: Worker secret with repository `contents:write` permission to dispatch Actions.
- `SESSION_SECRET`: stable Worker HMAC secret used for Zyrex sessions, scoped installer tokens, and release key derivation.
- `FFX_RELEASE_REPOSITORY`: optional Worker variable; defaults to `reyliar/zyrex-web`.

## Local Windows build

```powershell
$env:FFX_RELEASE_SOURCE_TOKEN = '<GitHub Actions source token>'
.\build.ps1 -PresetId preset-mvng96tn -SourceFolder 'C:\path\to\production\folder'
```
