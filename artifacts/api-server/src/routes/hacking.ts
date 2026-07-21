/**
 * Hacking — Tier 9.1
 * Intelligence-based player-vs-player and player-vs-corp DC/item theft.
 */
import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import HackSession from "../models/HackSession";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { notifyUser } from "../lib/notifyUser";
import { postToSystemFeed } from "../lib/systemFeed";
import { isHospitalized, isJailed } from "../models/User";

const router = Router();

// ── Corporation targets (hourly resetting DC pools) ───────────────────────────
interface CorpTarget {
  id: string;
  name: string;
  poolCap: number;
  resetMs: number;
  difficulty: number; // each point ≈ −3% success chance
}

const CORP_TARGETS: CorpTarget[] = [
  { id: "megamart_grid",  name: "MegaMart DataGrid",   poolCap:  8_000, resetMs: 3_600_000, difficulty: 1 },
  { id: "militech_relay", name: "Militech Relay Node", poolCap: 15_000, resetMs: 3_600_000, difficulty: 3 },
  { id: "arasaka_bank",   name: "Arasaka DataBank",    poolCap: 25_000, resetMs: 3_600_000, difficulty: 5 },
];

const corpPools: Record<string, { remaining: number; resetAt: number }> = {};

function getCorpPool(corp: CorpTarget): { remaining: number; resetAt: number } {
  const now = Date.now();
  if (!corpPools[corp.id] || now >= corpPools[corp.id].resetAt) {
    corpPools[corp.id] = { remaining: corp.poolCap, resetAt: now + corp.resetMs };
  }
  return corpPools[corp.id];
}

// GET /api/hack/status — player's own hacking stats + corp pool overview
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("hackDefenseLevel lastHackedAt intelligence dc")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentLevel = user.hackDefenseLevel ?? 0;
    const corps = CORP_TARGETS.map(c => {
      const pool = getCorpPool(c);
      return {
        id: c.id, name: c.name, poolCap: c.poolCap,
        poolRemaining: pool.remaining, difficulty: c.difficulty,
        resetAt: new Date(pool.resetAt),
      };
    });

    res.json({
      hackDefenseLevel: currentLevel,
      nextUpgradeCost: 5_000 * (currentLevel + 1),
      intelligence: user.intelligence,
      lastHackedAt: user.lastHackedAt,
      corps,
    });
  } catch (err: any) {
    logger.error({ err }, "hack GET /status");
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/hack/corps — list corporation targets with pool status
router.get("/corps", requireAuth, async (_req, res) => {
  try {
    res.json(CORP_TARGETS.map(c => {
      const pool = getCorpPool(c);
      return {
        id: c.id, name: c.name, poolCap: c.poolCap,
        poolRemaining: pool.remaining, difficulty: c.difficulty,
        resetAt: new Date(pool.resetAt),
      };
    }));
  } catch (err: any) {
    logger.error({ err }, "hack GET /corps");
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/hack/target — hack a player or corporation
router.post("/target", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId, targetType } = req.body as { targetId?: string; targetType?: string };

    if (!targetId || !["player", "corp"].includes(targetType ?? "")) {
      return res.status(400).json({ message: "targetId and targetType ('player'|'corp') are required" });
    }

    const hacker = await User.findById(req.userId).select(
      "intelligence hackDefenseLevel lastHackedAt hackCooldowns dc level status hospitalizedUntil jailedUntil jailUntil"
    );
    if (!hacker) return res.status(404).json({ message: "User not found" });

    if (isHospitalized(hacker)) return res.status(400).json({ message: "Cannot hack while hospitalized" });
    if (isJailed(hacker)) return res.status(400).json({ message: "Cannot hack while jailed" });
    if (hacker.intelligence < 5) {
      return res.status(400).json({ message: "Need at least 5 Intelligence to run a hack" });
    }

    let stolenDc = 0;
    let stolenItem: string | null = null;
    let success = false;
    let outcome = "";
    let targetName = "";

    // ── Corp hack ──────────────────────────────────────────────────────────────
    if (targetType === "corp") {
      const corp = CORP_TARGETS.find(c => c.id === targetId);
      if (!corp) return res.status(404).json({ message: "Corporation target not found" });

      const pool = getCorpPool(corp);
      if (pool.remaining <= 0) {
        return res.status(400).json({
          message: `${corp.name}'s data vaults are dry. They reset hourly.`,
          resetAt: new Date(pool.resetAt),
        });
      }

      // Base 50% + INT bonus − difficulty penalty
      const successChance = Math.min(0.95, 0.50 + (hacker.intelligence - 5) * 0.02 - corp.difficulty * 0.03);
      success = Math.random() < successChance;
      targetName = corp.name;

      if (success) {
        const pct = 0.05 + Math.random() * 0.10;
        const maxSteal = Math.floor(pool.remaining * pct);
        stolenDc = Math.max(100, Math.min(pool.remaining, maxSteal));
        pool.remaining = Math.max(0, pool.remaining - stolenDc);
        await User.findByIdAndUpdate(req.userId, { $inc: { dc: stolenDc } });
        outcome = `Breached ${corp.name} — extracted ${stolenDc.toLocaleString()} DC from their data vaults.`;
      } else {
        outcome = `${corp.name}'s ICE detected the intrusion and pushed you out. No gain.`;
      }

    // ── Player hack ────────────────────────────────────────────────────────────
    } else {
      if (String(targetId) === String(req.userId)) {
        return res.status(400).json({ message: "Cannot hack yourself" });
      }

      // Per-target 6-hour cooldown stored in hackCooldowns map
      const cooldowns: Map<string, Date> = hacker.hackCooldowns ?? new Map();
      const cooldownKey = String(targetId);
      const cooldownUntil = cooldowns.get(cooldownKey);
      if (cooldownUntil && cooldownUntil > new Date()) {
        const minsLeft = Math.ceil((cooldownUntil.getTime() - Date.now()) / 60_000);
        return res.status(429).json({
          message: `Target's systems are still on alert. Cooldown expires in ${minsLeft} minutes.`,
          cooldownUntil,
        });
      }

      const target = await User.findById(targetId).select(
        "username dc hackDefenseLevel isGhostAccount"
      );
      if (!target || (target as any).isGhostAccount) {
        return res.status(404).json({ message: "Target not found" });
      }

      targetName = target.username;
      const defenseLevel = target.hackDefenseLevel ?? 0;
      const successChance = Math.min(0.85, Math.max(0.30,
        (hacker.intelligence - defenseLevel) / 100 + 0.30
      ));
      success = Math.random() < successChance;

      // Set 6h cooldown and update lastHackedAt
      const cooldownExpiry = new Date(Date.now() + 6 * 3_600_000);
      await User.findByIdAndUpdate(req.userId, {
        $set: {
          [`hackCooldowns.${cooldownKey}`]: cooldownExpiry,
          lastHackedAt: new Date(),
        },
      });

      // Log session (re-uses HackSession model; TTL cleans it after expiry)
      await HackSession.create({
        hackerId: req.userId,
        targetId: target._id,
        sequence: [success ? "success" : "fail"],
        difficulty: hacker.intelligence,
        expiresAt: cooldownExpiry,
      });

      if (success) {
        // Steal 5–15% of target's wallet, capped at 50 k DC
        const stealPct = 0.05 + Math.random() * 0.10;
        const raw = Math.floor((target.dc ?? 0) * stealPct);
        stolenDc = Math.min(50_000, Math.max(0, raw));

        if (stolenDc > 0) {
          const deducted = await User.findOneAndUpdate(
            { _id: target._id, dc: { $gte: stolenDc } },
            { $inc: { dc: -stolenDc } },
          );
          if (!deducted) stolenDc = 0; // target's balance changed — still a successful breach
        }
        if (stolenDc > 0) {
          await User.findByIdAndUpdate(req.userId, { $inc: { dc: stolenDc } });
        }

        // 20% chance to also lift a random unequipped item
        if (Math.random() < 0.20) {
          const items = await Item.find({
            ownerId: target._id, equipped: false, marketListed: false, inTrade: false,
          }).select("_id name").limit(10).lean();

          if (items.length > 0) {
            const chosen = items[Math.floor(Math.random() * items.length)];
            await Item.findByIdAndUpdate(chosen._id, {
              $set: { ownerId: req.userId, owner: req.userId },
            });
            stolenItem = chosen.name;
          }
        }

        const parts = [
          stolenDc > 0 ? `${stolenDc.toLocaleString()} DC` : null,
          stolenItem ?? null,
        ].filter(Boolean).join(" and ");

        outcome = parts
          ? `Breached ${target.username}'s systems — walked away with ${parts}.`
          : `Got into ${target.username}'s system but their wallet was empty.`;

        notifyUser({
          userId: target._id,
          type: "general",
          message: `Your systems were breached! ${stolenDc > 0 ? `${stolenDc.toLocaleString()} DC stolen.` : "Someone ghosted through your defenses."}`,
          link: "/hack",
          push: { title: "🔓 System Breach!", body: stolenDc > 0 ? `${stolenDc.toLocaleString()} DC stolen.` : "Someone was in your system." },
        }).catch(() => {});

        if (stolenDc >= 25_000) {
          postToSystemFeed(
            "hack",
            `[🔓 HACK] Someone breached ${target.username}'s systems and walked away with ${stolenDc.toLocaleString()} DC.`,
          ).catch(() => {});
        }

      } else {
        // 30% counter-trace chance → heat penalty
        if (Math.random() < 0.30) {
          const heatPenalty = 5 + Math.floor(Math.random() * 10);
          await User.findByIdAndUpdate(req.userId, { $inc: { heat: heatPenalty } });
          outcome = `Counter-traced by ${target.username}'s ICE. Heat +${heatPenalty}.`;
        } else {
          outcome = `${target.username}'s defenses held. No trace — try again in 6 hours.`;
        }
      }
    }

    res.json({ success, outcome, stolenDc, stolenItem, targetName });
  } catch (err: any) {
    logger.error({ err }, "hack POST /target");
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/hack/history — player's own hack log
router.get("/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const sessions = await HackSession.find({ hackerId: req.userId })
      .sort({ _id: -1 }).limit(20).lean();

    const targetIds = sessions.map(s => s.targetId);
    const targets = await User.find({ _id: { $in: targetIds } }).select("username").lean();
    const targetMap = Object.fromEntries(targets.map(t => [t._id.toString(), t.username]));

    res.json(sessions.map(s => ({
      id: s._id,
      targetId: s.targetId,
      targetUsername: targetMap[s.targetId.toString()] ?? "Unknown",
      outcome: s.sequence[0] ?? "unknown",
      difficulty: s.difficulty,
      cooldownUntil: s.expiresAt,
    })));
  } catch (err: any) {
    logger.error({ err }, "hack GET /history");
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/hack/upgrade-defense — spend DC to upgrade hackDefenseLevel
router.post("/upgrade-defense", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("hackDefenseLevel dc").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const current = user.hackDefenseLevel ?? 0;
    const cost = 5_000 * (current + 1);

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: cost } },
      { $inc: { dc: -cost, hackDefenseLevel: 1 } },
      { new: true, select: "hackDefenseLevel dc" },
    );

    if (!updated) {
      return res.status(400).json({
        message: `Need ${cost.toLocaleString()} DC to upgrade firewall to Defense Level ${current + 1}.`,
      });
    }

    res.json({
      message: `Firewall upgraded to Defense Level ${updated.hackDefenseLevel ?? current + 1}.`,
      hackDefenseLevel: updated.hackDefenseLevel,
      dc: updated.dc,
      nextCost: 5_000 * ((updated.hackDefenseLevel ?? current + 1) + 1),
    });
  } catch (err: any) {
    logger.error({ err }, "hack POST /upgrade-defense");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
