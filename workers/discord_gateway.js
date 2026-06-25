/**
 * Zyrex Discord Gateway Bot - Cloudflare Workers
 * 
 * Uses a WebSocket connection to Discord Gateway to keep the bot
 * online in DND mode 24/7. Runs via cron trigger every 30s.
 * 
 * Environment secrets:
 *   DISCORD_BOT_TOKEN - Bot token from Discord Developer Portal
 */

const DISCORD_GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";

// Global state (persists across requests in same isolate)
let ws = null;
let seq = null;
let sessionId = null;
let heartbeatTimer = null;
let reconnectTimeout = null;
let isConnected = false;
let reconnectAttempts = 0;
let connectInProgress = false;

export default {
  async fetch(request, env, ctx) {
    // Trigger bot connection if not connected
    if (!isConnected && !connectInProgress) {
      ctx.waitUntil(connectToGateway(env));
    }

    // Status endpoint
    return new Response(JSON.stringify({
      status: isConnected ? "connected" : (connectInProgress ? "connecting" : "disconnected"),
      online: isConnected,
      sessionId: sessionId ? sessionId.substring(0,8)+"..." : null,
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  },

  // Cron trigger - runs every 30 seconds
  async scheduled(event, env, ctx) {
    if (!isConnected && !connectInProgress) {
      console.log("⏰ Cron: Not connected, starting gateway connection...");
      ctx.waitUntil(connectToGateway(env));
    } else if (isConnected) {
      console.log("⏰ Cron: Bot is connected and in DND mode.");
    }
  },
};

async function connectToGateway(env) {
  if (connectInProgress) return;
  connectInProgress = true;

  try {
    console.log("🔌 Connecting to Discord Gateway...");
    
    ws = new WebSocket(DISCORD_GATEWAY);

    ws.onopen = () => {
      console.log("✅ Gateway WebSocket opened");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data, env);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    ws.onclose = (event) => {
      console.log(`🔌 Gateway closed (code: ${event.code})`);
      isConnected = false;
      connectInProgress = false;
      cleanup();
      scheduleReconnect(env);
    };

    ws.onerror = (error) => {
      console.error("❌ Gateway error:", error.message || "Unknown");
      isConnected = false;
      connectInProgress = false;
    };

  } catch (error) {
    console.error("❌ Failed to connect:", error.message);
    connectInProgress = false;
    scheduleReconnect(env);
  }
}

function handleMessage(data, env) {
  const { op, d, s, t } = data;

  if (s !== null && s !== undefined) seq = s;

  switch (op) {
    case 10: {
      console.log(`👋 Hello received. Heartbeat interval: ${d.heartbeat_interval}ms`);
      startHeartbeat(d.heartbeat_interval);
      identify(env);
      break;
    }

    case 11: break;

    case 0: {
      if (t === "READY") {
        sessionId = d.session_id;
        isConnected = true;
        connectInProgress = false;
        reconnectAttempts = 0;
        console.log(`✅ Bot ready! User: ${d.user.username}`);
        setPresence("dnd", "zyrexediting.xyz");
      } else if (t === "RESUMED") {
        isConnected = true;
        console.log("✅ Session resumed");
      }
      break;
    }

    case 7: {
      console.log("🔄 Reconnect requested");
      ws.close(4000, "Reconnect");
      break;
    }

    case 9: {
      console.log("❌ Invalid session");
      if (d === true) resume(env);
      else { sessionId = null; seq = null; identify(env); }
      break;
    }
  }
}

function identify(env) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    op: 2,
    d: {
      token: env.DISCORD_BOT_TOKEN,
      intents: 1 << 0,
      properties: { os: "cloudflare", browser: "zyrex-bot", device: "zyrex-bot" },
      presence: { status: "dnd", activities: [{ name: "zyrexediting.xyz", type: 3 }], since: null, afk: false },
    },
  }));
  console.log("🔑 Identifying...");
}

function resume(env) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !sessionId || !seq) return;
  ws.send(JSON.stringify({ op: 6, d: { token: env.DISCORD_BOT_TOKEN, session_id: sessionId, seq } }));
  console.log("🔄 Resuming...");
}

function setPresence(status, text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    op: 3,
    d: { status, activities: [{ name: text, type: 3, state: text }], since: null, afk: false },
  }));
  console.log(`🎯 Presence: ${status} — watching ${text}`);
}

function startHeartbeat(interval) {
  cleanup();
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op: 1, d: seq }));
    } else {
      cleanup();
    }
  }, interval);
}

function scheduleReconnect(env) {
  const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), 60000);
  reconnectAttempts++;
  console.log(`⏰ Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})`);
  cleanup();
  reconnectTimeout = setTimeout(() => {
    connectInProgress = false;
    connectToGateway(env).catch(e => console.error("Reconnect error:", e));
  }, delay);
}

function cleanup() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
}
