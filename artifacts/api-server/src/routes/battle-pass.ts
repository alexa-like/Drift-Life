import { Router } from "express";
import { BattlePass } from "../models/BattlePass";
import User from "../models/User";
import { notifyUser } from "../lib/notifyUser";

const router = Router();

// ── Auth middleware (reuse the one already on the express app) ─────────────────
// Routes in this file are mounted under /api and share the app-level auth guard.
// The userId is injected by the auth middleware at req.userId.

// ── GET /api/battle-pass/active ───────────────────────────────────────────────
// Returns the active pass + caller's progress. 200 with null if none active.
router.get("/active", async (req: any, res: any) => {
  try {
    const now = new Date();
    const pass = await BattlePass.findOne({
      status: "active",
      startsAt: { $lte: now },
      endsAt:   { $gt:  now },
    }).lean();

    if (!pass) return res.json({ pass: null });

    const userId = req.userId;
    if (!userId) return res.json({ pass, playerLevel: 0, playerXp: 0, isPremium: false, claimedRewards: [] });

    const user = await User.findById(userId).select("seasonXp seasonLevel battlePassPremium claimedPassRewards premiumPassEventId").lean();

    return res.json({
      pass,
      playerLevel:    user?.seasonLevel ?? 0,
      playerXp:       user?.seasonXp    ?? 0,
      isPremium:      !!(user?.battlePassPremium && user?.premiumPassEventId === String(pass._id)),
      claimedRewards: user?.claimedPassRewards ?? [],
      isDoubleXp:     (pass.xpMultiplier ?? 1) >= 2,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/battle-pass/buy-premium ─────────────────────────────────────────
router.post("/buy-premium", async (req: any, res: any) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const now = new Date();
    const pass = await BattlePass.findOne({ status: "active", startsAt: { $lte: now }, endsAt: { $gt: now } }).lean();
    if (!pass) return res.status(404).json({ error: "No active battle pass" });

    // Idempotent — already bought
    const user = await User.findById(userId).select("nc battlePassPremium premiumPassEventId").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.battlePassPremium && user.premiumPassEventId === String(pass._id)) {
      return res.json({ ok: true, alreadyOwned: true });
    }

    // Atomic NC deduction — fails if not enough
    const result = await User.findOneAndUpdate(
      { _id: userId, nc: { $gte: pass.ncCost } },
      {
        $inc: { nc: -pass.ncCost },
        $set: { battlePassPremium: true, premiumPassEventId: String(pass._id) },
      },
      { new: true, select: "nc" }
    );

    if (!result) {
      return res.status(400).json({ error: `Not enough NC — need ${pass.ncCost} NC` });
    }

    notifyUser({
      userId: String(userId),
      type: "general",
      title: "🌟 Premium Battle Pass Unlocked!",
      message: `You unlocked the ${pass.seasonName} premium track. Cosmetics & titles await!`,
    }).catch(() => {});

    return res.json({ ok: true, ncRemaining: result.nc });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/battle-pass/claim/:level/:track ─────────────────────────────────
router.post("/claim/:level/:track", async (req: any, res: any) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const level = parseInt(req.params.level, 10);
  const track = req.params.track as "free" | "premium";
  if (!["free", "premium"].includes(track) || isNaN(level) || level < 1) {
    return res.status(400).json({ error: "Invalid level or track" });
  }

  try {
    const now = new Date();
    const pass = await BattlePass.findOne({ status: "active", startsAt: { $lte: now }, endsAt: { $gt: now } }).lean();
    if (!pass) return res.status(404).json({ error: "No active battle pass" });

    const user = await User.findById(userId).select("seasonLevel battlePassPremium premiumPassEventId claimedPassRewards nc dc titles").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Level reached?
    if ((user.seasonLevel ?? 0) < level) {
      return res.status(400).json({ error: `Reach Level ${level} first (you are Level ${user.seasonLevel ?? 0})` });
    }

    // Premium track locked?
    if (track === "premium" && !(user.battlePassPremium && user.premiumPassEventId === String(pass._id))) {
      return res.status(403).json({ error: "Upgrade to premium to claim this reward" });
    }

    // Already claimed?
    const claimKey = `level_${level}_${track}`;
    const already = (user.claimedPassRewards ?? []).includes(claimKey);
    if (already) return res.status(400).json({ error: "Already claimed" });

    // Find level definition
    const lvlDef = pass.levels.find(l => l.level === level);
    if (!lvlDef) return res.status(404).json({ error: "Level not found in pass" });

    const reward = track === "free" ? lvlDef.freeReward : lvlDef.premiumReward;

    // Build the atomic update
    const $inc: Record<string, number> = {};
    const $push: Record<string, unknown> = { claimedPassRewards: claimKey };
    const $addToSet: Record<string, unknown> = {};

    if (reward.dc > 0) $inc.dc = reward.dc;
    if (reward.nc > 0) $inc.nc = reward.nc;
    if (reward.title) $addToSet.titles = reward.title;

    await User.updateOne(
      { _id: userId, claimedPassRewards: { $ne: claimKey } }, // double-claim guard
      { $inc, $push, ...( Object.keys($addToSet).length ? { $addToSet } : {} ) }
    );

    return res.json({
      ok: true,
      claimKey,
      reward: {
        dc:    reward.dc   ?? 0,
        nc:    reward.nc   ?? 0,
        title: reward.title ?? null,
        badge: reward.badge ?? null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Owner routes ───────────────────────────────────────────────────────────────
// Mounted under /api/owner/battle-pass via index.ts

export const ownerBattlePassRouter = Router();

// POST /api/owner/battle-pass — create a new pass for an event
ownerBattlePassRouter.post("/", async (req: any, res: any) => {
  if (!["owner", "admin"].includes(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  try {
    const pass = new BattlePass(req.body);
    await pass.save();
    return res.status(201).json(pass);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// PATCH /api/owner/battle-pass/:id — edit any field
ownerBattlePassRouter.patch("/:id", async (req: any, res: any) => {
  if (!["owner", "admin"].includes(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  try {
    const pass = await BattlePass.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!pass) return res.status(404).json({ error: "Pass not found" });
    return res.json(pass);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/owner/battle-pass/:id/activate — set status to active
ownerBattlePassRouter.post("/:id/activate", async (req: any, res: any) => {
  if (!["owner", "admin"].includes(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  try {
    // Deactivate any currently active pass first
    await BattlePass.updateMany({ status: "active" }, { $set: { status: "ended" } });
    const pass = await BattlePass.findByIdAndUpdate(req.params.id, { $set: { status: "active" } }, { new: true });
    if (!pass) return res.status(404).json({ error: "Pass not found" });
    return res.json(pass);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/owner/battle-pass — list all passes
ownerBattlePassRouter.get("/", async (req: any, res: any) => {
  if (!["owner", "admin"].includes(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  try {
    const passes = await BattlePass.find().sort({ createdAt: -1 }).lean();
    return res.json(passes);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
