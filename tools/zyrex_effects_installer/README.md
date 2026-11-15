# Zyrex leak preset installer

Each Windows and macOS installer is built for one published leak ID. It shows the leak thumbnail, description, creator `@username`, and uploader. The application bundle contains only encrypted preset bytes and public metadata; it cannot read or install any `.ffx` preset until the user signs in with Discord through Zyrex.

After sign-in, the app receives a short-lived product-scoped token from the Worker, retrieves the release key, decrypts the pack in memory, and asks the Worker to trace each `.ffx` before writing it. The Worker only releases that key to a member who holds **both** the `Verified` role in the Discord server **and** an active download pass (or the unlimited ad-free role), exactly like the site's own download flow — the `payload-key`, `trace`, installer-download and `ffx-source` endpoints all re-check the pair on every call, so a revoked role or an expired pass stops an install immediately and an encrypted pack in someone's hands stays unreadable. A member who signs in without both sees **Unlock download access**, which opens the Access page and re-checks automatically while they finish an offer. Presets are installed under `User Presets/<creator username>/<leak name>/`, with all original subfolders preserved. Existing files are kept. Each preset's own `<zyrex:Trace>` XMP element records the Discord ID, the Discord username and the UTC download time **in plain text**, reusing the packet's existing padding so the file length never changes. The account ID is also carried in zero-width marks on the credited effect names, so deleting the visible block does not hide it. No sidecar receipt or extra file is created. Files that cannot be safely traced are not installed.

The install screen shows a progress bar driven by `get_state().progress` (`done`, `total`, current file name, stage). A preset installed by an older build still carries the retired encoded trace block; the installer blanks that block (same byte length) and asks the Worker to write the readable one, so re-installing over an existing folder upgrades it instead of skipping it. Each install reports `start`, `complete`, `error` and `access-denied` events to `POST /api/installer/log`; the founder-only panel at `/admin-app-logs` lists them with a search field (Discord ID, username, leak, event, IP, date).

The release folder contains exactly three entries:

- `Windows/<Leak name>/`: `<Leak name>.exe`
- `macOS/<Leak name>/`: `<Leak name>.dmg`
- Both platform folders include `Leaked by Zyrex.txt` and `Visit for more resources.url`.

The app is version `v1.0.0`; its icon is generated from `content.png`. Its detected After Effects destination is clickable; after install, the primary button turns into a green **Exit** button that closes the app, and the notification shows the exact preset folder. When no `User Presets` folder can be found, the primary button becomes **Choose After Effects folder** and opens the native folder picker; the chosen path is stored in `%LOCALAPPDATA%\Zyrex\installer.json` (`~/Library/Application Support` on macOS) and reused on the next launch. The executable does not contain plaintext FFX files or the decryption key.

## Bundle layout

The distributed app is a single file on both platforms (`<Leak name>.exe`, `<Leak name>.dmg` containing a one-file `.app`). To keep it small:

- `ui.html` inlines the logo as a data URI, so no loose asset files are read at runtime.
- AES-256-GCM decryption uses pycryptodome; `cryptography` stays a build-time dependency only for encrypting the payload.
- `pyihooks/hook-Crypto.py` ships only the AES/ECB/CTR/GHASH backends instead of every pycryptodome module.
- Unused stdlib and packaging modules (`tkinter`, `setuptools`, `unittest`, `PIL`, ...) are excluded in `build_release.py`.

## Automatic release flow

`.github/workflows/release.yml` builds Windows and macOS artifacts. Product publishing triggers it using `repository_dispatch`; `workflow_dispatch` can build one leak by ID or backfill every existing preset leak with production FFX files. Both platform builds use the same release ID and Worker-derived encryption key. The combined artifact contains separate `Windows/` and `macOS/` folders. Failed IDs can be rebuilt and merged with a successful base run by setting `preset_ids` and `base_run_id`.

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
