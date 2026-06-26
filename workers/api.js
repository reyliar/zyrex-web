// Zyrex API Worker - Discord OAuth, Guild Stats, User Profiles

const DISCORD_API = "https://discord.com/api/v10";
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

// ============ SFTPGO HELPERS ============
const SFTPGO_API = "http://localhost:8080/api/v2";
let SFTPGO_TOKEN = null;
let SFTPGO_TOKEN_EXPIRY = 0;

async function getSFTPGoToken(env) {
  if (SFTPGO_TOKEN && Date.now() < SFTPGO_TOKEN_EXPIRY) return SFTPGO_TOKEN;
  
  const resp = await fetch(`${SFTPGO_API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env.SFTPGO_ADMIN_USER || "admin", password: env.SFTPGO_ADMIN_PASS || "admin" }),
  });
  if (!resp.ok) throw new Error("SFTPGo auth failed");
  const data = await resp.json();
  SFTPGO_TOKEN = data.access_token;
  SFTPGO_TOKEN_EXPIRY = Date.now() + (data.expires_in - 60) * 1000;
  return SFTPGO_TOKEN;
}

async function sftpgoFetch(env, endpoint, options = {}) {
  const token = await getSFTPGoToken(env);
  const resp = await fetch(`${SFTPGO_API}${endpoint}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  return resp;
}

// ============ PAYHIP SCRAPER ============
async function scrapePayhip(url) {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    const html = await resp.text();

    const title = (html.match(/<title>(.*?)<\/title>/i) || [])[1]?.replace(/[|–-]\s*Payhip.*/i, "").trim() || "";
    const description = (html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) || [])[1] || "";
    const ogImage = (html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || [])[1] || "";
    const price = (html.match(/data-price="([^"]+)"/i) || html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)</i) || [])[1] || "";

    // Find all images
    const imgRegex = /<img[^>]+src="(https:\/\/[^"]*payhip[^"]*\.(?:png|jpg|jpeg|gif|webp)[^"]*)"/gi;
    const thumbnails = [];
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      if (!thumbnails.includes(m[1]) && !m[1].includes("logo")) thumbnails.push(m[1]);
    }

    // Category detection
    const categories = [];
    const catRegex = /<a[^>]*href="\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
    let cm;
    while ((cm = catRegex.exec(html)) !== null) {
      const txt = cm[1].trim();
      if (txt && !categories.includes(txt) && txt.length < 30) categories.push(txt);
    }

    return { success: true, title, description, image: ogImage, price, thumbnails: thumbnails.slice(0, 10), categories: categories.slice(0, 5) };
  } catch (e) {
    return { success: false, error: e.message };
  }
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

      // GUILD STATS
      if (path === "/api/guild/stats") {
        // Fetch guild with counts
        const gr = await fetch(`${DISCORD_API}/guilds/${env.GUILD_ID}?with_counts=true`, {
          headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
        });
        if (!gr.ok) {
          return json({ name: "Zyrex", member_count: 0, online_count: 0, channels_count: 0, roles_count: 0, boost_level: 0 });
        }
        const g = await gr.json();

        // Fetch channels count
        let channelsCount = 0;
        try {
          const cr = await fetch(`${DISCORD_API}/guilds/${env.GUILD_ID}/channels`, {
            headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
          });
          if (cr.ok) {
            const channels = await cr.json();
            channelsCount = Array.isArray(channels) ? channels.length : 0;
          }
        } catch (e) { console.error("Channels fetch:", e); }

        // Fetch roles count (roles might not be in guild response)
        let rolesCount = 0;
        if (g.roles && Array.isArray(g.roles)) {
          rolesCount = g.roles.length;
        } else {
          try {
            const rr = await fetch(`${DISCORD_API}/guilds/${env.GUILD_ID}/roles`, {
              headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
            });
            if (rr.ok) {
              const roles = await rr.json();
              rolesCount = Array.isArray(roles) ? roles.length : 0;
            }
          } catch (e) { console.error("Roles fetch:", e); }
        }

        return json({
          name: g.name || "Zyrex",
          icon: g.icon || "",
          member_count: g.approximate_member_count || g.member_count || 0,
          online_count: g.approximate_presence_count || 0,
          channels_count: channelsCount,
          roles_count: rolesCount,
          boost_level: g.premium_tier || 0,
        });
      }

      // DISCORD USER PROFILE (for Team section)
      if (path === "/api/discord-user") {
        const userId = url.searchParams.get("userId") || "1421177012814614548";
        if (!/^\d{17,20}$/.test(userId)) {
          return json({ success: false, error: "Invalid userId" }, 400);
        }

        const ur = await fetch(`${DISCORD_API}/users/${userId}`, {
          headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
            "User-Agent": "DiscordBot (https://zyrexediting.xyz, 1.0)",
          },
        });
        if (!ur.ok) return json({ success: false, error: "User not found" });

        const userData = await ur.json();
        return json({
          success: true,
          source: "discord-rest",
          user: userData,
          presence: null,
        });
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

      // ============ PAYHIP SCRAPER ============
      if (path === "/api/payhip/scrape") {
        const payhipUrl = url.searchParams.get("url");
        if (!payhipUrl || !payhipUrl.includes("payhip.com")) {
          return json({ success: false, error: "Invalid Payhip URL" }, 400);
        }
        const data = await scrapePayhip(payhipUrl);
        return json(data);
      }

      // ============ SFTPGO ACCOUNTS ============
      // Get or create SFTPGo account for logged-in user
      if (path === "/api/sftpgo/account") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        
        if (!session.canUpload && !ADMIN_IDS.includes(session.userId)) {
          return json({ error: "You don't have upload permission" }, 403);
        }

        const username = `u${session.userId}`;
        try {
          // Check if account exists
          let gr = await sftpgoFetch(env, `/users/${username}`);
          if (!gr.ok) {
            // Create account
            gr = await sftpgoFetch(env, "/users", {
              method: "POST",
              body: JSON.stringify({
                username,
                password: session.userId.slice(-12),
                status: 1,
                permissions: { "/": ["*"] },
                home_dir: username,
                description: `${session.username} (${session.userId})`,
                max_sessions: 5,
                quota_size: 1073741824, // 1GB
              }),
            });
            if (gr.ok) {
              return json({ success: true, message: "Account created", username, created: true });
            }
            const err = await gr.text();
            return json({ success: false, error: "Failed to create account: " + err }, 500);
          }
          const user = await gr.json();
          return json({ success: true, username, created: false, user });
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
      }

      // List user's files in SFTPGo
      if (path === "/api/sftpgo/files") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        if (!session.canUpload && !ADMIN_IDS.includes(session.userId)) {
          return json({ error: "No upload permission" }, 403);
        }

        const username = `u${session.userId}`;
        const dir = url.searchParams.get("path") || "/";
        try {
          const resp = await sftpgoFetch(env, `/folders`);
          if (!resp.ok) return json({ success: false, error: "Failed to list files" }, 500);
          const folders = await resp.json();
          
          // Get files in user's directory
          const cleanDir = dir.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
          return json({ success: true, path: cleanDir, folders: folders.filter(f => f.name?.startsWith(username + "/") || f.name === username) });
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
      }

      // ============ PRODUCT SUBMISSION ============
      if (path === "/api/products/submit" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        if (!session.canUpload && !ADMIN_IDS.includes(session.userId)) {
          return json({ error: "No upload permission" }, 403);
        }

        const product = await request.json();
        const productId = `preset-${Date.now().toString(36)}`;
        product.id = productId;
        product.author_id = session.userId;
        product.author = session.username;
        product.status = "pending";
        product.created_at = new Date().toISOString();

        try {
          // Save to SFTPGo as JSON in user's directory
          const username = `u${session.userId}`;
          const productJson = JSON.stringify(product, null, 2);
          
          await sftpgoFetch(env, `/user/files/${username}/${productId}.json`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
          });

          // Also save a pending submission record
          const submission = {
            id: productId,
            product,
            status: "pending",
            submitted_at: new Date().toISOString(),
          };
          
          await sftpgoFetch(env, `/user/files/${username}/.submissions/${productId}.json`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
          });

          return json({ success: true, id: productId, message: "Product submitted for review" });
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
      }

      // List user's submitted products
      if (path === "/api/products/my") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        
        const username = `u${session.userId}`;
        try {
          const resp = await sftpgoFetch(env, `/user/files/${username}/.submissions/`);
          if (!resp.ok) return json({ success: true, products: [] });
          
          const files = await resp.json();
          const products = [];
          for (const file of (files || [])) {
            if (file.name.endsWith(".json")) {
              try {
                const fr = await sftpgoFetch(env, `/user/files/${username}/.submissions/${file.name}`);
                if (fr.ok) {
                  const data = await fr.json();
                  products.push(data);
                }
              } catch {}
            }
          }
          return json({ success: true, products });
        } catch (e) {
          return json({ success: true, products: [] });
        }
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error("Worker error:", err.message);
      return json({ error: "Internal error" }, 500);
    }
  },
};

