"""Hide every preset leak that still misses an app download and re-queue its build.

Run after a backfill: the Worker walks the whole catalogue, reveals the leaks whose Windows
and macOS installers are in place, and hides the ones that still miss a platform while asking
CI to build them again. Leaks with no FFX source stay listed, because nothing could ever be
built for them.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = "https://zyrexediting.xyz"
RECONCILE_API = f"{SITE}/api/installer/reconcile"


def reconcile_page(token: str, offset: int, limit: int = 20, max_dispatch: int = 6) -> dict:
    query = urllib.parse.urlencode({"apply": "1", "dispatch": "1", "limit": limit, "max_dispatch": max_dispatch, "offset": offset})
    body = b"{}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Zyrex-Installer-Reconcile/1.0",
    }
    last_error: Exception | None = None
    for attempt in range(1, 7):
        request = urllib.request.Request(RECONCILE_API + "?" + query, data=body, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:300]
            if error.code not in {429, 500, 502, 503, 504} or attempt == 6:
                raise RuntimeError(f"Reconcile failed with HTTP {error.code}: {detail}") from error
            last_error = error
            time.sleep(attempt * 8)
        except (TimeoutError, urllib.error.URLError) as error:
            if attempt == 6:
                raise RuntimeError(f"Reconcile did not answer: {error}") from error
            last_error = error
            time.sleep(attempt * 8)
    raise RuntimeError(f"Reconcile did not answer: {last_error}")


def main() -> int:
    token = os.environ.get("FFX_RELEASE_SOURCE_TOKEN", "").strip()
    if not token:
        raise SystemExit("FFX_RELEASE_SOURCE_TOKEN must be configured to reconcile the catalogue.")
    totals = {"total": 0, "revealed": 0, "hidden": 0, "dispatched": 0, "unbuildable": 0, "failed": 0}
    offset = 0
    saw_pipeline = True
    while True:
        report = reconcile_page(token, offset)
        if not isinstance(report, dict) or report.get("success") is not True:
            raise SystemExit(f"Unexpected reconcile response: {report}")
        saw_pipeline = saw_pipeline and bool(report.get("pipeline_ready"))
        totals["total"] = max(totals["total"], int(report.get("total") or 0))
        for key in ("revealed", "hidden"):
            totals[key] += len(report.get(key) or [])
        totals["dispatched"] += int(report.get("dispatched") or 0)
        totals["unbuildable"] += len(report.get("unbuildable") or [])
        totals["failed"] += len(report.get("failed") or [])
        print(
            f"offset {offset}: {len(report.get('complete') or [])} ready, "
            f"{len(report.get('missing') or [])} missing, "
            f"{len(report.get('unbuildable') or [])} without source, "
            f"{len(report.get('hidden') or [])} hidden, {len(report.get('revealed') or [])} revealed",
            flush=True,
        )
        next_offset = int(report.get("next_offset") or 0)
        if not next_offset:
            break
        offset = next_offset
    print(json.dumps(totals), flush=True)
    if not saw_pipeline:
        print("WARNING: the installer pipeline is not configured, so nothing was hidden.", file=sys.stderr)
    if totals["unbuildable"]:
        print(
            f"{totals['unbuildable']} leak(s) have no FFX source and stay listed without an app download.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
