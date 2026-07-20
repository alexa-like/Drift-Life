/**
 * Telegram integration routes.
 *
 * GET  /api/telegram/status        — linked status for web UI
 * POST /api/telegram/link-init     — generate one-time link code
 * POST /api/telegram/unlink        — unlink Telegram account
 * POST /api/telegram/webhook       — Telegram Bot webhook (secret-verified)
 *
 * Webhook handles:
 *   pre_checkout_query  → validate & answer within 10s
 *   callback_query      → inline keyboard button press → update menu in-place
 *   message             → link codes, /start deeplinks, successful_payment
 */
import { Router } from "express";
import crypto from "crypto";
import User from "../models/User";
import TelegramPayment from "../models/TelegramPayment";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import {
  sendTelegramMessage,
  sendMessageWithKeyboard,
  editMessageText,
  answerCallbackQuery,
  answerPreCheckoutQuery,
  sendInvoice,
} from "../lib/telegram";
import { NC_PACKS, TIER_CONFIG, getActiveTier, type SubscriptionTier } from "../lib/subscription";
import { resolvePending, peekPending, storePending } from "./store";

const router = Router();

// ── In-memory link codes: code → { userId, expiresAt } ───────────────────────
const _linkCodes = new Map<string, { userId: string; expiresAt: number }>();

function generateLinkCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// ── Per-chatId invoice rate limit: max 5 per minute ──────────────────────────
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

// ── Inline keyboard constants ─────────────────────────────────────────────────

const MAIN_MENU_KB = [
  [
    { text: "📊 My Status",    callback_data: "status" },
    { text: "💰 Buy NC",       callback_data: "packs"  },
  ],
  [
    { text: "💎 Subscribe",    callback_data: "tiers"  },
  ],
];

const BACK_KB = [[{ text: "⬅ Back to Menu", callback_data: "menu" }]];

const TIER_EMOJI: Record<string, string> = {
  street_runner:  "◈",
  neon_syndicate: "◉",
  apex_sovereign: "♛",
};

// ── Menu helper functions ─────────────────────────────────────────────────────

async function showMainMenu(chatId: string, editMsgId?: number): Promise<void> {
  const text =
    `<b>🏙 Neonoir Bot</b>\n\n` +
    `Use the buttons below to manage your account, buy NC packs, or subscribe.\n\n` +
    `<i>Tip: Link your account in-game first if you haven't already.</i>`;

  if (editMsgId) {
    await editMessageText({ chatId, messageId: editMsgId, text, inlineKeyboard: MAIN_MENU_KB });
  } else {
    await sendMessageWithKeyboard({ chatId, text, inlineKeyboard: MAIN_MENU_KB });
  }
}

async function showStatus(chatId: string, linkedUser: any, editMsgId?: number): Promise<void> {
  const tier = getActiveTier(linkedUser);
  const tierCfg = tier ? TIER_CONFIG[linkedUser.subscriptionTier as SubscriptionTier] : null;

  const subLine = tierCfg
    ? `💎 <b>${tierCfg.name}</b>`
    : `💎 No active subscription`;

  const expiresLine = linkedUser.subscriptionExpiresAt && tier
    ? `   Expires: ${new Date(linkedUser.subscriptionExpiresAt).toDateString()}`
    : "";

  const lastClaim: Date | null = linkedUser.ncDailyClaimedAt
    ? new Date(linkedUser.ncDailyClaimedAt)
    : null;
  const claimedToday = lastClaim
    ? lastClaim.toDateString() === new Date().toDateString()
    : false;
  const claimLine = tier
    ? claimedToday
      ? `✅ Daily NC: already claimed today`
      : `⏳ Daily NC: ready to claim (${tierCfg!.dailyNc} NC)`
    : "";

  const text =
    `<b>📊 @${linkedUser.username} — Status</b>\n\n` +
    `💎 NC Balance: <b>${(linkedUser.nc ?? 0).toLocaleString()} NC</b>\n` +
    `${subLine}\n` +
    `${expiresLine ? expiresLine + "\n" : ""}` +
    `${claimLine ? claimLine + "\n" : ""}` +
    `\nUse the menu to buy NC or subscribe.`;

  if (editMsgId) {
    await editMessageText({ chatId, messageId: editMsgId, text, inlineKeyboard: BACK_KB });
  } else {
    await sendMessageWithKeyboard({ chatId, text, inlineKeyboard: BACK_KB });
  }
}

async function showPacksList(chatId: string, editMsgId?: number): Promise<void> {
  const packKb = [
    ...NC_PACKS.map(p => [{
      text: `${p.nc.toLocaleString()} NC — ⭐${p.stars}${p.bonusPct > 0 ? ` +${p.bonusPct}%` : ""}`,
      callback_data: `buy:${p.id}`,
    }]),
    [{ text: "⬅ Back to Menu", callback_data: "menu" }],
  ];

  const packLines = NC_PACKS.map(p =>
    `• <b>${p.nc.toLocaleString()} NC</b> — ⭐ ${p.stars} Stars${p.bonusPct > 0 ? ` <i>(+${p.bonusPct}% bonus)</i>` : ""} — ${p.label}`
  ).join("\n");

  const text =
    `<b>💎 NC Packs (Nova Credits)</b>\n\n` +
    `${packLines}\n\n` +
    `Tap a pack to receive a payment invoice directly in this chat.`;

  if (editMsgId) {
    await editMessageText({ chatId, messageId: editMsgId, text, inlineKeyboard: packKb });
  } else {
    await sendMessageWithKeyboard({ chatId, text, inlineKeyboard: packKb });
  }
}

async function showTiersList(chatId: string, linkedUser: any, editMsgId?: number): Promise<void> {
  const activeTierId: string | null = linkedUser
    ? getActiveTier(linkedUser) ? linkedUser.subscriptionTier : null
    : null;

  const tierKb = [
    ...Object.entries(TIER_CONFIG).map(([id, cfg]) => [{
      text: `${TIER_EMOJI[id] ?? "•"} ${cfg.name} — ⭐${cfg.starsPerMonth}/mo${activeTierId === id ? " ✓" : ""}`,
      callback_data: `sub:${id}`,
    }]),
    [{ text: "⬅ Back to Menu", callback_data: "menu" }],
  ];

  const tierLines = Object.entries(TIER_CONFIG).map(([id, cfg]) => {
    const active = activeTierId === id ? " <b>(ACTIVE)</b>" : "";
    return (
      `${TIER_EMOJI[id] ?? "•"} <b>${cfg.name}</b>${active}\n` +
      `   ⭐ ${cfg.starsPerMonth} Stars/month · ${cfg.dailyNc} NC/day · XP ×${cfg.jobXpMult}`
    );
  }).join("\n\n");

  const text =
    `<b>💎 Subscription Tiers</b>\n\n` +
    `${tierLines}\n\n` +
    `All plans are 30-day. Tap a tier to subscribe via Telegram Stars.`;

  if (editMsgId) {
    await editMessageText({ chatId, messageId: editMsgId, text, inlineKeyboard: tierKb });
  } else {
    await sendMessageWithKeyboard({ chatId, text, inlineKeyboard: tierKb });
  }
}

/** Create & send an NC pack invoice directly in the chat. */
async function sendPackInvoice(chatId: string, userId: string, packId: string): Promise<void> {
  const pack = NC_PACKS.find(p => p.id === packId);
  if (!pack) {
    await sendTelegramMessage(chatId, `❌ Pack not found. Use /buy to see available packs.`);
    return;
  }
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}:${pack.id}:${nonce}`;
  storePending(payload, userId, pack.id);
  await sendInvoice({
    chatId,
    title: `${pack.nc.toLocaleString()} Nova Credits`,
    description: `${pack.nc.toLocaleString()} NC${pack.bonusPct > 0 ? ` (+${pack.bonusPct}% bonus)` : ""} for Neonoir · ${pack.label}`,
    payload,
    currency: "XTR",
    amount: pack.stars,
  });
}

/** Create & send a subscription invoice directly in the chat. */
async function sendTierInvoice(
  chatId: string,
  userId: string,
  tierId: string,
  linkedUser: any,
): Promise<void> {
  const tierEntry = Object.entries(TIER_CONFIG).find(([id]) => id === tierId);
  if (!tierEntry) {
    await sendTelegramMessage(chatId, `❌ Tier not found. Use /subscribe to see available tiers.`);
    return;
  }
  const [, tierCfg] = tierEntry;

  // Warn if already subscribed (non-blocking — invoice still sent)
  const activeTierNow = getActiveTier(linkedUser);
  if (activeTierNow) {
    const daysLeft = linkedUser.subscriptionExpiresAt
      ? Math.ceil((new Date(linkedUser.subscriptionExpiresAt).getTime() - Date.now()) / 86_400_000)
      : 0;
    await sendTelegramMessage(
      chatId,
      `⚠️ You already have an active subscription (${TIER_CONFIG[linkedUser.subscriptionTier as SubscriptionTier]?.name}, ` +
      `${daysLeft} days left).\n\nPurchasing resets your expiry to 30 days from today — ` +
      `remaining days are <b>not</b> added. Your invoice is below if you still want to proceed.`,
    );
  }

  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}:${tierId}:${nonce}`;
  storePending(payload, userId, tierId);
  await sendInvoice({
    chatId,
    title: `${tierCfg.name} — 30 days`,
    description: `${tierCfg.name}: ${tierCfg.dailyNc} NC/day, exclusive frame, XP ×${tierCfg.jobXpMult}, crime ×${tierCfg.crimeRewardMult}`,
    payload,
    currency: "XTR",
    amount: tierCfg.starsPerMonth,
  });
}

// ── REST endpoints ────────────────────────────────────────────────────────────

// GET /api/telegram/status
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

// POST /api/telegram/link-init
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

    const botUsername = "NeonoirBot";
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

// POST /api/telegram/unlink
router.post("/unlink", requireAuth, async (req: AuthRequest, res) => {
  try {
    await User.updateOne(
      { _id: req.userId },
      { $set: { telegramId: null, telegramUsername: null, telegramNotifications: false } },
    );
    res.json({ message: "Telegram account unlinked" });
  } catch (err: any) {
    req.log.error({ err }, "telegram unlink error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/telegram/webhook ────────────────────────────────────────────────
// SECURITY: TELEGRAM_WEBHOOK_SECRET is REQUIRED. Requests without a matching
// secret are rejected with 401. Without this, forged successful_payment events
// could mint NC for free.
router.post("/webhook", async (req, res) => {
  const secretToken = "fbc6fcfc5581f5f2b9d03dc25dcd52e2df3399da36d7d695a5f2442e45591b7d";
  if (req.headers["x-telegram-bot-api-secret-token"] !== secretToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Acknowledge immediately — Telegram retries if we don't respond within 60s
  res.sendStatus(200);

  const update = req.body as TelegramUpdate;

  try {
    // ── 1. pre_checkout_query ─────────────────────────────────────────────
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      const peeked = peekPending(pcq.invoice_payload);
      let errorMessage: string | undefined;

      if (!peeked) {
        errorMessage = "Invoice expired or not found. Please create a new invoice in Neonoir.";
      } else {
        const ncPackPrecheck = NC_PACKS.find(p => p.id === peeked.productId);
        const subEntry = Object.entries(TIER_CONFIG).find(([id]) => id === peeked.productId);
        const expectedStars = ncPackPrecheck ? ncPackPrecheck.stars : subEntry?.[1].starsPerMonth;
        if (!expectedStars) {
          errorMessage = "Product no longer available.";
        } else if (pcq.currency !== "XTR" || pcq.total_amount !== expectedStars) {
          errorMessage = "Payment amount mismatch. Please restart the purchase.";
        }
      }

      await answerPreCheckoutQuery(pcq.id, !errorMessage, errorMessage);
      return;
    }

    // ── 2. callback_query — inline keyboard button press ──────────────────
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.from.id);
      const data = cq.data ?? "";
      const msgId = cq.message?.message_id;

      // Acknowledge immediately (removes loading spinner on button)
      await answerCallbackQuery(cq.id);

      // Look up linked Neonoir user for all actions
      const linkedUser = await User.findOne({ telegramId: chatId })
        .select("_id uc username subscriptionTier subscriptionExpiresAt ucDailyClaimedAt")
        .lean();

      if (data === "menu") {
        await showMainMenu(chatId, msgId);
        return;
      }

      if (data === "status") {
        if (!linkedUser) {
          await sendTelegramMessage(chatId,
            `❌ No Neonoir account linked to this Telegram.\n\nGo to <b>Neonoir → Store → Link Telegram</b>.`);
          return;
        }
        await showStatus(chatId, linkedUser, msgId);
        return;
      }

      if (data === "packs") {
        await showPacksList(chatId, msgId);
        return;
      }

      if (data === "tiers") {
        await showTiersList(chatId, linkedUser, msgId);
        return;
      }

      if (data.startsWith("buy:")) {
        if (!linkedUser) {
          await sendTelegramMessage(chatId,
            `❌ No Neonoir account linked.\n\nGo to <b>Neonoir → Store → Link Telegram</b> first.`);
          return;
        }
        if (!checkInvoiceRate(chatId)) {
          await answerCallbackQuery(cq.id, "⏳ Slow down — too many invoices. Wait a moment.");
          return;
        }
        const packId = data.slice(4);
        await sendPackInvoice(chatId, String((linkedUser as any)._id), packId);
        return;
      }

      if (data.startsWith("sub:")) {
        if (!linkedUser) {
          await sendTelegramMessage(chatId,
            `❌ No Neonoir account linked.\n\nGo to <b>Neonoir → Store → Link Telegram</b> first.`);
          return;
        }
        if (!checkInvoiceRate(chatId)) {
          await answerCallbackQuery(cq.id, "⏳ Slow down — too many invoices. Wait a moment.");
          return;
        }
        const tierId = data.slice(4);
        await sendTierInvoice(chatId, String((linkedUser as any)._id), tierId, linkedUser);
        return;
      }

      return;
    }

    // ── 3. message ────────────────────────────────────────────────────────
    if (update.message) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const text = (msg.text || "").trim();
      const fromUsername = msg.from?.username ?? null;

      // ── 3a. successful_payment ──────────────────────────────────────────
      if (msg.successful_payment) {
        const payment = msg.successful_payment;
        const payload = payment.invoice_payload;
        const chargeId = payment.provider_payment_charge_id;

        // Idempotency guard
        const existing = await TelegramPayment.findOne({ chargeId }).lean();
        if (existing) return;

        const pending = resolvePending(payload);
        if (!pending) {
          const alreadyGranted = await TelegramPayment.findOne({ chargeId }).lean();
          if (alreadyGranted) return;
          req.log?.warn({ chargeId, payload }, "successful_payment with unknown payload");
          return;
        }

        // Verify the Telegram account that paid matches the linked user
        const linkedUser = await User.findById(pending.userId).select("telegramId").lean();
        if (!linkedUser || String((linkedUser as any).telegramId) !== chatId) {
          req.log?.warn({ pendingUserId: pending.userId, chatId }, "Payment from unlinked/mismatched account");
          return;
        }

        const productId = pending.productId;

        // Verify amount matches catalog
        const ncPackCheck = NC_PACKS.find(p => p.id === productId);
        const subEntryCheck = Object.entries(TIER_CONFIG).find(([id]) => id === productId);
        const expectedStars = ncPackCheck ? ncPackCheck.stars : subEntryCheck?.[1].starsPerMonth;
        if (!expectedStars || payment.total_amount !== expectedStars || payment.currency !== "XTR") {
          req.log?.warn({ productId, expected: expectedStars, received: payment.total_amount }, "Payment mismatch — skipping");
          return;
        }

        const ncPack = NC_PACKS.find(p => p.id === productId);
        const subEntry = Object.entries(TIER_CONFIG).find(([id]) => id === productId);

        if (ncPack) {
          await TelegramPayment.create({
            chargeId, userId: pending.userId, productId,
            productType: "nc_pack", tier: null,
            starsAmount: payment.total_amount, ncGranted: ncPack.nc,
          });
          await User.updateOne({ _id: pending.userId }, { $inc: { nc: ncPack.nc } });
          await sendMessageWithKeyboard({
            chatId,
            text: `✅ <b>${ncPack.nc.toLocaleString()} NC credited!</b>\n\nYour Nova Credits balance has been updated in Neonoir. Enjoy!`,
            inlineKeyboard: MAIN_MENU_KB,
          });

        } else if (subEntry) {
          const [tierId, tierCfg] = subEntry;
          const tier = tierId as SubscriptionTier;
          const expiresAt = new Date(Date.now() + 30 * 86_400_000);

          await TelegramPayment.create({
            chargeId, userId: pending.userId, productId,
            productType: "subscription", tier: tierId,
            starsAmount: payment.total_amount, ncGranted: 0,
          });

          const user = await User.findById(pending.userId)
            .select("nc subscriptionTier");
          if (!user) return;

          const setFields: any = {
            subscriptionTier: tier,
            subscriptionExpiresAt: expiresAt,
            ncDailyClaimedAt: null,
            ncClaimStreak: 0,
            ncRolloverDays: 0,
          };
          const updateOp: any = { $set: setFields };
          if (tierCfg.monthlyNc > 0) {
            updateOp.$inc = { nc: tierCfg.monthlyNc };
          }

          await User.updateOne({ _id: pending.userId }, updateOp);

          await sendMessageWithKeyboard({
            chatId,
            text:
              `🎉 <b>${tierCfg.name} activated!</b>\n\n` +
              `Your 30-day subscription is live:\n` +
              `• Daily NC claim: ${tierCfg.dailyNc} NC/day\n` +
              `• XP ×${tierCfg.jobXpMult} &amp; crime ×${tierCfg.crimeRewardMult} boosts active\n\n` +
              `Claim your daily NC in the Neonoir Store every day. Streak 7 days for a bonus! 🔥`,
            inlineKeyboard: [[{ text: "📊 View My Status", callback_data: "status" }]],
          });
        }
        return;
      }

      // ── 3b. Deep-link and code handling ────────────────────────────────
      // The /start payload can be:
      //   verify_<24-char-token>  — platform verification flow (new)
      //   link_<24-char-token>    — platform linking flow (new)
      //   <6-char-hex>            — legacy in-memory link code (Store page)
      //   (anything else)         — fall through to text commands

      if (text.startsWith("/start ")) {
        const payload = text.slice(7).trim();

        // ── New verify/link deep-link flows ──────────────────────────────
        if (payload.startsWith("verify_") || payload.startsWith("link_")) {
          const isVerify  = payload.startsWith("verify_");
          const flowType  = isVerify ? "verify" : "link";
          const token     = isVerify ? payload.slice(7) : payload.slice(5);

          const { consumeToken, createCode } = await import("../lib/platformCodes");
          const tokenEntry = consumeToken(token);

          if (!tokenEntry) {
            await sendTelegramMessage(
              chatId,
              `❌ Session token expired or not found.\n\nGo back to Neonoir and start a new ${flowType} session.`,
            );
            return;
          }
          if (tokenEntry.platform !== "telegram") {
            await sendTelegramMessage(chatId, `❌ This token is not for Telegram.`);
            return;
          }

          const dbUser = await User.findById(tokenEntry.userId).select("username").lean();
          const playerName = (dbUser as any)?.username ?? "Player";

          const code = createCode({
            userId:   tokenEntry.userId,
            type:     flowType,
            platform: "telegram",
            chatId,
          });

          await sendTelegramMessage(
            chatId,
            `Hey ${playerName},\n` +
            `Here's your Neonoir ${flowType === "verify" ? "verification" : "linking"} code:\n\n` +
            `<code>${code}</code>\n\n` +
            `Enter it in the Neonoir game within <b>30 seconds</b>.`,
          );
          return;
        }

        // ── Legacy link code via /start ───────────────────────────────────
        const legacyCode = payload.toUpperCase();
        if (/^[0-9A-F]{6}$/.test(legacyCode)) {
          const entry = _linkCodes.get(legacyCode);
          if (!entry || Date.now() > entry.expiresAt) {
            await sendTelegramMessage(chatId, "❌ Code expired or invalid. Generate a new one in Neonoir → Store.");
            _linkCodes.delete(legacyCode);
            return;
          }
          const existingLink = await User.findOne({ telegramId: chatId }).lean();
          if (existingLink && String((existingLink as any)._id) !== entry.userId) {
            await sendTelegramMessage(chatId, "⚠️ This Telegram account is already linked to a different Neonoir account.");
            return;
          }
          await User.updateOne(
            { _id: entry.userId },
            { $set: { telegramId: chatId, telegramUsername: fromUsername } },
          );
          _linkCodes.delete(legacyCode);
          await sendMessageWithKeyboard({
            chatId,
            text:
              `✅ <b>Neonoir linked!</b>\n\n` +
              `Your Telegram account is now connected.\n\n` +
              `You can now buy NC packs and subscriptions directly here using the menu below.`,
            inlineKeyboard: MAIN_MENU_KB,
          });
          return;
        }

        // Unknown /start payload — show the main menu
        await showMainMenu(chatId);
        return;
      }

      // ── Bare 6-char code typed manually (legacy Store page flow) ───────
      if (/^[0-9A-F]{6}$/i.test(text)) {
        const code = text.toUpperCase();
        const entry = _linkCodes.get(code);
        if (!entry || Date.now() > entry.expiresAt) {
          await sendTelegramMessage(chatId, "❌ Code expired or invalid. Generate a new one in Neonoir → Store.");
          _linkCodes.delete(code);
          return;
        }
        const existingLink = await User.findOne({ telegramId: chatId }).lean();
        if (existingLink && String((existingLink as any)._id) !== entry.userId) {
          await sendTelegramMessage(chatId, "⚠️ This Telegram account is already linked to a different Neonoir account.");
          return;
        }
        await User.updateOne(
          { _id: entry.userId },
          { $set: { telegramId: chatId, telegramUsername: fromUsername } },
        );
        _linkCodes.delete(code);
        await sendMessageWithKeyboard({
          chatId,
          text:
            `✅ <b>Neonoir linked!</b>\n\n` +
            `Your Telegram account is now connected.\n\n` +
            `You can now buy NC packs and subscriptions directly here using the menu below.`,
          inlineKeyboard: MAIN_MENU_KB,
        });
        return;
      }

      // ── 3c. Text commands → inline menus ───────────────────────────────
      const linkedUser = await User.findOne({ telegramId: chatId })
        .select("_id uc username subscriptionTier subscriptionExpiresAt ucDailyClaimedAt")
        .lean();

      if (text === "/start" || text === "/menu" || text === "/help") {
        await showMainMenu(chatId);
        return;
      }

      if (text === "/status" || text === "/bal" || text === "/balance") {
        if (!linkedUser) {
          await sendMessageWithKeyboard({
            chatId,
            text: `❌ No Neonoir account linked.\n\nLink your account in-game under <b>Store → Link Telegram</b>.`,
            inlineKeyboard: [[{ text: "ℹ️ How to link", callback_data: "menu" }]],
          });
          return;
        }
        await showStatus(chatId, linkedUser);
        return;
      }

      if (text === "/buy" || text.startsWith("/buy ")) {
        if (!linkedUser) {
          await sendTelegramMessage(chatId, `❌ No Neonoir account linked.\n\nLink in-game under Store → Link Telegram first.`);
          return;
        }
        const packArg = text.slice(4).trim().toLowerCase();
        if (!packArg) {
          await showPacksList(chatId);
          return;
        }
        if (!checkInvoiceRate(chatId)) {
          await sendTelegramMessage(chatId, `⏳ Slow down — too many invoices. Wait a moment.`);
          return;
        }
        await sendPackInvoice(chatId, String((linkedUser as any)._id), packArg);
        return;
      }

      if (text === "/subscribe" || text === "/sub" || text.startsWith("/subscribe ") || text.startsWith("/sub ")) {
        if (!linkedUser) {
          await sendTelegramMessage(chatId, `❌ No Neonoir account linked.\n\nLink in-game under Store → Link Telegram first.`);
          return;
        }
        const tierArg = text.replace(/^\/(subscribe|sub)\s*/, "").trim().toLowerCase();
        if (!tierArg) {
          await showTiersList(chatId, linkedUser);
          return;
        }
        if (!checkInvoiceRate(chatId)) {
          await sendTelegramMessage(chatId, `⏳ Slow down — too many invoices. Wait a moment.`);
          return;
        }
        await sendTierInvoice(chatId, String((linkedUser as any)._id), tierArg, linkedUser);
        return;
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
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}
