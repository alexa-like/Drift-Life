/**
 * seasons.ts — Season Hall of Fame and Stat Reset routes
 * Mounted at /api/seasons
 */

import { Router } from "express";
import { BattlePass } from "../models/BattlePass";
import User from "../models/User";
import Notification from "../models/Notification";
import { notifyUser } from "../lib/notifyUser";
import { logger } from "../lib/logger";

const router = Router();

// Middleware: all routes require authentication
function requireAuth(req: any, res: any, next: any) {
  if (!req.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}

// ── GET /api/seasons/hall-of-fame ─────────────────────────────────────────────
// List all ended BattlePasses that have a hallOfFame snapshot (season select dropdown)
router.get("/hall-of-fame", requireAuth, async (_req: any, res: any) => {
  try {
    const passes = await BattlePass.find(
      { status: "ended", "hallOfFame.0": { $exists: true } },
      { seasonName: 1, eventId: 1, endsAt: 1, "hallOfFame": { $slice: 1 } }
    )
      .sort({ endsAt: -1 })
      .lean();

    return res.json(
      passes.map(p => ({
        _id:        String(p._id),
        seasonName: p.seasonName,
        eventId:    String(p.eventId),
        endsAt:     p.endsAt,
      }))
    );
  } catch (err: any) {
    logger.error({ err }, "seasons/hall-of-fame list error");
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/seasons/hall-of-fame/:id ────────────────────────────────────────
// Get the frozen top-50 Hall of Fame for a specific BattlePass
router.get("/hall-of-fame/:id", requireAuth, async (req: any, res: any) => {
  try {
    const pass = await BattlePass.findById(req.params.id, {
      seasonName: 1, eventId: 1, endsAt: 1, hallOfFame: 1,
    }).lean();

    if (!pass) return res.status(404).json({ error: "Season not found" });

    return res.json({
      _id:        String(pass._id),
      seasonName: pass.seasonName,
      eventId:    String(pass.eventId),
      endsAt:     pass.endsAt,
      hallOfFame: pass.hallOfFame ?? [],
    });
  } catch (err: any) {
    logger.error({ err }, "seasons/hall-of-fame/:id error");
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/seasons/reset-status ────────────────────────────────────────────
// Returns the caller's stat-reset offer window (if any)
router.get("/reset-status", requireAuth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.userId, {
      lastSeasonResetAt: 1,
      resetOfferExpiresAt: 1,
    }).lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const offerActive =
      user.resetOfferExpiresAt != null &&
      new Date(user.resetOfferExpiresAt) > now;

    return res.json({
      hasOffer:          offerActive,
      offerExpiresAt:    user.resetOfferExpiresAt ?? null,
      lastSeasonResetAt: user.lastSeasonResetAt   ?? null,
    });
  } catch (err: any) {
    logger.error({ err }, "seasons/reset-status error");
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/seasons/accept-reset ───────────────────────────────────────────
// Double-confirm stat reset: body must include { confirm: true }
router.post("/accept-reset", requireAuth, async (req: any, res: any) => {
  const userId = req.userId;
  if (!req.body?.confirm) {
    return res.status(400).json({ error: "Send { confirm: true } to execute the reset" });
  }

  try {
    const now = new Date();
    const user = await User.findById(userId, {
      resetOfferExpiresAt: 1,
      lastSeasonResetAt: 1,
      level: 1,
      nc: 1,
      ownedCosmetics: 1,
      cosmeticInventory: 1,
      titles: 1,
    }).lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    // Validate offer window
    if (
      !user.resetOfferExpiresAt ||
      new Date(user.resetOfferExpiresAt) <= now
    ) {
      return res.status(400).json({
        error: "No active stat reset offer. Offers are available for 72 hours after a season ends for players above level 30.",
      });
    }

    // Atomic reset:
    // - Strength / charisma / intelligence / streetCred → level-1 defaults
    // - DC → 10,000 (keep NC, items, level, XP)
    // - Grant: "Season Veteran" cosmetic title flair + "Season Veteran" title + 1,000 NC
    // - Set lastSeasonResetAt, clear resetOfferExpiresAt

    const veteranTitle = "Season Veteran";
    const veteranFlair = "season-veteran";

    const updated = await User.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          strength:            10,
          charisma:            5,
          intelligence:        5,
          streetCred:          0,
          dc:                  10_000,
          equippedNameFlair:   veteranFlair,
          lastSeasonResetAt:   now,
          resetOfferExpiresAt: null,
        },
        $inc: { nc: 1_000 },
        $addToSet: {
          titles:         veteranTitle,
          ownedCosmetics: veteranFlair,
        },
        $push: {
          cosmeticInventory: {
            cosmeticId: veteranFlair,
            acquiredAt: now,
            expiresAt:  null,
            source:     "event_reward",
          },
        },
      },
      { new: true, select: "dc nc strength intelligence" }
    );

    if (!updated) return res.status(500).json({ error: "Reset failed — please try again" });

    // Notify
    notifyUser({
      userId: String(userId),
      type:   "achievement",
      title:  "↺ Season Reset Complete",
      message: `Your stats have been reset to base values. You received 1,000 NC and the "Season Veteran" title. DC wallet set to 10,000 DC.`,
    }).catch(() => {});

    logger.info({ userId }, "Season stat reset accepted");

    return res.json({
      ok: true,
      newDc:           updated.dc,
      newNc:           updated.nc,
      newStrength:     updated.strength,
      newIntelligence: updated.intelligence,
    });
  } catch (err: any) {
    logger.error({ err, userId }, "seasons/accept-reset error");
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/seasons/hof-count ────────────────────────────────────────────────
// How many Hall of Fame appearances does the calling user have?
router.get("/hof-count", requireAuth, async (req: any, res: any) => {
  try {
    const userId = String(req.userId);
    const count = await BattlePass.countDocuments({
      status: "ended",
      "hallOfFame.userId": userId,
    });
    return res.json({ count });
  } catch (err: any) {
    logger.error({ err }, "seasons/hof-count error");
    return res.status(500).json({ error: err.message });
  }
});

export default router;
