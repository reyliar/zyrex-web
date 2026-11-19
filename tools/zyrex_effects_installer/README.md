# Zyrex leak preset installer

Each Windows and macOS installer is built for one published leak ID. It shows the leak thumbnail, description, creator `@username`, and uploader. The application bundle contains only encrypted preset bytes and public metadata; it cannot read or install any `.ffx` preset until the user signs in with Discord through Zyrex.

After sign-in, the app receives a short-lived product-scoped token from the Worker, retrieves the release key, decrypts the pack in memory, and asks the Worker to trace each `.ffx` before writing it. The Worker only releases that key to a member who holds **both** the `Verified` role in the Discord server **and** an active download pass (or the unlimited ad-free role), exactly like the site's own download flow — the `payload-key`, `trace`, installer-download and `ffx-source` endpoints all re-check the pair on every call, so a revoked role or an expired pass stops an install immediately and an encrypted pack in someone's hands stays unreadable. A member who signs in without both sees **Unlock download access**, which opens the Access page and re-checks automatically while they finish an offer. Presets are installed under `User Presets/<creator username>/<leak name>/`, with all original subfolders preserved. Existing files are kept. Each preset's own `<zyrex:Trace>` XMP element records the Discord ID, the Discord username and the UTC download time **in plain text**, reusing the packet's existing padding so the file length never changes. Nothing inside the preset body is modified — the chunk tree and every display string stay byte-identical to what the creator exported, because After Effects renders those strings and a hidden character in one of them fails its text engine (`Unable to draw string. GDI Status: GenericError`), which makes the preset apply nothing. No sidecar receipt or extra file is created; a preset without a metadata packet is installed untraced rather than edited.

The install screen shows a progress bar driven by `get_state().progress` (`done`, `total`, current file name, stage). A preset written by an older build still carries the retired trace forms (the base64 block or the zero-width marks); the installer recognises it as broken and rebuilds it from the clean bytes inside the installer, so re-installing over an existing folder repairs it instead of skipping it. Each install reports `start`, `complete`, `error` and `access-denied` events to `POST /api/installer/log`; the founder-only panel at `/admin-app-logs` lists them with a search field (Discord ID, username, leak, event, IP, date).

The release folder contains exactly three entries:

- `Windows/<Leak name>/`: `<Leak name>.exe`
- `macOS/<Leak name>/`: `<Leak name>.dmg`
- Both platform folders include `Leaked by Zyrex.txt` and `Visit for more resources.url`.

The app is version `v1.0.2`; its icon is generated from `content.png`. Its detected After Effects destination is clickable; after install, the primary button turns into a green **Exit** button that closes the app, and the notification shows the exact preset folder. Destination detection uses the real Windows Documents folder (so OneDrive-redirected and non-English installs work) and creates `User Presets` when After Effects exists but never saved one; on macOS it scans `/Applications`, the per-user Applications folder and `~/Library/Application Support/Adobe` for `Adobe After Effects <year>`. When no folder can be found the primary button becomes **Choose After Effects folder**, the destination row turns amber (`is-missing`) and the notice explains the problem *before* any sign-in: picking the folder **continues the flow automatically** (sign-in → access check → install) instead of dropping the member back to the start. An `After Effects <year>` folder is mapped to its `User Presets`, and a folder inside the After Effects installation (`Program Files`, `/Applications`, `/Library`, `/System`) is refused with the correct path instead of failing later. The chosen path is stored in `%LOCALAPPDATA%\Zyrex\installer.json` (`~/Library/Application Support` on macOS), re-validated on every launch, and reused. A preset that After Effects is holding open no longer aborts the pack: the remaining presets are installed, the locked ones are counted in the completion message, and every failure is logged. The executable does not contain plaintext FFX files or the decryption key.

## Launch and cleanup rules (v1.0.2)

A `.zip` is never a place to run the app from: Explorer and Finder hand out a throw-away copy, so the presets would be written from a folder that disappears and the app could not clean up after itself. `main()` checks `archive_launch_path()` (the executable path, `_MEIPASS` and `__file__`) for a `.zip` component and stops with an "extract the ZIP first" alert instead of starting.

The install dialog lists every `.ffx` the payload contains **before** anything is copied. `preset_compatibility()` reads `format_version` from each manifest entry — the RIFX `head` version After Effects writes, taken from the original bytes before the trace is added — and compares it with the newest After Effects installed on the machine (`ae_max_format(ae_year())`): 93 → 2023, 95 → 2024, 97 → 2025, 99 → 2026, and two more per release afterwards. Each row is marked compatible, too new (`aeMin` newer than the member's AE) or unknown when AE could not be detected, and the member confirms the list before the install runs.

When the pack has been installed the app offers to delete itself (`remove_app()`): on macOS the `.app` bundle is removed synchronously and verified, on Windows a detached shell retries `del` for up to ~30 s after the process exits and clears both the config folder and the one-file extraction folder. A copy that cannot remove itself (Program Files, `/Applications`, `/Library`) keeps the app and reports that it has to be deleted by hand.

## Bundle layout

The distributed app is a single file on both platforms (`<Leak name>.exe`, `<Leak name>.dmg` containing a one-file `.app`). To keep it small:

- `ui.html` inlines the logo as a data URI, so no loose asset files are read at runtime.
- AES-256-GCM decryption uses pycryptodome; `cryptography` stays a build-time dependency only for encrypting the payload.
- `pyihooks/hook-Crypto.py` ships only the AES/ECB/CTR/GHASH backends instead of every pycryptodome module.
- Unused stdlib and packaging modules (`tkinter`, `setuptools`, `unittest`, `PIL`, ...) are excluded in `build_release.py`.

## HTTPS trust (macOS and Windows)

A PyInstaller one-file bundle does not inherit an OpenSSL trust store, so on macOS every request used to die with `CERTIFICATE_VERIFY_FAILED`, which also meant no `start`/`complete`/`error` event ever reached `/api/installer/log`. The bundle always ships `cacert.pem` (`--add-data cacert.pem`), and `build_release.py` copies the copy kept in this folder so a build never depends on what the runner's certifi happens to contain. The app builds one verifying `ssl.SSLContext` for every `urlopen` call, using the first readable bundle from:

1. `ZYREX_CA_BUNDLE` (escape hatch for a corporate proxy),
2. the bundled `cacert.pem` next to the executable — preferred over the host store, because a stock macOS root file can be stale,
3. `certifi.where()`,
4. `sys.prefix/ssl/cacert.pem`,
5. `/etc/ssl/cert.pem`, `/usr/local/etc/openssl/cert.pem`, `/opt/homebrew/etc/openssl@3/cert.pem`.

`ca_bundle()` assigns `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE` and `CURL_CA_BUNDLE` (plain assignment, not `setdefault`, so an inherited broken value cannot win), drops `SSL_CERT_DIR`, and `ssl_context()` calls `load_default_certs()` on top so the platform roots are added to the shipped ones. Certificate verification is never disabled: a failure is reported to the member as a readable message ("this device could not verify zyrexediting.xyz …") instead of a raw traceback. `build_release.py` raises if no CA bundle is available, and `--self-test` asserts the bundle exists, holds more than ten CAs, verifies certificates and can reach the API over HTTPS (`ZYREX_SKIP_NETWORK=1` skips only the live probe).

## Automatic release flow

`.github/workflows/release.yml` builds Windows and macOS artifacts. Product publishing triggers it using `repository_dispatch`; `workflow_dispatch` can build one leak by ID or backfill every existing preset leak with production FFX files. Both platform builds use the same release ID and Worker-derived encryption key. The combined artifact contains separate `Windows/` and `macOS/` folders. Failed IDs can be rebuilt and merged with a successful base run by setting `preset_ids` and `base_run_id`.

A preset leak is only listed once **both** app downloads exist next to it. Publishing sets `installers_pending`, keeps the leak out of `/api/products`, and queues the build; a dispatch that fails or finds no FFX source leaves the leak pending instead of sharing it, and `sweepMissingInstallers` retries the dispatch every 20 minutes for three days. A leak that is older than 48 hours when its installers land is revealed without a second Discord message, so a backfill never re-announces old leaks.

`POST /api/installer/reconcile` (Bearer `FFX_RELEASE_SOURCE_TOKEN`) audits the whole catalogue and takes `apply=1`, `dispatch=1|0`, `hide_unbuildable=1`, `limit`, `max_dispatch` and `offset`. A dry run reports which leaks are complete, which still miss a platform (with `source_ready`) and which have no FFX source to build from; `apply=1` hides the ones that can be built, clears `installers_pending` for the ones that are complete, and re-queues up to `max_dispatch` builds per call. `reconcile_catalogue.py` walks the whole catalogue through that endpoint and runs automatically at the end of every `backfill_all` run (`reconcile_catalogue: false` skips it). `discover_sources.py` asks for `include_pending=1`, so the CI backfill also sees the leaks the catalogue is hiding.

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
