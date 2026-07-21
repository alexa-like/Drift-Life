import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { connectDB } from "./lib/db";
import { startKeepAlive, stopKeepAlive } from "./lib/keepAlive";
import { seed } from "./lib/seed";
import { registerWebhook, setMyCommands, broadcastTelegramToLinkedUsers } from "./lib/telegram";
import { registerGuildCommands } from "./lib/discord";
import User from "./models/User";
import { verifyAccess } from "./lib/jwt";
import { allowedOrigins } from "./lib/cors";
import { closeExpiredAuctions, scheduleBotAuctions } from "./routes/auction";
import { expireBounties } from "./routes/bounties";
import { expireMarketListings } from "./routes/market";
import { postWeeklyRecap, pruneFeed } from "./routes/leaderboard";
import { postWeeklyBanRecap } from "./lib/banRecap";
import { tickBusinessIncome } from "./lib/businessIncomeWorker";
import VantaScheduledTask from "./models/VantaScheduledTask";
import { pushLog } from "./lib/logBuffer";
import { tickEventScheduler } from "./lib/eventEngine";

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

// Online presence tracking: socketId → userId (authenticated sockets only)
const onlineUsers = new Map<string, string>();

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

  // Authenticate socket — client must send a valid JWT access token
  socket.on("auth", async (token: string) => {
    try {
      if (!token || typeof token !== "string") return;
      // Verify the access token cryptographically — rejects expired, tampered, or forged tokens
      const payload = verifyAccess(token);
      const userId = payload.userId;
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
      // Track online presence and broadcast new count
      onlineUsers.set(socket.id, userId);
      io.emit("online_count", { count: new Set(onlineUsers.values()).size });
    } catch {
      // verifyAccess throws on invalid/expired token — silently reject
      socket.emit("auth_err", { message: "Invalid or expired token." });
    }
  });

  // Legacy join event — room join only, does NOT grant auth state
  socket.on("join", (userId: string) => {
    // Only allow joining the user's own room if already authenticated
    if (authedUserId && authedUserId === userId) {
      socket.join(`user:${userId}`);
    }
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

  // Event chat room
  socket.on("join_event", () => {
    socket.join("event");
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
    if (onlineUsers.has(socket.id)) {
      onlineUsers.delete(socket.id);
      io.emit("online_count", { count: new Set(onlineUsers.values()).size });
    }
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

// Make io and online user map available to routes
app.locals["io"] = io;
app.locals["onlineUsers"] = onlineUsers;

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

    // ── Business passive income: tick every 5 minutes ────────────────────────
    setInterval(() => {
      tickBusinessIncome().catch((err) =>
        logger.error({ err }, "business income tick error"),
      );
    }, 5 * 60 * 1000);
    tickBusinessIncome().catch((err) =>
      logger.error({ err }, "business income tick startup error"),
    );

    // ── Event scheduler: auto-activate / auto-end / flash cleanup every 60s ──
    setInterval(() => {
      tickEventScheduler(io).catch((err) =>
        logger.error({ err }, "event scheduler tick error"),
      );
    }, 60_000);
    tickEventScheduler(io).catch((err) =>
      logger.error({ err }, "event scheduler startup error"),
    );

    // ── Gang war expiry: check every 60s for active wars past endsAt ─────────
    setInterval(async () => {
      try {
        const { default: GangWar } = await import("./models/GangWar");
        const { resolveExpiredWar } = await import("./lib/warScoring");
        const expiredWars = await GangWar.find({
          status: "active",
          endsAt: { $lt: new Date() },
        });
        for (const war of expiredWars) {
          await resolveExpiredWar(war);
        }
      } catch (err) {
        logger.error({ err }, "gang-war expiry tick error");
      }
    }, 60_000);

    // ── Auction auto-close: run every 1 minute ────────────────────────────────
    setInterval(() => {
      closeExpiredAuctions().catch((err) =>
        logger.error({ err }, "auction auto-close interval error"),
      );
    }, 60 * 1000);
    // Run once immediately on startup to catch any auctions that expired while server was down
    closeExpiredAuctions().catch((err) =>
      logger.error({ err }, "auction auto-close startup error"),
    );

    // Bot-operated auction house: periodically spins up new Epic/Legendary auctions.
    scheduleBotAuctions();

    // ── Vanta scheduled tasks: check every 60s ────────────────────────────────
    setInterval(async () => {
      try {
        const now = new Date();
        const dueTasks = await VantaScheduledTask.find({ status: "pending", runAt: { $lte: now } });
        for (const task of dueTasks) {
          task.status = "running";
          task.executedAt = new Date();
          await task.save();
          try {
            let result = "";
            const p = task.payload as Record<string, unknown>;
            if (task.type === "scan_cheaters") {
              const suspects = await (await import("./models/User")).default
                .find({ dc: { $gte: 50_000_000 }, isGhostAccount: { $ne: true } })
                .select("username dc totalCrimes createdAt").limit(20);
              result = `Scan done. ${suspects.length} high-DC players: ${suspects.map((u: any) => `${u.username}(${u.dc.toLocaleString()}DC)`).join(", ")}`;
            } else if (task.type === "mass_currency" && p["currency"] && Number(p["amount"]) > 0) {
              const UserModel = (await import("./models/User")).default;
              const r = await UserModel.updateMany({ banned: false, isGhostAccount: { $ne: true } }, { $inc: { [p["currency"] as string]: Number(p["amount"]) } });
              result = `Mass currency done: +${p["amount"]} ${p["currency"]} to ${r.modifiedCount} players`;
            } else if (task.type === "wipe_test_accounts") {
              const UserModel = (await import("./models/User")).default;
              const r = await UserModel.deleteMany({ isGhostAccount: true });
              result = `Wiped ${r.deletedCount} ghost test accounts`;
            } else if (task.type === "mass_ban_check") {
              const UserModel = (await import("./models/User")).default;
              const cnt = await UserModel.countDocuments({ banned: true });
              result = `Ban check: ${cnt} accounts currently banned`;
            } else {
              result = `Task "${task.label}" executed (type: ${task.type})`;
            }
            task.status = "done";
            task.result = result;
            pushLog("info", `Vanta scheduled task "${task.label}" done`, result);
          } catch (err: unknown) {
            task.status = "failed";
            task.errorMessage = String(err);
            pushLog("error", `Vanta task "${task.label}" failed`, String(err));
          }
          await task.save();
        }
      } catch (err) {
        logger.error({ err }, "Vanta scheduled task runner error");
      }
    }, 60_000);

    // ── Market listing expiry: run every hour ─────────────────────────────────
    setInterval(() => {
      expireMarketListings().catch((err) =>
        logger.error({ err }, "market listing expiry interval error"),
      );
    }, 60 * 60 * 1000);
    // Run once immediately on startup to catch listings that expired while server was down
    expireMarketListings().catch((err) =>
      logger.error({ err }, "market listing expiry startup error"),
    );

    // ── Weekly leaderboard recap: check hourly, posts once per Monday ─────────
    // postWeeklyRecap() is idempotent (guarded by a persisted marker) so it's
    // safe to check on every tick — it only actually posts once the new week
    // starts and hasn't already been posted.
    setInterval(() => {
      postWeeklyRecap().catch((err) =>
        logger.error({ err }, "weekly leaderboard recap interval error"),
      );
    }, 60 * 60 * 1000);
    postWeeklyRecap().catch((err) =>
      logger.error({ err }, "weekly leaderboard recap startup error"),
    );

    // ── Weekly anonymized ban-count recap (Tier 8 §8.3): check hourly, posts
    // once per Monday — same idempotent-marker pattern as postWeeklyRecap above.
    setInterval(() => {
      postWeeklyBanRecap().catch((err) =>
        logger.error({ err }, "weekly ban recap interval error"),
      );
    }, 60 * 60 * 1000);
    postWeeklyBanRecap().catch((err) =>
      logger.error({ err }, "weekly ban recap startup error"),
    );

    // ── System feed pruning: cap at newest 500 events, check hourly ───────────
    setInterval(() => {
      pruneFeed().catch((err) =>
        logger.error({ err }, "feed prune interval error"),
      );
    }, 60 * 60 * 1000);
    pruneFeed().catch((err) =>
      logger.error({ err }, "feed prune startup error"),
    );

    // ── Bounty expiry: refund overdue bounties, check hourly ──────────────────
    setInterval(() => {
      expireBounties().catch((err) =>
        logger.error({ err }, "bounty expiry interval error"),
      );
    }, 60 * 60 * 1000);
    expireBounties().catch((err) =>
      logger.error({ err }, "bounty expiry startup error"),
    );

    // ── Daily quests reset notification: once per UTC day, checked hourly ─────
    // Uses an in-memory marker so we only broadcast once after midnight UTC.
    // Skips the very first check on startup (don't spam players each deploy).
    let _questResetDay = (() => {
      const d = new Date();
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    })();
    setInterval(async () => {
      const d = new Date();
      const today = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
      if (_questResetDay === today) return;
      _questResetDay = today;
      try {
        // Push notification to all subscribed players (re-use eventEngine's
        // broadcastPushToAll pattern inline to avoid a circular import)
        const { isWebPushConfigured, sendPushNotification } = await import("./lib/webPush");
        const PushSubscription = (await import("./models/PushSubscription")).default;
        if (isWebPushConfigured()) {
          const subs = await PushSubscription.find({}).lean();
          await Promise.allSettled(
            subs.map((sub) =>
              sendPushNotification({ endpoint: sub.endpoint, keys: (sub as any).keys }, {
                title: "📅 Daily Quests Reset",
                body: "New daily missions are ready. Log in to earn rewards!",
                link: "/daily",
                tag: "general",
              }).catch(() => {}),
            ),
          );
        }
        // Telegram notification to all linked players
        await broadcastTelegramToLinkedUsers(
          "📅 <b>Daily Quests Reset!</b>\n\nNew missions are available. Log in to Neonoir and earn your daily rewards!",
        );
        logger.info("Daily quests reset notification sent");
      } catch (err) {
        logger.error({ err }, "daily quests reset notification error");
      }
    }, 60 * 60 * 1000); // check hourly


    // Register Telegram webhook once the server is live and accepting traffic.
    //
    // TELEGRAM_WEBHOOK_URL must be set in the Render dashboard — it is the full
    // public URL of this server, e.g. https://neonoir.onrender.com/api/telegram/webhook
    const webhookUrl = process.env["TELEGRAM_WEBHOOK_URL"];
    const webhookSecret = "fbc6fcfc5581f5f2b9d03dc25dcd52e2df3399da36d7d695a5f2442e45591b7d";
    if (webhookUrl) {
      registerWebhook(webhookUrl, webhookSecret).catch((err) => {
        logger.warn({ err }, "Telegram webhook registration failed at startup");
      });
      // Register bot command menu shown in the Telegram "/" picker
      setMyCommands([
        { command: "start",     description: "Open the Neonoir menu" },
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

    // ── Discord slash command registration ────────────────────────────────────
    // Requires DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, and DISCORD_GUILD_ID.
    // Commands are registered as guild commands (instant propagation vs global 1h delay).
    const discordGuildId = process.env["DISCORD_GUILD_ID"];
    if (discordGuildId) {
      registerGuildCommands(discordGuildId, [
        {
          name:        "verify",
          description: "One-time identity verification with your Neonoir account",
          options: [{
            name:        "token",
            description: "Session token from the Neonoir Connections page",
            type:        3,       // STRING
            required:    true,
          }],
        },
        {
          name:        "link",
          description: "Permanently link your Discord account to Neonoir",
          options: [{
            name:        "token",
            description: "Session token from the Neonoir Connections page",
            type:        3,       // STRING
            required:    true,
          }],
        },
      ]).catch((err: unknown) => logger.warn({ err }, "Discord command registration failed"));
    } else {
      logger.info("DISCORD_GUILD_ID not set — skipping Discord command registration");
    }
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
