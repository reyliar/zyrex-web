// Zyrex API Worker - Discord OAuth + SFTPGo Direct + Proxy to Bot
const DISCORD_API = "https://discord.com/api/v10";
const BOT_API = "https://zyre.wispbyte.org";
const VERIFY_BOT_API = "https://zyre.wispbyte.org";
const SFTPGO_API = "https://storage.zyrexediting.xyz/api/v2";
const ADMIN_IDS = ["1421177012814614548", "1382421118098346174"];

// Cached SFTPGo admin token
let sftpgoToken = null;
let sftpgoTokenExpiry = 0;

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

// ============ SFTPGO DIRECT API HELPERS ============
async function sftpgoAuth(env) {
  if (sftpgoToken && Date.now() < sftpgoTokenExpiry) {
    return sftpgoToken;
  }
  const user = env.SFTPGO_ADMIN_USER || "reyliar";
  const pass = env.SFTPGO_ADMIN_PASS || "";
  if (!pass) {
    console.error("SFTPGO_ADMIN_PASS secret not configured");
    return null;
  }
  try {
    const authHeader = btoa(`${user}:${pass}`);
    const resp = await fetch(`${SFTPGO_API}/token`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "User-Agent": "ZyrexWorker/1.0",
      },
    });
    if (!resp.ok) {
      console.error("SFTPGo auth failed:", resp.status);
      return null;
    }
    const data = await resp.json();
    sftpgoToken = data.access_token;
    // Expire 1 minute before actual expiry
    sftpgoTokenExpiry = Date.now() + (data.expires_in ? (data.expires_in - 60) * 1000 : 300000);
    return sftpgoToken;
  } catch (e) {
    console.error("SFTPGo auth error:", e.message);
    return null;
  }
}

// Find SFTPGo user by Discord ID.
// 1) Direct SFTPGo lookup (description field, username convention)
// 2) Fallback: ask bot API for the mapping
async function findSftpgoUserByDiscordId(discordId, env) {
  const token = await sftpgoAuth(env);
  if (token) {
    try {
      // List all users and search by description for discord:ID pattern
      const resp = await fetch(`${SFTPGO_API}/users?limit=200`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "ZyrexWorker/1.0",
        },
      });
      if (resp.ok) {
        const users = await resp.json();
        // First: try exact description match "discord:DISCORD_ID"
        let match = users.find(u => u.description && u.description.includes(`discord:${discordId}`));
        // Second: try username convention uDISCORD_ID
        if (!match) match = users.find(u => u.username === `u${discordId}`);
        // Third: try any user whose username contains the discord ID
        if (!match) match = users.find(u => u.username && u.username.includes(discordId));
        if (match) return match;
      }
    } catch (e) {
      console.error("SFTPGo find user error:", e.message);
    }
  }
  
  // Fallback: try bot API for Discord→SFTPGo mapping
  try {
    const botResp = await fetch(`${BOT_API}/api/sftpgo/lookup?userId=${discordId}`);
    if (botResp.ok) {
      const data = await botResp.json();
      if (data.success && data.username) {
        // Found via bot, now get full user from SFTPGo
        const token2 = await sftpgoAuth(env);
        if (token2) {
          try {
            const userResp = await fetch(`${SFTPGO_API}/users/${encodeURIComponent(data.username)}`, {
              headers: { "Authorization": `Bearer ${token2}`, "User-Agent": "ZyrexWorker/1.0" },
            });
            if (userResp.ok) return await userResp.json();
          } catch(e) {}
        }
        // Return minimal user object from bot data
        return { username: data.username, description: data.display_name || "", status: 1, quota_size: 0, used_quota_size: 0 };
      }
    }
  } catch (e) {
    console.error("Bot API lookup fallback error:", e.message);
  }
  
  return null;
}

// Get SFTPGo user account details (quota, status, etc.)
// Also auto-syncs Discord ID into SFTPGo description for future lookups
async function getSftpgoAccount(discordId, env) {
  const user = await findSftpgoUserByDiscordId(discordId, env);
  if (!user) return { success: false, error: "No SFTPGo cloud account linked to your Discord profile. Contact an admin." };
  
  // Auto-sync: ensure Discord ID is in description field for future direct lookups
  if (user.description && !user.description.includes(`discord:${discordId}`)) {
    // Fire and forget - don't block the response
    const token = await sftpgoAuth(env);
    if (token) {
      const newDesc = user.description + ` | discord:${discordId}`;
      fetch(`${SFTPGO_API}/users/${encodeURIComponent(user.username)}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "ZyrexWorker/1.0",
        },
        body: JSON.stringify({ ...user, description: newDesc }),
      }).catch(e => console.error("Auto-sync description failed:", e.message));
    }
  } else if (!user.description) {
    // No description - set one with Discord ID
    const token = await sftpgoAuth(env);
    if (token) {
      const newDesc = `discord:${discordId}`;
      fetch(`${SFTPGO_API}/users/${encodeURIComponent(user.username)}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "ZyrexWorker/1.0",
        },
        body: JSON.stringify({ ...user, description: newDesc }),
      }).catch(e => console.error("Auto-sync description failed:", e.message));
    }
  }
  
  // Extract Discord info from description
  let displayName = "";
  if (user.description) {
    const parts = user.description.split("|");
    displayName = parts[0]?.trim() || "";
  }
  
  return {
    success: true,
    username: user.username,
    display_name: displayName || user.username,
    user: {
      username: user.username,
      description: user.description || "",
      status: user.status,
      quota_size: user.quota_size || 0,
      used_quota_size: user.used_quota_size || 0,
      used_quota_files: user.used_quota_files || 0,
      home_dir: user.home_dir || "",
    },
  };
}

// List files in a user's SFTPGo directory
async function listSftpgoFiles(discordId, path, env) {
  const user = await findSftpgoUserByDiscordId(discordId, env);
  if (!user) return { success: false, error: "No SFTPGo cloud account linked to your Discord profile." };
  
  const token = await sftpgoAuth(env);
  if (!token) return { success: false, error: "SFTPGo authentication failed" };
  
  try {
    // Normalize path
    let browsePath = path || "/";
    if (!browsePath.startsWith("/")) browsePath = "/" + browsePath;
    
    // Use SFTPGo filesystem API to browse user's directory
    const resp = await fetch(`${SFTPGO_API}/folders?path=${encodeURIComponent(browsePath)}&username=${encodeURIComponent(user.username)}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "ZyrexWorker/1.0",
      },
    });
    if (!resp.ok) {
      // Fallback: try user-specific folder listing
      const resp2 = await fetch(`${SFTPGO_API}/users/${encodeURIComponent(user.username)}/folders?path=${encodeURIComponent(browsePath)}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "ZyrexWorker/1.0",
        },
      });
      if (!resp2.ok) {
        return { success: true, files: [], folders: [], note: `API returned status ${resp2.status}` };
      }
      const data = await resp2.json();
      return {
        success: true,
        files: (data.files || []).map(f => ({
          name: f.name || "unknown",
          path: f.path || browsePath + (f.name || ""),
          size: f.size || 0,
          last_modified: f.last_modified || f.updated_at || null,
        })),
        folders: (data.folders || data.dirs || []).map(d => ({
          name: typeof d === "string" ? d : (d.name || d.path || "unknown"),
        })),
      };
    }
    const data = await resp.json();
    return {
      success: true,
      files: (data.files || []).map(f => ({
        name: f.name || "unknown",
        path: f.path || browsePath + (f.name || ""),
        size: f.size || 0,
        last_modified: f.last_modified || f.updated_at || null,
      })),
      folders: (data.folders || data.dirs || []).map(d => ({
        name: typeof d === "string" ? d : (d.name || d.path || "unknown"),
      })),
    };
  } catch (e) {
    console.error("SFTPGo list files error:", e.message);
    return { success: false, error: "Failed to list directory: " + e.message };
  }
}

// Scan user's cloud for detected resources (EDITOR/RESOURCE pattern)
async function scanDetectedResources(discordId, env) {
  const user = await findSftpgoUserByDiscordId(discordId, env);
  if (!user) return { success: false, error: "No SFTPGo cloud account linked to your Discord profile." };
  
  const token = await sftpgoAuth(env);
  if (!token) return { success: false, error: "SFTPGo authentication failed" };
  
  try {
    // List top-level folders (editors)
    const rootResp = await fetch(`${SFTPGO_API}/folders?path=/&username=${encodeURIComponent(user.username)}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "ZyrexWorker/1.0",
      },
    });
    if (!rootResp.ok) {
      return { success: true, resources: [] };
    }
    const rootData = await rootResp.json();
    const topFolders = rootData.folders || rootData.dirs || [];
    
    const resources = [];
    for (const folder of topFolders) {
      const editorName = typeof folder === "string" ? folder : (folder.name || folder.path || "");
      if (!editorName || editorName === "." || editorName === "..") continue;
      
      // List sub-folders (resources) inside each editor
      const subPath = "/" + editorName;
      const subResp = await fetch(`${SFTPGO_API}/folders?path=${encodeURIComponent(subPath)}&username=${encodeURIComponent(user.username)}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "ZyrexWorker/1.0",
        },
      });
      if (!subResp.ok) continue;
      const subData = await subResp.json();
      const subFolders = subData.folders || subData.dirs || [];
      const subFiles = subData.files || [];
      
      // If there are files directly in the editor folder, skip (not a resource pattern)
      for (const sub of subFolders) {
        const resourceName = typeof sub === "string" ? sub : (sub.name || sub.path || "");
        if (!resourceName || resourceName === "." || resourceName === "..") continue;
        
        // List files inside the resource folder
        const resPath = `${subPath}/${resourceName}`;
        const resResp = await fetch(`${SFTPGO_API}/folders?path=${encodeURIComponent(resPath)}&username=${encodeURIComponent(user.username)}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "User-Agent": "ZyrexWorker/1.0",
          },
        });
        if (!resResp.ok) continue;
        const resData = await resResp.json();
        const files = (resData.files || []).map(f => ({
          name: f.name || "unknown",
          path: f.path || `${resPath}/${f.name}`,
          size: f.size || 0,
        }));
        
        resources.push({
          editor: editorName,
          resource: resourceName,
          files: files,
        });
      }
      
      // Also handle the case where editor has files directly + subfolders
      if (subFiles.length > 0 && subFolders.length === 0) {
        // Editor with only files = the editor name IS the resource
        resources.push({
          editor: editorName,
          resource: editorName,
          files: subFiles.map(f => ({
            name: f.name || "unknown",
            path: f.path || `${subPath}/${f.name}`,
            size: f.size || 0,
          })),
        });
      }
    }
    
    return { success: true, resources };
  } catch (e) {
    console.error("SFTPGo scan resources error:", e.message);
    return { success: false, error: "Failed to scan cloud: " + e.message };
  }
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
        // Fetch from Pages deployment (ASSETS binding not available in standalone Worker)
        return fetch(`https://main.zyrexweb.pages.dev${newUrl.pathname}${newUrl.search}`);
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

        // Build avatar URL
        let avatarUrl = "";
        if (session.avatar) {
          const ext = session.avatar.startsWith("a_") ? "gif" : "png";
          avatarUrl = `https://cdn.discordapp.com/avatars/${session.userId}/${session.avatar}.${ext}?size=256`;
        } else if (session.userId) {
          // Default Discord avatar
          const defIdx = (BigInt(session.userId) >> 22n) % 6n;
          avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defIdx}.png`;
        }

        return new Response(JSON.stringify({
          id: session.userId,
          username: session.username,
          global_name: session.displayName || session.username,
          avatar: session.avatar,
          avatar_url: avatarUrl,
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

      // ============ DOWNLOAD: Validate Token (local file API) ============
      if (path === "/api/downloads/validate") {
        const token = url.searchParams.get("token");
        if (!token) return json({ error: "Token required" }, 400);
        try {
          // Use peek=1 so token is NOT consumed here — only download consumes it
          const apiUrl = `https://storage.zyrexediting.xyz/api/files/validate?token=${encodeURIComponent(token)}&peek=1`;
          const resp = await fetch(apiUrl, { headers: { "X-Auth-Token": "zyrex-files-api-2026" } });
          if (resp.ok) return json(await resp.json());
        } catch (e) { console.error("Token validation error:", e.message); }
        return json({ success: false, error: "Invalid or expired token" }, 404);
      }

      // ============ DOWNLOAD: Request Token (local file API) ============
      if (path.startsWith("/api/downloads/request-token/")) {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        const productId = path.split("/api/downloads/request-token/")[1];
        if (!productId) return json({ error: "Product ID required" }, 400);
        
        let filePath = "";
        try {
          // Fetch product info from VPS bot with 5s timeout
          const prodResp = await fetch(`${BOT_API}/api/products?id=${productId}`, {
            signal: AbortSignal.timeout(5000),
          });
          if (prodResp.ok) {
            const prod = await prodResp.json();
            filePath = prod.file_path || "";
          }
        } catch (e) {
          console.error("Failed to fetch product from bot:", e.message);
        }
        
        // Build list of paths to try: BOT_API path first, then production fallback
        const pathsToTry = [];
        if (filePath) pathsToTry.push(filePath);
        pathsToTry.push(`production/${productId}`);
        
        let lastError = "";
        for (const tryPath of pathsToTry) {
          try {
            const apiUrl = `https://storage.zyrexediting.xyz/api/files/request-token`;
            const resp = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Auth-Token": "zyrex-files-api-2026" },
              body: JSON.stringify({
                discord_id: session.userId,
                product_id: productId,
                file_path: tryPath,
              }),
              signal: AbortSignal.timeout(10000),
            });
            if (resp.ok) return json(await resp.json());
            lastError = await resp.text();
            // If not found, try next path; otherwise break and return error
            if (!lastError.includes("not found") && !lastError.includes("Resource not found")) {
              break;
            }
          } catch (e) {
            lastError = e.message;
          }
        }
        
        return json({ success: false, error: "Token generation failed: " + lastError }, 500);
      }
      // ============ DOWNLOAD: Binary File Stream (local file API) ============
      if (path === "/api/downloads/download") {
        const token = url.searchParams.get("token");
        if (!token) return json({ error: "Token required" }, 400);
        let apiUrl = `https://storage.zyrexediting.xyz/api/files/download?token=${encodeURIComponent(token)}`;
        const selectedFiles = url.searchParams.get("files");
        if (selectedFiles) apiUrl += `&files=${encodeURIComponent(selectedFiles)}`;
        const title = url.searchParams.get("title");
        if (title) apiUrl += `&title=${encodeURIComponent(title)}`;
        const resp = await fetch(apiUrl, { headers: { "X-Auth-Token": "zyrex-files-api-2026" } });
        if (!resp.ok) return json({ success: false, error: "Download failed" }, resp.status);
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            "Content-Type": resp.headers.get("Content-Type") || "application/octet-stream",
            "Content-Disposition": resp.headers.get("Content-Disposition") || "attachment",
            "Content-Length": resp.headers.get("Content-Length") || "",
            ...corsHeaders,
          },
        });
      }

      // ============ SFTPGO: Account Info (bot first, fallback to direct) ============
      if (path === "/api/sftpgo/account") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        // Try bot API first (has richer data like display_name, discord links)
        try {
          const botResp = await fetch(`${BOT_API}/api/sftpgo/account`, {
            headers: {
              "X-User-ID": session.userId || "",
              "X-User-Name": session.username || "",
              "X-User-Can-Upload": session.canUpload ? "true" : "false",
              "X-User-Is-Admin": ADMIN_IDS.includes(session.userId) ? "true" : "false",
            },
          });
          if (botResp.ok) {
            const data = await botResp.json();
            if (data.success) return json(data);
          }
        } catch (e) { console.error("Bot account fetch failed:", e.message); }
        // Fallback: direct SFTPGo lookup
        const result = await getSftpgoAccount(session.userId, env);
        return json(result, result.success ? 200 : 404);
      }

      // ============ SFTPGO: List Files (local file API server) ============
      if (path === "/api/sftpgo/files") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        const browsePath = url.searchParams.get("path") || "/";
        try {
          const apiUrl = `https://storage.zyrexediting.xyz/api/files/list?token=zyrex-files-api-2026&discord_id=${session.userId}&path=${encodeURIComponent(browsePath)}`;
          const resp = await fetch(apiUrl);
          if (resp.ok) {
            const data = await resp.json();
            return json(data);
          }
          console.log("Local file API failed, status:", resp.status);
        } catch (e) { console.error("Local file API error:", e.message); }
        // Fallback: try bot API
        try {
          const botResp = await fetch(`${BOT_API}/api/sftpgo/files?path=${encodeURIComponent(browsePath)}`, {
            headers: {
              "X-User-ID": session.userId || "",
              "X-User-Name": session.username || "",
              "X-User-Can-Upload": session.canUpload ? "true" : "false",
              "X-User-Is-Admin": ADMIN_IDS.includes(session.userId) ? "true" : "false",
            },
          });
          if (botResp.ok) return json(await botResp.json());
        } catch (e) { console.error("Bot file listing fallback error:", e.message); }
        return json({ success: false, error: "File listing service unavailable" }, 500);
      }

      // ============ SFTPGO: Detected Resources (local file API server) ============
      if (path === "/api/sftpgo/detected-resources") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        try {
          const apiUrl = `https://storage.zyrexediting.xyz/api/files/resources?token=zyrex-files-api-2026&discord_id=${session.userId}`;
          const resp = await fetch(apiUrl);
          if (resp.ok) {
            const data = await resp.json();
            return json(data);
          }
          console.log("Local resources API failed, status:", resp.status);
        } catch (e) { console.error("Local resources API error:", e.message); }
        // Fallback: try bot API
        try {
          const botResp = await fetch(`${BOT_API}/api/sftpgo/detected-resources`, {
            headers: {
              "X-User-ID": session.userId || "",
              "X-User-Name": session.username || "",
              "X-User-Can-Upload": session.canUpload ? "true" : "false",
              "X-User-Is-Admin": ADMIN_IDS.includes(session.userId) ? "true" : "false",
            },
          });
          if (botResp.ok) {
            const data = await botResp.json();
            return json(data);
          }
        } catch (e) { console.error("Bot detected-resources error:", e.message); }
        // Fallback: direct SFTPGo scan
        const result = await scanDetectedResources(session.userId, env);
        return json(result, result.success ? 200 : 500);
      }

      // ============ CLOUD DIRECT: Change Password ============
      if (path === "/api/cloud/change-password" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        const body = await request.json();
        const newPassword = body.password;
        if (!newPassword || newPassword.length < 6) {
          return json({ success: false, error: "Password must be at least 6 characters" }, 400);
        }
        const user = await findSftpgoUserByDiscordId(session.userId, env);
        if (!user) return json({ success: false, error: "No SFTPGo cloud account linked to your profile" }, 404);
        const token = await sftpgoAuth(env);
        if (!token) return json({ success: false, error: "SFTPGo auth failed" }, 500);
        try {
          const updateResp = await fetch(`${SFTPGO_API}/users/${encodeURIComponent(user.username)}`, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": "ZyrexWorker/1.0",
            },
            body: JSON.stringify({ ...user, password: newPassword }),
          });
          if (updateResp.ok) {
            return json({ success: true, message: "Password updated successfully" });
          }
          const errData = await updateResp.text();
          return json({ success: false, error: "SFTPGo update failed: " + errData }, 500);
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
      }

      // ============ PRODUCTS: Destination Editors (local file API) ============
      if (path === "/api/products/destination-editors") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        try {
          const apiUrl = `https://storage.zyrexediting.xyz/api/files/editors?token=zyrex-files-api-2026`;
          const resp = await fetch(apiUrl);
          if (resp.ok) return json(await resp.json());
        } catch (e) { console.error("Local editors API error:", e.message); }
        return json({ success: false, error: "Editor listing unavailable" }, 500);
      }

      // ============ FILES: List files by path (public, no session needed) ============
      if (path === "/api/files/list-path") {
        const listPath = url.searchParams.get("path") || "";
        if (!listPath) return json({ success: false, error: "Missing path parameter" }, 400);
        try {
          const apiUrl = `https://storage.zyrexediting.xyz/api/files/list-path?token=zyrex-files-api-2026&path=${encodeURIComponent(listPath)}`;
          const resp = await fetch(apiUrl);
          if (resp.ok) return json(await resp.json());
          console.error("list-path upstream error:", resp.status);
        } catch (e) { console.error("list-path error:", e.message); }
        return json({ success: false, error: "File listing unavailable" }, 500);
      }

      // ============ PRODUCTS: Create Editor Folder (local file API) ============
      if (path === "/api/products/create-editor" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        try {
          const body = await request.json();
          const apiUrl = `https://storage.zyrexediting.xyz/api/files/create-editor?token=zyrex-files-api-2026`;
          const resp = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (resp.ok) return json(await resp.json());
        } catch (e) { console.error("Local create-editor error:", e.message); }
        return json({ success: false, error: "Create editor failed" }, 500);
      }

      // ============ PRODUCTS: Transfer to Production (local file API) ============
      if (path === "/api/products/transfer" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        try {
          const body = await request.json();
          const payload = {
            discord_id: session.userId,
            source_editor: body.source_editor,
            source_resource: body.source_resource,
            destination_editor: body.destination_editor,
          };
          const apiUrl = `https://storage.zyrexediting.xyz/api/files/transfer?token=zyrex-files-api-2026`;
          const resp = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (resp.ok) return json(await resp.json());
          const errText = await resp.text();
          return json({ success: false, error: "Transfer failed: " + errText }, 500);
        } catch (e) {
          return json({ success: false, error: "Transfer error: " + e.message }, 500);
        }
      }

      // ============ BOT PROXY (admin, cloud link/unlink, downloads, hlx, verify, products) ============
      if (path.startsWith("/api/products") || path.startsWith("/api/admin/") || path.startsWith("/api/cloud/") || path.startsWith("/api/downloads/") || path.startsWith("/api/hlx/") || path.startsWith("/api/verify") || path.startsWith("/api/sftpgo/")) {
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

