/**
 * Platform verification & linking routes.
 *
 * GET  /api/platform/status            — Discord + Telegram link status
 * POST /api/platform/verify-init       — start a one-time verification session
 * POST /api/platform/verify-submit     — submit the 6-char code (no link stored)
 * POST /api/platform/link-init         — start a persistent linking session
 * POST /api/platform/link-submit       — submit the code and store the platform link
 * POST /api/platform/resend            — resend the current code to the same chat
 * DELETE /api/platform/telegram        — unlink Telegram
 * DELETE /api/platform/discord         — unlink Discord
 *
 * The two-phase flow:
 *   1. init   → returns a token embedded in a Telegram deep link or Discord slash-command arg
 *   2. bot    → receives token via /start or slash command, creates a 6-char code, sends it to user
 *   3. submit → user enters code in game; server validates and (for link) stores platform ID
 */

import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import {
  createToken,
  createCode,
  consumeCode,
  lookupCode,
  getActiveCodeEntry,
  recordFailedAttempt,
  isSessionLocked,
  resetAttempts,
  MAX_ATTEMPTS,
  type FlowType,
  type Platform,
} from "../lib/platformCodes";
import { sendTelegramMessage } from "../lib/telegram";
import {
  sendInteractionFollowup,
  setMemberNickname,
  addMemberRole,
  removeMemberRole,
} from "../lib/discord";
import User from "../models/User";

const router = Router();

function botUsername(): string {
  return "NeonoirBot";
}

/** The message text sent to the player's bot chat / Discord DM containing the code. */
function codeMessage(playerName: string, code: string): string {
  return (
    `Hey ${playerName},\n` +
    `Here's your Neonoir verification code:\n\n` +
    `<code>${code}</code>\n\n` +
    `Expires in 30 seconds.`
  );
}

// ── GET /api/platform/status ──────────────────────────────────────────────────

router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("telegramId telegramUsername discordId discordUsername")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      telegram: {
        linked:   !!(user as any).telegramId,
        username: (user as any).telegramUsername ?? null,
      },
      discord: {
        linked:   !!(user as any).discordId,
        username: (user as any).discordUsername ?? null,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "platform status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/platform/verify-init ───────────────────────────────────────────

router.post("/verify-init", requireAuth, async (req: AuthRequest, res) => {
  const { platform } = req.body as { platform: string };
  if (platform !== "telegram" && platform !== "discord") {
    return res.status(400).json({ message: "Invalid platform — must be 'telegram' or 'discord'" });
  }
  try {
    const token = createToken(String(req.userId), "verify", platform as Platform);

    if (platform === "telegram") {
      return res.json({
        token,
        deepLink: `https://t.me/${botUsername()}?start=verify_${token}`,
        instructions: "Tap the link to open Telegram. The bot will send you a 6-character code — enter it here within 30 seconds.",
      });
    }

    // Discord
    return res.json({
      token,
      instructions: `Go to our Discord server → #verify-account and run the slash command: /verify ${token}`,
      guildInvite: process.env["DISCORD_GUILD_INVITE"] ?? null,
    });
  } catch (err: any) {
    req.log.error({ err }, "platform verify-init error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/platform/link-init ─────────────────────────────────────────────

router.post("/link-init", requireAuth, async (req: AuthRequest, res) => {
  const { platform } = req.body as { platform: string };
  if (platform !== "telegram" && platform !== "discord") {
    return res.status(400).json({ message: "Invalid platform — must be 'telegram' or 'discord'" });
  }
  try {
    const user = await User.findById(req.userId)
      .select("telegramId discordId")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    if (platform === "telegram" && (user as any).telegramId) {
      return res.status(400).json({ message: "Telegram already linked", alreadyLinked: true });
    }
    if (platform === "discord" && (user as any).discordId) {
      return res.status(400).json({ message: "Discord already linked", alreadyLinked: true });
    }

    const token = createToken(String(req.userId), "link", platform as Platform);

    if (platform === "telegram") {
      return res.json({
        token,
        deepLink: `https://t.me/${botUsername()}?start=link_${token}`,
        instructions: "Tap the link to open Telegram. The bot will send you a 6-character code — enter it here within 30 seconds.",
      });
    }

    // Discord
    return res.json({
      token,
      instructions: `Go to our Discord server → #link-account and run the slash command: /link ${token}`,
      guildInvite: process.env["DISCORD_GUILD_INVITE"] ?? null,
    });
  } catch (err: any) {
    req.log.error({ err }, "platform link-init error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/platform/verify-submit ─────────────────────────────────────────

router.post("/verify-submit", requireAuth, async (req: AuthRequest, res) => {
  const { code, platform } = req.body as { code: string; platform?: string };
  const cleanCode = (code ?? "").trim().toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(cleanCode)) {
    return res.status(400).json({ message: "Invalid code format — expected 6 hex characters" });
  }

  // Determine platform from code entry or from body; needed for attempt tracking.
  // We do a preliminary lookup just to get the platform so we can check attempt lock.
  const preview = lookupCode(cleanCode);
  const plat = (preview?.platform ?? platform ?? "telegram") as Platform;

  try {
    // Session-level lock check — prevents brute-force even after code rotation/expiry
    if (isSessionLocked(String(req.userId), "verify", plat)) {
      return res.status(429).json({ message: "Too many attempts", tooManyAttempts: true });
    }

    const entry = lookupCode(cleanCode);
    if (!entry) {
      // Count this as a failed attempt (wrong or expired code)
      const attempts = recordFailedAttempt(String(req.userId), "verify", plat);
      return res.status(400).json({
        message: "Code expired or not found",
        expired: true,
        attemptsUsed: attempts,
        tooManyAttempts: attempts >= MAX_ATTEMPTS,
      });
    }
    if (entry.userId !== String(req.userId)) {
      recordFailedAttempt(String(req.userId), "verify", entry.platform);
      return res.status(403).json({ message: "This code does not belong to your account" });
    }
    if (entry.type !== "verify") {
      return res.status(400).json({ message: "Wrong code type — use a verification link, not a linking link" });
    }

    // Consume first (atomic in single-threaded Node.js — no await between lookup and delete)
    const consumed = consumeCode(cleanCode);
    if (!consumed) {
      // Already consumed by a concurrent request
      const attempts = recordFailedAttempt(String(req.userId), "verify", entry.platform);
      return res.status(400).json({ message: "Code already used or expired", expired: true, attemptsUsed: attempts });
    }

    resetAttempts(String(req.userId), "verify", entry.platform);
    res.json({ success: true, platform: entry.platform });
  } catch (err: any) {
    req.log.error({ err }, "platform verify-submit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/platform/link-submit ───────────────────────────────────────────

router.post("/link-submit", requireAuth, async (req: AuthRequest, res) => {
  const { code, platform } = req.body as { code: string; platform?: string };
  const cleanCode = (code ?? "").trim().toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(cleanCode)) {
    return res.status(400).json({ message: "Invalid code format — expected 6 hex characters" });
  }

  const preview = lookupCode(cleanCode);
  const plat = (preview?.platform ?? platform ?? "telegram") as Platform;

  try {
    if (isSessionLocked(String(req.userId), "link", plat)) {
      return res.status(429).json({ message: "Too many attempts", tooManyAttempts: true });
    }

    const entry = lookupCode(cleanCode);
    if (!entry) {
      const attempts = recordFailedAttempt(String(req.userId), "link", plat);
      return res.status(400).json({
        message: "Code expired or not found",
        expired: true,
        attemptsUsed: attempts,
        tooManyAttempts: attempts >= MAX_ATTEMPTS,
      });
    }
    if (entry.userId !== String(req.userId)) {
      recordFailedAttempt(String(req.userId), "link", entry.platform);
      return res.status(403).json({ message: "This code does not belong to your account" });
    }
    if (entry.type !== "link") {
      return res.status(400).json({ message: "Wrong code type — use a linking link, not a verification link" });
    }

    // Consume atomically before any await
    const consumed = consumeCode(cleanCode);
    if (!consumed) {
      const attempts = recordFailedAttempt(String(req.userId), "link", entry.platform);
      return res.status(400).json({ message: "Code already used or expired", expired: true, attemptsUsed: attempts });
    }

    const user = await User.findById(req.userId).select("username").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    resetAttempts(String(req.userId), "link", entry.platform);

    if (entry.platform === "telegram") {
      const chatId = entry.chatId;
      if (!chatId) {
        return res.status(400).json({
          message: "No Telegram chat ID found — please retry using the deep link",
        });
      }
      // Prevent one Telegram account linking to two game accounts
      const conflict = await User.findOne({ telegramId: chatId }).lean();
      if (conflict && String((conflict as any)._id) !== entry.userId) {
        return res.status(409).json({
          message: "This Telegram account is already linked to a different Neonoir account",
        });
      }
      await User.updateOne({ _id: entry.userId }, { $set: { telegramId: chatId } });
      // Notify via bot (non-blocking)
      sendTelegramMessage(
        chatId,
        `✅ <b>Neonoir linked!</b>\n\nYour Telegram account is now connected. You can buy NC packs and subscriptions directly here.`,
      ).catch(() => {});
      return res.json({ success: true, platform: "telegram" });
    }

    if (entry.platform === "discord") {
      const { discordUserId, discordUsername: discordUser } = entry;
      if (!discordUserId) {
        return res.status(400).json({ message: "No Discord user ID found — please retry" });
      }
      // Prevent one Discord account linking to two game accounts
      const conflict = await User.findOne({ discordId: discordUserId }).lean();
      if (conflict && String((conflict as any)._id) !== entry.userId) {
        return res.status(409).json({
          message: "This Discord account is already linked to a different Neonoir account",
        });
      }
      await User.updateOne(
        { _id: entry.userId },
        { $set: { discordId: discordUserId, discordUsername: discordUser ?? null } },
      );
      // Discord server actions — all non-blocking
      const guildId      = process.env["DISCORD_GUILD_ID"];
      const verifiedRole = process.env["DISCORD_VERIFIED_ROLE_ID"];
      const unverRole    = process.env["DISCORD_UNVERIFIED_ROLE_ID"];
      if (guildId) {
        setMemberNickname(guildId, discordUserId, (user as any).username).catch(() => {});
        if (verifiedRole) addMemberRole(guildId, discordUserId, verifiedRole).catch(() => {});
        if (unverRole)    removeMemberRole(guildId, discordUserId, unverRole).catch(() => {});
      }
      return res.json({ success: true, platform: "discord" });
    }

    return res.status(400).json({ message: "Unknown platform" });
  } catch (err: any) {
    req.log.error({ err }, "platform link-submit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/platform/resend ─────────────────────────────────────────────────
// body: { type: 'verify'|'link', platform: 'telegram'|'discord' }

router.post("/resend", requireAuth, async (req: AuthRequest, res) => {
  const { type, platform } = req.body as { type: string; platform: string };
  if ((type !== "verify" && type !== "link") || (platform !== "telegram" && platform !== "discord")) {
    return res.status(400).json({ message: "Invalid type or platform" });
  }
  try {
    const user = await User.findById(req.userId).select("username").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const active = getActiveCodeEntry(
      String(req.userId),
      type as FlowType,
      platform as Platform,
    );
    if (!active) {
      return res.status(400).json({
        message: "No active session to resend — please start a new one",
        noSession: true,
      });
    }

    // Create new code (invalidates old one automatically via createCode)
    const newCode = createCode({
      ...active.entry,
      userId: String(req.userId),
    });

    const playerName = (user as any).username;
    const msgText   = codeMessage(playerName, newCode);

    if (platform === "telegram" && active.entry.chatId) {
      await sendTelegramMessage(active.entry.chatId, msgText);
      return res.json({ resent: true });
    }

    if (platform === "discord" && active.entry.discordInteractionToken) {
      await sendInteractionFollowup(active.entry.discordInteractionToken, msgText);
      return res.json({ resent: true });
    }

    return res.status(400).json({
      message: "Cannot resend — no connected chat found. Please start a new session.",
      noChat: true,
    });
  } catch (err: any) {
    req.log.error({ err }, "platform resend error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE /api/platform/telegram ────────────────────────────────────────────

router.delete("/telegram", requireAuth, async (req: AuthRequest, res) => {
  try {
    await User.updateOne(
      { _id: req.userId },
      { $set: { telegramId: null, telegramUsername: null, telegramNotifications: false } },
    );
    res.json({ message: "Telegram account unlinked" });
  } catch (err: any) {
    req.log.error({ err }, "platform unlink-telegram error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE /api/platform/discord ─────────────────────────────────────────────

router.delete("/discord", requireAuth, async (req: AuthRequest, res) => {
  try {
    await User.updateOne(
      { _id: req.userId },
      { $set: { discordId: null, discordUsername: null } },
    );
    res.json({ message: "Discord account unlinked" });
  } catch (err: any) {
    req.log.error({ err }, "platform unlink-discord error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
