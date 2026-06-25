// Zyrex API Worker - Handles Discord OAuth, session management, and guild stats
// Deploy with: npx wrangler deploy workers/api.js --name zyrex-api

const DISCORD_API = 'https://discord.com/api/v10';

// CORS headers for frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function redirect(url) {
  return Response.redirect(url, 302);
}

function parseSession(cookie) {
  if (!cookie) return null;
  const match = cookie.match(/zyrex_session=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(atob(match[1]));
  } catch {
    return null;
  }
}

function createCookie(sessionData, maxAge = 86400) {
  const encoded = btoa(JSON.stringify(sessionData));
  return `zyrex_session=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

function clearCookie() {
  return 'zyrex_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ========== LOGIN ==========
    if (path === '/api/login') {
      const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify email guilds.members.read',
        prompt: 'none',
      });
      return redirect(`${DISCORD_API}/oauth2/authorize?${params}`);
    }

    // ========== LOGOUT ==========
    if (path === '/api/logout') {
      return new Response(null, {
        status: 302,
        headers: { Location: '/', 'Set-Cookie': clearCookie() },
      });
    }

    // ========== ME ==========
    if (path === '/api/me') {
      const cookie = request.headers.get('Cookie');
      const session = parseSession(cookie);
      if (!session) return json({ error: 'Not logged in' }, 401);
      return json({
        id: session.userId,
        username: session.username,
        global_name: session.displayName || session.username,
        avatar: session.avatar,
        can_upload: session.canUpload || false,
      });
    }

    // ========== AUTH CALLBACK ==========
    if (path === '/api/auth/callback') {
      const code = url.searchParams.get('code');
      if (!code) return redirect('/?error=no_code');

      // Exchange code for token
      const tokenData = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: env.DISCORD_REDIRECT_URI,
      });

      const tokenResp = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenData,
      });
      if (!tokenResp.ok) return redirect('/?error=auth_failed');
      const token = await tokenResp.json();

      // Get user info
      const userResp = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!userResp.ok) return redirect('/?error=user_fetch_failed');
      const discordUser = await userResp.json();

      // Check guild membership for upload role
      let canUpload = false;
      try {
        const memberResp = await fetch(
          `${DISCORD_API}/guilds/${env.GUILD_ID}/members/${discordUser.id}`,
          { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } }
        );
        if (memberResp.ok) {
          const member = await memberResp.json();
          canUpload = member.roles?.includes(env.UPLOAD_ROLE_ID);
        }
      } catch (e) {
        console.error('Guild check failed:', e);
      }

      const sessionData = {
        userId: discordUser.id,
        username: discordUser.username,
        displayName: discordUser.global_name || discordUser.username,
        avatar: discordUser.avatar,
        canUpload,
      };

      return new Response(null, {
        status: 302,
        headers: {
          Location: '/',
          'Set-Cookie': createCookie(sessionData),
        },
      });
    }

    // ========== GUILD STATS ==========
    if (path === '/api/guild/stats') {
      try {
        const gResp = await fetch(
          `${DISCORD_API}/guilds/${env.GUILD_ID}?with_counts=true`,
          { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } }
        );
        if (!gResp.ok) return json(fallbackStats());
        const guild = await gResp.json();
        return json({
          name: guild.name || 'Zyrex Community',
          icon: guild.icon || '',
          member_count: guild.approximate_member_count || guild.member_count || 0,
          online_count: guild.approximate_presence_count || 0,
          channels_count: 0,
          boost_level: guild.premium_tier || 0,
        });
      } catch (e) {
        return json(fallbackStats());
      }
    }

    // ========== DISCORD USER (for team section) ==========
    if (path === '/api/discord-user') {
      const userId = url.searchParams.get('userId');
      if (!userId) return json({ error: 'userId required' }, 400);
      try {
        const uResp = await fetch(`${DISCORD_API}/users/${userId}`, {
          headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
        });
        if (!uResp.ok) return json({ success: false, error: 'User not found' });
        const user = await uResp.json();
        return json({ success: true, user });
      } catch (e) {
        return json({ success: false, error: e.message });
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};

function fallbackStats() {
  return {
    name: 'Zyrex Community',
    icon: '',
    member_count: 0,
    online_count: 0,
    channels_count: 0,
    boost_level: 0,
  };
}
