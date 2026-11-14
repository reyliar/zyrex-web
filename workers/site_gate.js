const DEFAULT_HEALTH_URL = "https://storage.zyrexediting.xyz/health";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_ONLINE_CACHE_MS = 30000;
const DEFAULT_OFFLINE_CACHE_MS = 5000;

// The invite belongs to the API worker, which rotates it whenever Discord kills the
// link or joins spike. Reading it here keeps every page on the live invite without
// editing 40 files, and the client script fixes links rendered after load.
const INVITE_CACHE_MS = 60 * 1000;
const INVITE_URL_PATTERN = /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,64}\/?$/i;
let inviteCache = { url: "", at: 0 };

async function currentDiscordInvite(env) {
  if (!env.API) return "";
  if (inviteCache.url && Date.now() - inviteCache.at < INVITE_CACHE_MS) return inviteCache.url;
  try {
    const response = await env.API.fetch(new Request("https://zyrexediting.xyz/api/discord/invite", {
      headers: { Accept: "application/json" },
    }));
    if (!response.ok) return inviteCache.url;
    const data = await response.json().catch(() => null);
    const url = data && typeof data.url === "string" ? data.url : "";
    if (!INVITE_URL_PATTERN.test(url)) return inviteCache.url;
    inviteCache = { url, at: Date.now() };
    return url;
  } catch (_) {
    return inviteCache.url;
  }
}

async function withClientErrorMonitor(env, response) {
  if (!response || !response.headers.get("Content-Type")?.toLowerCase().includes("text/html")) return response;
  const invite = await currentDiscordInvite(env);
  let rewriter = new HTMLRewriter().on("head", {
    element(element) {
      element.append('<script src="/js/error-monitor.js" defer></script>', { html: true });
      element.append('<script src="/js/discord-invite.js" defer></script>', { html: true });
    },
  });
  if (invite) {
    // A selector the runtime refuses must never take the page down with it.
    try {
      rewriter = rewriter.on("a[href]", {
        element(element) {
          const href = element.getAttribute("href");
          if (href && INVITE_URL_PATTERN.test(href.trim())) element.setAttribute("href", invite);
        },
      });
    } catch (_) {}
  }
  return rewriter.transform(response);
}

async function fetchSiteAssets(env, request) {
  return withClientErrorMonitor(env, await env.ASSETS.fetch(request));
}

const ERROR_STATUS_TEXT = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  410: "Gone",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

// Every error code renders the same gray page: only the number, a way home and the
// Zyrex lockup. The download host gets the same page without the site chrome.
async function errorPageResponse(env, request, code, options = {}) {
  const status = Number(code) || 404;
  const target = new URL(options.bare === true ? "/error-bare" : "/error", "https://zyrexediting.xyz");
  target.searchParams.set("code", String(status));
  try {
    const page = await env.ASSETS.fetch(new Request(target.toString(), { headers: { Accept: "text/html" } }));
    if (!page || !page.ok) throw new Error("error page unavailable");
    const rendered = request && request.method === "HEAD" ? page : await withClientErrorMonitor(env, page);
    const headers = new Headers(rendered.headers);
    headers.set("Content-Type", "text/html; charset=UTF-8");
    headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(request && request.method === "HEAD" ? null : rendered.body, {
      status,
      statusText: ERROR_STATUS_TEXT[status] || "Error",
      headers,
    });
  } catch (_) {
    return new Response(String(status), {
      status,
      headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "no-store" },
    });
  }
}

async function dlNotFound(env, request) {
  return errorPageResponse(env, request, 404, { bare: true });
}

function isDlPageAsset(pathname) {
  return pathname.startsWith("/assets/") || pathname.startsWith("/js/") ||
    /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|map)$/i.test(pathname);
}
const ZYREX_MASTER_KEY = "zyrex_master_k9x7v2m4q8p1w5e6r3t0y9u8i7o6a5s4d";

function extractApiKey(request, url = null) {
  if (!request) return "";
  let key = request.headers.get("X-Zyrex-Key") ||
            request.headers.get("X-API-Key") ||
            request.headers.get("x-zyrex-key") ||
            request.headers.get("x-api-key") ||
            "";
  if (!key) {
    const auth = request.headers.get("Authorization") || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      key = auth.slice(7).trim();
    }
  }
  if (!key) {
    try {
      const parsedUrl = url || (request.url ? new URL(request.url) : null);
      if (parsedUrl && parsedUrl.searchParams) {
        key = parsedUrl.searchParams.get("api_key") || parsedUrl.searchParams.get("key") || "";
      }
    } catch (_) {}
  }
  return key;
}

function isMasterApiKey(key, env = null) {
  if (!key) return false;
  const master = env?.ZYREX_MASTER_KEY || ZYREX_MASTER_KEY;
  return key === master;
}

let healthState = {
  available: true, // Default optimistic until proven otherwise
  checkedAt: 0,
  initialized: false,
};
let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 5; // Require at least 5 consecutive probe failures before declaring offline
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
      consecutiveFailures++;
      if (consecutiveFailures < FAILURE_THRESHOLD) {
        return true; // Soft tolerance for blips, maintaining public uptime
      }
      return false;
    }

    try {
      const payload = await response.json();
      const status = String(payload?.status || "").toLowerCase();
      const available = !status || status === "ok" || status === "healthy" || status === "online" || status === "degraded" || response.status === 200;
      lastHealthReason = available ? "online" : `invalid-status-${status || "missing"}`;
      if (available) {
        consecutiveFailures = 0;
        return true;
      } else {
        consecutiveFailures++;
        return consecutiveFailures < FAILURE_THRESHOLD;
      }
    } catch (_) {
      consecutiveFailures = 0;
      lastHealthReason = "online";
      return true;
    }
  } catch (error) {
    lastHealthReason = "request-error";
    console.warn("Server health probe failed", error?.message || String(error));
    consecutiveFailures++;
    if (consecutiveFailures < FAILURE_THRESHOLD) {
      return true; // Keep site available during transient network fluctuation
    }
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

async function offlineResponse(env, request) {
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
      message: "Some services are temporarily unavailable. Please check /status for the latest service updates.",
      status_page: "https://zyrexediting.xyz/status"
    }), { status: 503, headers });
  }

  const bare = url.hostname === "dl.zyrexediting.xyz";
  return errorPageResponse(env, request, 503, { bare });
}

function isApiRequest(pathname) {
  return pathname.startsWith("/api/");
}

function normalizeRoutePath(pathname) {
  let p = (pathname || "").toLowerCase().trim();
  if (p.endsWith("/") && p.length > 1) {
    p = p.slice(0, -1);
  }
  return p;
}

function isSessionRequiredPage(pathname) {
  const p = normalizeRoutePath(pathname);
  return (
    p === "/bookmarks" || p === "/bookmarks.html" ||
    p === "/profile-edit" || p === "/profile-edit.html"
  );
}

function isUploaderRequiredPage(pathname) {
  const p = normalizeRoutePath(pathname);
  return (
    p === "/upload" || p === "/upload.html" ||
    p === "/upload-audio" || p === "/upload-audio.html"
  );
}

function isAdminRequiredPage(pathname) {
  const p = normalizeRoutePath(pathname);
  return (
    p === "/admin-publish" || p === "/admin-publish.html" ||
    p === "/admin-upload" || p === "/admin-upload.html" ||
    p === "/admin-vt-scan" || p === "/admin-vt-scan.html" ||
    p === "/admin-scenepacks" || p === "/admin-scenepacks.html" ||
    p === "/upload-scenepack" || p === "/upload-scenepack.html"
  );
}

function redirectToLogin(requestUrl, redirectPath) {
  const loginUrl = new URL("/api/login", requestUrl);
  loginUrl.searchParams.set("redirect", redirectPath);
  return Response.redirect(loginUrl.toString(), 302);
}

async function adminForbiddenResponse(env, request) {
  return errorPageResponse(env, request, 403);
}

async function uploaderForbiddenResponse(env, request) {
  return errorPageResponse(env, request, 403);
}

async function authorizeProtectedPage(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const isSessionReq = isSessionRequiredPage(pathname);
  const isUploaderReq = isUploaderRequiredPage(pathname);
  const isAdminReq = isAdminRequiredPage(pathname);

  if (!isSessionReq && !isUploaderReq && !isAdminReq) {
    return null; // Public page, allow
  }

  const apiKey = extractApiKey(request, url);
  if (isMasterApiKey(apiKey, env)) {
    return null; // Master API key authorized unconditionally
  }

  const cookie = request.headers.get("Cookie") || "";
  const fullRedirectPath = pathname + (url.search || "");

  // Fast check: if no session cookie exists at all, redirect immediately
  if (!cookie.includes("zyrex_session=")) {
    return redirectToLogin(request.url, fullRedirectPath);
  }

  if (!env.API) {
    return new Response("Authentication service unavailable", { status: 503 });
  }

  const meUrl = new URL("/api/me", request.url);
  let authResponse;
  try {
    authResponse = await env.API.fetch(new Request(meUrl.toString(), {
      method: "GET",
      headers: request.headers,
    }));
  } catch (e) {
    return new Response("Authentication service connection error", { status: 503 });
  }

  if (authResponse.status === 401) {
    return redirectToLogin(request.url, fullRedirectPath);
  }

  if (!authResponse.ok) {
    return isSessionReq ? redirectToLogin(request.url, fullRedirectPath) : await adminForbiddenResponse(env, request);
  }

  let user = null;
  try {
    user = await authResponse.json();
  } catch (_) {
    return redirectToLogin(request.url, fullRedirectPath);
  }

  if (!user || !user.id) {
    return redirectToLogin(request.url, fullRedirectPath);
  }

  if (isAdminReq) {
    return user.is_admin ? null : await adminForbiddenResponse(env, request);
  }

  if (isUploaderReq) {
    return (user.can_upload || user.is_admin) ? null : await uploaderForbiddenResponse(env, request);
  }

  return null; // Authorized
}

// ── Public profiles ────────────────────────────────────────────────────────────
// Every member profile lives at /@handle. There is no such file on disk, so the
// shell page is served for it and the client renders the profile from the URL.
const PROFILE_ROUTE_PATTERN = /^\/@([A-Za-z0-9._-]{1,32})\/?$/;
// Each feed post has its own page so replies live there instead of in the timeline.
const POST_ROUTE_PATTERN = /^\/post\/([A-Za-z0-9-]{16,40})\/?$/;
// Short post links carry a sequence number instead of a uuid.
const FEED_POST_ROUTE_PATTERN = /^\/feed\/post\/(\d{1,9})\/?$/;

// Turns a sequence number into the post it belongs to, or an empty string.
async function resolveFeedPostId(env, seq) {
  if (!env.API) return "";
  try {
    const apiUrl = new URL("/api/feed/post", "https://zyrexediting.xyz");
    apiUrl.searchParams.set("n", String(seq));
    const response = await env.API.fetch(new Request(apiUrl.toString(), { headers: { Accept: "application/json" } }));
    if (!response.ok) return "";
    const payload = await response.json().catch(() => null);
    const postId = String((payload && payload.post_id) || "");
    return /^[a-f0-9-]{16,40}$/i.test(postId) ? postId.toLowerCase() : "";
  } catch (_) {
    return "";
  }
}
const CRAWLER_UA_PATTERN = /discordbot|twitterbot|facebookexternalhit|whatsapp|telegrambot|slackbot|linkedinbot|embedly|pinterest|redditbot|googlebot|bingbot|yandex|duckduckbot|applebot|skypeuripreview|vkshare|w3c_validator|bluesky|cardyb|mastodon|iframely|opengraph|viber|kakaotalk|tumblr|naver|yeti|daumoa|bingpreview|bot\b|crawler|spider/i;

function isCrawlerRequest(request) {
  const ua = request.headers.get("User-Agent") || "";
  return CRAWLER_UA_PATTERN.test(ua);
}

function escapeHtmlAttribute(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatProfileCount(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${Math.round(number / 100000) / 10}M`;
  if (number >= 1000) return `${Math.round(number / 100) / 10}K`;
  return String(number);
}

// A profile link pasted into Discord should preview properly, so crawlers get a
// minimal document with real Open Graph tags instead of the client-rendered shell.
async function profileOpenGraphResponse(env, request, url, handle) {
  let profile = null;
  try {
    const apiUrl = new URL("/api/profile", url.origin);
    apiUrl.searchParams.set("handle", handle);
    const response = await env.API.fetch(new Request(apiUrl.toString(), {
      headers: { Accept: "application/json" },
    }));
    if (response.ok) {
      const payload = await response.json();
      profile = payload && payload.profile ? payload.profile : null;
    }
  } catch (_) {}

  if (!profile || profile.private || profile.restricted) {
    return null;
  }

  const stats = profile.stats || {};
  const counts = profile.counts || {};
  const title = `${profile.name} (@${profile.handle}) | Zyrex`;
  const bits = [];
  if (profile.tier_label) bits.push(profile.tier_label);
  if (counts.resources) bits.push(`${formatProfileCount(counts.resources)} resources`);
  if (stats.downloads) bits.push(`${formatProfileCount(stats.downloads)} downloads`);
  if (counts.followers) bits.push(`${formatProfileCount(counts.followers)} followers`);
  const description = profile.bio
    ? `${profile.bio.slice(0, 150)} · ${bits.join(" · ")}`
    : `${bits.join(" · ") || "Zyrex member"} on Zyrex`;
  const image = /^https?:\/\//i.test(String(profile.avatar || ""))
    ? profile.avatar
    : `${url.origin}${profile.avatar || "/assets/content.png"}`;
  const target = `${url.origin}/@${profile.handle}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlAttribute(title)}</title>
<meta name="description" content="${escapeHtmlAttribute(description)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Zyrex">
<meta property="og:url" content="${escapeHtmlAttribute(target)}">
<meta property="og:title" content="${escapeHtmlAttribute(title)}">
<meta property="og:description" content="${escapeHtmlAttribute(description)}">
<meta property="og:image" content="${escapeHtmlAttribute(image)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtmlAttribute(title)}">
<meta name="twitter:description" content="${escapeHtmlAttribute(description)}">
<meta name="twitter:image" content="${escapeHtmlAttribute(image)}">
<link rel="icon" type="image/png" href="/assets/content.png">
<meta http-equiv="refresh" content="0;url=${escapeHtmlAttribute(target)}">
</head>
<body>
<h1>${escapeHtmlAttribute(title)}</h1>
<p>${escapeHtmlAttribute(description)}</p>
<img src="${escapeHtmlAttribute(image)}" alt="${escapeHtmlAttribute(profile.name)}">
<p><a href="${escapeHtmlAttribute(target)}">View the profile on Zyrex</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=120, s-maxage=600",
    },
  });
}

// A post link pasted into Discord should preview the post itself, so crawlers get
// Open Graph tags built from the post payload instead of the empty shell.
async function postOpenGraphResponse(env, request, url, postId) {
  let post = null;
  let author = null;
  try {
    const apiUrl = new URL("/api/post", url.origin);
    apiUrl.searchParams.set("id", postId);
    const response = await env.API.fetch(new Request(apiUrl.toString(), {
      headers: { Accept: "application/json" },
    }));
    if (response.ok) {
      const payload = await response.json();
      post = payload && payload.post ? payload.post : null;
      author = payload && payload.author ? payload.author : null;
    }
  } catch (_) {}

  if (!post) {
    return new Response("<!DOCTYPE html><html><head><title>Post not found | Zyrex</title></head><body><p>That post is no longer available.</p></body></html>", {
      status: 404,
      headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" },
    });
  }

  const target = `${url.origin}/post/${postId}`;
  const name = (author && (author.name || author.handle)) || "Zyrex member";
  const title = `${name} on Zyrex`;
  const body = String(post.text || "").replace(/\s+/g, " ").trim();
  const description = body ? body.slice(0, 180) : "A post from the Zyrex community feed.";
  const media = Array.isArray(post.media) ? post.media.filter(Boolean)[0] : "";
  const image = media
    ? (/^https?:\/\//i.test(media) ? media : `${url.origin}${media}`)
    : (author && /^https?:\/\//i.test(String(author.avatar || "")) ? author.avatar : `${url.origin}${(author && author.avatar) || "/assets/og-image.png"}`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlAttribute(title)}</title>
<meta name="description" content="${escapeHtmlAttribute(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Zyrex">
<meta property="og:url" content="${escapeHtmlAttribute(target)}">
<meta property="og:title" content="${escapeHtmlAttribute(title)}">
<meta property="og:description" content="${escapeHtmlAttribute(description)}">
<meta property="og:image" content="${escapeHtmlAttribute(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtmlAttribute(title)}">
<meta name="twitter:description" content="${escapeHtmlAttribute(description)}">
<meta name="twitter:image" content="${escapeHtmlAttribute(image)}">
<link rel="icon" type="image/png" href="/assets/content.png">
<meta http-equiv="refresh" content="0;url=${escapeHtmlAttribute(target)}">
</head>
<body>
<h1>${escapeHtmlAttribute(title)}</h1>
<p>${escapeHtmlAttribute(description)}</p>
<img src="${escapeHtmlAttribute(image)}" alt="Post media">
<p><a href="${escapeHtmlAttribute(target)}">View the post on Zyrex</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}

const RESOURCE_CATEGORY_LABELS = {
  "after-effects": "After Effects",
  "premiere-pro": "Premiere Pro",
  "photoshop": "Photoshop",
  "video-star": "Video Star",
  "topaz-labs": "Topaz Labs",
};
const RESOURCE_TYPE_LABELS = {
  preset: "preset",
  plugin: "plugin",
  audio: "audio",
  software: "software",
};
// Scraped records often carry a placeholder instead of real text.
const EMPTY_DESCRIPTION_PATTERN = /^(?:no description\.?|n\/?a|none|-+|\.+)$/i;

// Product thumbnails are stored as absolute CDN urls, but records can also carry a
// site-relative path or the literal strings "undefined"/"null".
function resourceImageUrl(value, origin) {
  const image = String(value || "").trim();
  if (!image || /^(undefined|null|false)$/i.test(image)) return "";
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("/")) return `${origin}${image}`;
  return "";
}

// IMDb/Amazon posters are served at any width through the file-name suffix, so a
// social card asks for a large variant instead of the small catalogue thumbnail.
function socialImageUrl(value, origin, width) {
  const image = resourceImageUrl(value, origin);
  if (!image) return "";
  if (/m\.media-amazon\.com\/images\//i.test(image)) {
    return image.replace(/_V1_[^/]*?\.(jpg|jpeg|png)$/i, `_V1_FMjpg_UX${width}_.$1`)
      .replace(/_V1_\.(jpg|jpeg|png)$/i, `_V1_FMjpg_UX${width}_.$1`);
  }
  return image;
}

// Product descriptions contain pasted markdown/html and long line breaks. Discord
// and Twitter only render the first couple of lines, so flatten them first.
function openGraphDescription(value, limit) {
  const text = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:[a-z]+|#\d+);/gi, " ")
    .replace(/\s+/g, " ")
    // Uploaded descriptions often lose the space after punctuation ("pack!Text"), which
    // makes the embed unreadable. Only uppercase follows get one, so urls stay intact.
    .replace(/([!?:;.])(?=[A-Z])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

// A resource permalink pasted into Discord should preview the resource itself, so
// crawlers get Open Graph tags built from the product payload.
async function resourceOpenGraphResponse(env, request, url, resourceId) {
  let product = null;
  try {
    const apiUrl = new URL("/api/products", url.origin);
    apiUrl.searchParams.set("id", resourceId);
    const response = await env.API.fetch(new Request(apiUrl.toString(), {
      headers: { Accept: "application/json" },
    }));
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      if (payload && payload.id) product = payload;
    }
  } catch (_) {}

  if (!product) return null;

  const type = String(product.type || "").toLowerCase();
  // Scene packs and the dedicated product pages have their own routes, so a preview
  // must never advertise /leak while the visitor is bounced elsewhere.
  if (type === "scenepack") return null;
  const canonicalPath = type === "audio"
    ? `/product-audio?id=${encodeURIComponent(product.id)}`
    : (type === "plugin" || type === "software")
      ? `/product?id=${encodeURIComponent(product.id)}`
      : `/leak?id=${encodeURIComponent(product.id)}`;

  const name = String(product.name || "Resource").trim();
  const typeLabel = RESOURCE_TYPE_LABELS[type] || "resource";
  const categoryLabel = RESOURCE_CATEGORY_LABELS[String(product.category || "").toLowerCase()] || "";
  const subject = `${categoryLabel} ${typeLabel}`.trim();
  const creator = String(product.creator_nickname || product.creator_username || "").trim();
  const stats = [];
  const downloads = Number(product.downloads) || 0;
  const views = Number(product.views) || 0;
  if (downloads > 0) stats.push(`${formatProfileCount(downloads)} ${downloads === 1 ? "download" : "downloads"}`);
  if (views > 0) stats.push(`${formatProfileCount(views)} ${views === 1 ? "view" : "views"}`);

  const title = `${name} | Zyrex`;
  const rawDescription = String(product.description || product.desc || "").trim();
  const summary = EMPTY_DESCRIPTION_PATTERN.test(rawDescription) ? "" : openGraphDescription(rawDescription, 170);
  const description = summary
    ? `${summary} · ${[subject, ...stats].join(" · ")}`
    : `Free ${subject}${creator ? ` by ${creator}` : ""} on Zyrex${stats.length ? ` · ${stats.join(" · ")}` : ""}`;
  const image = resourceImageUrl(product.thumbnail || product.cdn_thumbnail, url.origin) || `${url.origin}/assets/og-image.png`;
  const target = `${url.origin}${canonicalPath}`;
  const published = String(product.created_at || "").trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlAttribute(title)}</title>
<meta name="description" content="${escapeHtmlAttribute(description)}">
<link rel="canonical" href="${escapeHtmlAttribute(target)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zyrex">
<meta property="og:url" content="${escapeHtmlAttribute(target)}">
<meta property="og:title" content="${escapeHtmlAttribute(title)}">
<meta property="og:description" content="${escapeHtmlAttribute(description)}">
<meta property="og:image" content="${escapeHtmlAttribute(image)}">
<meta property="og:image:alt" content="${escapeHtmlAttribute(name)}">
${published ? `<meta property="og:updated_time" content="${escapeHtmlAttribute(published)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtmlAttribute(title)}">
<meta name="twitter:description" content="${escapeHtmlAttribute(description)}">
<meta name="twitter:image" content="${escapeHtmlAttribute(image)}">
<link rel="icon" type="image/png" href="/assets/content.png">
<meta http-equiv="refresh" content="0;url=${escapeHtmlAttribute(canonicalPath)}">
</head>
<body>
<h1>${escapeHtmlAttribute(name)}</h1>
<p>${escapeHtmlAttribute(description)}</p>
<img src="${escapeHtmlAttribute(image)}" alt="${escapeHtmlAttribute(name)}">
<p><a href="${escapeHtmlAttribute(canonicalPath)}">Download ${escapeHtmlAttribute(name)} on Zyrex</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      // Resource details change through uploads and edits, never per request.
      "Cache-Control": "public, max-age=300, s-maxage=1800",
    },
  });
}

// Scene packs live in their own catalogue, so a shared /scenepack link needs its own
// preview. A link can point at a pack (?id=) or at a title page (?key=), and both
// previews lead with the production name, its synopsis and its artwork.
async function scenepackOpenGraphTarget(env, url, options) {
  const packId = String(options.packId || "").trim();
  const titleKey = String(options.titleKey || "").trim();
  const call = async (path) => {
    try {
      const apiUrl = new URL(path, url.origin);
      const response = await env.API.fetch(new Request(apiUrl.toString(), {
        headers: { Accept: "application/json" },
      }));
      if (!response.ok) return null;
      return await response.json().catch(() => null);
    } catch (_) {
      return null;
    }
  };

  if (packId) {
    const payload = await call(`/api/scenepacks/${encodeURIComponent(packId)}`);
    const pack = payload && payload.item;
    if (!pack || !pack.id) return null;
    const movie = pack.movie || {};
    const production = String(movie.title || pack.title || "Scenepack").trim();
    const character = String(pack.character || "").trim();
    const stats = [];
    if (Number(pack.clip_count) > 0) stats.push(`${pack.clip_count} clips`);
    if (pack.quality) stats.push(pack.quality);
    if (pack.encoding) stats.push(pack.encoding);
    return {
      canonicalPath: `/scenepack?id=${encodeURIComponent(pack.id)}`,
      production,
      heading: character && character !== production ? `${production} — ${character}` : production,
      subtitle: pack.title || "",
      description: String(movie.plot || pack.description || ""),
      stats,
      year: movie.year || "",
      genres: Array.isArray(movie.genres) ? movie.genres : [],
      rating: movie.rating || "",
      image: pack.backdrop || pack.thumbnail || movie.poster || movie.backdrop || "",
      typeLabel: pack.type_label || "Scenepack",
    };
  }

  if (titleKey) {
    const payload = await call(`/api/scenepacks/title?key=${encodeURIComponent(titleKey)}`);
    const title = payload && payload.title;
    if (!title || !title.name) return null;
    const stats = payload.stats || {};
    const bits = [];
    if (Number(stats.packs) > 0) bits.push(`${stats.packs} scenepack${Number(stats.packs) === 1 ? "" : "s"}`);
    if (Number(stats.downloads) > 0) bits.push(`${formatProfileCount(stats.downloads)} downloads`);
    return {
      canonicalPath: `/scenepack?key=${encodeURIComponent(title.key || titleKey)}`,
      production: String(title.name).trim(),
      heading: String(title.name).trim(),
      subtitle: title.type_label || "",
      description: String(title.plot || ""),
      stats: bits,
      year: title.year || "",
      genres: Array.isArray(title.genres) ? title.genres : [],
      rating: title.rating || "",
      image: title.avatar || title.backdrop || title.poster || "",
      typeLabel: title.type_label || "Scenepacks",
    };
  }

  return null;
}

function scenepackOpenGraphResponse(env, url, target) {
  if (!target) return null;
  const meta = [target.year, target.genres.slice(0, 3).join(", ")].filter(Boolean).join(" · ");
  const summary = openGraphDescription(target.description, 170);
  const tail = [...(meta ? [meta] : []), ...target.stats].filter(Boolean).join(" · ");
  const description = summary
    ? (tail ? `${summary} · ${tail}` : summary)
    : `${target.production}${target.year ? ` (${target.year})` : ""}${target.stats.length ? ` · ${target.stats.join(" · ")}` : ""} on Zyrex`;
  const image = socialImageUrl(target.image, url.origin, 1200) || `${url.origin}/assets/og-image.png`;
  const canonical = `${url.origin}${target.canonicalPath}`;
  const title = `${target.heading} | Zyrex Scenepacks`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlAttribute(title)}</title>
<meta name="description" content="${escapeHtmlAttribute(description)}">
<link rel="canonical" href="${escapeHtmlAttribute(canonical)}">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="Zyrex">
<meta property="og:url" content="${escapeHtmlAttribute(canonical)}">
<meta property="og:title" content="${escapeHtmlAttribute(target.heading)}">
<meta property="og:description" content="${escapeHtmlAttribute(description)}">
<meta property="og:image" content="${escapeHtmlAttribute(image)}">
<meta property="og:image:alt" content="${escapeHtmlAttribute(target.production)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtmlAttribute(target.heading)}">
<meta name="twitter:description" content="${escapeHtmlAttribute(description)}">
<meta name="twitter:image" content="${escapeHtmlAttribute(image)}">
<meta name="theme-color" content="#050407">
<link rel="icon" type="image/png" href="/assets/content.png">
<meta http-equiv="refresh" content="0;url=${escapeHtmlAttribute(target.canonicalPath)}">
</head>
<body>
<h1>${escapeHtmlAttribute(target.production)}</h1>
${target.subtitle ? `<h2>${escapeHtmlAttribute(target.subtitle)}</h2>\n` : ""}<p>${escapeHtmlAttribute(description)}</p>
<img src="${escapeHtmlAttribute(image)}" alt="${escapeHtmlAttribute(target.production)}">
<p><a href="${escapeHtmlAttribute(target.canonicalPath)}">Open ${escapeHtmlAttribute(target.production)} scenepacks on Zyrex</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=300, s-maxage=1800",
    },
  });
}

// Plugin and software downloads moved into the category lists, so a product page for one of
// them no longer exists. Old shared links are redirected to the list that can download it.
const PLUGIN_CATEGORY_PAGES = {
  software: "software",
  "adobe-plugin": "adobe",
  "ae-plugins": "adobe",
  "pr-plugins": "adobe",
  "ofx-plugin": "ofx",
  avx: "avx",
  extensions: "extensions",
  scripts: "extensions",
  "extensions-scripts": "extensions",
};
const PLUGIN_CATEGORY_MEMO_MS = 5 * 60 * 1000;
const pluginCategoryMemo = new Map();

async function pluginCategoryTarget(env, productId) {
  if (!env.API || !/^[A-Za-z0-9_-]{3,80}$/.test(productId)) return "";
  const cached = pluginCategoryMemo.get(productId);
  if (cached && Date.now() - cached.at < PLUGIN_CATEGORY_MEMO_MS) return cached.target;
  let target = "";
  try {
    const apiUrl = new URL("/api/products", "https://zyrexediting.xyz");
    apiUrl.searchParams.set("id", productId);
    const response = await env.API.fetch(new Request(apiUrl.toString(), {
      headers: { Accept: "application/json" },
    }));
    if (response.ok) {
      const product = await response.json().catch(() => null);
      const type = String((product && product.type) || "").toLowerCase();
      if (type === "plugin" || type === "software") {
        const page = PLUGIN_CATEGORY_PAGES[String((product && product.category) || "").toLowerCase()];
        target = page ? `/plugins/${page}` : "/plugins";
      }
    }
  } catch (_) {
    target = "";
  }
  pluginCategoryMemo.set(productId, { at: Date.now(), target });
  if (pluginCategoryMemo.size > 800) {
    const cutoff = Date.now() - PLUGIN_CATEGORY_MEMO_MS;
    for (const [key, value] of pluginCategoryMemo) {
      if (value.at < cutoff) pluginCategoryMemo.delete(key);
    }
  }
  return target;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Plugin/software product pages are retired in favour of the category lists.
    if ((pathname === "/product" || pathname === "/product.html") && env.API) {
      const productId = String(url.searchParams.get("id") || "").trim();
      if (productId) {
        const target = await pluginCategoryTarget(env, productId);
        if (target) return Response.redirect(`${url.origin}${target}`, 301);
      }
    }

    // Permanent 301 redirects for rebranded catalogue routes
    if (pathname === "/resources" || pathname === "/resources.html") {
      return Response.redirect(`${url.origin}/leaks${url.search}`, 301);
    }
    if (pathname === "/resource" || pathname === "/resource.html") {
      return Response.redirect(`${url.origin}/leak${url.search}`, 301);
    }
    if (pathname === "/presets" || pathname === "/presets.html") {
      return Response.redirect(`${url.origin}/leaks${url.search}`, 301);
    }
    if (pathname === "/preset" || pathname === "/preset.html") {
      return Response.redirect(`${url.origin}/leak${url.search}`, 301);
    }
    if (["/more", "/more.html"].includes(pathname)) {
      return Response.redirect(`${url.origin}/audio${url.search}`, 301);
    }
    // The retired per-product scenepack page now lives in the scenepack catalogue.
    if (["/product-scenepack", "/product-scenepack.html"].includes(pathname)) {
      return Response.redirect(`${url.origin}/scenepacks${url.search}`, 301);
    }

    // Member profiles: /@handle renders the profile shell, and crawlers get OG tags
    // so a shared profile link previews properly.
    const profileRoute = PROFILE_ROUTE_PATTERN.exec(pathname);
    if (profileRoute && env.ASSETS) {
      if (isCrawlerRequest(request)) {
        const ogResponse = await profileOpenGraphResponse(env, request, url, profileRoute[1].toLowerCase());
        if (ogResponse) return ogResponse;
      }
      // Pages canonicalises `.html` to the extensionless route, so fetch the canonical
      // path to avoid handing the browser a redirect that would drop the handle.
      const shellUrl = new URL("/profile", url.origin);
      shellUrl.search = url.search;
      return fetchSiteAssets(env, new Request(shellUrl.toString(), request));
    }

    // Short links live at /feed/post/<n> and resolve through the sequence index.
    const feedPostRoute = FEED_POST_ROUTE_PATTERN.exec(pathname);
    if (feedPostRoute && env.ASSETS) {
      if (isCrawlerRequest(request)) {
        const postId = await resolveFeedPostId(env, feedPostRoute[1]);
        if (postId) {
          const ogResponse = await postOpenGraphResponse(env, request, url, postId);
          if (ogResponse) return ogResponse;
        }
      }
      const shellUrl = new URL("/post", url.origin);
      return fetchSiteAssets(env, new Request(shellUrl.toString(), request));
    }

    // Individual feed posts live at /post/<id> so a post has its own page for replies.
    const postRoute = POST_ROUTE_PATTERN.exec(pathname);
    if (postRoute && env.ASSETS) {
      if (isCrawlerRequest(request)) {
        const ogResponse = await postOpenGraphResponse(env, request, url, postRoute[1].toLowerCase());
        if (ogResponse) return ogResponse;
      }
      const shellUrl = new URL("/post", url.origin);
      shellUrl.search = url.search;
      return fetchSiteAssets(env, new Request(shellUrl.toString(), request));
    }

    // Resource permalinks live at /leak?id=<resource-id>; crawlers get real Open
    // Graph tags so a shared download link previews with its own title and thumbnail.
    if ((pathname === "/leak" || pathname === "/leak.html") && env.ASSETS && isCrawlerRequest(request)) {
      const resourceId = String(url.searchParams.get("id") || "").trim();
      if (resourceId) {
        const ogResponse = await resourceOpenGraphResponse(env, request, url, resourceId);
        if (ogResponse) return ogResponse;
      }
    }

    // Scenepack links: /scenepack?id=<pack> and /scenepack?key=<title>. Crawlers get
    // real Open Graph tags so a shared link previews the production, its synopsis and
    // its artwork instead of the generic site card.
    if ((pathname === "/scenepack" || pathname === "/scenepack.html") && env.ASSETS && isCrawlerRequest(request)) {
      const scenepackId = String(url.searchParams.get("id") || "").trim();
      const scenepackKey = String(url.searchParams.get("key") || "").trim();
      if (scenepackId || scenepackKey) {
        const target = await scenepackOpenGraphTarget(env, url, { packId: scenepackId, titleKey: scenepackKey })
          .catch(() => null);
        const ogResponse = scenepackOpenGraphResponse(env, url, target);
        if (ogResponse) return ogResponse;
      }
    }

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

    const providedApiKey = extractApiKey(request, url);
    const hasMasterKey = isMasterApiKey(providedApiKey, env);

    const forceEdgeLock = env.FORCE_EDGE_LOCK === "true" || env.MAINTENANCE_MODE === "true";

    // If manual edge lock or emergency maintenance is explicitly activated, lock public access
    if (forceEdgeLock) {
      if (hasMasterKey && isApiRequest(pathname) && env.API) {
        return env.API.fetch(request);
      }
      if (isStatusPage || isStaticAsset) {
        return fetchSiteAssets(env, request);
      }
      if (isStatusApi && env.API) {
        return env.API.fetch(request);
      }
      return offlineResponse(env, request);
    }

    // Public pages, assets, APIs, and downloads must not wait on the VPS health probe.
    // Probe only for pages that require the remote server for upload/admin writes.
    const needsRemoteServer = isUploaderRequiredPage(pathname) || isAdminRequiredPage(pathname);
    if (needsRemoteServer && !hasMasterKey && !(await isServerAvailable(env))) {
      return offlineResponse(env, request);
    }

    const authDenied = await authorizeProtectedPage(request, env);
    if (authDenied) return authDenied;

    const isDlDomain = url.hostname === "dl.zyrexediting.xyz";

    // Allow API requests through dl domain
    if (isDlDomain && isApiRequest(pathname) && env.API) {
      return env.API.fetch(request);
    }

    if (isDlDomain) {
      // The download hostname is a single-purpose host. It must never expose
      // the main site's route fallback or redirect visitors onto other pages.
      const token = url.searchParams.get("token");
      if (pathname === "/" && token) {
        return Response.redirect("https://dl.zyrexediting.xyz/download" + url.search, 302);
      }
      const isDlPage = pathname === "/download" || pathname === "/download.html";
      if (isDlPage) {
        if (!token) return dlNotFound(env, request);
        // `.html` gets normalized back to `/download` by asset html_handling;
        // fetch the canonical extensionless route to avoid a redirect loop on dl.
        return fetchSiteAssets(env, new Request("https://zyrexediting.xyz/download" + url.search, request));
      }
      if (isDlPageAsset(pathname)) {
        return fetchSiteAssets(env, new Request("https://zyrexediting.xyz" + pathname + url.search, request));
      }
      return dlNotFound(env, request);
    }

    if (isApiRequest(pathname) && env.API) {
      return env.API.fetch(request);
    }

    // Static site assets (HTML, CSS, JS) served from Cloudflare CDN
    return fetchSiteAssets(env, request);
  },
};
