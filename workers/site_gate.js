const DEFAULT_HEALTH_URL = "https://storage.zyrexediting.xyz/health";
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_ONLINE_CACHE_MS = 10000;
const DEFAULT_OFFLINE_CACHE_MS = 5000;

let healthState = {
  available: false,
  checkedAt: 0,
  initialized: false,
};
let activeProbe = null;
let lastHealthReason = "not-checked";

function numberFromEnv(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function healthCacheTtl(env) {
  return healthState.available
    ? numberFromEnv(env.HEALTH_ONLINE_CACHE_MS, DEFAULT_ONLINE_CACHE_MS)
    : numberFromEnv(env.HEALTH_OFFLINE_CACHE_MS, DEFAULT_OFFLINE_CACHE_MS);
}

async function probeServer(env) {
  const controller = new AbortController();
  const timeoutMs = numberFromEnv(env.HEALTH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(env.SERVER_HEALTH_URL || DEFAULT_HEALTH_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Zyrex-Site-Gate/1.0",
      },
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    if (!response.ok) {
      lastHealthReason = `http-${response.status}`;
      return false;
    }

    const payload = await response.json();
    const status = String(payload?.status || "").toLowerCase();
    const available = status === "ok" || status === "healthy" || status === "online";
    lastHealthReason = available ? "online" : `invalid-status-${status || "missing"}`;
    return available;
  } catch (error) {
    lastHealthReason = "request-error";
    console.warn("Server health probe failed", error?.message || String(error));
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function isServerAvailable(env) {
  const now = Date.now();
  if (healthState.initialized && now - healthState.checkedAt < healthCacheTtl(env)) {
    return healthState.available;
  }

  if (!activeProbe) {
    activeProbe = probeServer(env)
      .then((available) => {
        healthState = { available, checkedAt: Date.now(), initialized: true };
        return available;
      })
      .finally(() => {
        activeProbe = null;
      });
  }

  return activeProbe;
}

function maintenanceHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Servers Offline · Zyrex Editing</title>
  <style>
    :root{color-scheme:dark;--bg:#07070a;--panel:#111116;--line:#292932;--text:#f5f5f7;--muted:#a4a4af;--red:#ff4d5e}
    *{box-sizing:border-box}html,body{height:100%;margin:0}body{display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 20%,#1b1117 0,#0b0b0f 38%,var(--bg) 72%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    main{width:min(620px,100%);padding:42px 34px;text-align:center;background:rgba(17,17,22,.92);border:1px solid var(--line);border-radius:24px;box-shadow:0 30px 80px #0008;backdrop-filter:blur(18px)}
    .mark{display:inline-flex;align-items:center;gap:9px;padding:8px 13px;border:1px solid #4a2830;border-radius:999px;background:#261118;color:#ff9ca6;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
    .dot{width:9px;height:9px;border-radius:50%;background:var(--red);box-shadow:0 0 0 0 #ff4d5e80;animation:pulse 1.8s infinite}
    h1{margin:25px 0 13px;font-size:clamp(29px,6vw,48px);line-height:1.08;letter-spacing:-.04em}p{margin:0 auto;max-width:490px;color:var(--muted);font-size:16px;line-height:1.7}
    button{margin-top:28px;padding:12px 19px;border:1px solid #393943;border-radius:12px;background:#1b1b22;color:var(--text);font:inherit;font-weight:650;cursor:pointer}button:hover{background:#24242c;border-color:#50505c}.note{display:block;margin-top:17px;color:#73737e;font-size:12px}
    @keyframes pulse{70%{box-shadow:0 0 0 10px #ff4d5e00}100%{box-shadow:0 0 0 0 #ff4d5e00}}
  </style>
</head>
<body>
  <main>
    <span class="mark"><span class="dot"></span>System offline</span>
    <h1>Our servers are currently offline</h1>
    <p>Zyrex Editing is temporarily unavailable because the server cannot be reached. The site will automatically return when the server is online again.</p>
    <button type="button" onclick="location.reload()">Check again</button>
    <span class="note">This page checks the server automatically every 15 seconds.</span>
  </main>
  <script>setTimeout(function(){location.reload()},15000)</script>
</body>
</html>`;
}

function offlineResponse(request) {
  const url = new URL(request.url);
  const wantsJson = url.pathname.startsWith("/api/") ||
    request.headers.get("Accept")?.includes("application/json");
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Retry-After": "15",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Zyrex-Site-Gate": "offline",
    "X-Zyrex-Health-Reason": lastHealthReason,
  };

  if (wantsJson) {
    headers["Content-Type"] = "application/json; charset=UTF-8";
    return new Response(JSON.stringify({
      error: "service_unavailable",
      message: "The server is offline. The site is temporarily unavailable.",
    }), { status: 503, headers });
  }

  headers["Content-Type"] = "text/html; charset=UTF-8";
  headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  return new Response(request.method === "HEAD" ? null : maintenanceHtml(), {
    status: 503,
    headers,
  });
}

function isApiRequest(pathname) {
  return pathname === "/resources" ||
    pathname === "/resources.html" ||
    pathname.startsWith("/api/");
}

export default {
  async fetch(request, env) {
    if (!(await isServerAvailable(env))) {
      return offlineResponse(request);
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if ((url.hostname === "dl.zyrexediting.xyz" || isApiRequest(pathname)) && env.API) {
      return env.API.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
