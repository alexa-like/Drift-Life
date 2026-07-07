/**
 * Telegram integration routes.
 *
 * GET  /api/telegram/status        — returns linked status
 * POST /api/telegram/link-init     — generate a one-time link code
 * POST /api/telegram/webhook       — Telegram Bot webhook (verified by secret token)
 *
 * Webhook handles:
 *   message            → if text matches a pending link code, links the account
 *   pre_checkout_query → always answers OK immediately
 *   successful_payment → verifies payload, writes TelegramPayment, grants UC/sub
 */
import { Router } from "express";
import crypto from "crypto";
import User from "../models/User";
import TelegramPayment from "../models/TelegramPayment";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { sendTelegramMessage, answerPreCheckoutQuery } from "../lib/telegram";
import { UC_PACKS, TIER_CONFIG, getActiveTier, type SubscriptionTier } from "../lib/subscription";
import { resolvePending, peekPending } from "./store";

const router = Router();

// In-memory link codes: code → { userId, expiresAt }
const _linkCodes = new Map<string, { userId: string; expiresAt: number }>();

function generateLinkCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char hex
}

// ── GET /api/telegram/status ──────────────────────────────────────────────────
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("telegramId telegramUsername").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      linked: !!(user as any).telegramId,
      telegramUsername: (user as any).telegramUsername ?? null,
    });
  } catch (err: any) {
    req.log.error({ err }, "telegram status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/telegram/link-init ──────────────────────────────────────────────
// Returns a 6-char code the player DMs to the bot. Code expires in 10 minutes.
router.post("/link-init", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("telegramId username").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if ((user as any).telegramId) {
      return res.status(400).json({ message: "Telegram already linked", alreadyLinked: true });
    }

    const code = generateLinkCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Clear any previous pending code for this user
    for (const [k, v] of _linkCodes) {
      if (v.userId === String(req.userId)) _linkCodes.delete(k);
    }
    _linkCodes.set(code, { userId: String(req.userId), expiresAt });

    const botUsername = process.env["TELEGRAM_BOT_USERNAME"] || "DriftLifeBot";
    res.json({
      code,
      expiresInMinutes: 10,
      botDeepLink: `https://t.me/${botUsername}?start=${code}`,
      instructions: `DM @${botUsername} the code: <b>${code}</b> to link your account. Expires in 10 minutes.`,
    });
  } catch (err: any) {
    req.log.error({ err }, "telegram link-init error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/telegram/unlink ─────────────────────────────────────────────────
router.post("/unlink", requireAuth, async (req: AuthRequest, res) => {
  try {
    await User.updateOne(
      { _id: req.userId },
      { $set: { telegramId: null, telegramUsername: null, telegramNotifications: false } }
    );
    res.json({ message: "Telegram account unlinked" });
  } catch (err: any) {
    req.log.error({ err }, "telegram unlink error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/telegram/webhook ────────────────────────────────────────────────
// Telegram sends updates here. Verified via X-Telegram-Bot-Api-Secret-Token.
// Register with: /setWebhook?url=https://your-domain/api/telegram/webhook&secret_token=YOUR_SECRET
router.post("/webhook", async (req, res) => {
  // Verify secret token
  const secretToken = process.env["TELEGRAM_WEBHOOK_SECRET"];
  if (secretToken) {
    const received = req.headers["x-telegram-bot-api-secret-token"];
    if (received !== secretToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  // Acknowledge immediately — Telegram retries if we don't respond within 60s
  res.sendStatus(200);

  const update = req.body as TelegramUpdate;

  try {
    // ── 1. pre_checkout_query — validate and answer within 10s ────────────
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      const peeked = peekPending(pcq.invoice_payload);

      let errorMessage: string | undefined;

      if (!peeked) {
        errorMessage = "Invoice expired or not found. Please create a new invoice in DriftLife.";
      } else {
        // Verify product still exists and amount is correct
        const ucPack = UC_PACKS.find(p => p.id === peeked.productId);
        const subEntry = Object.entries(TIER_CONFIG).find(([id]) => id === peeked.productId);
        const expectedStars = ucPack ? ucPack.stars : subEntry?.[1].starsPerMonth;

        if (!expectedStars) {
          errorMessage = "Product no longer available.";
        } else if (pcq.currency !== "XTR" || pcq.total_amount !== expectedStars) {
          errorMessage = "Payment amount mismatch. Please restart the purchase.";
        }
      }

      await answerPreCheckoutQuery(pcq.id, !errorMessage, errorMessage);
      return;
    }

    // ── 2. Message — handle link codes and /start deeplinks ───────────────
    if (update.message) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const text = (msg.text || "").trim();
      const fromUsername = msg.from?.username ?? null;

      // Extract code from /start <code> or a bare 6-char hex message
      let code: string | null = null;
      if (text.startsWith("/start ")) {
        code = text.slice(7).trim().toUpperCase();
      } else if (/^[0-9A-F]{6}$/i.test(text)) {
        code = text.toUpperCase();
      }

      if (code) {
        const entry = _linkCodes.get(code);
        if (!entry || Date.now() > entry.expiresAt) {
          await sendTelegramMessage(chatId, "❌ Code expired or invalid. Generate a new one in DriftLife → Settings.");
          _linkCodes.delete(code ?? "");
          return;
        }

        // Check if this Telegram account is already linked to another user
        const existingLink = await User.findOne({ telegramId: chatId }).lean();
        if (existingLink && String((existingLink as any)._id) !== entry.userId) {
          await sendTelegramMessage(chatId, "⚠️ This Telegram account is already linked to a different DriftLife account.");
          return;
        }

        await User.updateOne(
          { _id: entry.userId },
          { $set: { telegramId: chatId, telegramUsername: fromUsername } }
        );
        _linkCodes.delete(code);

        await sendTelegramMessage(
          chatId,
          `✅ <b>DriftLife linked!</b>\n\nYour Telegram account is now connected. You can now purchase UC and subscriptions from the in-game Store.\n\nStar payments will be confirmed here automatically.`
        );
        return;
      }

      // Handle /help
      if (text === "/help" || text === "/start") {
        await sendTelegramMessage(chatId,
          `<b>DriftLife Bot</b>\n\nTo link your account:\n1. Open DriftLife → Settings → Link Telegram\n2. DM me the 6-character code shown\n\nAfter linking, you can buy UC and subscriptions directly in-game.`
        );
      }
    }

    // ── 3. successful_payment — grant the purchase ─────────────────────────
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const chatId = String(update.message.chat.id);
      const payload = payment.invoice_payload;
      const chargeId = payment.provider_payment_charge_id;

      // Idempotency guard first — cheapest check
      const existing = await TelegramPayment.findOne({ chargeId }).lean();
      if (existing) return;

      // Verify payload matches a pending invoice
      const pending = resolvePending(payload);
      if (!pending) {
        const alreadyGranted = await TelegramPayment.findOne({ chargeId }).lean();
        if (alreadyGranted) return;
        req.log?.warn({ chargeId, payload }, "successful_payment with unknown payload");
        return;
      }

      // Verify userId in payload matches the Telegram account that paid
      const linkedUser = await User.findById(pending.userId)
        .select("telegramId").lean();
      if (!linkedUser || String((linkedUser as any).telegramId) !== chatId) {
        req.log?.warn({ pendingUserId: pending.userId, chatId }, "Payment from unlinked/mismatched Telegram account");
        return;
      }

      const productId = pending.productId;

      // Verify expected amount matches catalog — guards against tampered invoice amounts
      const ucPackCheck = UC_PACKS.find(p => p.id === productId);
      const subEntryCheck = Object.entries(TIER_CONFIG).find(([id]) => id === productId);
      const expectedStars = ucPackCheck ? ucPackCheck.stars : subEntryCheck?.[1].starsPerMonth;
      if (!expectedStars || payment.total_amount !== expectedStars || payment.currency !== "XTR") {
        req.log?.warn({ productId, expected: expectedStars, received: payment.total_amount, currency: payment.currency }, "Payment amount/currency mismatch — skipping grant");
        return;
      }
      const ucPack = UC_PACKS.find(p => p.id === productId);
      const subEntry = Object.entries(TIER_CONFIG).find(([id]) => id === productId);

      if (ucPack) {
        // Grant UC
        await TelegramPayment.create({
          chargeId,
          userId: pending.userId,
          productId,
          productType: "uc_pack",
          tier: null,
          starsAmount: payment.total_amount,
          ucGranted: ucPack.uc,
        });
        await User.updateOne({ _id: pending.userId }, { $inc: { uc: ucPack.uc } });
        await sendTelegramMessage(chatId,
          `✅ <b>${ucPack.uc} UC credited!</b>\n\nYour UltraCredits balance has been updated in DriftLife. Enjoy!`
        );

      } else if (subEntry) {
        const [tierId, tierCfg] = subEntry;
        const tier = tierId as SubscriptionTier;

        // Grant subscription: set tier + expiry (always 30 days from now, no stacking)
        const expiresAt = new Date(Date.now() + 30 * 86_400_000);

        await TelegramPayment.create({
          chargeId,
          userId: pending.userId,
          productId,
          productType: "subscription",
          tier: tierId,
          starsAmount: payment.total_amount,
          ucGranted: 0,
        });

        // Grant exclusive frame if not already owned
        const user = await User.findById(pending.userId).select("ownedChatFrames nc subscriptionTier");
        if (!user) return;

        const updates: any = {
          subscriptionTier: tier,
          subscriptionExpiresAt: expiresAt,
          ucDailyClaimedAt: null,   // reset so they can claim today
          ucClaimStreak: 0,
          ucRolloverDays: 0,
        };

        const ownedFrames: string[] = (user as any).ownedChatFrames || [];
        if (!ownedFrames.includes(tierCfg.frameId)) {
          updates.$addToSet = { ownedChatFrames: tierCfg.frameId };
        }
        if (tierCfg.monthlyNc > 0) {
          updates.$inc = { nc: tierCfg.monthlyNc };
        }

        await User.updateOne({ _id: pending.userId }, { $set: updates, ...(updates.$addToSet ? { $addToSet: updates.$addToSet } : {}), ...(updates.$inc ? { $inc: updates.$inc } : {}) });

        await sendTelegramMessage(chatId,
          `🎉 <b>${tierCfg.name} activated!</b>\n\n` +
          `Your 30-day subscription is live:\n` +
          `• Daily UC claim: ${tierCfg.dailyUc} UC/day\n` +
          `• Exclusive frame unlocked in DriftLife\n` +
          `• XP & crime reward boosts active\n\n` +
          `Claim your daily UC in the Store every day. Streak 7 days for a bonus! 🔥`
        );
      }
    }
  } catch (err: any) {
    // Webhook errors must not propagate — Telegram already got 200 OK
    console.error("Telegram webhook processing error:", err);
  }
});

export default router;

// ── Types ─────────────────────────────────────────────────────────────────────
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      provider_payment_charge_id: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    from: { id: number; username?: string };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
}
