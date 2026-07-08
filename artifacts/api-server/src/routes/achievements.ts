import { Router } from "express";
import User from "../models/User";
import UserAchievement, { ACHIEVEMENT_CATALOG } from "../models/Achievement";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import Notification from "../models/Notification";

const router = Router();

// GET /api/achievements — all achievements with player progress
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const userAchievements = await UserAchievement.find({ userId: req.userId }).lean();
    const progressMap: Record<string, { progress: number; completed: boolean; completedAt: Date | null }> = {};
    for (const ua of userAchievements) {
      progressMap[ua.achievementId] = {
        progress: ua.progress,
        completed: ua.completed,
        completedAt: ua.completedAt,
      };
    }

    function getCurrentProgress(stat: string): number {
      switch (stat) {
        case "wins": return user!.wins;
        case "winStreak": return progressMap["unbeaten_10"]?.progress || 0;
        case "totalFights": return user!.totalFights;
        case "totalCrimes": return user!.totalCrimes;
        case "crimeSuccessRate": return user!.totalCrimes >= 100
          ? Math.round((user!.successfulCrimes / user!.totalCrimes) * 100)
          : 0;
        case "crimesSinceJail": return progressMap["never_jailed"]?.progress || 0;
        case "lifetimeDC": return progressMap["first_million"]?.progress || user!.dc;
        case "bankBalance": return user!.bankBalance;
        case "nc": return user!.nc;
        case "totalPurchases": return progressMap["first_purchase"]?.progress || 0;
        case "totalMessages": return progressMap["chat_100"]?.progress || 0;
        case "totalDMs": return progressMap["first_dm"]?.progress || 0;
        case "dailyStreak": return user!.dailyStreak;
        case "districtsVisited": return progressMap["first_travel"]?.progress || 0;
        case "level": return user!.level;
        case "prestige": return user!.prestige;
        case "uniqueJobsCompleted": return progressMap["all_jobs"]?.progress || 0;
        case "raceWins": return (user as any).raceWins ?? 0;
        case "totalRaces": return (user as any).totalRaces ?? 0;
        case "royaleSpins": return (user as any).totalRoyaleSpins ?? 0;
        case "combatWinStreak": return (user as any).maxCombatWinStreak ?? 0;
        default: return 0;
      }
    }

    res.json(
      ACHIEVEMENT_CATALOG.map(a => {
        const saved = progressMap[a.id];
        const progress = saved?.completed ? a.target : Math.min(getCurrentProgress(a.stat), a.target);
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          category: a.category,
          dcReward: a.dcReward,
          keyReward: (a as any).keyReward ?? 0,
          progress,
          target: a.target,
          completed: saved?.completed ?? false,
          completedAt: saved?.completedAt ?? null,
        };
      })
    );
  } catch (err: any) {
    req.log.error({ err }, "get achievements error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/achievements/check — internal: check all achievements for a user
// Also exported as a function for use in game routes
export async function checkAchievements(userId: string): Promise<void> {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const existing = await UserAchievement.find({ userId }).lean();
    const progressMap: Record<string, typeof existing[0]> = {};
    for (const ua of existing) progressMap[ua.achievementId] = ua;

    function getCurrentProgress(stat: string): number {
      switch (stat) {
        case "wins": return user!.wins;
        case "totalFights": return user!.totalFights;
        case "totalCrimes": return user!.totalCrimes;
        case "crimeSuccessRate": return user!.totalCrimes >= 100
          ? Math.round((user!.successfulCrimes / user!.totalCrimes) * 100) : 0;
        case "lifetimeDC": return progressMap["first_million"]?.progress ?? user!.dc;
        case "bankBalance": return user!.bankBalance;
        case "nc": return user!.nc;
        case "dailyStreak": return user!.dailyStreak;
        case "level": return user!.level;
        case "prestige": return user!.prestige;
        case "raceWins": return (user as any).raceWins ?? 0;
        case "totalRaces": return (user as any).totalRaces ?? 0;
        case "royaleSpins": return (user as any).totalRoyaleSpins ?? 0;
        case "combatWinStreak": return (user as any).maxCombatWinStreak ?? 0;
        default: return progressMap[`_${stat}`]?.progress ?? 0;
      }
    }

    for (const a of ACHIEVEMENT_CATALOG) {
      const saved = progressMap[a.id];
      if (saved?.completed) continue;

      const currentProgress = getCurrentProgress(a.stat);
      const completed = currentProgress >= a.target;

      if (!saved) {
        await UserAchievement.create({
          userId,
          achievementId: a.id,
          progress: currentProgress,
          completed,
          completedAt: completed ? new Date() : null,
          rewardGranted: false,
        });
      } else {
        await UserAchievement.updateOne(
          { userId, achievementId: a.id },
          { progress: currentProgress, completed, completedAt: completed ? new Date() : null }
        );
      }

      // Grant DC + Key rewards on completion
      if (completed && !saved?.rewardGranted) {
        const inc: Record<string, number> = {};
        if (a.dcReward > 0)        inc["dc"]   = a.dcReward;
        if ((a as any).keyReward)  inc["keys"] = (a as any).keyReward;
        if (Object.keys(inc).length > 0) {
          await User.findByIdAndUpdate(userId, { $inc: inc });
        }
        await UserAchievement.updateOne({ userId, achievementId: a.id }, { rewardGranted: true });

        // Inbox notification
        const rewardParts: string[] = [];
        if (a.dcReward > 0)        rewardParts.push(`+${a.dcReward.toLocaleString()} DC`);
        if ((a as any).keyReward)  rewardParts.push(`+${(a as any).keyReward} Key${(a as any).keyReward > 1 ? "s" : ""}`);
        const rewardStr = rewardParts.length ? ` — ${rewardParts.join(", ")}` : "";
        Notification.create({
          userId,
          type: "system",
          message: `Achievement unlocked: ${a.name}${rewardStr}`,
          read: false,
          createdAt: new Date(),
        }).catch(() => {});
      }
    }

    await user.save();
  } catch (err) {
    logger.error({ err }, "checkAchievements error");
  }
}

router.post("/check", requireAuth, async (req: AuthRequest, res) => {
  try {
    await checkAchievements(String(req.userId));
    res.json({ message: "Achievements checked" });
  } catch (err: any) {
    req.log.error({ err }, "check achievements error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
