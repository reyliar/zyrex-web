// Zyrex API Worker - Discord OAuth + Proxy to Bot
const DISCORD_API = "https://discord.com/api/v10";
const BOT_API = "https://zyre.wispbyte.org";
const VERIFY_BOT_API = "https://zyre.wispbyte.org";
const ADMIN_IDS = ["1421177012814614548", "1382421118098346174"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-User-ID, X-User-Name, X-User-Can-Upload, X-User-Is-Admin",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirect(url) {
  return Response.redirect(url, 302);
}

function parseSession(cookie) {
  if (!cookie) return null;
  const m = cookie.match(/zyrex_session=([^;]+)/);
  if (!m) return null;
  try { return JSON.parse(atob(m[1])); } catch { return null; }
}

function setCookie(data, maxAge = 86400) {
  const val = btoa(JSON.stringify(data));
  return `zyrex_session=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

function clearCookie() {
  return "zyrex_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure";
}

// ============ PAYHIP SCRAPER (Direct) ============
async function scrapePayhip(url) {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    });
    if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
    const html = await resp.text();

    // Title
    let title = (html.match(/<title>(.*?)<\/title>/i) || [])[1]?.replace(/[|–\-]\s*Payhip.*/i, "").trim() || "";
    title = title.replace(/&amp;/g, "&").replace(/&#39;/g, "'");

    // Description
    let description = (html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) || [])[1] || "";

    // OG Image
    const ogImage = (html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || [])[1] || "";

    // Price
    let price = "";
    const priceMatches = [
      html.match(/"price":\s*"?\$?([\d.]+)/i),
      html.match(/data-price="([^"]+)"/i),
      html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*\$?([\d.]+)\s*<\/span>/i),
    ];
    for (const m of priceMatches) {
      if (m?.[1]) { price = "$" + m[1]; break; }
    }

    // Thumbnails (product images)
    const thumbnails = new Set();
    const imgRegex = /<img[^>]+src="(https:\/\/[^"]*(?:payhip|pe56d)[^"]*\.(?:png|jpg|jpeg|gif|webp)[^"]*)"/gi;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      if (!m[1].includes("logo") && !m[1].includes("favicon") && !m[1].includes("avatar")) {
        thumbnails.add(m[1]);
      }
    }
    
    // Also try meta tags for images
    const metaImg = (html.match(/<meta\s+property="og:image:secure_url"\s+content="([^"]+)"/i) || [])[1];
    if (metaImg) thumbnails.add(metaImg);

    return {
      success: true,
      title,
      description,
      image: ogImage,
      price,
      thumbnails: [...thumbnails].slice(0, 8),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "storage.zyrexediting.xyz") {
      return fetch(request);
    }
    if (url.hostname === "dl.zyrexediting.xyz") {
      const newUrl = new URL(request.url);
      if (!newUrl.pathname.startsWith("/api/")) {
        if (newUrl.pathname === "/") {
          newUrl.pathname = "/download.html";
        }
        return env.ASSETS.fetch(newUrl);
      }
    }
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // LOGIN
      if (path === "/api/login") {
        const redirectTo = url.searchParams.get("redirect") || "/";
        const extraState = url.searchParams.get("state") || "";
        // Encode redirect + extra state into Discord's state param (JSON + base64url)
        const stateObj = { r: redirectTo, s: extraState };
        const state = btoa(JSON.stringify(stateObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
        const p = new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          redirect_uri: env.DISCORD_REDIRECT_URI,
          response_type: "code",
          scope: "identify email guilds.members.read",
          state: state,
        });
        return redirect(`${DISCORD_API}/oauth2/authorize?${p}`);
      }

      // LOGOUT
      if (path === "/api/logout") {
        return new Response(null, {
          status: 302,
          headers: { Location: "/", "Set-Cookie": clearCookie() },
        });
      }

      // ME
      if (path === "/api/me") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);

        let canUpload = session.canUpload || false;
        const isAdmin = ADMIN_IDS.includes(session.userId);
        
        // Fetch uploaders list from VPS API
        try {
          const upResp = await fetch(`${BOT_API}/api/guild/uploaders`);
          if (upResp.ok) {
            const data = await upResp.json();
            const uploaders = data.uploaders || [];
            canUpload = uploaders.includes(session.userId);
          }
        } catch (e) {
          console.error("VPS guild uploaders fetch failed:", e);
        }

        let responseHeaders = { ...corsHeaders };
        if (canUpload !== session.canUpload) {
          session.canUpload = canUpload;
          responseHeaders["Set-Cookie"] = setCookie(session);
        }

        return new Response(JSON.stringify({
          id: session.userId,
          username: session.username,
          global_name: session.displayName || session.username,
          avatar: session.avatar,
          can_upload: canUpload,
          is_admin: isAdmin,
        }), {
          status: 200,
          headers: { ...responseHeaders, "Content-Type": "application/json" }
        });
      }

      // AUTH CALLBACK
      if (path === "/api/auth/callback") {
        const code = url.searchParams.get("code");
        if (!code) return redirect("/?error=no_code");

        // Decode state to get redirect URL and extra state
        let redirectTo = "/";
        let extraState = "";
        try {
          const stateRaw = url.searchParams.get("state") || "";
          const stateJson = JSON.parse(atob(stateRaw.replace(/-/g, '+').replace(/_/g, '/')));
          redirectTo = stateJson.r || "/";
          extraState = stateJson.s || "";
        } catch(e) {}

        const body = new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: env.DISCORD_REDIRECT_URI,
        });

        const tr = await fetch(`${DISCORD_API}/oauth2/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        if (!tr.ok) return redirect("/?error=auth_failed");
        const token = await tr.json();

        const ur = await fetch(`${DISCORD_API}/users/@me`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!ur.ok) return redirect("/?error=user_fetch_failed");
        const du = await ur.json();

        let canUpload = ADMIN_IDS.includes(du.id);
        if (!canUpload) {
          try {
            const upResp = await fetch(`${BOT_API}/api/guild/uploaders`);
            if (upResp.ok) {
              const data = await upResp.json();
              const uploaders = data.uploaders || [];
              canUpload = uploaders.includes(du.id);
            }
          } catch (e) {
            console.error("VPS guild uploaders auth check failed:", e);
          }
        }

        // If this is a verify flow, call the verify bot API directly with real user IP
        if (redirectTo === "/verify" && extraState) {
          try {
            const userIp = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "";
            const userCountry = request.headers.get("CF-IPCountry") || "";
            const vResp = await fetch(`${VERIFY_BOT_API}/api/verify?userId=${du.id}&token=${encodeURIComponent(extraState)}&ip=${encodeURIComponent(userIp)}&country=${encodeURIComponent(userCountry)}`);
            const vData = await vResp.json();
            if (vData.success) {
              redirectTo = "/verify?result=success&name=" + encodeURIComponent(vData.display_name || du.global_name || du.username);
            } else {
              redirectTo = "/verify?result=error&msg=" + encodeURIComponent(vData.error || "Verification failed");
            }
          } catch(e) {
            redirectTo = "/verify?result=error&msg=Service+unavailable";
          }
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: redirectTo,
            "Set-Cookie": setCookie({
              userId: du.id, username: du.username,
              displayName: du.global_name || du.username,
              avatar: du.avatar, canUpload,
            }),
          },
        });
      }

      // GUILD STATS - Proxy to Bot
      if (path === "/api/guild/stats") {
        const resp = await fetch(`${BOT_API}/api/guild/stats`);
        if (resp.ok) return json(await resp.json());
        return json({ name: "Zyrex", member_count: 0, online_count: 0, channels_count: 0, roles_count: 0, boost_level: 0 });
      }

      // GUILD UPLOADERS - Proxy to Bot
      if (path === "/api/guild/uploaders") {
        const resp = await fetch(`${BOT_API}/api/guild/uploaders`);
        if (resp.ok) return json(await resp.json());
        return json({ uploaders: [] });
      }

      // GUILD MEMBERS - Proxy to Bot
      if (path === "/api/guild/members") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session || !ADMIN_IDS.includes(session.userId)) {
          return json({ error: "Unauthorized" }, 403);
        }
        const targetUrl = `${BOT_API}/api/guild/members`;
        const botResp = await fetch(targetUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": session.userId,
            "X-User-Name": session.username,
            "X-User-Can-Upload": session.canUpload ? "true" : "false",
            "X-User-Is-Admin": "true",
          }
        });
        const data = await botResp.text();
        try {
          return json(JSON.parse(data), botResp.status);
        } catch {
          return new Response(data, { status: botResp.status, headers: corsHeaders });
        }
      }

      // DISCORD USER PROFILE - Proxy to Bot
      if (path === "/api/discord-user") {
        const userId = url.searchParams.get("userId") || "1421177012814614548";
        if (!/^\d{17,20}$/.test(userId)) {
          return json({ success: false, error: "Invalid userId" }, 400);
        }
        const resp = await fetch(`${BOT_API}/api/discord-user?userId=${userId}`);
        if (resp.ok) return json(await resp.json());
        
        // Fallback: Query Discord REST directly if bot fails and token exists
        if (env.DISCORD_BOT_TOKEN) {
          const ur = await fetch(`${DISCORD_API}/users/${userId}`, {
            headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
          });
          if (ur.ok) {
            const userData = await ur.json();
            return json({ success: true, source: "discord-rest", user: userData });
          }
        }
        return json({ success: false, error: "User not found" });
      }

      // DELETE PRODUCT (admin only)
      if (path === "/api/products/delete" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session || !ADMIN_IDS.includes(session.userId)) {
          return json({ error: "Unauthorized" }, 403);
        }
        const { id } = await request.json();
        if (!id) return json({ error: "Product ID required" }, 400);
        // For now, respond success (DB integration later)
        return json({ success: true, message: `Product ${id} deleted` });
      }

      // ============ PAYHIP SCRAPER (Proxied to Bot) ============
      if (path === "/api/payhip/scrape") {
        const payhipUrl = url.searchParams.get("url");
        if (!payhipUrl || !payhipUrl.includes("payhip.com")) {
          return json({ success: false, error: "Invalid Payhip URL" }, 400);
        }
        const targetUrl = `${BOT_API}/api/payhip/scrape?url=${encodeURIComponent(payhipUrl)}`;
        const botResp = await fetch(targetUrl);
        const data = await botResp.text();
        try {
          return json(JSON.parse(data), botResp.status);
        } catch {
          return new Response(data, { status: botResp.status, headers: corsHeaders });
        }
      }

      // ============ BINARY DOWNLOAD STREAM (passthrough, no text parsing) ============
      if (path === "/api/downloads/download") {
        const session = parseSession(request.headers.get("Cookie"));
        const proxyHeaders = {};
        if (session) {
          proxyHeaders["X-User-ID"] = session.userId || "";
          proxyHeaders["X-User-Name"] = session.username || "";
        }
        const targetUrl = `${BOT_API}${path}${url.search}`;
        const botResp = await fetch(targetUrl, {
          method: "GET",
          headers: proxyHeaders,
        });
        // Pass binary response through directly without parsing
        return new Response(botResp.body, {
          status: botResp.status,
          headers: {
            "Content-Type": botResp.headers.get("Content-Type") || "application/octet-stream",
            "Content-Disposition": botResp.headers.get("Content-Disposition") || "",
            "Content-Length": botResp.headers.get("Content-Length") || "",
            ...corsHeaders,
          },
        });
      }

      // ============ BOT PROXY (SFTPGo, products, admin, cloud, downloads) ============
      if (path.startsWith("/api/sftpgo/") || path.startsWith("/api/products") || path.startsWith("/api/admin/") || path.startsWith("/api/cloud/") || path.startsWith("/api/downloads/") || path.startsWith("/api/hlx/") || path.startsWith("/api/verify")) {
        const session = parseSession(request.headers.get("Cookie"));
        const proxyHeaders = {
          "Content-Type": "application/json",
        };
        if (session) {
          proxyHeaders["X-User-ID"] = session.userId || "";
          proxyHeaders["X-User-Name"] = session.username || "";
          proxyHeaders["X-User-Can-Upload"] = session.canUpload ? "true" : "false";
          proxyHeaders["X-User-Is-Admin"] = ADMIN_IDS.includes(session.userId) ? "true" : "false";
        }
        const targetUrl = `${BOT_API}${path}${url.search}`;
        const body = request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined;
        const botResp = await fetch(targetUrl, {
          method: request.method,
          headers: proxyHeaders,
          body: body || undefined,
        });
        const data = await botResp.text();
        try {
          return json(JSON.parse(data), botResp.status);
        } catch {
          return new Response(data, { status: botResp.status, headers: corsHeaders });
        }
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error("Worker error:", err.message);
      return json({ error: "Internal error" }, 500);
    }
  },
};

