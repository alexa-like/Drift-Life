import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import User from "../models/User";
import ChatMessage, { dmKey } from "../models/ChatMessage";
import ChatReport from "../models/ChatReport";
import { requireAuth, requireOwner, AuthRequest } from "../middlewares/auth";
import mongoose from "mongoose";
import { notifyMentions } from "../lib/mentions";
import { getActiveTier } from "../lib/subscription";

const router = Router();

const HISTORY_LIMIT = 50;
const MESSAGE_COOLDOWN_MS = 3000;
const MAX_CONTENT_LEN = 256;
const XP_PER_MESSAGE = 2;
const XP_CAP_PER_DAY = 20;

const cooldownMap = new Map<string, number>();

function requireStaff(req: AuthRequest, res: any, next: any) {
  if (req.role !== "owner" && req.role !== "admin" && req.role !== "staff") {
    return res.status(403).json({ message: "Staff only" });
  }
  next();
}

/** Strip all HTML tags from user-provided text. Returns plain text only. */
function sanitizeContent(raw: unknown): string {
  if (!raw || typeof raw !== "string") return "";
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).trim();
}

// ── GLOBAL CHAT ───────────────────────────────────────────────────────────────

// GET /api/chat/global — last 50 global messages
router.get("/global", requireAuth, async (req: AuthRequest, res) => {
  try {
    const me = await User.findById(req.userId).select("mutedUsers").lean();
    const muted = ((me as any)?.mutedUsers ?? []).map(String);
    const messages = await ChatMessage.find({
      channel: "global",
      deleted: false,
      ...(muted.length ? { senderId: { $nin: muted } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();
    res.json(messages.reverse().map(m => ({
      id: m._id,
      userId: m.senderId,
      username: m.senderName,
      faction: m.senderFaction,
      title: m.senderTitle,
      chatFrame: (m as any).senderChatFrame || null,
      level: (m as any).senderLevel || 1,
      pinnedBadges: (m as any).senderPinnedBadges ?? [],
      content: m.content,
      at: m.createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get global chat error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/chat/global — send a global message
router.post("/global", requireAuth, async (req: AuthRequest, res) => {
  try {
    const content = sanitizeContent(req.body.content);
    if (!content) return res.status(400).json({ message: "content required" });
    if (content.length > MAX_CONTENT_LEN) return res.status(400).json({ message: `Message too long (max ${MAX_CONTENT_LEN} chars)` });

    const now = Date.now();
    const lastSent = cooldownMap.get(String(req.userId)) || 0;
    if (now - lastSent < MESSAGE_COOLDOWN_MS) {
      return res.status(429).json({ message: "Slow down — 1 message per 3 seconds" });
    }
    cooldownMap.set(String(req.userId), now);

    const user = await User.findById(req.userId)
      .select("username faction equippedTitle mutedUntil banned equippedChatFrame level subscriptionTier subscriptionExpiresAt pinnedBadges");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) return res.status(403).json({ message: "Banned" });
    if (user.mutedUntil && user.mutedUntil > new Date()) {
      return res.status(403).json({ message: "You are muted" });
    }

    const activeTierGlobal = getActiveTier(user as any);
    const senderBadges: string[] = (user as any).pinnedBadges ?? [];

    const message = await ChatMessage.create({
      channel: "global",
      districtId: null,
      dmKey: null,
      senderId: user._id,
      senderName: user.username,
      senderFaction: user.faction,
      senderTitle: user.equippedTitle,
      senderChatFrame: (user as any).equippedChatFrame || null,
      senderLevel: user.level,
      senderPinnedBadges: senderBadges,
      content,
    });

    const io = req.app.locals["io"];
    if (io) {
      io.to("global").emit("global_message", {
        id: message._id,
        userId: user._id,
        username: user.username,
        faction: user.faction,
        title: user.equippedTitle,
        chatFrame: (user as any).equippedChatFrame || null,
        level: user.level,
        subscriptionTier: activeTierGlobal ? (user as any).subscriptionTier : null,
        pinnedBadges: senderBadges,
        content,
        at: message.createdAt,
      });
    }

    notifyMentions({ text: content, senderId: user._id, senderName: user.username, sourceLabel: "Global Chat", sourcePage: "chat" });

    res.json({ message: "Sent", id: message._id });
  } catch (err: any) {
    req.log.error({ err }, "post global chat error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DISTRICT CHAT ─────────────────────────────────────────────────────────────

// GET /api/chat/district/:districtId — last 50 messages
router.get("/district/:districtId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { districtId } = req.params;
    const me = await User.findById(req.userId).select("mutedUsers").lean();
    const muted = ((me as any)?.mutedUsers ?? []).map(String);
    const messages = await ChatMessage.find({
      channel: "district",
      districtId,
      deleted: false,
      ...(muted.length ? { senderId: { $nin: muted } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();
    res.json(messages.reverse().map(m => ({
      id: m._id,
      userId: m.senderId,
      username: m.senderName,
      faction: m.senderFaction,
      title: m.senderTitle,
      chatFrame: (m as any).senderChatFrame || null,
      level: (m as any).senderLevel || 1,
      pinnedBadges: (m as any).senderPinnedBadges ?? [],
      content: m.content,
      at: m.createdAt,
      districtId: m.districtId,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get district chat error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/chat/district/:districtId — send district message
router.post("/district/:districtId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { districtId } = req.params;
    const content = sanitizeContent(req.body.content);
    if (!content) return res.status(400).json({ message: "content required" });
    if (content.length > MAX_CONTENT_LEN) return res.status(400).json({ message: `Message too long (max ${MAX_CONTENT_LEN} chars)` });

    const now = Date.now();
    const lastSent = cooldownMap.get(String(req.userId)) || 0;
    if (now - lastSent < MESSAGE_COOLDOWN_MS) {
      return res.status(429).json({ message: "Slow down — 1 message per 3 seconds" });
    }
    cooldownMap.set(String(req.userId), now);

    const user = await User.findById(req.userId)
      .select("username faction equippedTitle mutedUntil banned district equippedChatFrame level subscriptionTier subscriptionExpiresAt pinnedBadges");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) return res.status(403).json({ message: "Banned" });
    if (user.mutedUntil && user.mutedUntil > new Date()) {
      return res.status(403).json({ message: "You are muted" });
    }

    const activeTierDistrict = getActiveTier(user as any);
    const dId = String(districtId);
    const districtBadges: string[] = (user as any).pinnedBadges ?? [];
    const message = await ChatMessage.create({
      channel: "district",
      districtId: dId,
      dmKey: null,
      senderId: user._id,
      senderName: user.username,
      senderFaction: user.faction,
      senderTitle: user.equippedTitle,
      senderChatFrame: (user as any).equippedChatFrame || null,
      senderLevel: user.level,
      senderPinnedBadges: districtBadges,
      content,
    }) as any;

    const io = req.app.locals["io"];
    if (io) {
      io.to(`district:${dId}`).emit("chat_message", {
        id: message._id,
        userId: user._id,
        username: user.username,
        faction: user.faction,
        title: user.equippedTitle,
        chatFrame: (user as any).equippedChatFrame || null,
        level: user.level,
        subscriptionTier: activeTierDistrict ? (user as any).subscriptionTier : null,
        pinnedBadges: districtBadges,
        content,
        at: message.createdAt,
        districtId: dId,
      });
    }

    notifyMentions({ text: content, senderId: user._id, senderName: user.username, sourceLabel: "District Chat", sourcePage: "chat" });

    res.json({ message: "Sent", id: message._id });
  } catch (err: any) {
    req.log.error({ err }, "post district chat error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── FACTION CHAT ──────────────────────────────────────────────────────────────

// GET /api/chat/faction — last 50 messages in the player's faction channel
router.get("/faction", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("faction mutedUsers").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.faction || user.faction === null) {
      return res.status(400).json({ message: "You must belong to a faction to use faction chat" });
    }
    const muted = ((user as any).mutedUsers ?? []).map(String);
    const messages = await ChatMessage.find({
      channel: `faction:${user.faction}`,
      deleted: false,
      ...(muted.length ? { senderId: { $nin: muted } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();
    res.json(messages.reverse().map(m => ({
      id: m._id,
      userId: m.senderId,
      username: m.senderName,
      faction: m.senderFaction,
      title: m.senderTitle,
      chatFrame: (m as any).senderChatFrame || null,
      level: (m as any).senderLevel || 1,
      pinnedBadges: (m as any).senderPinnedBadges ?? [],
      content: m.content,
      at: m.createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get faction chat error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/chat/faction — send a faction message
router.post("/faction", requireAuth, async (req: AuthRequest, res) => {
  try {
    const content = sanitizeContent(req.body.content);
    if (!content) return res.status(400).json({ message: "content required" });
    if (content.length > MAX_CONTENT_LEN) return res.status(400).json({ message: `Message too long (max ${MAX_CONTENT_LEN} chars)` });

    const now = Date.now();
    const lastSent = cooldownMap.get(`faction:${String(req.userId)}`) || 0;
    if (now - lastSent < MESSAGE_COOLDOWN_MS) {
      return res.status(429).json({ message: "Slow down — 1 message per 3 seconds" });
    }
    cooldownMap.set(`faction:${String(req.userId)}`, now);

    const user = await User.findById(req.userId)
      .select("username faction equippedTitle mutedUntil banned equippedChatFrame level subscriptionTier subscriptionExpiresAt pinnedBadges");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) return res.status(403).json({ message: "Banned" });
    if (!user.faction) {
      return res.status(400).json({ message: "Join a faction to use faction chat" });
    }
    if (user.mutedUntil && user.mutedUntil > new Date()) {
      return res.status(403).json({ message: "You are muted" });
    }

    const activeTierFaction = getActiveTier(user as any);
    const channel = `faction:${user.faction}` as `faction:${string}`;
    const factionBadges: string[] = (user as any).pinnedBadges ?? [];
    const message = await ChatMessage.create({
      channel,
      districtId: null,
      dmKey: null,
      senderId: user._id,
      senderName: user.username,
      senderFaction: user.faction,
      senderTitle: user.equippedTitle,
      senderChatFrame: (user as any).equippedChatFrame || null,
      senderLevel: user.level,
      senderPinnedBadges: factionBadges,
      content,
    });

    const io = req.app.locals["io"];
    if (io) {
      io.to(channel).emit("faction_message", {
        id: message._id,
        userId: user._id,
        username: user.username,
        faction: user.faction,
        title: user.equippedTitle,
        chatFrame: (user as any).equippedChatFrame || null,
        level: user.level,
        subscriptionTier: activeTierFaction ? (user as any).subscriptionTier : null,
        pinnedBadges: factionBadges,
        content,
        at: message.createdAt,
      });
    }

    notifyMentions({ text: content, senderId: user._id, senderName: user.username, sourceLabel: "Faction Chat", sourcePage: "chat" });

    res.json({ message: "Sent", id: message._id });
  } catch (err: any) {
    req.log.error({ err }, "post faction chat error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DIRECT MESSAGES ───────────────────────────────────────────────────────────

/** Shared helper: build the conversations list for the requesting user */
async function getDmConversations(userId: string): Promise<object[]> {
  // Escape any regex-special characters in the userId string before embedding it
  const escaped = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|:)${escaped}($|:)`);

  const conversations: any[] = await ChatMessage.aggregate([
    { $match: { channel: "dm", deleted: false, dmKey: { $regex: pattern } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$dmKey", lastMsg: { $first: "$$ROOT" } } },
    { $sort: { "lastMsg.createdAt": -1 } },
    { $limit: 50 },
  ]);

  const otherIds: string[] = [];
  for (const c of conversations) {
    const parts: string[] = String(c._id).split(":");
    const otherId = parts.find((p: string) => p !== userId);
    if (otherId) otherIds.push(otherId);
  }

  const otherUsers = await User.find({ _id: { $in: otherIds } })
    .select("username avatar avatarUrl faction lastActiveAt appearOffline")
    .lean();
  const userMap: Record<string, (typeof otherUsers)[0]> = {};
  for (const u of otherUsers) userMap[String(u._id)] = u;

  const now = Date.now();
  return conversations.map((c: any) => {
    const parts: string[] = String(c._id).split(":");
    const otherId = parts.find((p: string) => p !== userId) || "";
    const other = userMap[otherId] as any;
    const lastActive = other?.lastActiveAt ? new Date(other.lastActiveAt).getTime() : 0;
    const msSince = now - lastActive;
    const isOnline = !other?.appearOffline && msSince < 5 * 60 * 1000;
    const isAway = !other?.appearOffline && !isOnline && msSince < 30 * 60 * 1000;
    return {
      userId: otherId,
      username: other?.username || "Unknown",
      avatar: other?.avatar || "1",
      avatarUrl: other?.avatarUrl || null,
      faction: other?.faction || null,
      lastMessage: c.lastMsg.content,
      lastAt: c.lastMsg.createdAt,
      onlineStatus: isOnline ? "online" : isAway ? "away" : "offline",
    };
  });
}

// GET /api/chat/dm/conversations — list all DM conversations
router.get("/dm/conversations", requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json(await getDmConversations(String(req.userId)));
  } catch (err: any) {
    req.log.error({ err }, "get dm conversations error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/chat/dm/list — alias for /dm/conversations (must be registered before /dm/:userId)
router.get("/dm/list", requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json(await getDmConversations(String(req.userId)));
  } catch (err: any) {
    req.log.error({ err }, "get dm list error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/chat/dm/:userId — last 50 messages with a specific player
router.get("/dm/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const myId = String(req.userId);
    const otherId = String(req.params.userId);

    // Guard against non-ObjectId params (e.g. "list" or "conversations" falling through)
    if (!mongoose.isValidObjectId(otherId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const key = dmKey(myId, otherId);

    const other = await User.findById(otherId).select("dmPrivacy banned").lean();
    if (!other || (other as any).banned) return res.status(404).json({ message: "User not found" });

    const messages = await ChatMessage.find({ channel: "dm", dmKey: key, deleted: false })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();

    res.json(messages.reverse().map(m => ({
      id: m._id,
      userId: m.senderId,
      username: m.senderName,
      faction: m.senderFaction,
      title: m.senderTitle,
      content: m.content,
      at: m.createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get dm error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/chat/dm/:userId — send DM
router.post("/dm/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const myId = String(req.userId);
    const otherId = String(req.params.userId);

    if (myId === otherId) return res.status(400).json({ message: "Cannot DM yourself" });

    const content = sanitizeContent(req.body.content);
    if (!content) return res.status(400).json({ message: "content required" });
    if (content.length > MAX_CONTENT_LEN) return res.status(400).json({ message: `Message too long (max ${MAX_CONTENT_LEN} chars)` });

    const [me, other] = await Promise.all([
      User.findById(myId).select("username faction equippedTitle mutedUntil banned blockedUsers"),
      User.findById(otherId).select("dmPrivacy banned blockedUsers"),
    ]);

    if (!me || me.banned) return res.status(403).json({ message: "Banned" });
    if (!other || (other as any).banned) return res.status(404).json({ message: "User not found" });
    if (me.mutedUntil && me.mutedUntil > new Date()) return res.status(403).json({ message: "You are muted" });
    if ((other as any).dmPrivacy === "nobody") return res.status(403).json({ message: "This player is not accepting DMs" });
    if ((other as any).blockedUsers?.includes(myId)) return res.status(403).json({ message: "Cannot send messages to this player" });
    if ((me as any).blockedUsers?.includes(otherId)) return res.status(403).json({ message: "You have blocked this player" });

    const key = dmKey(myId, otherId);

    const now = Date.now();
    const lastSent = cooldownMap.get(`dm:${myId}`) || 0;
    if (now - lastSent < MESSAGE_COOLDOWN_MS) {
      return res.status(429).json({ message: "Slow down — 1 message per 3 seconds" });
    }
    cooldownMap.set(`dm:${myId}`, now);

    const message = await ChatMessage.create({
      channel: "dm",
      districtId: null,
      dmKey: key,
      senderId: me._id,
      senderName: me.username,
      senderFaction: me.faction,
      senderTitle: me.equippedTitle,
      content,
    });

    const io = req.app.locals["io"];
    if (io) {
      const payload = {
        id: message._id,
        userId: me._id,
        username: me.username,
        faction: me.faction,
        title: me.equippedTitle,
        content,
        at: message.createdAt,
      };
      io.to(`user:${otherId}`).emit("new_dm", { senderId: myId, senderName: me.username, message: payload });
      io.to(`user:${myId}`).emit("dm_message", { partnerId: otherId, message: payload });
    }

    res.json({ message: "Sent", id: message._id });
  } catch (err: any) {
    req.log.error({ err }, "post dm error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── CHANNELS ─────────────────────────────────────────────────────────────────

// GET /api/chat/channels — returns the user's available chat channels
// Includes district channel if user is currently abroad
router.get("/channels", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("faction status currentLocation")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const channels: Array<{ id: string; type: string; label: string }> = [
      { id: "global", type: "global", label: "Global" },
    ];

    if ((user as any).faction) {
      channels.push({
        id: `faction:${(user as any).faction}`,
        type: "faction",
        label: `Faction — ${(user as any).faction}`,
      });
    }

    if ((user as any).status === "abroad" && (user as any).currentLocation) {
      const districtId = (user as any).currentLocation as string;
      channels.push({
        id: `district:${districtId}`,
        type: "district",
        label: `District — ${districtId.replace(/_/g, " ")}`,
      });
    }

    res.json({ channels });
  } catch (err: any) {
    req.log.error({ err }, "get chat channels error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PLAYER MUTING (client-side hide only, not a ban) ──────────────────────────

// POST /api/chat/mute/:userId — hide another player's messages from your own view
router.post("/mute/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const targetId = String(req.params.userId);
    if (targetId === String(req.userId)) return res.status(400).json({ message: "Cannot mute yourself" });
    if (!mongoose.isValidObjectId(targetId)) return res.status(400).json({ message: "Invalid userId" });

    const target = await User.findById(targetId).select("_id").lean();
    if (!target) return res.status(404).json({ message: "User not found" });

    await User.findByIdAndUpdate(req.userId, { $addToSet: { mutedUsers: targetId } });
    res.json({ message: "Player muted", mutedUserId: targetId });
  } catch (err: any) {
    req.log.error({ err }, "mute player error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/chat/mute/:userId — unmute a player
router.delete("/mute/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const targetId = String(req.params.userId);
    await User.findByIdAndUpdate(req.userId, { $pull: { mutedUsers: targetId } });
    res.json({ message: "Player unmuted", mutedUserId: targetId });
  } catch (err: any) {
    req.log.error({ err }, "unmute player error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── MESSAGE REPORTING ─────────────────────────────────────────────────────────

// POST /api/chat/report — report a chat message for staff review
router.post("/report", requireAuth, async (req: AuthRequest, res) => {
  try {
    const messageId = String(req.body.messageId || "");
    const reason = req.body.reason ? sanitizeContent(req.body.reason).slice(0, 256) : null;
    if (!mongoose.isValidObjectId(messageId)) return res.status(400).json({ message: "Invalid messageId" });

    const msg = await ChatMessage.findById(messageId).lean();
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (String(msg.senderId) === String(req.userId)) {
      return res.status(400).json({ message: "Cannot report your own message" });
    }

    const [reporter, reported] = await Promise.all([
      User.findById(req.userId).select("username").lean(),
      User.findById(msg.senderId).select("username").lean(),
    ]);
    if (!reporter) return res.status(404).json({ message: "User not found" });

    await ChatReport.create({
      messageId: msg._id,
      messageContent: msg.content,
      messageChannel: msg.channel,
      reportedUserId: msg.senderId,
      reportedUsername: (reported as any)?.username || msg.senderName,
      reporterId: reporter._id,
      reporterUsername: (reporter as any).username,
      reason,
    });

    res.json({ message: "Report submitted" });
  } catch (err: any) {
    req.log.error({ err }, "report message error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── MODERATION ────────────────────────────────────────────────────────────────

// DELETE /api/chat/:messageId — delete any message (staff only)
router.delete("/:messageId", requireAuth, requireStaff as any, async (req: AuthRequest, res) => {
  try {
    const msg = await ChatMessage.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    msg.deleted = true;
    await msg.save();

    const io = req.app.locals["io"];
    if (io) {
      io.emit("message_deleted", { messageId: req.params.messageId, channel: msg.channel });
    }

    res.json({ message: "Message deleted" });
  } catch (err: any) {
    req.log.error({ err }, "delete message error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
