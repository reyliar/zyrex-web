"""Create a small index linking to each successful per-platform installer artifact."""
from __future__ import annotations

import argparse
import csv
import html
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def api_json(url: str, token: str) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "Zyrex-Installer-Release-Index/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    for attempt in range(6):
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            if error.code not in {403, 429} or attempt == 5:
                raise
            retry_after = int(error.headers.get("Retry-After", "0") or 0)
            time.sleep(max(retry_after, min(60, 5 * (attempt + 1))))
    raise RuntimeError("GitHub API request did not complete.")


def pages(repo: str, endpoint: str, token: str, key: str) -> list[dict]:
    result: list[dict] = []
    for page in range(1, 20):
        query = urllib.parse.urlencode({"per_page": 100, "page": page})
        data = api_json(f"https://api.github.com/repos/{repo}/{endpoint}?{query}", token)
        items = data.get(key) or []
        result.extend(items)
        if len(result) >= int(data.get("total_count") or 0) or not items:
            break
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GH_TOKEN"]
    run_ids = list(dict.fromkeys(value for value in (os.environ.get("BASE_RUN_ID", "").strip(), os.environ.get("CURRENT_RUN_ID", "").strip()) if value))
    if not run_ids:
        raise SystemExit("No source Actions run was provided.")

    artifacts: dict[str, dict] = {}
    failures: list[dict] = []
    for run_id in run_ids:
        for artifact in pages(repo, f"actions/runs/{run_id}/artifacts", token, "artifacts"):
            name = str(artifact.get("name") or "")
            if name.startswith("zyrex-build-") and not artifact.get("expired"):
                artifacts[name] = {**artifact, "run_id": run_id}
        for job in pages(repo, f"actions/runs/{run_id}/jobs", token, "jobs"):
            if job.get("conclusion") == "failure":
                failures.append({"run_id": run_id, "job": job.get("name", "installer job failed")})

    rows = []
    for name, artifact in sorted(artifacts.items(), key=lambda item: item[0].casefold()):
        parts = name.removeprefix("zyrex-build-").rsplit("-", 1)
        preset_id, platform = (parts[0], parts[1]) if len(parts) == 2 else (name, "unknown")
        rows.append({
            "preset_id": preset_id,
            "platform": platform,
            "artifact": name,
            "size_mb": round(int(artifact.get("size_in_bytes") or 0) / (1024 * 1024), 1),
            "expires_at": artifact.get("expires_at", ""),
            "url": f"https://github.com/{repo}/actions/runs/{artifact['run_id']}/artifacts/{artifact['id']}",
        })

    args.output.mkdir(parents=True, exist_ok=True)
    with (args.output / "installer-artifacts.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=("preset_id", "platform", "artifact", "size_mb", "expires_at", "url"))
        writer.writeheader()
        writer.writerows(rows)

    table_rows = "\n".join(
        "<tr><td>{}</td><td>{}</td><td>{} MB</td><td>{}</td><td><a href=\"{}\">Open artifact</a></td></tr>".format(
            html.escape(row["preset_id"]), html.escape(row["platform"]), row["size_mb"], html.escape(row["expires_at"]), html.escape(row["url"], quote=True)
        ) for row in rows
    )
    failed_html = "".join(f"<li><code>{html.escape(str(item['job']))}</code> (run {html.escape(item['run_id'])})</li>" for item in failures)
    failure_section = f"<h2>Builds needing source fixes</h2><p>These source files failed the After Effects FFX format check, so no installer was produced for these jobs.</p><ul>{failed_html}</ul>" if failures else ""
    document = f'''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zyrex installer artifacts</title>
<style>body{{margin:32px auto;padding:0 18px;max-width:1100px;background:#100b0e;color:#f7f2f5;font:15px/1.55 Outfit,Arial,sans-serif}}h1{{margin-bottom:6px}}p{{color:#c9bdc5}}.glass{{padding:22px;border:1px solid #ffffff30;border-radius:22px;background:#ffffff0b;backdrop-filter:blur(24px)}}table{{width:100%;border-collapse:collapse}}th,td{{padding:11px 10px;text-align:left;border-bottom:1px solid #ffffff18}}th{{color:#ff7892}}a{{color:#ffd3dc}}code{{overflow-wrap:anywhere}}@media(max-width:700px){{.table-wrap{{overflow:auto}}table{{min-width:720px}}}}</style>
<main class="glass"><h1>Zyrex preset installers</h1><p>{len(rows)} successful platform installers are available. Each installer asks the user to sign in with Discord before unlocking its encrypted FFX files. Artifacts expire according to the date shown below.</p>
<div class="table-wrap"><table><thead><tr><th>Leak ID</th><th>Platform</th><th>Size</th><th>Expires (UTC)</th><th>Download</th></tr></thead><tbody>{table_rows}</tbody></table></div>{failure_section}</main></html>'''
    (args.output / "installer-artifacts.html").write_text(document, encoding="utf-8")
    (args.output / "release-summary.json").write_text(json.dumps({"runs": run_ids, "artifact_count": len(rows), "failed_jobs": failures}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {len(rows)} successful installer artifacts across {len(run_ids)} workflow run(s); {len(failures)} build jobs failed.")


if __name__ == "__main__":
    main()
