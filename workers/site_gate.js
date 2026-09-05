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
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --cherry: #ff2b52;
      --cherry-light: #ff6b8b;
      --dark: #060108;
      --panel: rgba(18, 9, 14, 0.92);
      --border: rgba(255, 43, 82, 0.28);
      --text: #f8f5f6;
      --muted: #a49da2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0 }
    html, body {
      min-height: 100vh;
      background: #060108;
      background-image: 
        radial-gradient(circle at 50% 15%, rgba(255, 43, 82, 0.18) 0%, transparent 60%),
        radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.12) 0%, transparent 50%);
      color: var(--text);
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      user-select: none;
    }
    .lock-card {
      width: min(640px, 100%);
      padding: 48px 38px;
      text-align: center;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 43, 82, 0.15);
      backdrop-filter: blur(24px);
      position: relative;
      overflow: hidden;
    }
    .lock-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, transparent, var(--cherry), var(--cherry-light), transparent);
    }
    .brand-lockup {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      text-decoration: none;
    }
    .brand-logo {
      width: 42px; height: 42px;
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(255, 43, 82, 0.35);
    }
    .brand-name {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #fff;
    }
    .brand-name span { color: var(--cherry-light); }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 8px 16px;
      border: 1px solid rgba(255, 77, 94, 0.4);
      border-radius: 999px;
      background: rgba(255, 43, 82, 0.12);
      color: #ff9ca6;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .dot-pulse {
      width: 9px; height: 9px;
      border-radius: 50%;
      background: #ff2b52;
      box-shadow: 0 0 0 0 rgba(255, 43, 82, 0.7);
      animation: pulse 1.8s infinite;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      margin: 12px 0 14px;
      font-size: clamp(1.8rem, 5vw, 2.5rem);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
      color: #fff;
    }
    p {
      margin: 0 auto 26px;
      max-width: 520px;
      color: var(--muted);
      font-size: 0.94rem;
      line-height: 1.7;
    }
    .action-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .btn-status {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 13px 26px;
      border: 1px solid var(--cherry);
      border-radius: 14px;
      background: linear-gradient(135deg, #ff2b52, #b81432);
      color: #fff;
      text-decoration: none;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 0.94rem;
      box-shadow: 0 8px 25px rgba(255, 43, 82, 0.35);
      transition: all 0.25s ease;
    }
    .btn-status:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(255, 43, 82, 0.5);
      border-color: var(--cherry-light);
    }
    .btn-retry {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 13px 22px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 0.94rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-retry:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.25);
    }
    .auto-note {
      display: block;
      margin-top: 24px;
      color: rgba(255, 255, 255, 0.4);
      font-size: 0.78rem;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 43, 82, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(255, 43, 82, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 43, 82, 0); }
    }
  </style>
</head>
<body>
  <div class="lock-card">
    <div class="brand-lockup">
      <img src="/assets/content.png" alt="Zyrex Logo" class="brand-logo" onerror="this.style.display='none'">
      <div class="brand-name">Zyrex<span>™</span> EDITING</div>
    </div>
    <br>
    <div class="status-badge">
      <span class="dot-pulse"></span> VPS OFFLINE · SISTEM KİLİTLENDİ
    </div>
    <h1>Sistem Geçici Olarak Kilitlendi</h1>
    <p>
      Zyrex VPS altyapısı ve bot servisimizle şu anda bağlantı kurulamıyor. Veri güvenliği ve kesintisiz deneyim sağlamak amacıyla sayfalara erişim Cloudflare Edge üzerinde geçici olarak durdurulmuştur.
    </p>
    <div class="action-group">
      <a href="/status" class="btn-status"><i class="fas fa-signal"></i> Sistem Durumunu Görüntüle (/status)</a>
      <button type="button" class="btn-retry" onclick="location.reload()"><i class="fas fa-rotate"></i> Yeniden Dene</button>
    </div>
    <span class="auto-note"><i class="fas fa-shield-halved"></i> Sayfa her 15 saniyede bir otomatik yenilenir. VPS aktif olduğunda kilit anında kalkar.</span>
  </div>
  <script>setTimeout(function(){ location.reload(); }, 15000);</script>
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
