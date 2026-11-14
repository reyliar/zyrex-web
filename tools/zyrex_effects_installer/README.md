# Zyrex leak preset installer

Each installer is built for one published leak ID. The builder reads the leak name, creator, uploader, description, thumbnail, and preset files from Zyrex. The app shows the site artwork and metadata, then installs into `User Presets\Creator\Leak\*.ffx` with one click. Metadata uses the embedded product details immediately and retries transient Zyrex API failures in the background.

The release folder contains exactly three entries:

- `Windows/<Leak name>/`: `<Leak name>.exe`
- `macOS/<Leak name>/`: `<Leak name>.dmg`
- All platforms: `Leaked by Zyrex.txt` and `Visit for more resources.url`

The app is version `v1.0.0`. Its detected After Effects destination is clickable; after install the green Completed button and notification show the exact preset folder. Preset bytes and fonts are embedded in the app. Source `.ffx` files are copied from the production bucket through a token-authenticated Worker endpoint. Every preset is credited in its effect names or, when its effect data cannot be safely edited, its filename before either platform app is generated. Existing presets with matching names are preserved.

## Automatic release flow

`.github/workflows/release.yml` builds Windows and macOS artifacts. Product publishing triggers it using `repository_dispatch`; `workflow_dispatch` can build one leak by ID or backfill every existing preset leak with production FFX files. The combined artifact contains separate `Windows/` and `macOS/` folders.

Required credentials:

- `FFX_RELEASE_SOURCE_TOKEN`: same random secret in the Worker and GitHub Actions; protects the production preset endpoint.
- `FFX_RELEASE_GITHUB_TOKEN`: Worker secret with repository `contents:write` permission to dispatch Actions.
- `FFX_RELEASE_REPOSITORY`: optional Worker variable; defaults to `reyliar/zyrex-web`.

## Local Windows build and test

```powershell
.\build.ps1 -PresetId preset-mvng96tn -SourceFolder 'C:\path\to\production\folder'
py -3.12 app.py --self-test
```
