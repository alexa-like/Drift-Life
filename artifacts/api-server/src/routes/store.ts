/**
 * Store routes — NC (Nova Credits) packs + subscription tiers via Telegram Stars or in-game NC.
 * GET  /api/store/status                — nc balance, sub tier, days left, claim status
 * POST /api/store/create-invoice        — Telegram Stars invoice link
 * POST /api/store/buy-subscription-nc   — buy subscription with in-game NC
 * POST /api/store/claim-daily-nc        — claim daily NC (streak + rollover)
 * POST /api/store/gift-nc               — P2P NC transfer (10% fee)
 */
import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/User";
import UcPurchaseLog from "../models/UcPurchaseLog";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { createInvoiceLink } from "../lib/telegram";
import { NC_PACKS, TIER_CONFIG, getActiveTier, type SubscriptionTier } from "../lib/subscription";

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
      .select("nc subscriptionTier subscriptionExpiresAt ncDailyClaimedAt ncClaimStreak ncRolloverDays telegramId telegramUsername")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const u = user as any;
    const tier = getActiveTier(u);
    const now = new Date();

    // Determine if today's claim is already taken
    const lastClaim: Date | null = u.ncDailyClaimedAt ? new Date(u.ncDailyClaimedAt) : null;
    const todayStr = now.toDateString();
    const claimedToday = lastClaim ? lastClaim.toDateString() === todayStr : false;

    // Days remaining on subscription
    const subExpires: Date | null = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt) : null;
    const subDaysLeft = subExpires && subExpires > now
      ? Math.ceil((subExpires.getTime() - now.getTime()) / 86_400_000)
      : 0;

    // Preview next claim amount (including streak bonus on day 7)
    const streak: number = u.ncClaimStreak ?? 0;
    const rollover: number = u.ncRolloverDays ?? 0;
    const nextStreak = streak + 1;
    const baseNc = tier?.dailyNc ?? 0;
    const streakBonus = nextStreak % 7 === 0 ? Math.floor(baseNc * 0.5) : 0;
    const rolloverBonus = Math.floor(baseNc * Math.min(rollover, 3) * 0.1);
    const nextClaimAmount = baseNc + streakBonus + rolloverBonus;

    res.json({
      nc: u.nc ?? 0,
      subscriptionTier: tier ? u.subscriptionTier : null,
      subscriptionExpiresAt: subExpires,
      subDaysLeft,
      ncDailyClaimedAt: u.ncDailyClaimedAt,
      claimedToday,
      ncClaimStreak: streak,
      ncRolloverDays: rollover,
      nextClaimAmount: tier ? nextClaimAmount : 0,
      telegramLinked: !!u.telegramId,
      telegramUsername: u.telegramUsername ?? null,
      ncPacks: NC_PACKS,
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

    const ncPack = NC_PACKS.find(p => p.id === productId);
    const subTierEntry = Object.entries(TIER_CONFIG).find(([id]) => id === productId);
    if (!ncPack && !subTierEntry) {
      return res.status(404).json({ message: "Product not found" });
    }

    const user = await User.findById(req.userId).select("telegramId subscriptionTier subscriptionExpiresAt").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!(user as any).telegramId) {
      return res.status(400).json({ message: "Link your Telegram account first", needsTelegramLink: true });
    }

    const isNcPack = !!ncPack;
    const stars = isNcPack ? ncPack!.stars : subTierEntry![1].starsPerMonth;
    const title = isNcPack
      ? `${ncPack!.nc.toLocaleString()} Nova Credits`
      : `${subTierEntry![1].name} — 30 days`;
    const description = isNcPack
      ? `${ncPack!.nc.toLocaleString()} NC${ncPack!.bonusPct > 0 ? ` (+${ncPack!.bonusPct}% bonus)` : ""} for Neonoir`
      : `${subTierEntry![1].name} subscription: daily NC, exclusive frame, XP & crime boosts`;

    const nonce = crypto.randomBytes(8).toString("hex");
    const payload = `${req.userId}:${productId}:${nonce}`;
    storePending(payload, String(req.userId), productId);

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

// ── POST /api/store/claim-daily-nc ────────────────────────────────────────────
router.post("/claim-daily-nc", requireAuth, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Atomic: only fires if not already claimed today
    const pre = await User.findOneAndUpdate(
      {
        _id: req.userId,
        $or: [
          { ncDailyClaimedAt: null },
          { ncDailyClaimedAt: { $lt: todayStart } },
        ],
      },
      { $set: { ncDailyClaimedAt: now } },
      { new: false },
    );

    if (!pre) {
      return res.status(400).json({ message: "Already claimed today", claimedToday: true });
    }

    const u = pre as any;
    const tier = getActiveTier(u);
    if (!tier) {
      await User.updateOne({ _id: req.userId }, { $set: { ncDailyClaimedAt: u.ncDailyClaimedAt ?? null } });
      return res.status(400).json({ message: "No active subscription" });
    }

    const lastClaim: Date | null = u.ncDailyClaimedAt ? new Date(u.ncDailyClaimedAt) : null;
    let streak: number = u.ncClaimStreak ?? 0;
    let rollover: number = u.ncRolloverDays ?? 0;

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

    const base = tier.dailyNc;
    const streakBonus = streak % 7 === 0 ? Math.floor(base * 0.5) : 0;
    const rolloverBonus = Math.floor(base * rollover * 0.1);
    const totalNc = base + streakBonus + rolloverBonus;

    await User.updateOne(
      { _id: req.userId },
      {
        $inc: { nc: totalNc },
        $set: { ncClaimStreak: streak, ncRolloverDays: rollover },
      }
    );

    res.json({
      claimed: totalNc,
      base,
      streakBonus,
      rolloverBonus,
      streak,
      newNcBalance: (u.nc ?? 0) + totalNc,
      message: streakBonus > 0
        ? `🔥 Day 7 streak! Claimed ${totalNc} NC (includes +${streakBonus} streak bonus)`
        : `Claimed ${totalNc} NC${rolloverBonus > 0 ? ` (+${rolloverBonus} rollover bonus)` : ""}`,
    });
  } catch (err: any) {
    req.log.error({ err }, "claim-daily-nc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/store/buy-subscription-nc ──────────────────────────────────────
// Purchase a 30-day subscription by spending in-game NC instead of Telegram Stars.
// Uses a Mongoose session transaction so NC deduction, subscription grant, and
// audit log all commit atomically.
router.post("/buy-subscription-nc", requireAuth, async (req: AuthRequest, res) => {
  const session = await mongoose.startSession();
  try {
    const { tierId } = req.body as { tierId?: string };
    if (!tierId || typeof tierId !== "string") {
      return res.status(400).json({ message: "tierId required" });
    }

    const tierEntry = Object.entries(TIER_CONFIG).find(([id]) => id === tierId);
    if (!tierEntry) {
      return res.status(404).json({ message: "Subscription tier not found" });
    }
    const [, tierCfg] = tierEntry;
    const ncCost = tierCfg.ncPrice;
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);
    const tier = tierId as SubscriptionTier;

    class InsufficientNcError extends Error { constructor() { super("NOT_ENOUGH_NC"); } }

    await session.withTransaction(async () => {
      // Step 1 — atomic NC deduction
      const pre = await User.findOneAndUpdate(
        { _id: req.userId, nc: { $gte: ncCost } },
        { $inc: { nc: -ncCost } },
        { new: false, session },
      );
      if (!pre) throw new InsufficientNcError();

      // Step 2 — grant subscription
      const setFields: any = {
        subscriptionTier: tier,
        subscriptionExpiresAt: expiresAt,
        ncDailyClaimedAt: null,
        ncClaimStreak: 0,
        ncRolloverDays: 0,
      };
      const updateOp: any = { $set: setFields };
      if (tierCfg.monthlyNc > 0) updateOp.$inc = { nc: tierCfg.monthlyNc };

      await User.updateOne({ _id: req.userId }, updateOp, { session });

      // Step 3 — audit log
      await UcPurchaseLog.create(
        [{
          userId:    req.userId,
          tierId,
          tierName:  tierCfg.name,
          ncSpent:   ncCost,
          ncGranted: tierCfg.monthlyNc,
        }],
        { session },
      );
    });

    res.json({
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt,
      ncSpent: ncCost,
      ncGranted: tierCfg.monthlyNc,
      message: `🎉 ${tierCfg.name} activated for 30 days!`,
    });
  } catch (err: any) {
    if (err?.message === "NOT_ENOUGH_NC") {
      const tierEntry = Object.entries(TIER_CONFIG).find(([id]) => id === req.body?.tierId);
      const tierCfg = tierEntry?.[1];
      return res.status(400).json({
        message: `Not enough NC. You need ${(tierCfg?.ncPrice ?? 0).toLocaleString()} NC for ${tierCfg?.name ?? "this tier"}.`,
        notEnoughNc: true,
      });
    }
    req.log.error({ err }, "buy-subscription-nc error");
    res.status(500).json({ message: "Internal server error" });
  } finally {
    session.endSession();
  }
});

// ── POST /api/store/keys ──────────────────────────────────────────────────────
// Buy 3 Royale keys for 50 NC.
router.post("/keys", requireAuth, async (req: AuthRequest, res) => {
  try {
    const COST_NC = 50;
    const KEYS_GRANTED = 3;

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, nc: { $gte: COST_NC } },
      { $inc: { nc: -COST_NC, keys: KEYS_GRANTED } },
      { returnDocument: 'after' },
    ).select("nc keys");

    if (!updated) {
      return res.status(400).json({ message: `Not enough NC. You need ${COST_NC} NC.`, notEnoughNc: true });
    }

    res.json({
      keysGranted: KEYS_GRANTED,
      ncSpent: COST_NC,
      nc: (updated as any).nc,
      keys: (updated as any).keys,
      message: `Purchased ${KEYS_GRANTED} keys for ${COST_NC} NC`,
    });
  } catch (err: any) {
    req.log.error({ err }, "store keys purchase error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/store/gift-nc ───────────────────────────────────────────────────
// Send NC to another player (10% fee, min 100 NC, max 10,000 NC per gift)
router.post("/gift-nc", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { recipientUsername, amount } = req.body as { recipientUsername?: string; amount?: number };
    if (!recipientUsername || typeof amount !== "number") {
      return res.status(400).json({ message: "recipientUsername and amount required" });
    }
    if (amount < 100 || amount > 10_000) {
      return res.status(400).json({ message: "Gift amount must be 100–10,000 NC" });
    }

    const sender = await User.findById(req.userId).select("nc username");
    if (!sender) return res.status(404).json({ message: "User not found" });

    const fee = Math.ceil(amount * 0.10);
    const totalCost = amount + fee;
    if ((sender as any).nc < totalCost) {
      return res.status(400).json({ message: `Not enough NC. Need ${totalCost} NC (${amount} + ${fee} fee)` });
    }

    const recipient = await User.findOne({ username: recipientUsername }).select("_id username nc");
    if (!recipient) return res.status(404).json({ message: "Player not found" });
    if (String(recipient._id) === String(req.userId)) {
      return res.status(400).json({ message: "Cannot gift NC to yourself" });
    }

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, nc: { $gte: totalCost } },
      { $inc: { nc: -totalCost } },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(400).json({ message: "Not enough NC (concurrent check failed)" });

    await User.updateOne({ _id: recipient._id }, { $inc: { nc: amount } });

    res.json({
      sent: amount,
      fee,
      totalCost,
      recipientUsername: (recipient as any).username,
      message: `Gifted ${amount} NC to ${(recipient as any).username} (fee: ${fee} NC)`,
    });
  } catch (err: any) {
    req.log.error({ err }, "gift-nc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/store/refill-energy — 2 NC per missing energy point, min 10 NC ──
router.post("/refill-energy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("nc energy maxEnergy").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentEnergy = (user as any).energy ?? 0;
    const maxEnergy     = (user as any).maxEnergy ?? 200;
    const energyNeeded  = maxEnergy - currentEnergy;

    if (energyNeeded <= 0)
      return res.status(400).json({ message: "Energy is already full" });

    const ncCost = Math.max(10, energyNeeded * 2);

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, nc: { $gte: ncCost } },
      { $inc: { nc: -ncCost }, $set: { energy: maxEnergy, energyRegenAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!updated)
      return res.status(400).json({
        message: `Not enough NC — refilling ${energyNeeded} energy costs ${ncCost} NC`,
        notEnoughNc: true,
        ncRequired: ncCost,
      });

    res.json({
      energyRestored: energyNeeded,
      ncSpent: ncCost,
      newEnergy: maxEnergy,
      newNc: (updated as any).nc,
      message: `Restored ${energyNeeded} energy for ${ncCost} NC`,
    });
  } catch (err: any) {
    req.log.error({ err }, "refill-energy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
