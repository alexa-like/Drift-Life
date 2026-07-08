/**
 * Daily Missions — Tier 6
 * 6 missions assigned daily per player, reset at 00:00 UTC.
 * Rewards: XP, DC, Key Shards.
 *
 * GET  /api/missions/daily       — get today's missions + progress
 * POST /api/missions/progress    — update progress for a mission type (called by game systems)
 * POST /api/missions/claim/:id   — claim reward for completed mission
 */
import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { MISSION_CATALOG, MissionDef, getDailyMissions } from "../lib/missionEvents";

export type { MissionDef };
export { MISSION_CATALOG };

const router = Router();

function getTodaySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

// ── GET /api/missions/daily ───────────────────────────────────────────────────
router.get("/daily", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("dailyMissionProgress dailyMissionDate")
      .lean();
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    const todayKey = getTodayKey();
    const storedKey = (user as any).dailyMissionDate as string | undefined;
    let progress: Record<string, { progress: number; completed: boolean; claimedAt: Date | null }> = {};

    if (storedKey === todayKey) {
      progress = (user as any).dailyMissionProgress ?? {};
    }

    const missions = getDailyMissions(getTodaySeed());
    const now = new Date();
    const resetAt = new Date();
    resetAt.setUTCHours(24, 0, 0, 0);

    res.json({
      date:    todayKey,
      resetAt,
      missions: missions.map(m => ({
        ...m,
        progress:  progress[m.id]?.progress  ?? 0,
        completed: progress[m.id]?.completed ?? false,
        claimed:   !!progress[m.id]?.claimedAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "missions daily get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/missions/claim/:id ──────────────────────────────────────────────
router.post("/claim/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const missionId = req.params["id"] as string;
    const todayKey  = getTodayKey();
    const missions  = getDailyMissions(getTodaySeed());
    const mission   = missions.find(m => m.id === missionId);

    if (!mission) {
      res.status(400).json({ message: "Mission not available today" });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    // Reset if new day
    const storedKey = (user as any).dailyMissionDate as string | undefined;
    let progress: Record<string, any> = {};
    if (storedKey === todayKey) {
      progress = (user as any).dailyMissionProgress ?? {};
    }

    const entry = progress[missionId] ?? { progress: 0, completed: false, claimedAt: null };
    if (!entry.completed) {
      res.status(400).json({ message: "Mission not completed yet" }); return;
    }
    if (entry.claimedAt) {
      res.status(400).json({ message: "Already claimed" }); return;
    }

    // Grant rewards
    user.dc        += mission.rewards.dc;
    user.xp        += mission.rewards.xp;
    user.keyShards += mission.rewards.keyShards;

    entry.claimedAt = new Date();
    progress[missionId] = entry;
    (user as any).dailyMissionProgress = progress;
    (user as any).dailyMissionDate     = todayKey;

    await user.save();

    res.json({
      message: `Claimed! +${mission.rewards.dc} DC, +${mission.rewards.xp} XP${mission.rewards.keyShards ? `, +${mission.rewards.keyShards} Key Shard` : ""}`,
      rewards: mission.rewards,
    });
  } catch (err) {
    req.log.error({ err }, "missions claim error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Internal: POST /api/missions/progress — called from game systems ──────────
// Body: { type: string, amount?: number }
router.post("/progress", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, amount = 1 } = req.body as { type: string; amount?: number };
    const todayKey = getTodayKey();
    const missions = getDailyMissions(getTodaySeed());

    const user = await User.findById(req.userId);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    const storedKey = (user as any).dailyMissionDate as string | undefined;
    let progress: Record<string, any> = {};
    if (storedKey !== todayKey) {
      progress = {};
      (user as any).dailyMissionDate = todayKey;
    } else {
      progress = (user as any).dailyMissionProgress ?? {};
    }

    let changed = false;
    for (const m of missions) {
      if (m.type !== type) continue;
      if (progress[m.id]?.completed) continue;
      const current = progress[m.id]?.progress ?? 0;
      const newProg = Math.min(m.target, current + amount);
      progress[m.id] = {
        progress: newProg,
        completed: newProg >= m.target,
        claimedAt: progress[m.id]?.claimedAt ?? null,
      };
      changed = true;
    }

    if (changed) {
      (user as any).dailyMissionProgress = progress;
      await user.save();
    }

    res.json({ updated: changed });
  } catch (err) {
    req.log.error({ err }, "missions progress error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
