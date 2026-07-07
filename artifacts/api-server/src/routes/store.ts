/**
 * Store routes — UC packs + subscription tiers via Telegram Stars.
 * POST /api/store/create-invoice  — returns a Telegram Stars invoice link
 * POST /api/store/claim-daily-uc  — claim daily UC (streak + rollover)
 * GET  /api/store/status          — returns uc, sub tier, days left, claim status
 */
import { Router } from "express";
import crypto from "crypto";
import User from "../models/User";
import TelegramPayment from "../models/TelegramPayment";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { createInvoiceLink } from "../lib/telegram";
import { UC_PACKS, TIER_CONFIG, getActiveTier, type SubscriptionTier } from "../lib/subscription";

const router = Router();

// In-memory pending-payment map: payload → { userId, productId, expiresAt }
// Verified by webhook before granting rewards.
const _pending = new Map<string, { userId: string; productId: string; expiresAt: number }>();

export function storePending(payload: string, userId: string, productId: string): void {
  _pending.set(payload, { userId, productId, expiresAt: Date.now() + 3_600_000 });
}

export function resolvePending(payload: string): { userId: string; productId: string } | null {
  const e = _pending.get(payload);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { _pending.delete(payload); return null; }
  _pending.delete(payload);
  return { userId: e.userId, productId: e.productId };
}

/** Read without deleting — used by pre_checkout_query to validate before the payment completes. */
export function peekPending(payload: string): { userId: string; productId: string } | null {
  const e = _pending.get(payload);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { _pending.delete(payload); return null; }
  return { userId: e.userId, productId: e.productId };
}

// ── GET /api/store/status ─────────────────────────────────────────────────────
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("uc subscriptionTier subscriptionExpiresAt ucDailyClaimedAt ucClaimStreak ucRolloverDays telegramId telegramUsername")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const u = user as any;
    const tier = getActiveTier(u);
    const now = new Date();

    // Determine if today's claim is already taken
    const lastClaim: Date | null = u.ucDailyClaimedAt ? new Date(u.ucDailyClaimedAt) : null;
    const todayStr = now.toDateString();
    const claimedToday = lastClaim ? lastClaim.toDateString() === todayStr : false;

    // Days remaining on subscription
    const subExpires: Date | null = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt) : null;
    const subDaysLeft = subExpires && subExpires > now
      ? Math.ceil((subExpires.getTime() - now.getTime()) / 86_400_000)
      : 0;

    // Preview next claim amount (including streak bonus on day 7)
    const streak: number = u.ucClaimStreak ?? 0;
    const rollover: number = u.ucRolloverDays ?? 0;
    const nextStreak = streak + 1;
    const baseUc = tier?.dailyUc ?? 0;
    const streakBonus = nextStreak % 7 === 0 ? Math.floor(baseUc * 0.5) : 0;
    const rolloverBonus = Math.floor(baseUc * Math.min(rollover, 3) * 0.1);
    const nextClaimAmount = baseUc + streakBonus + rolloverBonus;

    res.json({
      uc: u.uc ?? 0,
      subscriptionTier: tier ? u.subscriptionTier : null,
      subscriptionExpiresAt: subExpires,
      subDaysLeft,
      ucDailyClaimedAt: u.ucDailyClaimedAt,
      claimedToday,
      ucClaimStreak: streak,
      ucRolloverDays: rollover,
      nextClaimAmount: tier ? nextClaimAmount : 0,
      telegramLinked: !!u.telegramId,
      telegramUsername: u.telegramUsername ?? null,
      ucPacks: UC_PACKS,
      tiers: Object.entries(TIER_CONFIG).map(([id, cfg]) => ({ id, ...cfg })),
    });
  } catch (err: any) {
    req.log.error({ err }, "store status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/store/create-invoice ────────────────────────────────────────────
router.post("/create-invoice", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { productId } = req.body as { productId?: string };
    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ message: "productId required" });
    }

    // Determine product type
    const ucPack = UC_PACKS.find(p => p.id === productId);
    const subTierEntry = Object.entries(TIER_CONFIG).find(([id]) => id === productId);
    if (!ucPack && !subTierEntry) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check Telegram linked
    const user = await User.findById(req.userId).select("telegramId subscriptionTier subscriptionExpiresAt").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!(user as any).telegramId) {
      return res.status(400).json({ message: "Link your Telegram account first", needsTelegramLink: true });
    }

    const isUcPack = !!ucPack;
    const stars = isUcPack ? ucPack!.stars : subTierEntry![1].starsPerMonth;
    const title = isUcPack
      ? `${ucPack!.uc} UltraCredits`
      : `${subTierEntry![1].name} — 30 days`;
    const description = isUcPack
      ? `${ucPack!.uc} UC${ucPack!.bonusPct > 0 ? ` (+${ucPack!.bonusPct}% bonus)` : ""} for DriftLife`
      : `${subTierEntry![1].name} subscription: daily UC, exclusive frame, XP & crime boosts`;

    // Build a unique payload for replay protection
    const nonce = crypto.randomBytes(8).toString("hex");
    const payload = `${req.userId}:${productId}:${nonce}`;

    // Store pending record so webhook can validate the userId
    storePending(payload, String(req.userId), productId);

    // Create the Telegram invoice link
    const invoiceLink = await createInvoiceLink({
      title,
      description,
      payload,
      currency: "XTR",
      amount: stars,
    });

    res.json({ invoiceLink, stars, title });
  } catch (err: any) {
    req.log.error({ err }, "create-invoice error");
    if (err.message?.includes("TELEGRAM_BOT_TOKEN")) {
      return res.status(503).json({ message: "Telegram payments not configured yet" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/store/claim-daily-uc ────────────────────────────────────────────
router.post("/claim-daily-uc", requireAuth, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Atomic: acquire the claim slot in a single operation.
    // Only succeeds if the user has NOT claimed today. Returns pre-update doc.
    const pre = await User.findOneAndUpdate(
      {
        _id: req.userId,
        $or: [
          { ucDailyClaimedAt: null },
          { ucDailyClaimedAt: { $lt: todayStart } },
        ],
      },
      { $set: { ucDailyClaimedAt: now } },
      { new: false },
    );

    if (!pre) {
      return res.status(400).json({ message: "Already claimed today", claimedToday: true });
    }

    const u = pre as any;
    const tier = getActiveTier(u);
    if (!tier) {
      // Subscription expired; undo the claim-date mark
      await User.updateOne({ _id: req.userId }, { $set: { ucDailyClaimedAt: u.ucDailyClaimedAt ?? null } });
      return res.status(400).json({ message: "No active subscription" });
    }

    // Streak + rollover logic (computed from pre-update document)
    const lastClaim: Date | null = u.ucDailyClaimedAt ? new Date(u.ucDailyClaimedAt) : null;
    let streak: number = u.ucClaimStreak ?? 0;
    let rollover: number = u.ucRolloverDays ?? 0;

    if (lastClaim) {
      const daysSinceLast = Math.floor((now.getTime() - lastClaim.getTime()) / 86_400_000);
      if (daysSinceLast === 1) {
        streak += 1;
        rollover = 0;
      } else if (daysSinceLast <= 3) {
        rollover = Math.min(3, daysSinceLast - 1);
        streak = 1;
      } else {
        streak = 1;
        rollover = 0;
      }
    } else {
      streak = 1;
      rollover = 0;
    }

    const base = tier.dailyUc;
    const streakBonus = streak % 7 === 0 ? Math.floor(base * 0.5) : 0;
    const rolloverBonus = Math.floor(base * rollover * 0.1);
    const totalUc = base + streakBonus + rolloverBonus;

    // Second update: grant UC and persist streak/rollover
    await User.updateOne(
      { _id: req.userId },
      {
        $inc: { uc: totalUc },
        $set: { ucClaimStreak: streak, ucRolloverDays: rollover },
      }
    );

    res.json({
      claimed: totalUc,
      base,
      streakBonus,
      rolloverBonus,
      streak,
      newUcBalance: (u.uc ?? 0) + totalUc,
      message: streakBonus > 0
        ? `🔥 Day 7 streak! Claimed ${totalUc} UC (includes +${streakBonus} streak bonus)`
        : `Claimed ${totalUc} UC${rolloverBonus > 0 ? ` (+${rolloverBonus} rollover bonus)` : ""}`,
    });
  } catch (err: any) {
    req.log.error({ err }, "claim-daily-uc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/store/gift-uc ───────────────────────────────────────────────────
// Send UC to another player (10% fee, min 100 UC, max 10,000 UC per gift)
router.post("/gift-uc", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { recipientUsername, amount } = req.body as { recipientUsername?: string; amount?: number };
    if (!recipientUsername || typeof amount !== "number") {
      return res.status(400).json({ message: "recipientUsername and amount required" });
    }
    if (amount < 100 || amount > 10_000) {
      return res.status(400).json({ message: "Gift amount must be 100–10,000 UC" });
    }

    const sender = await User.findById(req.userId).select("uc username");
    if (!sender) return res.status(404).json({ message: "User not found" });

    const fee = Math.ceil(amount * 0.10);
    const totalCost = amount + fee;
    if ((sender as any).uc < totalCost) {
      return res.status(400).json({ message: `Not enough UC. Need ${totalCost} UC (${amount} + ${fee} fee)` });
    }

    const recipient = await User.findOne({ username: recipientUsername }).select("_id username uc");
    if (!recipient) return res.status(404).json({ message: "Player not found" });
    if (String(recipient._id) === String(req.userId)) {
      return res.status(400).json({ message: "Cannot gift UC to yourself" });
    }

    // Atomic deduct from sender
    const updated = await User.findOneAndUpdate(
      { _id: req.userId, uc: { $gte: totalCost } },
      { $inc: { uc: -totalCost } },
      { new: true }
    );
    if (!updated) return res.status(400).json({ message: "Not enough UC (concurrent check failed)" });

    // Grant to recipient
    await User.updateOne({ _id: recipient._id }, { $inc: { uc: amount } });

    res.json({
      sent: amount,
      fee,
      totalCost,
      recipientUsername: (recipient as any).username,
      message: `Gifted ${amount} UC to ${(recipient as any).username} (fee: ${fee} UC)`,
    });
  } catch (err: any) {
    req.log.error({ err }, "gift-uc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
