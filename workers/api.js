// Zyrex API Worker - Discord OAuth + R2 Storage + Proxy to Bot
const DISCORD_API = "https://discord.com/api/v10";
const BOT_API = "https://zyre.wispbyte.org";
const VERIFY_BOT_API = "https://zyre.wispbyte.org";
const FILE_API = "https://storage.zyrexediting.xyz";  // Python file server via Cloudflare Tunnel (local)
const SFTPGO_API = "https://storage.zyrexediting.xyz/api/v2";  // SFTPGo via Cloudflare Tunnel (local)
const ADMIN_IDS = ["1421177012814614548", "1382421118098346174"];

// Category display names & emojis
const CATEGORY_INFO = {
  "after-effects": { label: "After Effects", emoji: "🎬" },
  "premiere-pro": { label: "Premiere Pro", emoji: "🎞️" },
  "photoshop": { label: "Photoshop", emoji: "🖼️" },
  "video-star": { label: "Video Star", emoji: "⭐" },
  "topaz-labs": { label: "Topaz Labs", emoji: "💎" },
  "software": { label: "Software", emoji: "💻" },
  "adobe-plugin": { label: "Adobe Plugin", emoji: "🧩" },
  "ofx-plugin": { label: "OFX Plugin", emoji: "🔌" },
  "others": { label: "Others", emoji: "📁" },
};

// No separate notification needed — the bot announces directly to Discord channel during submit
// See C:\Users\reyli\Desktop\zyrex-bot\bot.py → announce_product()

// In-memory stores
let sftpgoToken = null;
let sftpgoTokenExpiry = 0;
const downloadCounts = new Map();  // productId -> count (stateless — reset on cold start, acceptable)
const usedTokens = new Set();  // single-use token enforcement
const TOKEN_EXPIRY = 600;  // 10 minutes

// Periodic cleanup of used tokens (every 15 minutes)
setInterval(() => {
  const now = Date.now();
  for (const entry of usedTokens) {
    try {
      const [hash, ts] = entry.split(':');
      if (now - parseInt(ts) > 900000) usedTokens.delete(entry);  // 15 min TTL
    } catch { usedTokens.delete(entry); }
  }
}, 900000);

// Self-contained token helpers (Workers are stateless — tokens carry their own data)
function encodeToken(data) {
  const payload = JSON.stringify({ ...data, exp: Date.now() + TOKEN_EXPIRY * 1000 });
  return btoa(String.fromCharCode(...new TextEncoder().encode(payload)));
}

function decodeToken(token) {
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(token), c => c.charCodeAt(0)));
    const data = JSON.parse(json);
    if (Date.now() > data.exp) return null;  // expired
    return data;
  } catch { return null; }
}

function hashToken(token) {
  // Simple hash for Set lookup — use last 32 chars as fingerprint
  return token.length > 32 ? token.slice(-32) : token;
}

// Role check cache (simple in-memory, 30s TTL)
const roleCheckCache = new Map();

async function checkVerifiedRole(userId, env) {
  if (!userId) return false;
  
  // Check cache
  const cached = roleCheckCache.get(userId);
  if (cached && Date.now() < cached.expiry) return cached.hasRole;
  
  try {
    // Primary: bot API
    const botResp = await fetch(`${BOT_API}/api/guild/check-role?userId=${encodeURIComponent(userId)}&roleId=1519246304163659858`);
    if (botResp.ok) {
      const data = await botResp.json();
      const result = !!(data && data.has_role);
      roleCheckCache.set(userId, { hasRole: result, expiry: Date.now() + 30000 });
      return result;
    }
  } catch (e) { console.error("Bot role check failed:", e.message); }
  
  // Fallback: Discord REST API
  try {
    const discordResp = await fetch(`${DISCORD_API}/guilds/${env.GUILD_ID || "1518954946110685184"}/members/${userId}`, {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    });
    if (discordResp.ok) {
      const member = await discordResp.json();
      const result = !!(member.roles && member.roles.includes("1519246304163659858"));
      roleCheckCache.set(userId, { hasRole: result, expiry: Date.now() + 30000 });
      return result;
    }
  } catch (e) { console.error("Discord REST role check failed:", e.message); }
  
  // Default deny on all errors
  roleCheckCache.set(userId, { hasRole: false, expiry: Date.now() + 15000 });
  return false;
}

// Watermark files (embedded)
const WATERMARKS = {
  "LEAKED BY ZYREX.txt": "ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX \r\nZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX \r\n\r\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588     \u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588     \u2588\u2588\u2588\r\n\u2580\u2580\u2580\u2580\u2580\u2580\u2588\u2588\u2588\u2580    \u2588\u2588\u2588     \u2588\u2588\u2588  \u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580   \u2588\u2588\u2588   \u2588\u2588\u2588 \r\n     \u2588\u2588\u2588       \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588            \u2588\u2588\u2588 \u2588\u2588\u2588  \r\n    \u2588\u2588\u2588         \u2588\u2588\u2588 \u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588     \u2588\u2588\u2588\u2588\u2588   \r\n   \u2588\u2588\u2588           \u2588\u2588\u2588\u2588\u2588     \u2588\u2588\u2588    \u2588\u2588\u2588    \u2588\u2588\u2588\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580     \u2588\u2588\u2588\u2588\u2588   \r\n  \u2588\u2588\u2588             \u2588\u2588\u2588      \u2588\u2588\u2588     \u2588\u2588\u2588   \u2588\u2588\u2588            \u2588\u2588\u2588 \u2588\u2588\u2588  \r\n \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2588\u2588      \u2588\u2588\u2588      \u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588 \r\n\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2588\u2588      \u2588\u2588\u2588       \u2588\u2588\u2588 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588     \u2588\u2588\u2588\r\n\r\nThis resource leaked by ZYREX.\r\n\r\n- https://discord.gg/wvgbyBwNuG\r\n- zyrexediting.xyz\r\n\r\nZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX\r\nZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX\r\n",
  "Visit for more resources!.url": "[{000214A0-0000-0000-C000-000000000046}]\r\nProp3=19,11\r\n[InternetShortcut]\r\nIDList=\r\nURL=https://zyrexediting.xyz/resources\r\n"
};

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
  try {
    const decoded = atob(m[1]);
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

function setCookie(data, maxAge = 86400) {
  const json = JSON.stringify(data);
  // btoa only handles ASCII; use TextEncoder for Unicode safety
  const bytes = new TextEncoder().encode(json);
  const val = btoa(String.fromCharCode(...bytes));
  return `zyrex_session=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

function clearCookie() {
  return "zyrex_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure";
}

// ============ R2 FILE HELPERS ============
async function r2List(env, prefix, useProd = false) {
  const bucket = useProd ? (env.STORAGE_PROD || env.STORAGE) : env.STORAGE;
  const objects = [];
  let cursor;
  do {
    const resp = await bucket.list({ prefix, limit: 500, cursor });
    for (const obj of resp.objects) {
      objects.push({ key: obj.key, size: obj.size, uploaded: obj.uploaded });
    }
    cursor = resp.cursor;
  } while (cursor);
  return objects;
}

async function r2Get(env, key, useProd = false) {
  const bucket = useProd ? (env.STORAGE_PROD || env.STORAGE) : env.STORAGE;
  const obj = await bucket.get(key);
  if (!obj) return null;
  return obj;
}

function normalizeR2Prefix(value) {
  let prefix = String(value || "").replace(/\\/g, "/").trim();
  prefix = prefix.replace(/^\/+/, "");
  if (prefix && !prefix.endsWith("/")) prefix += "/";
  return prefix;
}

function relativeR2Name(key, prefix) {
  return key.slice(prefix.length).replace(/\\/g, "/").replace(/^\/+/, "");
}

function isWatermarkName(name) {
  const base = String(name || "").split("/").pop();
  return Object.prototype.hasOwnProperty.call(WATERMARKS, base);
}

function isDownloadableR2Object(obj, prefix) {
  if (!obj || !obj.key || obj.key.endsWith("/") || obj.key === prefix) return false;
  const name = relativeR2Name(obj.key, prefix);
  if (!name || name.endsWith("/") || name === ".placeholder" || name.endsWith("/.placeholder")) return false;
  return !isWatermarkName(name);
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function normalizeSelectedName(value) {
  return safeDecode(String(value || "")).replace(/\\/g, "/").replace(/^\/+/, "");
}

function getRequestedFileSet(url) {
  const selected = new Set();
  const add = value => {
    const clean = normalizeSelectedName(value);
    if (clean) selected.add(clean);
  };

  for (const value of url.searchParams.getAll("file")) add(value);
  for (const value of url.searchParams.getAll("files")) {
    for (const part of String(value || "").split(",")) add(part);
  }

  return selected.size > 0 ? selected : null;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scorePrefixMatch(prefix, resourceName, productId, product) {
  const resourceSlug = slugify(resourceName || prefix);
  const prefixSlug = slugify(prefix);
  const targets = [productId, product?.id, product?.name, product?.title]
    .map(slugify)
    .filter(Boolean);

  let best = 0;
  for (const target of targets) {
    if (!target) continue;
    if (resourceSlug === target) best = Math.max(best, 100);
    else if (prefixSlug === target) best = Math.max(best, 95);
    else if (resourceSlug.includes(target) || target.includes(resourceSlug)) best = Math.max(best, 80);
    else if (prefixSlug.includes(target) || target.includes(prefixSlug)) best = Math.max(best, 60);
  }
  return best;
}

async function prefixHasDownloadableFiles(bucket, prefix) {
  if (!prefix) return false;
  const listed = await bucket.list({ prefix, limit: 100 });
  return (listed.objects || []).some(obj => isDownloadableR2Object(obj, prefix));
}

async function fetchProductHint(productId, session) {
  if (!productId) return null;
  try {
    const headers = {};
    if (session) {
      headers["X-User-ID"] = session.userId || "";
      headers["X-User-Name"] = session.username || "";
      headers["X-User-Can-Upload"] = session.canUpload ? "true" : "false";
      headers["X-User-Is-Admin"] = ADMIN_IDS.includes(session.userId) ? "true" : "false";
    }
    const resp = await fetch(`${BOT_API}/api/products?id=${encodeURIComponent(productId)}`, { headers });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data.id ? data : null;
  } catch (e) {
    console.error("Product hint lookup failed:", e.message);
    return null;
  }
}

async function resolveProductionPrefix(env, productId, hintPath, product = null) {
  const prodBucket = env.STORAGE_PROD || env.STORAGE;
  const candidates = [];
  const seenCandidates = new Set();
  const addCandidate = value => {
    const prefix = normalizeR2Prefix(value);
    if (prefix && !seenCandidates.has(prefix)) {
      seenCandidates.add(prefix);
      candidates.push(prefix);
    }
  };

  addCandidate(hintPath);
  addCandidate(product?.file_path);
  addCandidate(product?.cloud_path);
  addCandidate(product?.path);
  if (productId) {
    addCandidate(`production/${productId}`);
    addCandidate(productId);
  }

  for (const prefix of candidates) {
    if (await prefixHasDownloadableFiles(prodBucket, prefix)) return prefix;
  }

  const matches = [];
  const topList = await prodBucket.list({ delimiter: "/" });
  for (const topPrefix of topList.delimitedPrefixes || []) {
    const topName = topPrefix.replace(/\/$/, "");

    if (await prefixHasDownloadableFiles(prodBucket, topPrefix)) {
      matches.push({
        prefix: topPrefix,
        score: scorePrefixMatch(topPrefix, topName, productId, product),
      });
    }

    const resourceList = await prodBucket.list({ prefix: topPrefix, delimiter: "/" });
    for (const resourcePrefix of resourceList.delimitedPrefixes || []) {
      const resourceName = resourcePrefix.slice(topPrefix.length).replace(/\/$/, "");
      if (!(await prefixHasDownloadableFiles(prodBucket, resourcePrefix))) continue;
      matches.push({
        prefix: resourcePrefix,
        score: scorePrefixMatch(resourcePrefix, resourceName, productId, product),
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  if (matches.length > 0 && matches[0].score > 0) return matches[0].prefix;
  if (matches.length === 1) return matches[0].prefix;
  return "";
}

function safeZipFilename(name) {
  const clean = String(name || "download").replace(/[\\/:*?"<>|\r\n]+/g, "_").trim();
  return (clean || "download").slice(0, 140);
}

function formatSizeR2(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// Simple CRC32 (for ZIP)
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function makeLocalHeader(nameBytes, size, crc) {
  const buf = new Uint8Array(30 + nameBytes.length);
  const v = new DataView(buf.buffer);
  v.setUint32(0, 0x04034b50, true); // signature
  v.setUint16(4, 20, true);         // version
  v.setUint16(6, 0, true);          // flags
  v.setUint16(8, 0, true);          // compression (store)
  v.setUint16(10, 0, true);         // mod time
  v.setUint16(12, 0, true);         // mod date
  v.setUint32(14, crc, true);
  v.setUint32(18, size, true);      // compressed size
  v.setUint32(22, size, true);      // uncompressed size
  v.setUint16(26, nameBytes.length, true);
  v.setUint16(28, 0, true);         // extra field length
  buf.set(nameBytes, 30);
  return buf;
}
function makeCentralDirEntry(nameBytes, size, crc, offset) {
  const buf = new Uint8Array(46 + nameBytes.length);
  const v = new DataView(buf.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 20, true);
  v.setUint16(8, 0, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, 0, true);
  v.setUint16(14, 0, true);
  v.setUint32(16, crc, true);
  v.setUint32(20, size, true);
  v.setUint32(24, size, true);
  v.setUint16(28, nameBytes.length, true);
  v.setUint16(30, 0, true);
  v.setUint16(32, 0, true);
  v.setUint16(34, 0, true);
  v.setUint32(36, 0, true);
  v.setUint32(42, offset, true);
  buf.set(nameBytes, 46);
  return buf;
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
async function scanResourcesFromR2(discordId, username, env) {
  /** Scan R2 staging bucket for user's resources.
   *  Handles both clean prefixes and Windows-path-prefixed keys from SFTPGo. */
  if (!env.STORAGE) return { success: true, resources: [] };
  
  const allResources = [];
  
  try {
    // List ALL objects (not just top-level folders) to handle Windows path prefixes
    const allObjects = [];
    let cursor;
    do {
      const batch = await env.STORAGE.list({ limit: 500, cursor });
      for (const obj of batch.objects) {
        allObjects.push(obj);
      }
      cursor = batch.cursor;
    } while (cursor);
    
    if (allObjects.length === 0) return { success: true, resources: [] };
    
    // Discover user folder prefixes by finding paths that contain the Discord ID
    // or Discord username, accounting for Windows path prefixes
    const userPrefixes = new Set();
    
    for (const obj of allObjects) {
      let key = obj.key;
      
      // Strip known Windows path prefixes
      const winPrefixes = [
        "C:/Users/reyli/Desktop/sftpgo/data/",
        "C:\\Users\\reyli\\Desktop\\sftpgo\\data\\",
      ];
      for (const wp of winPrefixes) {
        if (key.startsWith(wp)) {
          key = key.slice(wp.length);
          break;
        }
      }
      
      // Now extract the user prefix (first path segment)
      const slashIdx = key.indexOf("/");
      if (slashIdx > 0) {
        const userPrefix = key.slice(0, slashIdx);
        // Match by Discord ID suffix or exact username
        if (discordId && userPrefix.endsWith(`_${discordId}`)) {
          userPrefixes.add(userPrefix);
        }
        if (username && userPrefix === username) {
          userPrefixes.add(userPrefix);
        }
      }
    }
    
    // If no user prefixes found via Discord ID, try matching by username in paths
    if (userPrefixes.size === 0) {
      // Check objects for known username patterns (NOT scan all folders!)
      for (const obj of allObjects) {
        const key = obj.key;
        for (const tryName of [username, username?.toLowerCase()].filter(Boolean)) {
          if (tryName && key.includes(`/${tryName}/`)) {
            const parts = key.split("/");
            const idx = parts.indexOf(tryName);
            if (idx > 0) {
              userPrefixes.add(parts.slice(0, idx + 1).join("/"));
            }
          }
        }
      }
    }
    
    // If still no user prefix found, return empty (don't leak other users' data)
    if (userPrefixes.size === 0) {
      return { success: true, resources: [] };
    }
    
    for (const folder of [...userPrefixes]) {
      // Normalize prefix: may include Windows path segments, we need the full R2 key prefix
      let fullPrefix = folder + "/";
      
      // If folder doesn't contain ":", it's a clean prefix — use directly
      // Otherwise we need to use it as a relative prefix within the R2 key
      const objectsInFolder = allObjects.filter(o => {
        const key = o.key.replace(/\\/g, "/");
        // Match keys that contain this folder path
        return key.includes(fullPrefix) || key.endsWith(fullPrefix);
      });
      
      if (objectsInFolder.length === 0) continue;
      
      // Determine the actual R2 prefix by finding the first matching object
      const firstMatch = objectsInFolder[0].key.replace(/\\/g, "/");
      const folderPos = firstMatch.indexOf(fullPrefix);
      const r2Prefix = folderPos >= 0 ? firstMatch.slice(0, folderPos + fullPrefix.length) : fullPrefix;
      
      // Now scan this prefix for editor/resource structure
      const editorFolders = new Set();
      for (const obj of objectsInFolder) {
        const key = obj.key.replace(/\\/g, "/");
        const rel = key.slice(r2Prefix.length);
        if (!rel || rel === "/") continue;
        const slashIdx = rel.indexOf("/");
        if (slashIdx > 0) editorFolders.add(rel.slice(0, slashIdx));
      }
      
      for (const editor of [...editorFolders].sort()) {
        const editorPrefix = r2Prefix + editor + "/";
        const editorObjects = objectsInFolder.filter(o => {
          const k = o.key.replace(/\\/g, "/");
          return k.startsWith(editorPrefix) && k !== editorPrefix;
        });
        
        const resourceFolders = new Set();
        let hasDirectFiles = false;
        
        for (const obj of editorObjects) {
          const key = obj.key.replace(/\\/g, "/");
          const rel = key.slice(editorPrefix.length);
          if (!rel) continue;
          const slashIdx = rel.indexOf("/");
          if (slashIdx > 0) resourceFolders.add(rel.slice(0, slashIdx));
          else hasDirectFiles = true;
        }
        
        for (const resource of [...resourceFolders].sort()) {
          const resPrefix = editorPrefix + resource + "/";
          const files = [];
          for (const obj of objectsInFolder) {
            const key = obj.key.replace(/\\/g, "/");
            if (key.startsWith(resPrefix) && key !== resPrefix) {
              const fname = key.slice(resPrefix.length);
              if (fname) {
                files.push({ name: fname, size: obj.size, path: key });
              }
            }
          }
          if (files.length > 0) allResources.push({ editor, resource, files });
        }
        
        if (hasDirectFiles && resourceFolders.size === 0) {
          const directFiles = [];
          for (const obj of editorObjects) {
            const key = obj.key.replace(/\\/g, "/");
            const fname = key.slice(editorPrefix.length);
            if (fname) {
              directFiles.push({ name: fname, size: obj.size, path: key });
            }
          }
          if (directFiles.length > 0) allResources.push({ editor, resource: editor, files: directFiles });
        }
      }
    }
  } catch (e) {
    console.error("R2 scan error:", e.message);
  }
  
  return { success: true, resources: allResources };
}

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

    // --- Image extraction: smarter priority-based selection ---
    let primaryImage = "";
    const thumbnails = new Set();

    // Helper: check if image URL belongs to an icon/avatar/small element
    function isExcludedImage(imgUrl) {
      const lower = imgUrl.toLowerCase();
      return lower.includes("logo") || lower.includes("favicon") || lower.includes("avatar")
          || lower.includes("/icon/") || lower.includes("_icon");
    }

    // Helper: extract width from Payhip CDN URL or img tag
    function getWidthFromUrl(url) {
      const m = url.match(/width=(\d+)/);
      return m ? parseInt(m[1]) : 0;
    }

    // 1. Try section-image class (word boundary match — handles multi-class)
    let sectionMatch = html.match(/<img[^>]*class="[^"]*\bsection-image\b[^"]*"[^>]*src="(https:\/\/[^"]+)"/i);
    if (!sectionMatch) {
      // Try without class attr ordering: img with section-image anywhere
      sectionMatch = html.match(/<img[^>]*\bsection-image\b[^>]*src="(https:\/\/[^"]+)"/i);
    }
    if (sectionMatch?.[1] && !isExcludedImage(sectionMatch[1])) {
      primaryImage = sectionMatch[1];
      thumbnails.add(sectionMatch[1]);
    }

    // 2. Try product-image, product-gallery classes
    if (!primaryImage) {
      const productImg = html.match(/<img[^>]*class="[^"]*\bproduct-image\b[^"]*"[^>]*src="(https:\/\/[^"]+)"/i)
                      || html.match(/<img[^>]*\bproduct-image\b[^>]*src="(https:\/\/[^"]+)"/i);
      if (productImg?.[1] && !isExcludedImage(productImg[1])) {
        primaryImage = productImg[1];
        thumbnails.add(productImg[1]);
      }
    }

    // 3. OG image meta (most reliable — Payhip sets this to the product thumbnail)
    const ogSecure = (html.match(/<meta\s+property="og:image:secure_url"\s+content="([^"]+)"/i) || [])[1];
    const ogImage = (html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || [])[1];
    const bestOg = ogSecure || ogImage;
    if (bestOg && !isExcludedImage(bestOg)) {
      if (!primaryImage) primaryImage = bestOg;
      thumbnails.add(bestOg);
    }

    // 4. Scored fallback: all img tags, excluding header/nav/author/profile containers
    //    Prefer images with larger width parameter, exclude tiny icons
    const scoredImages = [];
    const imgRegex = /<img[^>]+src="(https:\/\/[^"]*\.(?:png|jpg|jpeg|gif|webp)[^"]*)"/gi;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      const imgUrl = m[1];
      if (isExcludedImage(imgUrl)) continue;

      // Get surrounding context (~200 chars before this img)
      const pos = m.index;
      const context = html.substring(Math.max(0, pos - 300), pos).toLowerCase();

      // Exclude images in author/creator/profile/header/nav containers
      if (/class="[^"]*\b(?:author|creator|profile|avatar|user|header|navbar|sidebar)[^"]*\b/i.test(context)) continue;
      if (/<(?:header|nav|aside)[^>]*>/i.test(context) && !/<(?:main|article|section)[^>]*>/i.test(context)) continue;

      let score = 0;
      const w = getWidthFromUrl(imgUrl);
      if (w >= 1200) score += 30;
      else if (w >= 800) score += 20;
      else if (w >= 400) score += 10;
      else if (w > 0 && w < 200) score -= 50;  // tiny icon

      // Prefer images inside product/section containers
      if (/class="[^"]*\b(?:product|section|gallery)[^"]*\b/i.test(context)) score += 25;
      if (/<(?:main|article)[^>]*>/i.test(context)) score += 10;

      // JPEG tends to be product photos, PNG may be icons/logos (slight preference)
      if (/\.jpg|jpeg/i.test(imgUrl)) score += 5;

      scoredImages.push({ url: imgUrl, score });
    }

    // Sort by score descending, add to thumbnails
    scoredImages.sort((a, b) => b.score - a.score);
    for (const img of scoredImages) {
      if (img.score > 0) {
        if (!primaryImage) primaryImage = img.url;
        thumbnails.add(img.url);
      }
    }

    // If still no primary image, use first thumbnail
    if (!primaryImage && thumbnails.size > 0) {
      primaryImage = [...thumbnails][0];
    }

    return {
      success: true,
      title,
      description,
      image: primaryImage,
      price,
      thumbnails: [...thumbnails].slice(0, 8),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Bypass: dl subdomain serves static download page from Pages
    if (url.hostname === "dl.zyrexediting.xyz") {
      const newUrl = new URL(request.url);
      if (!newUrl.pathname.startsWith("/api/")) {
        if (newUrl.pathname === "/") {
          newUrl.pathname = "/download.html";
        }
        return fetch(`https://zyrexediting.xyz${newUrl.pathname}${newUrl.search}`);
      }
    }
    // Bypass: storage subdomain handled by Cloudflare Tunnel (SFTPGo on local machine)
    if (url.hostname === "storage.zyrexediting.xyz") {
      return fetch(request);
    }
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ============ AVATAR PROXY (bypass Discord CDN blocks) ============
    if (path.startsWith("/api/avatar/")) {
      const cacheTTL = 86400;
      try {
        let cdnUrl;
        if (path.includes("/default/")) {
          const idx = path.split("/default/")[1]?.replace(".png", "") || "0";
          cdnUrl = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
        } else {
          const parts = path.replace("/api/avatar/", "").split("/");
          const userId = parts[0];
          const hash = parts[1]?.replace(/\?.*/, "") || "";
          const size = url.searchParams.get("size") || "256";
          cdnUrl = `https://cdn.discordapp.com/avatars/${userId}/${hash}?size=${size}`;
        }
        const imgResp = await fetch(cdnUrl);
        if (imgResp.ok) {
          return new Response(imgResp.body, {
            status: 200,
            headers: {
              "Content-Type": imgResp.headers.get("Content-Type") || "image/png",
              "Cache-Control": `public, max-age=${cacheTTL}`,
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      } catch(e) { console.error("Avatar proxy error:", e.message); }
      return new Response(null, { status: 404, headers: corsHeaders });
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

        // Build avatar URL (use our proxy to avoid CDN blocks)
        let avatarUrl = "";
        if (session.avatar) {
          const ext = session.avatar.startsWith("a_") ? "gif" : "png";
          avatarUrl = `/api/avatar/${session.userId}/${session.avatar}.${ext}?size=256`;
        } else if (session.userId) {
          const defIdx = (BigInt(session.userId) >> 22n) % 6n;
          avatarUrl = `/api/avatar/default/${defIdx}.png`;
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

        // If this is a verify flow, call the verify bot API to auto-verify
        if (redirectTo === "/verify" && extraState) {
          try {
            // Get real user IP from multiple sources (works globally)
            const userIp =
              request.headers.get("CF-Connecting-IP") ||
              request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
              request.headers.get("X-Real-IP") ||
              request.headers.get("True-Client-IP") ||
              "";
            const userCountry =
              request.headers.get("CF-IPCountry") ||
              request.headers.get("X-Country") ||
              "";
            const vResp = await fetch(`${VERIFY_BOT_API}/api/verify?userId=${du.id}&ip=${encodeURIComponent(userIp)}&country=${encodeURIComponent(userCountry)}`);
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

      // GUILD MEMBERSHIP CHECK - Proxy to Bot
      if (path === "/api/guild/check-membership") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ in_guild: false, error: "Not logged in" }, 401);
        try {
          const targetUrl = `${BOT_API}/api/guild/check-membership?userId=${session.userId}`;
          const botResp = await fetch(targetUrl);
          if (botResp.ok) return json(await botResp.json());
        } catch(e) { console.error("Membership check error:", e.message); }
        return json({ in_guild: false });
      }

      // VERIFY COMPLETE - Proxy to Bot (one-time token verification)
      if (path === "/api/verify/complete" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ success: false, error: "Not logged in" }, 401);
        try {
          const body = await request.json();
          const targetUrl = `${VERIFY_BOT_API}/api/verify/complete`;
          const botResp = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: body.token,
              userId: session.userId,
              username: session.username,
              displayName: session.displayName,
            }),
          });
          if (botResp.ok) return json(await botResp.json());
          const errText = await botResp.text();
          try { return json(JSON.parse(errText), botResp.status); } catch { return json({ success: false, error: "Verification failed" }, 500); }
        } catch(e) { console.error("Verify complete error:", e.message); }
        return json({ success: false, error: "Service unavailable" }, 500);
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

      // ============ SCRAPER (Unified — Proxied to Bot) ============
      if (path === "/api/scrape" || path === "/api/payhip/scrape" || path === "/api/patreon/scrape" || path === "/api/boosty/scrape") {
        const scrapeUrl = url.searchParams.get("url");
        if (!scrapeUrl) {
          return json({ success: false, error: "URL parameter required" }, 400);
        }
        // Route to the bot's unified scraper (bot handles platform detection)
        const targetUrl = `${BOT_API}/api/scrape?url=${encodeURIComponent(scrapeUrl)}`;
        const botResp = await fetch(targetUrl);
        const data = await botResp.text();
        try {
          return json(JSON.parse(data), botResp.status);
        } catch {
          return new Response(data, { status: botResp.status, headers: corsHeaders });
        }
      }

      // ============ DOWNLOAD: Validate Token (self-contained) ============
      if (path === "/api/downloads/validate") {
        const token = url.searchParams.get("token");
        if (!token) return json({ error: "Token required" }, 400);
        const data = decodeToken(token);
        if (!data) return json({ success: false, error: "Invalid or expired token" }, 404);
        return json({
          success: true,
          product_id: data.product_id,
          file_path: data.file_path,
          discord_id: data.discord_id,
          expires_in: Math.max(0, Math.floor((data.exp - Date.now()) / 1000)),
        });
      }

      // ============ DOWNLOAD: Request Token (R2 production bucket) ============
      if (path === "/api/downloads/check-access") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ can_download: false, reason: "not_logged_in" });
        const hasRole = await checkVerifiedRole(session.userId, env);
        return json({
          can_download: hasRole,
          reason: hasRole ? "ok" : "not_verified",
          discord_id: session.userId,
          username: session.username,
        });
      }

      if (path.startsWith("/api/downloads/request-token/")) {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        
        // Verified role gate
        const isVerified = await checkVerifiedRole(session.userId, env);
        if (!isVerified) return json({ error: "Doğrulama gerekli. İndirme yapabilmek için Discord sunucumuzda Verified rolüne sahip olmanız gerekiyor.", code: "NOT_VERIFIED" }, 403);
        
        const productId = path.split("/api/downloads/request-token/")[1];
        if (!productId) return json({ error: "Product ID required" }, 400);
        
        let r2Prefix = "";
        let productHint = null;
        try {
          const hintPath = url.searchParams.get("file_path");
          productHint = await fetchProductHint(productId, session);
          r2Prefix = await resolveProductionPrefix(env, productId, hintPath, productHint);
          
          if (!r2Prefix) {
            return json({ success: false, error: "Resource not found in production storage. Transfer may not have completed yet." }, 404);
          }
        } catch (e) {
          console.error("R2 token search error:", e.message);
          return json({ success: false, error: "Storage search failed" }, 500);
        }
        
        // Generate self-contained download token
        const token = encodeToken({
          discord_id: session.userId,
          product_id: productId,
          file_path: r2Prefix,
          used: false,
        });
        
        return json({
          success: true,
          token,
          url: `https://dl.zyrexediting.xyz/?token=${token}`,
          expires_in: TOKEN_EXPIRY,
          file_path: r2Prefix,
        });
      }

      // ============ DOWNLOAD COUNTER (proxied to Bot VPS — single source of truth) ============
      if (path === "/api/downloads/counts") {
        try {
          const resp = await fetch(`${BOT_API}/api/downloads/counts`);
          if (resp.ok) return json(await resp.json());
          return json({ success: true, counts: {} });
        } catch (e) { return json({ success: true, counts: {} }); }
      }
      
      if (path === "/api/downloads/track" && request.method === "POST") {
        try {
          const body = await request.json();
          const resp = await fetch(`${BOT_API}/api/downloads/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (resp.ok) return json(await resp.json());
          return json({ success: false, error: "Bot API unavailable" }, 502);
        } catch (e) { return json({ success: false, error: "Bot API unreachable" }, 502); }
      }

      // ============ DOWNLOAD: Binary ZIP Stream (R2 production bucket) ============
      if (path === "/api/downloads/download") {
        const token = url.searchParams.get("token");
        if (!token) return json({ error: "Token required" }, 400);
        
        const data = decodeToken(token);
        if (!data) return json({ success: false, error: "Invalid or expired token" }, 404);
        
        // Single-use token enforcement
        const tokenFingerprint = hashToken(token);
        if (usedTokens.has(tokenFingerprint)) return json({ success: false, error: "Bu token zaten kullanıldı. Lütfen yeni bir indirme bağlantısı oluşturun." }, 403);
        
        // Mark token as used immediately (before streaming starts)
        usedTokens.add(tokenFingerprint + ':' + Date.now());
        
        const r2Prefix = normalizeR2Prefix(data.file_path);
        const selectedSet = getRequestedFileSet(url);
        const title = url.searchParams.get("title") || data.product_id;
        if (!r2Prefix) return json({ success: false, error: "Token does not contain a storage path" }, 400);
        
        try {
          const allObjects = await r2List(env, r2Prefix, true);  // useProd=true
          const fileObjects = allObjects.filter(o => isDownloadableR2Object(o, r2Prefix));
          
          if (fileObjects.length === 0) {
            return json({ success: false, error: "No files found" }, 404);
          }
          
          const selectedObjects = selectedSet
            ? fileObjects.filter(o => selectedSet.has(relativeR2Name(o.key, r2Prefix)))
            : fileObjects;
          
          if (selectedObjects.length === 0) {
            return json({ success: false, error: "Selected files were not found in storage" }, 404);
          }
          
          // Stream ZIP response
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();
          
          // Note: download tracking is done client-side (download.html calls /api/downloads/track after save)
          // This avoids double-counting from Worker fire-and-forget
          
          // Use a simple ZIP-like stream (store method for simplicity)
          (async () => {
            let aborted = false;
            try {
              const folderName = safeZipFilename(title || r2Prefix.split("/").filter(Boolean).pop() || "download");
              const centralDir = [];
              let offset = 0;
              let filesWritten = 0;
              
              for (const obj of selectedObjects) {
                const fname = relativeR2Name(obj.key, r2Prefix);
                if (!fname) continue;
                
                const fileData = await r2Get(env, obj.key, true);  // useProd=true
                if (!fileData) continue;
                
                let fileBytes;
                try {
                  const bytes = await fileData.arrayBuffer();
                  fileBytes = new Uint8Array(bytes);
                } catch (e) {
                  console.error("R2 read failed:", obj.key, e.message);
                  continue;  // skip this file, don't crash the whole ZIP
                }
                
                const nameBytes = encoder.encode(folderName + "/" + fname);
                const crcVal = crc32(fileBytes);
                
                const localHeader = makeLocalHeader(nameBytes, fileBytes.byteLength, crcVal);
                await writer.write(localHeader);
                await writer.write(fileBytes);
                
                centralDir.push(makeCentralDirEntry(nameBytes, fileBytes.byteLength, crcVal, offset));
                offset += localHeader.byteLength + fileBytes.byteLength;
                filesWritten++;
              }
              
              // Inject watermarks only if files were actually included
              if (filesWritten > 0) {
                for (const [wmName, wmContent] of Object.entries(WATERMARKS)) {
                  const wmBytes = encoder.encode(wmContent);
                  const nameBytes = encoder.encode(folderName + "/" + wmName);
                  const crcVal = crc32(wmBytes);
                  
                  const localHeader = makeLocalHeader(nameBytes, wmBytes.byteLength, crcVal);
                  await writer.write(localHeader);
                  await writer.write(wmBytes);
                  
                  centralDir.push(makeCentralDirEntry(nameBytes, wmBytes.byteLength, crcVal, offset));
                  offset += localHeader.byteLength + wmBytes.byteLength;
                }
              }
              
              if (filesWritten === 0) {
                throw new Error("No files could be read from R2");
              }
              
              // Only write central directory if we have entries
              if (centralDir.length > 0) {
                let cdOffset = offset;
                let cdSize = 0;
                for (const entry of centralDir) {
                  await writer.write(entry);
                  cdSize += entry.byteLength;
                }

                // End of central directory
                const eocd = new Uint8Array(22);
                const eocdView = new DataView(eocd.buffer);
                eocdView.setUint32(0, 0x06054b50, true);
                eocdView.setUint16(8, centralDir.length, true);
                eocdView.setUint16(10, centralDir.length, true);
                eocdView.setUint32(12, cdSize, true);
                eocdView.setUint32(16, cdOffset, true);
                await writer.write(eocd);
              }
            } catch (e) {
              console.error("ZIP stream error:", e.message);
              aborted = true;
              try { await writer.abort(e); } catch (_) {}
            } finally {
              if (!aborted) {
                try { await writer.close(); } catch (e) { /* already closed */ }
              }
            }
          })();
          
          const zipFilename = safeZipFilename(title || "download") + ".zip";
          return new Response(readable, {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": `attachment; filename="${zipFilename}"`,
              ...corsHeaders,
            },
          });
        } catch (e) {
          console.error("Download error:", e.message);
          return json({ success: false, error: "Download failed: " + e.message }, 500);
        }
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
          const apiUrl = `${FILE_API}/api/files/list?token=zyrex-files-api-2026&discord_id=${session.userId}&path=${encodeURIComponent(browsePath)}`;
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

      // ============ SFTPGO: Detected Resources (R2-first) ============
      if (path === "/api/sftpgo/detected-resources") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        
        // Try R2 staging bucket scan first (fast, direct)
        try {
          const r2Result = await scanResourcesFromR2(session.userId, session.username, env);
          if (r2Result && r2Result.resources && r2Result.resources.length > 0) {
            return json(r2Result);
          }
          console.log("R2 scan found no resources, trying file API...");
        } catch (e) { console.error("R2 scan error:", e.message); }
        
        // Fallback: try FILE_API (VPS file server)
        try {
          const apiUrl = `${FILE_API}/api/files/resources?token=zyrex-files-api-2026&discord_id=${session.userId}`;
          const resp = await fetch(apiUrl);
          if (resp.ok) {
            const data = await resp.json();
            if (data.resources && data.resources.length > 0) return json(data);
          }
        } catch (e) { console.error("File API resources error:", e.message); }
        
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
            if (data.resources && data.resources.length > 0) return json(data);
          }
        } catch (e) { console.error("Bot detected-resources error:", e.message); }
        
        // Last fallback: direct SFTPGo API scan
        const result = await scanDetectedResources(session.userId, env);
        return json(result, result.success ? 200 : 500);
      }

      // ============ ADMIN: List production folders (for orphaned resource detection) ============
      if (path === "/api/admin/production-folders") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session || !ADMIN_IDS.includes(session.userId)) return json({ error: "Admin only" }, 403);
        try {
          const prodBucket = env.STORAGE_PROD || env.STORAGE;
          const listed = await prodBucket.list({ delimiter: "/" });
          const folders = [];
          // Get top-level editor folders
          for (const cp of listed.delimitedPrefixes || []) {
            const editorName = cp.replace(/\/$/, "");
            if (!editorName || editorName === "production") continue;
            
            // List resources inside each editor
            const editorList = await prodBucket.list({ prefix: cp, delimiter: "/" });
            for (const resCp of editorList.delimitedPrefixes || []) {
              const resName = resCp.slice(cp.length).replace(/\/$/, "");
              if (!resName) continue;
              
              // Get files in resource folder
              const resList = await prodBucket.list({ prefix: resCp });
              const files = [];
              for (const obj of resList.objects) {
                const fname = obj.key.slice(resCp.length);
                if (fname && !fname.endsWith("/")) {
                  files.push({ name: fname, size: obj.size });
                }
              }
              if (files.length > 0) {
                folders.push({
                  editor: editorName,
                  resource: resName,
                  prefix: resCp,
                  fileCount: files.length,
                  files: files.slice(0, 5),  // first 5 files preview
                });
              }
            }
          }
          return json({ success: true, folders });
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
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

      // ============ PRODUCTS: Destination Editors (R2 prod bucket) ============
      if (path === "/api/products/destination-editors") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        try {
          const prodBucket = env.STORAGE_PROD || env.STORAGE;
          const listed = await prodBucket.list({ delimiter: "/" });
          const editors = [];
          for (const cp of listed.delimitedPrefixes || []) {
            const name = cp.replace(/\/$/, "");
            if (name && name !== "production") editors.push(name);
          }
          const seen = new Set(editors);
          for (const obj of listed.objects) {
            const parts = obj.key.split("/");
            if (parts.length >= 2) {
              const name = parts[0];
              if (name && name !== "production" && !seen.has(name)) {
                seen.add(name);
                editors.push(name);
              }
            }
          }
          return json({ success: true, editors: editors.sort() });
        } catch (e) {
          console.error("R2 editors error:", e.message);
          try {
            const apiUrl = `${FILE_API}/api/files/editors?token=zyrex-files-api-2026`;
            const resp = await fetch(apiUrl);
            if (resp.ok) return json(await resp.json());
          } catch (e2) { console.error("FILE_API editors fallback:", e2.message); }
        }
        return json({ success: false, error: "Editor listing unavailable" }, 500);
      }

      // ============ FILES: List files by path (R2 production bucket) ============
      if (path === "/api/files/list-path") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ success: false, error: "Not logged in" }, 401);
        const isVerified = await checkVerifiedRole(session.userId, env);
        if (!isVerified) return json({ success: false, error: "Verified role required" }, 403);
        
        const listPath = url.searchParams.get("path") || "";
        const productIdForList = url.searchParams.get("product_id") || "";
        if (!listPath && !productIdForList) return json({ success: false, error: "Missing path parameter" }, 400);
        try {
          let prefix = normalizeR2Prefix(listPath);
          if (!prefix && productIdForList) {
            prefix = await resolveProductionPrefix(env, productIdForList, "", null);
          }
          if (!prefix) return json({ success: true, files: [], prefix: "" });
          let objects;
          try {
            objects = await r2List(env, prefix, true);  // useProd=true
          } catch (listErr) {
            console.error("r2List failed:", listErr.message);
            return json({ success: true, files: [], prefix, note: "Storage unavailable" });
          }
          let files = objects.filter(o => isDownloadableR2Object(o, prefix)).map(o => ({
            name: relativeR2Name(o.key, prefix),
            size: o.size,
            size_formatted: formatSizeR2(o.size),
          }));
          if (files.length === 0 && productIdForList) {
            const resolvedPrefix = await resolveProductionPrefix(env, productIdForList, prefix, null);
            if (resolvedPrefix && resolvedPrefix !== prefix) {
              prefix = resolvedPrefix;
              const resolvedObjects = await r2List(env, prefix, true);
              files = resolvedObjects.filter(o => isDownloadableR2Object(o, prefix)).map(o => ({
                name: relativeR2Name(o.key, prefix),
                size: o.size,
                size_formatted: formatSizeR2(o.size),
              }));
            }
          }
          return json({ success: true, files, prefix });
        } catch (e) { console.error("list-path error:", e.message); return json({ success: false, error: "File listing failed: " + e.message }, 500); }
      }

      // ============ PRODUCTS: Create Editor Folder (R2 prod bucket) ============
      if (path === "/api/products/create-editor" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        try {
          const body = await request.json();
          const safeName = (body.name || "").replace(/[^a-zA-Z0-9 _\-.]/g, "").trim();
          if (!safeName) return json({ success: false, error: "Invalid folder name" }, 400);
          
          const prodBucket = env.STORAGE_PROD || env.STORAGE;
          // Check if folder already exists
          const existing = await prodBucket.list({ prefix: `${safeName}/`, delimiter: "/" });
          if ((existing.objects && existing.objects.length > 0) || (existing.delimitedPrefixes && existing.delimitedPrefixes.length > 0)) {
            return json({ success: false, error: `Folder '${safeName}' already exists` }, 409);
          }
          // Create placeholder to ensure folder prefix
          await prodBucket.put(`${safeName}/.placeholder`, "");
          return json({ success: true, message: `Editor folder '${safeName}' created` });
        } catch (e) {
          console.error("R2 create-editor error:", e.message);
          try {
            const body = await request.clone().json();
            const apiUrl = `${FILE_API}/api/files/create-editor?token=zyrex-files-api-2026`;
            const resp = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (resp.ok) return json(await resp.json());
          } catch (e2) { console.error("FILE_API create-editor fallback:", e2.message); }
        }
        return json({ success: false, error: "Create editor failed" }, 500);
      }

      // ============ PRODUCTS: Transfer to Production (R2 direct) ============
      if (path === "/api/products/transfer" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        try {
          const body = await request.json();
          const productId = body.product_id || "";
          const srcEditor = body.source_editor;
          const srcResource = body.source_resource;
          const dstEditor = body.destination_editor;
          if (!srcEditor || !srcResource || !dstEditor) {
            return json({ success: false, error: "Missing required fields" }, 400);
          }
          
          // SFTPGo username = Discord username (typical mapping)
          const username = session.username;
          if (!username) return json({ success: false, error: "No username in session" }, 400);
          
          // Auto-detect SFTPGo username from staging bucket
          let srcPrefix = null;
          const stagingBucket = env.STORAGE;
          
          // Scan top-level folders for files matching source_editor/source_resource
          const topList = await stagingBucket.list({ delimiter: "/" });
          for (const cp of topList.delimitedPrefixes || []) {
            const tryUser = cp.replace(/\/$/, "");
            const tryPrefix = `${tryUser}/${srcEditor}/${srcResource}/`;
            const check = await stagingBucket.list({ prefix: tryPrefix });
            if (check.objects.some(o => !o.key.endsWith("/"))) {
              srcPrefix = tryPrefix;
              break;
            }
          }
          
          // Fallback: try Discord username, then Discord ID pattern (SFTPGo naming)
          if (!srcPrefix) {
            srcPrefix = `${username}/${srcEditor}/${srcResource}/`;
            if (session.userId) {
              const altPrefix = `${username}_${session.userId}/${srcEditor}/${srcResource}/`;
              const altCheck = await stagingBucket.list({ prefix: altPrefix, limit: 1 });
              if (altCheck.objects.some(o => !o.key.endsWith("/"))) {
                srcPrefix = altPrefix;
              }
            }
          }
          // Production folder = editor/resource (clean structure)
          const dstPrefix = `${dstEditor}/${srcResource}/`;
          
          const prodBucket = env.STORAGE_PROD || env.STORAGE;
          
          // List files in staging
          const stagingList = await stagingBucket.list({ prefix: srcPrefix });
          const files = [];
          for (const obj of stagingList.objects) {
            if (obj.key === srcPrefix) continue;
            const rel = obj.key.slice(srcPrefix.length);
            if (rel && !rel.endsWith("/")) files.push({ srcKey: obj.key, relPath: rel, size: obj.size });
          }
          
          if (files.length === 0) {
            return json({ success: false, error: `No files found in cloud: ${srcEditor}/${srcResource}` }, 404);
          }
          
          // Copy each file from staging to production
          let copied = 0;
          const failed = [];
          for (const f of files) {
            try {
              const data = await stagingBucket.get(f.srcKey);
              if (data) {
                const bytes = await data.arrayBuffer();
                await prodBucket.put(dstPrefix + f.relPath, bytes);
                copied++;
              }
            } catch (e) {
              failed.push(f.srcKey);
              console.error("R2 copy failed:", f.srcKey, e.message);
            }
          }
          
          if (failed.length > 0 && copied === 0) {
            return json({ success: false, error: `Transfer failed: ${failed.length} files` }, 500);
          }
          
          // Inject watermark files into production
          const wmNames = ["LEAKED BY ZYREX.txt", "Visit for more resources!.url"];
          let wmCount = 0;
          for (const wm of wmNames) {
            try {
              const wmData = WATERMARKS[wm];
              if (wmData) {
                await prodBucket.put(dstPrefix + wm, wmData);
                wmCount++;
              }
            } catch (e) { /* ignore */ }
          }
          
          // Delete from staging
          for (const f of files) {
            try { await stagingBucket.delete(f.srcKey); } catch (e) { /* ignore */ }
          }
          
          const filePath = dstPrefix;
          return json({
            success: true,
            message: `Transferred ${copied} files, ${wmCount} watermarks. Cloud freed.`,
            file_path: filePath,
            files_copied: copied,
            watermarks_injected: wmCount,
          });
        } catch (e) {
          console.error("R2 transfer error:", e.message);
          return json({ success: false, error: "Transfer error: " + e.message }, 500);
        }
      }

      // ============ PUBLISH: Move from staging R2 → production R2 ============
      if (path === "/api/publish" && request.method === "POST") {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        if (!ADMIN_IDS.includes(session.userId)) return json({ error: "Admin only" }, 403);
        try {
          const body = await request.json();
          const resp = await fetch(`${FILE_API}/api/files/publish?token=zyrex-files-api-2026`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (resp.ok) return json(await resp.json());
          const errText = await resp.text();
          return json({ success: false, error: "Publish failed: " + errText }, 500);
        } catch (e) {
          return json({ success: false, error: "Publish error: " + e.message }, 500);
        }
      }

      // ============ SFTPGO ADMIN & CLOUD (direct bot proxy with auth) ============
      if (path.startsWith("/api/admin/sftpgo") || path.startsWith("/api/cloud/")) {
        const session = parseSession(request.headers.get("Cookie"));
        if (!session) return json({ error: "Not logged in" }, 401);
        if (!ADMIN_IDS.includes(session.userId)) return json({ error: "Admin only" }, 403);
        
        const targetUrl = `${BOT_API}${path}${url.search}`;
        try {
          const proxyResp = await fetch(targetUrl, {
            method: request.method,
            headers: {
              "Content-Type": "application/json",
              "X-User-ID": session.userId,
              "X-User-Name": session.username,
              "X-User-Can-Upload": session.canUpload ? "true" : "false",
              "X-User-Is-Admin": "true",
            },
            body: request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
          });
          const text = await proxyResp.text();
          try { return json(JSON.parse(text), proxyResp.status); }
          catch { return new Response(text, { status: proxyResp.status, headers: corsHeaders }); }
        } catch (e) {
          console.error("SFTPGo admin proxy error:", e.message);
          return json({ success: false, error: "Bot VPS unreachable" }, 502);
        }
      }

      // ============ BOT PROXY (admin, cloud link/unlink, downloads, hlx, verify, products) ============
      if (path.startsWith("/api/products") || path.startsWith("/api/admin/") || path.startsWith("/api/cloud/") || path.startsWith("/api/downloads/") || path.startsWith("/api/hlx/") || path.startsWith("/api/verify") || path.startsWith("/api/sftpgo/") || path === "/api/resource-stats") {
        const session = parseSession(request.headers.get("Cookie"));
        const proxyHeaders = {
          "Content-Type": "application/json",
        };
        if (session) {
          proxyHeaders["X-User-ID"] = session.userId || "";
          proxyHeaders["X-User-Name"] = session.username || "";
          proxyHeaders["X-User-Display-Name"] = session.displayName || session.username || "";
          proxyHeaders["X-User-Avatar"] = session.avatar || "";
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
          let parsed = JSON.parse(data);
          // Enrich product data with uploader_is_admin badge flag
          if (path === "/api/products" && botResp.ok) {
            if (url.searchParams.has("id")) {
              if (parsed && parsed.author_id) {
                parsed.uploader_is_admin = ADMIN_IDS.includes(parsed.author_id);
              }
            } else if (Array.isArray(parsed)) {
              parsed.forEach(p => {
                if (p && p.author_id) {
                  p.uploader_is_admin = ADMIN_IDS.includes(p.author_id);
                }
              });
            }
          }

          return json(parsed, botResp.status);
        } catch {
          return new Response(data, { status: botResp.status, headers: corsHeaders });
        }
      }

      // ============ PRESET PAGE: Inject OG meta tags for social sharing ============
      if (path === "/preset" || path === "/preset.html") {
        const presetId = url.searchParams.get("id") || "";
        const userAgent = (request.headers.get("User-Agent") || "").toLowerCase();
        const isCrawler = userAgent.includes("discordbot") || userAgent.includes("twitterbot") || userAgent.includes("facebookexternalhit") || userAgent.includes("whatsapp") || userAgent.includes("telegrambot") || userAgent.includes("slackbot") || userAgent.includes("linkedinbot");
        
        // Fetch product data from bot for OG tags
        let product = null;
        if (presetId) {
          try {
            const resp = await fetch(`${BOT_API}/api/products?id=${encodeURIComponent(presetId)}`);
            if (resp.ok) {
              const data = await resp.json();
              product = (Array.isArray(data) ? data[0] : data) || null;
            }
          } catch(e) {}
        }
        
        const ogTitle = product ? `${product.name} — Zyrex` : "Zyrex | Preset";
        const ogDesc = (product?.description || product?.desc || "Premium editing preset on Zyrex").substring(0, 200);
        const ogImage = product?.thumbnail || "https://zyrexediting.xyz/assets/banner.png";
        const ogUrl = `https://zyrexediting.xyz/preset?id=${encodeURIComponent(presetId)}`;
        
        // If it's a crawler, return a minimal HTML page with dynamic OG tags
        if (isCrawler) {
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${ogTitle}</title>
<meta property="og:type" content="website">
<meta property="og:url" content="${ogUrl}">
<meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}">
<meta property="og:description" content="${ogDesc.replace(/"/g, '&quot;')}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage}">
<meta name="description" content="${ogDesc.replace(/"/g, '&quot;')}">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
<h1>${ogTitle.replace(/"/g, '&quot;')}</h1>
<p>${ogDesc.replace(/"/g, '&quot;')}</p>
<img src="${ogImage}" alt="Preview" style="max-width:100%;height:auto">
<p><a href="${ogUrl}">View on Zyrex</a></p>
</body>
</html>`;
          return new Response(html, {
            status: 200,
            headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, max-age=60" },
          });
        }
        
        // For normal browsers: pass through to Pages
        // /preset → redirect to /preset.html (keeping query params)
        // /preset.html → serve directly via Pages (pass through subrequest)
        if (path === "/preset") {
          return Response.redirect(`/preset.html${url.search}`, 302);
        }
        // path === "/preset.html" → let Cloudflare serve from Pages
        return fetch(request);
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error("Worker error:", err.message);
      return json({ error: "Internal error" }, 500);
    }
  },
};
