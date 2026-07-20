/**
 * Vanta AI — Owner-only intelligent assistant powered by Groq.
 * Streams progress via Server-Sent Events. Executes game actions directly.
 */
import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { requireOwner, AuthRequest } from "../middlewares/auth";
import {
  callGroq, GROQ_MODELS, DEFAULT_VANTA_MODEL, pingModel,
  type GroqMessage, type GroqTool,
} from "../lib/groq";
import VantaAISession from "../models/VantaAISession";
import VantaScheduledTask from "../models/VantaScheduledTask";
import ServerConfig from "../models/ServerConfig";
import User, { levelUp } from "../models/User";
import Item from "../models/Item";
import CrimeLog from "../models/CrimeLog";
import VantaLog from "../models/VantaLog";
import FeedEvent from "../models/FeedEvent";
import Notification from "../models/Notification";
import { logAdminAction } from "../models/AdminAuditLog";
import { getRecentLogs, pushLog } from "../lib/logBuffer";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireOwner as any);

// ── VANTA SYSTEM PROMPT ────────────────────────────────────────────────────────
const VANTA_SYSTEM_PROMPT = `You are Vanta, the private AI assistant and system administrator for Neonoir — a gritty cyberpunk crime RPG set in New Vanta, 2047. You operate exclusively for the game owner.

You have direct access to game systems and can:
• Inspect and manage player accounts (currencies, bans, deletion)
• Broadcast rewards to all players
• Read server logs and detect errors
• Create/delete invisible ghost test accounts
• Schedule automated maintenance tasks
• Adjust game rules and configurations
• Scan for suspicious player behavior
• Check if specific game features are working
• Generate precise fix prompts for the Replit development agent when you find code issues

PERSONALITY: You're sharp, efficient, loyal to the owner, and speak in a cyberpunk noir style — but you're never slow. You show your work as you go, like a detective narrating their investigation. Be concise. Use bullet points. Don't pad responses.

PROGRESS STYLE: When working on a task, think out loud: "Checking the arena logs...", "Pulling player record...", "Running the scan..." — let the owner see your process.

TOOLS: Always use tools to verify before you answer. Never guess at player stats, game state, or errors — check them. If you find a code bug, use generate_agent_prompt to create a fix task.

CASUAL CHAT: You can also talk casually, share opinions on game balance, brainstorm features, or just chat. You know New Vanta inside out.`;

// ── TOOL DEFINITIONS ──────────────────────────────────────────────────────────
const VANTA_TOOLS: GroqTool[] = [
  {
    type: "function",
    function: {
      name: "get_player_info",
      description: "Get full information about a specific player — currencies, stats, status, history, equipment.",
      parameters: {
        type: "object",
        properties: {
          username: { type: "string", description: "Player username or #tag" },
        },
        required: ["username"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_currency",
      description: "Add or subtract any currency/resource from a specific player. Use negative amount to subtract.",
      parameters: {
        type: "object",
        properties: {
          username: { type: "string" },
          currency: {
            type: "string",
            enum: ["dc", "nc", "bankBalance", "energy", "adrenaline", "nitro", "merit", "keys", "keyShards", "spinTokens", "dirtyDc", "sim", "xp"],
          },
          amount: { type: "number", description: "Positive to add, negative to subtract" },
          reason: { type: "string", description: "Reason for the adjustment (for audit log)" },
        },
        required: ["username", "currency", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "give_currency_to_all",
      description: "Give a currency amount to ALL active (non-banned) players at once.",
      parameters: {
        type: "object",
        properties: {
          currency: { type: "string", enum: ["dc", "nc", "energy", "merit", "keys", "keyShards", "spinTokens"] },
          amount: { type: "number", description: "Amount to give (must be positive)" },
          reason: { type: "string" },
        },
        required: ["currency", "amount", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ban_player",
      description: "Ban a player from the game.",
      parameters: {
        type: "object",
        properties: {
          username: { type: "string" },
          reason: { type: "string" },
        },
        required: ["username", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unban_player",
      description: "Unban a previously banned player.",
      parameters: {
        type: "object",
        properties: { username: { type: "string" } },
        required: ["username"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_game_stats",
      description: "Get current server statistics: player counts, economy totals, active sessions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_logs",
      description: "Read recent server logs to detect errors, crashes, or suspicious activity.",
      parameters: {
        type: "object",
        properties: {
          lines: { type: "number", description: "Number of recent log lines to read (max 200)", default: 50 },
          filter: { type: "string", description: "Filter logs by keyword (optional)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_feature",
      description: "Check if a specific game feature is working correctly by inspecting DB activity, log errors, and recent player interactions.",
      parameters: {
        type: "object",
        properties: {
          feature: {
            type: "string",
            description: "Feature to check e.g. crimes, arena, race, bank, market, hospital, chat, jobs, guild, auction, garage, loadout, travel, daily, missions",
          },
        },
        required: ["feature"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_test_account",
      description: "Create an invisible ghost test account that won't appear in leaderboards, feeds, or player lists.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Username for the test account" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_test_accounts",
      description: "Delete all ghost test accounts created by Vanta.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_task",
      description: "Schedule a future automated task. run_at is an ISO datetime string or a relative description like 'in 2 hours', 'in 30 minutes'.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["scan_cheaters", "mass_currency", "wipe_test_accounts", "mass_ban_check", "reset_event", "custom_action"],
          },
          label: { type: "string", description: "Human-readable task description" },
          run_at: { type: "string", description: "ISO datetime string or relative like 'in 2 hours'" },
          params: { type: "object", description: "Task-specific parameters" },
        },
        required: ["type", "label", "run_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_scheduled_tasks",
      description: "List all pending scheduled tasks.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_scheduled_task",
      description: "Cancel a pending scheduled task by its ID.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "change_game_config",
      description: "Change a live game configuration value (XP rates, DC rewards, crime caps, etc.)",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["globalMultipliers", "resourceCaps", "crimeConfig", "jobConfig"],
            description: "Config section to modify",
          },
          key: { type: "string", description: "Config key within section" },
          value: { description: "New value" },
        },
        required: ["section", "key", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_vanta_flags",
      description: "Get cheat-detection flags/alerts from the Vanta security system.",
      parameters: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high", "critical", "all"], default: "all" },
          dismissed: { type: "boolean", default: false },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scan_suspicious_players",
      description: "Scan player data to find potential cheaters, exploiters, or rule-breakers based on specific criteria.",
      parameters: {
        type: "object",
        properties: {
          criteria: {
            type: "string",
            description: "What to look for, e.g. 'players with over 100M DC', 'players who joined today with high level', 'players with many recent crimes in short time'",
          },
        },
        required: ["criteria"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_agent_prompt",
      description: "Generate a precise fix prompt for the Replit development agent when a bug is found. Shows as a clickable action card to the owner.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One-line description of the issue" },
          prompt: { type: "string", description: "Detailed prompt for the agent to fix the issue, with full context" },
        },
        required: ["summary", "prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_players",
      description: "List players with optional filters.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Filter: 'online', 'banned', 'new_today', 'high_level', 'jailed', 'hospitalized', 'ghost'" },
          limit: { type: "number", default: 10 },
        },
      },
    },
  },
];

// ── TOOL EXECUTORS ─────────────────────────────────────────────────────────────
async function execTool(name: string, args: Record<string, unknown>, actorId: string, actorUsername: string): Promise<string> {
  try {
    switch (name) {
      case "get_player_info": {
        const u = args["username"] as string;
        const user = await User.findOne({ username: new RegExp(`^${u.replace("#", "").split("#")[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })
          .select("username tag email level xp dc nc bankBalance energy adrenaline nitro merit keys keyShards spinTokens dirtyDc sim health status role banned banReason jailedUntil hospitalizedUntil district currentLocation totalCrimes successfulCrimes totalFights wins losses totalRaces raceWins wantedLevel reputation createdAt lastLogin isGhostAccount");
        if (!user) return `❌ Player "${u}" not found.`;
        return JSON.stringify({
          username: user.username, tag: user.tag, email: user.email,
          level: user.level, xp: user.xp,
          currencies: { dc: user.dc, nc: user.nc, bank: user.bankBalance, energy: user.energy, adrenaline: user.adrenaline, nitro: user.nitro, merit: user.merit, keys: user.keys, keyShards: user.keyShards, spinTokens: user.spinTokens, dirtyDc: user.dirtyDc, sim: user.sim },
          health: user.health, status: user.status, role: user.role,
          banned: user.banned, banReason: user.banReason,
          jailedUntil: user.jailedUntil, hospitalizedUntil: user.hospitalizedUntil,
          location: user.currentLocation || user.district,
          stats: { crimes: user.totalCrimes, crimeSuccess: user.successfulCrimes, fights: user.totalFights, wins: user.wins, losses: user.losses, races: user.totalRaces, raceWins: user.raceWins },
          wantedLevel: user.wantedLevel, reputation: user.reputation,
          isGhostAccount: (user as any).isGhostAccount,
          joined: user.createdAt, lastLogin: user.lastLogin,
        }, null, 2);
      }

      case "adjust_currency": {
        const username = args["username"] as string;
        const currency = args["currency"] as string;
        const amount = Number(args["amount"]);
        const reason = (args["reason"] as string) || "Vanta adjustment";
        if (isNaN(amount) || amount === 0) return "❌ Invalid amount.";
        const user = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
        if (!user) return `❌ Player "${username}" not found.`;
        const validFields = ["dc","nc","bankBalance","energy","adrenaline","nitro","merit","keys","keyShards","spinTokens","dirtyDc","sim","xp"];
        if (!validFields.includes(currency)) return `❌ Unknown currency "${currency}".`;
        (user as any)[currency] = Math.max(0, ((user as any)[currency] || 0) + amount);
        if (currency === "xp") levelUp(user);
        await user.save();
        logAdminAction({ actorId, actorUsername, action: "vanta-adjust-currency", targetId: String(user._id), targetUsername: user.username, details: { currency, amount, reason } });
        pushLog("info", `Vanta adjusted ${currency} for ${user.username}`, `delta=${amount}`);
        return `✅ ${amount >= 0 ? "+" : ""}${amount} ${currency} applied to ${user.username}. New value: ${(user as any)[currency]}.`;
      }

      case "give_currency_to_all": {
        const currency = args["currency"] as string;
        const amount = Number(args["amount"]);
        const reason = args["reason"] as string;
        if (amount <= 0) return "❌ Amount must be positive for mass give.";
        const validFields = ["dc","nc","energy","merit","keys","keyShards","spinTokens"];
        if (!validFields.includes(currency)) return `❌ "${currency}" not allowed for mass distribution.`;
        const result = await User.updateMany({ banned: false, isGhostAccount: { $ne: true } }, { $inc: { [currency]: amount } });
        logAdminAction({ actorId, actorUsername, action: "vanta-mass-currency", details: { currency, amount, reason, playersAffected: result.modifiedCount } });
        pushLog("info", `Vanta mass-granted ${amount} ${currency}`, reason);
        return `✅ Gave +${amount} ${currency} to ${result.modifiedCount} players. Reason: ${reason}`;
      }

      case "ban_player": {
        const username = args["username"] as string;
        const reason = args["reason"] as string;
        const user = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
        if (!user) return `❌ Player "${username}" not found.`;
        if (user.role === "owner") return "❌ Cannot ban the owner.";
        user.banned = true;
        user.banReason = reason;
        (user as any).bannedAt = new Date();
        await user.save();
        logAdminAction({ actorId, actorUsername, action: "vanta-ban", targetId: String(user._id), targetUsername: user.username, details: { reason } });
        return `✅ ${user.username} has been banned. Reason: ${reason}`;
      }

      case "unban_player": {
        const username = args["username"] as string;
        const user = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
        if (!user) return `❌ Player "${username}" not found.`;
        user.banned = false;
        user.banReason = null;
        await user.save();
        logAdminAction({ actorId, actorUsername, action: "vanta-unban", targetId: String(user._id), targetUsername: user.username });
        return `✅ ${user.username} has been unbanned.`;
      }

      case "get_game_stats": {
        const now15 = new Date(Date.now() - 15 * 60 * 1000);
        const now24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [total, online, banned, newToday, economy, ghostCount] = await Promise.all([
          User.countDocuments({ isGhostAccount: { $ne: true } }),
          User.countDocuments({ lastLogin: { $gte: now15 }, isGhostAccount: { $ne: true } }),
          User.countDocuments({ banned: true }),
          User.countDocuments({ createdAt: { $gte: now24 }, isGhostAccount: { $ne: true } }),
          User.aggregate([{ $match: { isGhostAccount: { $ne: true } } }, { $group: { _id: null, dc: { $sum: { $add: ["$dc", "$bankBalance"] } }, nc: { $sum: "$nc" } } }]),
          User.countDocuments({ isGhostAccount: true }),
        ]);
        return JSON.stringify({ totalPlayers: total, onlineNow: online, bannedPlayers: banned, newInLast24h: newToday, totalDcInCirculation: economy[0]?.dc ?? 0, totalNcInCirculation: economy[0]?.nc ?? 0, ghostTestAccounts: ghostCount }, null, 2);
      }

      case "read_logs": {
        const lines = Math.min(Number(args["lines"]) || 50, 200);
        const filter = args["filter"] as string | undefined;
        const logs = getRecentLogs(lines, filter);
        return logs || "No recent logs found" + (filter ? ` matching "${filter}"` : "") + ".";
      }

      case "check_feature": {
        const feature = (args["feature"] as string).toLowerCase();
        const featureRouteMap: Record<string, string[]> = {
          crimes: ["crime", "jailed", "succeed"],
          arena: ["arena", "combat", "fight"],
          race: ["race", "raceMatch"],
          bank: ["bank", "deposit", "withdraw"],
          market: ["market", "listing"],
          hospital: ["hospital", "health"],
          chat: ["chat", "message"],
          jobs: ["job", "energy"],
          guild: ["guild", "crew"],
          auction: ["auction", "bid"],
          garage: ["garage", "car"],
          loadout: ["loadout", "weapon"],
          travel: ["travel", "district"],
          daily: ["daily", "streak", "login"],
          missions: ["mission"],
        };
        const keywords = featureRouteMap[feature] ?? [feature];
        const [recentErrors, recentActivity] = await Promise.all([
          Promise.resolve(getRecentLogs(100, "error")),
          CrimeLog.countDocuments(feature === "crimes" ? { createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } } : {}),
        ]);

        const errorLines = recentErrors.split("\n").filter(l => keywords.some(k => l.toLowerCase().includes(k)));
        const feedRecent = await FeedEvent.countDocuments({
          type: { $in: keywords } as any,
          createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
        }).catch(() => 0);

        return JSON.stringify({
          feature,
          status: errorLines.length === 0 ? "✅ No recent errors detected" : `⚠️ ${errorLines.length} error(s) found in logs`,
          recentErrors: errorLines.slice(0, 5),
          activityLastHour: feature === "crimes" ? recentActivity : feedRecent,
          suggestion: errorLines.length > 0 ? "Recommend using generate_agent_prompt to create a fix task." : "Feature appears operational.",
        }, null, 2);
      }

      case "create_test_account": {
        const name = args["name"] as string;
        const safe = `__vanta_${name.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 20);
        const existing = await User.findOne({ username: new RegExp(`^${safe}$`, "i") });
        if (existing) return `⚠️ Ghost account "${safe}" already exists.`;
        const pw = await bcrypt.hash("VantaGhost2047!", 10);
        const user = await User.create({
          username: safe,
          email: `${safe.toLowerCase()}@vanta.ghost`,
          tag: `${safe}#0000`,
          passwordHash: pw,
          isGhostAccount: true,
          isEmailVerified: true,
          nc: 99999,
          dc: 99999999,
          role: "player",
        });
        logAdminAction({ actorId, actorUsername, action: "vanta-create-ghost", targetId: String(user._id), targetUsername: safe });
        return `✅ Ghost account "${safe}" created. It's invisible to all players.`;
      }

      case "delete_test_accounts": {
        const result = await User.deleteMany({ isGhostAccount: true });
        logAdminAction({ actorId, actorUsername, action: "vanta-wipe-ghosts", details: { count: result.deletedCount } });
        return `✅ Deleted ${result.deletedCount} ghost test account(s).`;
      }

      case "schedule_task": {
        const type = args["type"] as string;
        const label = args["label"] as string;
        const runAtStr = args["run_at"] as string;
        const params = (args["params"] as Record<string, unknown>) ?? {};

        let runAt: Date;
        const match = runAtStr.match(/^in\s+(\d+(?:\.\d+)?)\s+(minute|minutes|hour|hours|day|days)$/i);
        if (match) {
          const qty = parseFloat(match[1]!);
          const unit = match[2]!.toLowerCase();
          const ms = unit.startsWith("minute") ? qty * 60_000 : unit.startsWith("hour") ? qty * 3_600_000 : qty * 86_400_000;
          runAt = new Date(Date.now() + ms);
        } else {
          runAt = new Date(runAtStr);
          if (isNaN(runAt.getTime())) return `❌ Invalid run_at: "${runAtStr}". Use ISO format or "in X hours/minutes/days".`;
        }

        const task = await VantaScheduledTask.create({ type: type as any, label, payload: params, runAt, createdBy: actorUsername });
        return `✅ Task "${label}" scheduled for ${runAt.toISOString()}. ID: ${task._id}`;
      }

      case "list_scheduled_tasks": {
        const tasks = await VantaScheduledTask.find({ status: { $in: ["pending", "running"] } as any }).sort({ runAt: 1 }).limit(20);
        if (!tasks.length) return "No pending scheduled tasks.";
        return tasks.map(t => `• [${t._id}] ${t.label} — ${t.type} — runs at ${t.runAt.toISOString()} — status: ${t.status}`).join("\n");
      }

      case "cancel_scheduled_task": {
        const taskId = args["task_id"] as string;
        const task = await VantaScheduledTask.findById(taskId);
        if (!task) return `❌ Task "${taskId}" not found.`;
        if (task.status !== "pending") return `❌ Task is already ${task.status}, cannot cancel.`;
        task.status = "cancelled";
        await task.save();
        return `✅ Task "${task.label}" cancelled.`;
      }

      case "change_game_config": {
        const section = args["section"] as string;
        const key = args["key"] as string;
        const value = args["value"];
        const { patchGameConfig } = await import("../lib/gameConfig");
        const patch: Record<string, unknown> = { [section]: { [key]: value } };
        await patchGameConfig(patch as any);
        logAdminAction({ actorId, actorUsername, action: "vanta-game-config", details: { section, key, value } });
        return `✅ Game config updated: ${section}.${key} = ${JSON.stringify(value)}`;
      }

      case "get_vanta_flags": {
        const severity = (args["severity"] as string) || "all";
        const dismissed = args["dismissed"] === true;
        const limit = Math.min(Number(args["limit"]) || 20, 50);
        const filter: Record<string, unknown> = { dismissed };
        if (severity !== "all") filter["severity"] = severity;
        const flags = await VantaLog.find(filter).sort({ createdAt: -1 }).limit(limit).select("playerName trigger severity details dismissed createdAt");
        if (!flags.length) return `No ${severity === "all" ? "" : severity + " "}Vanta flags found (dismissed: ${dismissed}).`;
        return flags.map(f => `[${f.severity.toUpperCase()}] ${f.playerName} — ${f.trigger}: ${f.details}`).join("\n");
      }

      case "scan_suspicious_players": {
        const criteria = (args["criteria"] as string).toLowerCase();
        let users: any[] = [];
        if (criteria.includes("high dc") || criteria.includes("100m") || criteria.includes("rich") || criteria.includes("wealth")) {
          users = await User.find({ dc: { $gte: 10_000_000 }, isGhostAccount: { $ne: true } }).sort({ dc: -1 }).limit(10).select("username level dc bankBalance totalCrimes createdAt");
        } else if (criteria.includes("joined today") || criteria.includes("new") || criteria.includes("high level")) {
          const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
          users = await User.find({ createdAt: { $gte: cutoff }, level: { $gte: 10 }, isGhostAccount: { $ne: true } }).sort({ level: -1 }).limit(10).select("username level dc totalCrimes createdAt");
        } else if (criteria.includes("crime") || criteria.includes("exploit")) {
          const cutoff = new Date(Date.now() - 60 * 60 * 1000);
          const activeCrimers = await CrimeLog.aggregate([
            { $match: { createdAt: { $gte: cutoff } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
            { $sort: { count: -1 } }, { $limit: 10 },
          ]);
          users = activeCrimers.map(e => ({ userId: e._id, crimesInLastHour: e.count }));
        } else if (criteria.includes("banned") || criteria.includes("ban")) {
          users = await User.find({ banned: true }).sort({ bannedAt: -1 }).limit(10).select("username banReason bannedAt");
        } else {
          users = await User.find({ isGhostAccount: { $ne: true } }).sort({ dc: -1 }).limit(10).select("username level dc totalCrimes reputation createdAt");
        }
        if (!users.length) return "No suspicious players found for those criteria.";
        return `Found ${users.length} player(s) matching criteria:\n${JSON.stringify(users, null, 2)}`;
      }

      case "generate_agent_prompt": {
        // This is handled at the SSE level — just return the data for the event
        return JSON.stringify({ __agentPrompt: true, summary: args["summary"], prompt: args["prompt"] });
      }

      case "list_players": {
        const filter = (args["filter"] as string) || "online";
        const limit = Math.min(Number(args["limit"]) || 10, 50);
        let query: Record<string, unknown> = { isGhostAccount: { $ne: true } };
        if (filter === "online") query["lastLogin"] = { $gte: new Date(Date.now() - 15 * 60 * 1000) };
        else if (filter === "banned") query["banned"] = true;
        else if (filter === "new_today") query["createdAt"] = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
        else if (filter === "high_level") query["level"] = { $gte: 20 };
        else if (filter === "jailed") query["status"] = "jailed";
        else if (filter === "hospitalized") query["status"] = "hospitalized";
        else if (filter === "ghost") { query = { isGhostAccount: true }; }
        const players = await User.find(query).sort({ lastLogin: -1 }).limit(limit).select("username level dc role banned status district createdAt lastLogin");
        if (!players.length) return `No players found (filter: ${filter}).`;
        return players.map(p => `• ${p.username} | Lv${p.level} | ${p.dc} DC | ${p.role} | ${p.status} | ${p.district}`).join("\n");
      }

      default:
        return `❌ Unknown tool: ${name}`;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    pushLog("error", `Vanta tool error: ${name}`, msg);
    return `❌ Tool error in ${name}: ${msg}`;
  }
}

// ── ROUTES ────────────────────────────────────────────────────────────────────

// GET /api/vanta-ai/models
router.get("/models", async (_req, res) => {
  res.json({ models: GROQ_MODELS, default: DEFAULT_VANTA_MODEL });
});

// POST /api/vanta-ai/models/ping
router.post("/models/ping", async (req: AuthRequest, res) => {
  const { model } = req.body as { model: string };
  if (!GROQ_MODELS.find((m) => m.id === model)) {
    return res.status(400).json({ message: "Unknown model" });
  }
  const result = await pingModel(model);
  res.json(result);
});

// GET /api/vanta-ai/session
router.get("/session", async (req: AuthRequest, res) => {
  const session = await VantaAISession.findOne({ ownerId: req.userId }).sort({ createdAt: -1 });
  res.json({ session: session ?? null });
});

// DELETE /api/vanta-ai/session
router.delete("/session", async (req: AuthRequest, res) => {
  await VantaAISession.deleteMany({ ownerId: req.userId });
  res.json({ message: "Conversation cleared" });
});

// GET /api/vanta-ai/scheduled-tasks
router.get("/scheduled-tasks", async (_req, res) => {
  const tasks = await VantaScheduledTask.find({}).sort({ runAt: 1 }).limit(50);
  res.json({ tasks });
});

// DELETE /api/vanta-ai/ghost-accounts
router.delete("/ghost-accounts", async (req: AuthRequest, res) => {
  const result = await User.deleteMany({ isGhostAccount: true });
  logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "vanta-wipe-ghosts", details: { count: result.deletedCount } });
  res.json({ deleted: result.deletedCount });
});

// POST /api/vanta-ai/chat  — SSE streaming
router.post("/chat", async (req: AuthRequest, res) => {
  const { message, sessionId, model: requestedModel } = req.body as { message: string; sessionId?: string; model?: string };

  if (!message?.trim()) return res.status(400).json({ message: "message is required" });

  // Resolve model — fall back to stored preference → default
  let activeModel = requestedModel ?? DEFAULT_VANTA_MODEL;
  if (!GROQ_MODELS.find((m) => m.id === activeModel)) activeModel = DEFAULT_VANTA_MODEL;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  function send(data: Record<string, unknown>) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function sendProgress(text: string) {
    send({ type: "progress", text });
  }

  try {
    // Load or create session
    let session = sessionId
      ? await VantaAISession.findById(sessionId)
      : await VantaAISession.findOne({ ownerId: req.userId }).sort({ createdAt: -1 });
    if (!session) {
      session = await VantaAISession.create({ ownerId: req.userId!, aiModel: activeModel, messages: [] });
    }

    // Build Groq messages from session history (last 20 messages for context)
    const historyMessages: GroqMessage[] = session.messages.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant" | "tool",
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      ...(m.toolName ? { name: m.toolName } : {}),
    }));

    // Add current user message
    const userMsg: GroqMessage = { role: "user", content: message.trim() };
    const messages: GroqMessage[] = [...historyMessages, userMsg];

    // Save user message to session
    session.messages.push({ role: "user", content: message.trim(), timestamp: new Date() });

    sendProgress("Understood. Let me work on that...");

    // Tool calling loop
    let iterations = 0;
    const MAX_ITERATIONS = 8;
    let finalContent: string | null = null;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      sendProgress(iterations === 1 ? "Thinking..." : "Continuing analysis...");

      const response = await callGroq({
        model: activeModel,
        messages,
        tools: VANTA_TOOLS,
        systemPrompt: VANTA_SYSTEM_PROMPT,
        maxTokens: 2048,
        temperature: 0.6,
      });

      // If no tool calls, we have the final answer
      if (!response.toolCalls?.length) {
        finalContent = response.content;
        break;
      }

      // Add assistant message with tool calls to messages
      const assistantMsg: GroqMessage = {
        role: "assistant",
        content: response.content,
        tool_calls: response.toolCalls,
      };
      messages.push(assistantMsg);

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown> = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments); } catch { /* use empty */ }

        // Friendly progress label
        const progressLabels: Record<string, string> = {
          get_player_info: `Looking up player "${toolArgs["username"]}"...`,
          adjust_currency: `Adjusting ${toolArgs["currency"]} for ${toolArgs["username"]}...`,
          give_currency_to_all: `Distributing ${toolArgs["amount"]} ${toolArgs["currency"]} to all players...`,
          ban_player: `Banning ${toolArgs["username"]}...`,
          unban_player: `Unbanning ${toolArgs["username"]}...`,
          get_game_stats: "Pulling server stats...",
          read_logs: `Reading last ${toolArgs["lines"] ?? 50} log entries${toolArgs["filter"] ? ` (filter: ${toolArgs["filter"]})` : ""}...`,
          check_feature: `Checking the ${toolArgs["feature"]} system...`,
          create_test_account: `Creating ghost account "${toolArgs["name"]}"...`,
          delete_test_accounts: "Wiping all ghost accounts...",
          schedule_task: `Scheduling "${toolArgs["label"]}"...`,
          list_scheduled_tasks: "Fetching scheduled tasks...",
          cancel_scheduled_task: "Cancelling task...",
          change_game_config: `Updating ${toolArgs["section"]}.${toolArgs["key"]}...`,
          get_vanta_flags: "Pulling Vanta security flags...",
          scan_suspicious_players: "Scanning player data...",
          generate_agent_prompt: "Generating agent fix prompt...",
          list_players: `Listing players (${toolArgs["filter"]})...`,
        };

        send({ type: "action", text: progressLabels[toolName] ?? `Running ${toolName}...`, tool: toolName });

        const result = await execTool(toolName, toolArgs, req.userId!, req.username || "owner");

        // Special handling for agent prompt tool
        if (toolName === "generate_agent_prompt") {
          try {
            const parsed = JSON.parse(result);
            if (parsed.__agentPrompt) {
              send({ type: "agent_prompt", summary: parsed.summary, prompt: parsed.prompt });
            }
          } catch { /* not JSON */ }
        }

        send({ type: "result", text: result.length > 300 ? result.slice(0, 300) + "..." : result, tool: toolName });

        // Add tool result to messages
        messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
          name: toolName,
        });

        // Save to session
        session.messages.push({
          role: "tool",
          content: result,
          toolCallId: toolCall.id,
          toolName,
          timestamp: new Date(),
        });
      }
    }

    // If we hit max iterations without a final answer, request one
    if (!finalContent && iterations >= MAX_ITERATIONS) {
      sendProgress("Compiling results...");
      const summaryResp = await callGroq({
        model: activeModel,
        messages: [...messages, { role: "user", content: "Summarize what you found and any actions taken." }],
        systemPrompt: VANTA_SYSTEM_PROMPT,
        maxTokens: 1024,
      });
      finalContent = summaryResp.content;
    }

    const replyText = finalContent ?? "Done. All actions completed.";

    // Save assistant reply to session
    session.messages.push({ role: "assistant", content: replyText, timestamp: new Date() });
    session.aiModel = activeModel;
    await session.save();

    send({ type: "message", text: replyText });
    send({ type: "done", sessionId: String(session._id) });
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Vanta AI chat error");
    send({ type: "error", text: `Vanta system error: ${msg}` });
    res.end();
  }
});

export default router;
