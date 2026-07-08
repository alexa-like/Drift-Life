import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { connectDB } from "./lib/db";
import { startKeepAlive, stopKeepAlive } from "./lib/keepAlive";
import { seed } from "./lib/seed";
import { registerWebhook, setMyCommands } from "./lib/telegram";
import User from "./models/User";
import { allowedOrigins } from "./lib/cors";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
  path: "/api/socket.io",
});

// Per-socket rate limiting: 10 messages per 60s window
const chatRateMap = new Map<string, { count: number; resetAt: number; lastMsgs: string[] }>();

function checkRateLimit(socketId: string, content: string): boolean {
  const now = Date.now();
  let entry = chatRateMap.get(socketId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60000, lastMsgs: [] };
    chatRateMap.set(socketId, entry);
  }
  if (entry.count >= 10) return false;
  // Same message 3x in a row → reject
  const recent = entry.lastMsgs.slice(-3);
  if (recent.length === 3 && recent.every(m => m === content)) return false;
  entry.count++;
  entry.lastMsgs.push(content);
  return true;
}

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket connected");

  let authedUserId: string | null = null;
  let authedUsername: string | null = null;
  let authedFaction: string | null = null;
  let authedTitle: string | null = null;

  // Authenticate socket, join private room
  socket.on("auth", async (userId: string) => {
    try {
      const user = await User.findById(userId)
        .select("username faction equippedTitle role banned")
        .lean();
      if (!user || user.banned) return;
      authedUserId = userId;
      authedUsername = user.username;
      authedFaction = user.faction || "neutral";
      authedTitle = user.equippedTitle || null;
      socket.join(`user:${userId}`);
      socket.emit("auth_ok", { userId });
    } catch {
      // ignore
    }
  });

  // Legacy join event (backward compat)
  socket.on("join", (userId: string) => {
    socket.join(`user:${userId}`);
  });

  // District rooms
  socket.on("join_district", (districtId: string) => {
    socket.join(`district:${districtId}`);
  });

  socket.on("leave_district", (districtId: string) => {
    socket.leave(`district:${districtId}`);
  });

  // Global room
  socket.on("join_global", () => {
    socket.join("global");
  });

  socket.on("join_faction", (faction: string | null) => {
    if (faction) socket.join(`faction:${faction}`);
  });

  socket.on("leave_faction", (faction: string | null) => {
    if (faction) socket.leave(`faction:${faction}`);
  });

  // Guild room
  socket.on("join_guild", (guildId: string) => {
    socket.join(`guild:${guildId}`);
  });

  // District chat
  socket.on("chat_message", async ({ districtId, content }: { districtId: string; content: string }) => {
    if (!authedUserId || !content) return;
    const trimmed = String(content).trim().slice(0, 280);
    if (!trimmed) return;
    if (!checkRateLimit(socket.id, trimmed)) {
      socket.emit("chat_error", "Slow down — you're sending too many messages.");
      return;
    }
    try {
      const user = await User.findById(authedUserId)
        .select("mutedUntil faction equippedTitle")
        .lean();
      if (user?.mutedUntil && new Date(user.mutedUntil) > new Date()) {
        socket.emit("chat_error", "You are muted.");
        return;
      }
      io.to(`district:${districtId}`).emit("chat_message", {
        id: `${Date.now()}-${socket.id}`,
        districtId,
        userId: authedUserId,
        username: authedUsername,
        faction: user?.faction || authedFaction,
        title: user?.equippedTitle || authedTitle || null,
        content: trimmed,
        at: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  });

  // Global chat
  socket.on("global_message", async ({ content }: { content: string }) => {
    if (!authedUserId || !content) return;
    const trimmed = String(content).trim().slice(0, 280);
    if (!trimmed) return;
    if (!checkRateLimit(socket.id, trimmed)) {
      socket.emit("chat_error", "Slow down — you're sending too many messages.");
      return;
    }
    try {
      const user = await User.findById(authedUserId)
        .select("mutedUntil faction equippedTitle")
        .lean();
      if (user?.mutedUntil && new Date(user.mutedUntil) > new Date()) {
        socket.emit("chat_error", "You are muted.");
        return;
      }
      io.to("global").emit("global_message", {
        id: `${Date.now()}-${socket.id}`,
        userId: authedUserId,
        username: authedUsername,
        faction: user?.faction || authedFaction,
        title: user?.equippedTitle || authedTitle || null,
        content: trimmed,
        at: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  });

  // Guild chat
  socket.on("guild_message", ({ guildId, content }: { guildId: string; content: string }) => {
    if (!authedUserId || !content) return;
    const trimmed = String(content).trim().slice(0, 280);
    if (!trimmed) return;
    if (!checkRateLimit(socket.id, trimmed)) {
      socket.emit("chat_error", "Slow down.");
      return;
    }
    io.to(`guild:${guildId}`).emit("guild_message", {
      id: `${Date.now()}-${socket.id}`,
      userId: authedUserId,
      username: authedUsername,
      faction: authedFaction,
      content: trimmed,
      at: new Date().toISOString(),
    });
  });

  // DM notification
  socket.on("dm_sent", ({ recipientId }: { recipientId: string }) => {
    if (!authedUserId) return;
    io.to(`user:${recipientId}`).emit("new_dm", {
      senderId: authedUserId,
      senderName: authedUsername,
    });
  });

  // PvP attack notification — also emitted from routes
  socket.on("notify_attack", ({ targetId, result }: { targetId: string; result: unknown }) => {
    if (!authedUserId) return;
    io.to(`user:${targetId}`).emit("attack_notification", result);
  });

  socket.on("disconnect", () => {
    chatRateMap.delete(socket.id);
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

// Make io available to routes
app.locals["io"] = io;

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  stopKeepAlive();
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// Last-resort safety nets — log and keep the process alive instead of
// crashing on a stray unhandled promise rejection or synchronous throw
// that slipped past route-level try/catch and Express error middleware.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
});

async function start() {
  await connectDB();
  await seed();
  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
    startKeepAlive();

    // Register Telegram webhook once the server is live and accepting traffic.
    //
    // Required env vars (set in Render dashboard):
    //   TELEGRAM_WEBHOOK_URL    — full public URL of this server, e.g.
    //                             https://driftlife.onrender.com/api/telegram/webhook
    //   TELEGRAM_WEBHOOK_SECRET — an arbitrary secret shared between Render and
    //                             Telegram; used to validate every incoming webhook
    //                             request. MUST be set — without it the webhook
    //                             endpoint rejects all requests.
    const webhookUrl = process.env["TELEGRAM_WEBHOOK_URL"];
    const webhookSecret = process.env["TELEGRAM_WEBHOOK_SECRET"];
    if (webhookUrl && webhookSecret) {
      registerWebhook(webhookUrl, webhookSecret).catch((err) => {
        logger.warn({ err }, "Telegram webhook registration failed at startup");
      });
      // Register bot command menu shown in the Telegram "/" picker
      setMyCommands([
        { command: "start",     description: "Open the DriftLife menu" },
        { command: "status",    description: "View your NC balance & subscription" },
        { command: "buy",       description: "Browse & buy NC packs" },
        { command: "subscribe", description: "View & purchase subscription tiers" },
        { command: "help",      description: "Show all commands" },
      ]).catch((err) => logger.warn({ err }, "Telegram setMyCommands failed"));
    } else if (webhookUrl && !webhookSecret) {
      logger.warn("TELEGRAM_WEBHOOK_URL is set but TELEGRAM_WEBHOOK_SECRET is missing — webhook NOT registered (required for security)");
    } else {
      logger.info("TELEGRAM_WEBHOOK_URL not set — skipping Telegram webhook registration");
    }
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
