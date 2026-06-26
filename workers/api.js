// Zyrex API Worker - Discord OAuth + Proxy to Bot
const DISCORD_API = "https://discord.com/api/v10";
const BOT_API = "https://zyrex.wispbyte.org";
const ADMIN_IDS = ["1421177012814614548", "1382421118098346174"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // LOGIN
      if (path === "/api/login") {
        const p = new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          redirect_uri: env.DISCORD_REDIRECT_URI,
          response_type: "code",
          scope: "identify email guilds.members.read",
          prompt: "none",
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
        return json({
          id: session.userId,
          username: session.username,
          global_name: session.displayName || session.username,
          avatar: session.avatar,
          can_upload: session.canUpload || false,
          is_admin: ADMIN_IDS.includes(session.userId),
        });
      }

      // AUTH CALLBACK
      if (path === "/api/auth/callback") {
        const code = url.searchParams.get("code");
        if (!code) return redirect("/?error=no_code");

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
            const mr = await fetch(`${DISCORD_API}/guilds/${env.GUILD_ID}/members/${du.id}`, {
              headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
            });
            if (mr.ok) {
              const member = await mr.json();
              canUpload = member.roles?.includes(env.UPLOAD_ROLE_ID);
            }
          } catch (e) { console.error("Guild check:", e); }
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: "/",
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

      // DISCORD USER PROFILE - Proxy to Bot
      if (path === "/api/discord-user") {
        const userId = url.searchParams.get("userId") || "1421177012814614548";
        if (!/^\d{17,20}$/.test(userId)) {
          return json({ success: false, error: "Invalid userId" }, 400);
        }
        const resp = await fetch(`${BOT_API}/api/discord-user?userId=${userId}`);
        if (resp.ok) return json(await resp.json());
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

      // ============ BOT PROXY ENDPOINTS ============
      // All SFTPGo, Payhip, product operations are handled by the bot
      
      if (path === "/api/payhip/scrape" || 
          path.startsWith("/api/sftpgo/") || 
          path.startsWith("/api/products/")) {
        const targetUrl = `${BOT_API}${path}${url.search}`;
        const body = request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined;
        const botResp = await fetch(targetUrl, {
          method: request.method,
          headers: { "Content-Type": "application/json" },
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

