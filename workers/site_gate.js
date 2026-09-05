const DEFAULT_HEALTH_URL = "https://storage.zyrexediting.xyz/health";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_ONLINE_CACHE_MS = 15000;
const DEFAULT_OFFLINE_CACHE_MS = 5000;

let healthState = {
  available: true, // Default optimistic until proven otherwise
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
        Accept: "application/json, text/plain, */*",
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

    try {
      const payload = await response.json();
      const status = String(payload?.status || "").toLowerCase();
      const available = !status || status === "ok" || status === "healthy" || status === "online" || response.status === 200;
      lastHealthReason = available ? "online" : `invalid-status-${status || "missing"}`;
      return available;
    } catch (_) {
      lastHealthReason = "online";
      return true;
    }
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
  <title>System Offline · Zyrex Editing</title>
  <link rel="icon" type="image/png" href="/assets/content.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: #09090b;
      background-image: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.03) 0%, transparent 70%);
      color: #fafafa;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      user-select: none;
      -webkit-font-smoothing: antialiased;
    }
    .lock-card {
      width: min(480px, 100%);
      padding: 38px 32px;
      text-align: center;
      background: #121215;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.7);
    }
    .brand-lockup {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 22px;
      text-decoration: none;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }
    .brand-name {
      font-size: 1.15rem;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    .brand-name sup {
      font-size: 0.65rem;
      color: #a1a1aa;
      font-weight: 500;
      margin-left: 1px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: 9999px;
      background: rgba(239, 68, 68, 0.08);
      color: #f87171;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
      margin-bottom: 18px;
    }
    .dot-pulse {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
      animation: pulse 1.8s infinite;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.55rem;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: -0.025em;
      color: #ffffff;
    }
    p {
      margin: 0 auto 24px;
      max-width: 400px;
      color: #a1a1aa;
      font-size: 0.88rem;
      line-height: 1.6;
    }
    .action-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border: 1px solid #ffffff;
      border-radius: 9px;
      background: #ffffff;
      color: #09090b;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.86rem;
      transition: all 0.15s ease;
    }
    .btn-status:hover {
      background: #e4e4e7;
      border-color: #e4e4e7;
      transform: translateY(-1px);
    }
    .btn-retry {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 16px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.04);
      color: #d4d4d8;
      font-weight: 500;
      font-size: 0.86rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-retry:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.22);
      color: #ffffff;
    }
    .auto-note {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 22px;
      color: #71717a;
      font-size: 0.74rem;
      font-family: 'JetBrains Mono', monospace;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
  </style>
</head>
<body>
  <div class="lock-card">
    <div class="brand-lockup">
      <img src="/assets/content.png" alt="Zyrex Logo" class="brand-logo" onerror="this.style.display='none'">
      <div class="brand-name">Zyrex<sup>™</sup></div>
    </div>
    <br>
    <div class="status-badge">
      <span class="dot-pulse"></span> SYSTEM TEMPORARILY LOCKED
    </div>
    <h1>System Temporarily Locked</h1>
    <p>
      The core infrastructure is currently unreachable. Access has been locked at the edge to protect user data and ensure platform security.
    </p>
    <div class="action-group">
      <a href="/status" class="btn-status"><i class="fas fa-chart-line"></i> View System Status</a>
      <button type="button" class="btn-retry" onclick="location.reload()"><i class="fas fa-rotate"></i> Retry</button>
    </div>
    <div class="auto-note">
      <i class="fas fa-shield-halved"></i> Auto-refreshing in <span id="countdown">15</span>s &bull; Edge Lock Active
    </div>
  </div>
  <script>
    var sec = 15;
    var el = document.getElementById('countdown');
    var timer = setInterval(function() {
      sec--;
      if (el) el.innerText = sec;
      if (sec <= 0) {
        clearInterval(timer);
        location.reload();
      }
    }, 1000);
  </script>
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
      message: "Zyrex VPS / Bot server is offline. Please check /status for real-time telemetry.",
      status_page: "https://zyrexediting.xyz/status"
    }), { status: 503, headers });
  }

  headers["Content-Type"] = "text/html; charset=UTF-8";
  return new Response(request.method === "HEAD" ? null : maintenanceHtml(), {
    status: 503,
    headers,
  });
}

function isApiRequest(pathname) {
  return pathname.startsWith("/api/");
}

function isAdminPublishPage(pathname) {
  return pathname === "/admin-publish" || pathname === "/admin-publish.html";
}

function adminForbiddenResponse() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin access required · Zyrex</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;padding:24px;background:#080506;color:#f8f5f6;font-family:system-ui,sans-serif;text-align:center}main{max-width:520px;padding:36px;border:1px solid #32252a;border-radius:20px;background:#120d0f}h1{margin:0 0 10px}p{margin:0;color:#aa9da2;line-height:1.6}a{display:inline-block;margin-top:22px;padding:10px 14px;border-radius:10px;background:#9f1d3a;color:white;text-decoration:none;font-weight:700}</style></head><body><main><h1>Admin access required</h1><p>This publishing page is only available to Zyrex administrators.</p><a href="/settings">Return to settings</a></main></body></html>`, {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function authorizeAdminPublish(request, env) {
  if (!env.API) return new Response("Authentication service unavailable", { status: 503 });

  const meUrl = new URL(request.url);
  meUrl.pathname = "/api/me";
  meUrl.search = "";
  const authResponse = await env.API.fetch(new Request(meUrl.toString(), {
    method: "GET",
    headers: request.headers,
  }));

  if (authResponse.status === 401) {
    const loginUrl = new URL("/api/login", request.url);
    loginUrl.searchParams.set("redirect", "/admin-publish");
    return Response.redirect(loginUrl.toString(), 302);
  }

  if (!authResponse.ok) return adminForbiddenResponse();
  try {
    const user = await authResponse.json();
    return user?.is_admin ? null : adminForbiddenResponse();
  } catch (_) {
    return adminForbiddenResponse();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Status page, Status API, and static assets needed to render them
    const isStatusPage = pathname === "/status" || pathname === "/status.html";
    const isStatusApi = pathname.startsWith("/api/status") || pathname === "/api/health";
    const isStaticAsset = pathname.startsWith("/assets/") || 
                          pathname.startsWith("/css/") || 
                          pathname.startsWith("/js/") || 
                          pathname === "/favicon.ico" ||
                          pathname.endsWith(".png") ||
                          pathname.endsWith(".svg") ||
                          pathname.endsWith(".jpg") ||
                          pathname.endsWith(".jpeg") ||
                          pathname.endsWith(".woff2") ||
                          pathname.endsWith(".css") ||
                          pathname.endsWith(".js");

    // Real-time VPS health check at Cloudflare Edge
    const serverAvailable = await isServerAvailable(env);

    // ============ UNBREAKABLE VPS OFFLINE EDGE LOCKDOWN ============
    if (!serverAvailable) {
      if (isStatusPage) {
        return env.ASSETS.fetch(request);
      }
      if (isStatusApi && env.API) {
        return env.API.fetch(request);
      }
      if (isStaticAsset) {
        return env.ASSETS.fetch(request);
      }
      // Deny access to all other pages and return high-security 503 Maintenance Screen
      return offlineResponse(request);
    }

    // ============ NORMAL TRAFFIC (VPS ONLINE) ============
    if (isAdminPublishPage(pathname)) {
      const denied = await authorizeAdminPublish(request, env);
      if (denied) return denied;
    }

    if (url.hostname === "dl.zyrexediting.xyz") {
      if (isApiRequest(pathname) && env.API) {
        return env.API.fetch(request);
      }
      if (pathname === "/" || pathname === "/download" || pathname === "/download.html") {
        return env.ASSETS.fetch("https://zyrexediting.xyz/download.html" + url.search);
      }
      return env.ASSETS.fetch(request);
    }


    if (isApiRequest(pathname) && env.API) {
      return env.API.fetch(request);
    }

    // Static site assets (HTML, CSS, JS) served from Cloudflare CDN
    return env.ASSETS.fetch(request);
  },
};
