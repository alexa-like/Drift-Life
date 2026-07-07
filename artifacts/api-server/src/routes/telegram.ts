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
import { sendTelegramMessage, answerPreCheckoutQuery, sendInvoice } from "../lib/telegram";
import { UC_PACKS, TIER_CONFIG, getActiveTier, type SubscriptionTier } from "../lib/subscription";
import { resolvePending, peekPending, storePending } from "./store";

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

// Per-chatId invoice creation rate limit: max 5 invoices per minute
const _invoiceRateMap = new Map<string, { count: number; resetAt: number }>();
function checkInvoiceRate(chatId: string): boolean {
  const now = Date.now();
  let entry = _invoiceRateMap.get(chatId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
    _invoiceRateMap.set(chatId, entry);
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// ── POST /api/telegram/webhook ────────────────────────────────────────────────
// Telegram sends updates here. Verified via X-Telegram-Bot-Api-Secret-Token.
// Register with: /setWebhook?url=https://your-domain/api/telegram/webhook&secret_token=YOUR_SECRET
//
// SECURITY: TELEGRAM_WEBHOOK_SECRET is REQUIRED. Without it, any party that
// can reach this endpoint could forge successful_payment events and mint UC.
// Requests without a matching secret are rejected with 401.
router.post("/webhook", async (req, res) => {
  const secretToken = process.env["TELEGRAM_WEBHOOK_SECRET"];

  // Reject if secret is not configured — prevents forged payment events in prod
  if (!secretToken) {
    return res.status(503).json({ message: "Webhook not configured" });
  }

  const received = req.headers["x-telegram-bot-api-secret-token"];
  if (received !== secretToken) {
    return res.status(401).json({ message: "Unauthorized" });
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

      // ── Bot commands (only available after account is linked) ────────────
      // Look up linked user by chatId for all non-link commands
      const linkedUser = text !== "/help" && text !== "/start"
        ? await User.findOne({ telegramId: chatId }).select("_id uc subscriptionTier subscriptionExpiresAt ucDailyClaimedAt username").lean()
        : null;

      // /status — show UC balance and subscription info
      if (text === "/status" || text === "/bal" || text === "/balance") {
        if (!linkedUser) {
          await sendTelegramMessage(chatId,
            `❌ No DriftLife account linked to this Telegram.\n\nGo to DriftLife → Store → Link Telegram to connect your account.`
          );
          return;
        }
        const u = linkedUser as any;
        const tier = getActiveTier(u);
        const subLine = tier
          ? `💎 Subscription: <b>${TIER_CONFIG[u.subscriptionTier as SubscriptionTier]?.name}</b>`
          : `💎 Subscription: None`;
        const expiresLine = u.subscriptionExpiresAt && tier
          ? `   Expires: ${new Date(u.subscriptionExpiresAt).toDateString()}`
          : "";
        await sendTelegramMessage(chatId,
          `<b>@${u.username} · DriftLife Status</b>\n\n` +
          `⭐ UC Balance: <b>${(u.uc ?? 0).toLocaleString()} UC</b>\n` +
          `${subLine}\n${expiresLine ? expiresLine + "\n" : ""}` +
          `\nUse /buy to purchase UC packs or /subscribe for subscriptions.`
        );
        return;
      }

      // /buy [pack_id] — list UC packs or send invoice for a specific one
      if (text.startsWith("/buy")) {
        if (!linkedUser) {
          await sendTelegramMessage(chatId,
            `❌ No DriftLife account linked.\n\nGo to DriftLife → Store → Link Telegram first.`
          );
          return;
        }
        const packArg = text.slice(4).trim().toLowerCase();
        if (!packArg) {
          // List available packs
          const lines = UC_PACKS.map((p, i) =>
            `${i + 1}. <code>/buy ${p.id}</code> — <b>${p.uc.toLocaleString()} UC</b> for ⭐ ${p.stars} Stars${p.bonusPct > 0 ? ` (+${p.bonusPct}% bonus)` : ""}`
          ).join("\n");
          await sendTelegramMessage(chatId,
            `<b>UC Packs</b>\n\nChoose a pack and send the command:\n\n${lines}\n\nUC is used to buy premium chat frames in DriftLife.`
          );
          return;
        }
        const pack = UC_PACKS.find(p => p.id === packArg);
        if (!pack) {
          await sendTelegramMessage(chatId, `❌ Unknown pack <code>${packArg}</code>. Send /buy to see available packs.`);
          return;
        }
        // Rate limit: max 5 invoice creations per minute per user
        if (!checkInvoiceRate(chatId)) {
          await sendTelegramMessage(chatId, `⏳ Slow down — you're creating invoices too fast. Wait a moment and try again.`);
          return;
        }
        try {
          const nonce = crypto.randomBytes(8).toString("hex");
          const payload = `${String((linkedUser as any)._id)}:${pack.id}:${nonce}`;
          storePending(payload, String((linkedUser as any)._id), pack.id);
          await sendInvoice({
            chatId,
            title: `${pack.uc.toLocaleString()} UltraCredits`,
            description: `${pack.uc.toLocaleString()} UC${pack.bonusPct > 0 ? ` (+${pack.bonusPct}% bonus)` : ""} for DriftLife · ${pack.label}`,
            payload,
            currency: "XTR",
            amount: pack.stars,
          });
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ Could not create invoice. Please try again or purchase from the DriftLife Store.`);
        }
        return;
      }

      // /subscribe [tier_id] — list subscription tiers or send invoice
      if (text.startsWith("/subscribe") || text.startsWith("/sub")) {
        if (!linkedUser) {
          await sendTelegramMessage(chatId,
            `❌ No DriftLife account linked.\n\nGo to DriftLife → Store → Link Telegram first.`
          );
          return;
        }
        const tierArg = text.replace(/^\/(subscribe|sub)\s*/, "").trim().toLowerCase();
        if (!tierArg) {
          // List tiers
          const lines = Object.entries(TIER_CONFIG).map(([id, cfg]) =>
            `• <code>/subscribe ${id}</code> — <b>${cfg.name}</b> ⭐ ${cfg.starsPerMonth} Stars/month\n  ${cfg.dailyUc} UC/day · XP ×${cfg.jobXpMult} · Crime ×${cfg.crimeRewardMult}`
          ).join("\n\n");
          await sendTelegramMessage(chatId,
            `<b>Subscription Tiers</b>\n\nAll plans are 30-day, paid via Telegram Stars.\n\n${lines}\n\nSubscriptions include exclusive chat frames, boosts, and daily UC claims.`
          );
          return;
        }
        const tierEntry = Object.entries(TIER_CONFIG).find(([id]) => id === tierArg);
        if (!tierEntry) {
          await sendTelegramMessage(chatId, `❌ Unknown tier <code>${tierArg}</code>. Send /subscribe to see available tiers.`);
          return;
        }
        const [tierId, tierCfg] = tierEntry;

        // Warn if the user already has an active subscription — purchasing resets
        // expiry to 30 days from now and does NOT stack remaining time.
        const u = linkedUser as any;
        const activeTierNow = getActiveTier(u);
        if (activeTierNow) {
          const daysLeft = u.subscriptionExpiresAt
            ? Math.ceil((new Date(u.subscriptionExpiresAt).getTime() - Date.now()) / 86_400_000)
            : 0;
          await sendTelegramMessage(chatId,
            `⚠️ <b>You already have an active subscription</b> (${TIER_CONFIG[u.subscriptionTier as SubscriptionTier]?.name}, ${daysLeft} days left).\n\n` +
            `Purchasing a new plan will reset your expiry to 30 days from today — your remaining ${daysLeft} days will be lost.\n\n` +
            `If you still want to proceed, re-send:\n<code>/subscribe ${tierId}</code>\n\n` +
            `(This message is just a warning — re-sending the command will continue.)`
          );
          // We still fall through and create the invoice — the warning is informational.
          // The user explicitly re-invoked the command above, so this is their second press.
        }

        // Rate limit: max 5 invoice creations per minute per user
        if (!checkInvoiceRate(chatId)) {
          await sendTelegramMessage(chatId, `⏳ Slow down — you're creating invoices too fast. Wait a moment and try again.`);
          return;
        }
        try {
          const nonce = crypto.randomBytes(8).toString("hex");
          const payload = `${String((linkedUser as any)._id)}:${tierId}:${nonce}`;
          storePending(payload, String((linkedUser as any)._id), tierId);
          await sendInvoice({
            chatId,
            title: `${tierCfg.name} — 30 days`,
            description: `${tierCfg.name} subscription: ${tierCfg.dailyUc} UC/day, exclusive frame, XP ×${tierCfg.jobXpMult}, crime ×${tierCfg.crimeRewardMult}`,
            payload,
            currency: "XTR",
            amount: tierCfg.starsPerMonth,
          });
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ Could not create invoice. Please try again or subscribe from the DriftLife Store.`);
        }
        return;
      }

      // /help or bare /start (no code)
      if (text === "/help" || text === "/start") {
        await sendTelegramMessage(chatId,
          `<b>DriftLife Bot</b>\n\n` +
          `<b>Commands:</b>\n` +
          `/status — your UC balance &amp; subscription\n` +
          `/buy — purchase UC packs\n` +
          `/subscribe — get a subscription\n` +
          `/help — show this message\n\n` +
          `<b>To link your account:</b>\n` +
          `1. Open DriftLife → Store → Link Telegram\n` +
          `2. DM me the 6-character code shown\n\n` +
          `After linking, use /buy or /subscribe to make purchases directly here.`
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

        const setFields: any = {
          subscriptionTier: tier,
          subscriptionExpiresAt: expiresAt,
          ucDailyClaimedAt: null,   // reset so they can claim today
          ucClaimStreak: 0,
          ucRolloverDays: 0,
        };

        // Build the update operator cleanly — never nest $addToSet/$inc inside $set
        const updateOp: any = { $set: setFields };

        const ownedFrames: string[] = (user as any).ownedChatFrames || [];
        if (!ownedFrames.includes(tierCfg.frameId)) {
          updateOp.$addToSet = { ownedChatFrames: tierCfg.frameId };
        }
        if (tierCfg.monthlyNc > 0) {
          updateOp.$inc = { nc: tierCfg.monthlyNc };
        }

        await User.updateOne({ _id: pending.userId }, updateOp);

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
