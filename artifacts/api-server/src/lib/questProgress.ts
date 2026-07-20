import { QuestTemplate } from "../models/Quest";
import User from "../models/User";

// ── ISO week helper ────────────────────────────────────────────────────────────
function isoWeek(d: Date = new Date()): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

// ── Assign daily quests if stale ───────────────────────────────────────────────
async function ensureDailyQuests(userId: string): Promise<void> {
  const user = await User.findById(userId).select("dailyQuests").lean();
  if (!user) return;

  const today = todayUTC();
  const firstAssigned = user.dailyQuests?.[0]?.assignedAt;
  const alreadyToday  = firstAssigned && todayUTC() === `${new Date(firstAssigned).getUTCFullYear()}-${new Date(firstAssigned).getUTCMonth() + 1}-${new Date(firstAssigned).getUTCDate()}`;
  if (alreadyToday) return;

  // Pick 3 random daily quest templates
  const templates = await QuestTemplate.aggregate([
    { $match: { isActive: true, type: { $in: ["daily", "both"] } } },
    { $sample: { size: 3 } },
  ]);
  if (templates.length === 0) return;

  const now = new Date();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        dailyQuests: templates.map(t => ({
          questId:    String(t._id),
          progress:   0,
          completed:  false,
          claimedAt:  null,
          assignedAt: now,
        })),
      },
    }
  );
}

// ── Assign weekly quests if stale ──────────────────────────────────────────────
async function ensureWeeklyQuests(userId: string): Promise<void> {
  const user = await User.findById(userId).select("weeklyQuests").lean();
  if (!user) return;

  const thisWeek = isoWeek();
  const alreadyThisWeek = user.weeklyQuests?.[0]?.assignedWeek === thisWeek;
  if (alreadyThisWeek) return;

  const templates = await QuestTemplate.aggregate([
    { $match: { isActive: true, type: { $in: ["weekly", "both"] } } },
    { $sample: { size: 3 } },
  ]);
  if (templates.length === 0) return;

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        weeklyQuests: templates.map(t => ({
          questId:      String(t._id),
          progress:     0,
          completed:    false,
          claimedAt:    null,
          assignedWeek: thisWeek,
        })),
      },
    }
  );
}

// ── Public: ensure quests are fresh ───────────────────────────────────────────
export async function ensureQuestsAssigned(userId: string): Promise<void> {
  await Promise.all([ensureDailyQuests(userId), ensureWeeklyQuests(userId)]);
}

// ── Public: update progress for an action ─────────────────────────────────────
/**
 * Increment quest progress for `action` on both daily + weekly quests.
 * Fire-and-forget safe: call with `.catch(() => {})`.
 */
export async function updateQuestProgress(userId: string, action: string): Promise<void> {
  const user = await User.findById(userId).select("dailyQuests weeklyQuests").lean();
  if (!user) return;

  // Collect all questIds from daily + weekly that match `action`
  const allQuests = [
    ...(user.dailyQuests  ?? []).map((q: any) => ({ ...q, track: "daily" })),
    ...(user.weeklyQuests ?? []).map((q: any) => ({ ...q, track: "weekly" })),
  ];

  if (allQuests.length === 0) return;

  // Look up templates for each questId in the user's active quests
  const questIds = allQuests.map((q: any) => q.questId);
  const templates = await QuestTemplate.find({ _id: { $in: questIds }, action }).lean();
  if (templates.length === 0) return;

  const matchingIds = new Set(templates.map(t => String(t._id)));

  // Build the update
  const dailyUpdates:  Record<string, unknown> = {};
  const weeklyUpdates: Record<string, unknown> = {};

  (user.dailyQuests ?? []).forEach((q: any, i: number) => {
    if (!matchingIds.has(q.questId) || q.completed) return;
    const tmpl = templates.find(t => String(t._id) === q.questId)!;
    const newProgress = Math.min((q.progress ?? 0) + 1, tmpl.targetCount);
    dailyUpdates[`dailyQuests.${i}.progress`] = newProgress;
    if (newProgress >= tmpl.targetCount) {
      dailyUpdates[`dailyQuests.${i}.completed`] = true;
    }
  });

  (user.weeklyQuests ?? []).forEach((q: any, i: number) => {
    if (!matchingIds.has(q.questId) || q.completed) return;
    const tmpl = templates.find(t => String(t._id) === q.questId)!;
    const newProgress = Math.min((q.progress ?? 0) + 1, tmpl.targetCount);
    weeklyUpdates[`weeklyQuests.${i}.progress`] = newProgress;
    if (newProgress >= tmpl.targetCount) {
      weeklyUpdates[`weeklyQuests.${i}.completed`] = true;
    }
  });

  const combinedSet = { ...dailyUpdates, ...weeklyUpdates };
  if (Object.keys(combinedSet).length === 0) return;

  await User.updateOne({ _id: userId }, { $set: combinedSet });
}
