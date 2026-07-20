import { Router } from "express";
import { QuestTemplate, seedQuestTemplates } from "../models/Quest";
import User from "../models/User";
import { BattlePass } from "../models/BattlePass";
import { awardBattlePassXp } from "../lib/battlePassXp";
import { ensureQuestsAssigned } from "../lib/questProgress";

const router = Router();

// Ensure seed data exists on first import
seedQuestTemplates().catch(() => {});

// ── GET /api/quests ────────────────────────────────────────────────────────────
// Returns daily + weekly quests with template data merged in, freshly assigned if stale.
router.get("/", async (req: any, res: any) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    // Lazy-assign if stale
    await ensureQuestsAssigned(String(userId));

    const user = await User.findById(userId).select("dailyQuests weeklyQuests").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const allQuestIds = [
      ...(user.dailyQuests  ?? []).map((q: any) => q.questId),
      ...(user.weeklyQuests ?? []).map((q: any) => q.questId),
    ];
    const templates = await QuestTemplate.find({ _id: { $in: allQuestIds } }).lean();
    const tmplMap = Object.fromEntries(templates.map(t => [String(t._id), t]));

    function enrichQuests(quests: any[]): any[] {
      return (quests ?? []).map((q: any) => ({
        ...q,
        template: tmplMap[q.questId] ?? null,
      }));
    }

    return res.json({
      daily:  enrichQuests(user.dailyQuests  ?? []),
      weekly: enrichQuests(user.weeklyQuests ?? []),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/quests/:id/claim ─────────────────────────────────────────────────
// Claim a completed quest reward.
router.post("/:id/claim", async (req: any, res: any) => {
  const userId  = req.userId;
  const questId = req.params.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const user = await User.findById(userId).select("dailyQuests weeklyQuests dc nc").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find the quest in daily or weekly
    let track:   "daily" | "weekly" | null = null;
    let questIdx = -1;

    (user.dailyQuests ?? []).forEach((q: any, i: number) => {
      if (q.questId === questId) { track = "daily"; questIdx = i; }
    });
    if (!track) {
      (user.weeklyQuests ?? []).forEach((q: any, i: number) => {
        if (q.questId === questId) { track = "weekly"; questIdx = i; }
      });
    }

    if (!track || questIdx === -1) return res.status(404).json({ error: "Quest not found in your list" });

    const quests: any[] = track === "daily" ? user.dailyQuests : user.weeklyQuests;
    const quest = quests[questIdx];

    if (!quest.completed) return res.status(400).json({ error: "Quest not completed yet" });
    if (quest.claimedAt)  return res.status(400).json({ error: "Quest already claimed" });

    const template = await QuestTemplate.findById(questId).lean();
    if (!template) return res.status(404).json({ error: "Quest template not found" });

    const { dc, nc, seasonXp, eventPoints } = template.reward;

    // Mark claimed
    const claimedAtKey = `${track}Quests.${questIdx}.claimedAt`;
    await User.updateOne(
      { _id: userId },
      {
        $inc: {
          ...(dc       ? { dc       } : {}),
          ...(nc       ? { nc       } : {}),
          ...(seasonXp ? { seasonXp } : {}),
        },
        $set: { [claimedAtKey]: new Date() },
      }
    );

    // Award BP XP for quest completion action
    const bpAction = track === "daily" ? "daily_quest" : "weekly_quest";
    awardBattlePassXp(String(userId), bpAction).catch(() => {});

    // If this was a weekly "Season Warrior" daily_quest tracker, award an extra progress tick
    if (bpAction === "daily_quest") {
      // Weekly quest action "daily_quest" — let quest progress helper handle it normally
      const { updateQuestProgress } = await import("../lib/questProgress");
      updateQuestProgress(String(userId), "daily_quest").catch(() => {});
    }

    return res.json({
      ok: true,
      reward: { dc: dc ?? 0, nc: nc ?? 0, seasonXp: seasonXp ?? 0, eventPoints: eventPoints ?? 0 },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
