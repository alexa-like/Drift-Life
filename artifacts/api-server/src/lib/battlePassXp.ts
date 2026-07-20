import { BattlePass } from "../models/BattlePass";
import User from "../models/User";
import { notifyUser } from "./notifyUser";

/**
 * Award battle-pass XP to a user for the given action key.
 * Handles XP accumulation, level-up detection, and level-up notifications.
 * Fire-and-forget safe: always call with `.catch(() => {})`.
 */
export async function awardBattlePassXp(userId: string, action: string): Promise<void> {
  // Find the active pass (only one should be active at a time)
  const now = new Date();
  const pass = await BattlePass.findOne({ status: "active", startsAt: { $lte: now }, endsAt: { $gt: now } }).lean();
  if (!pass) return;

  // Find XP for this action
  const source = pass.xpSources.find(s => s.action === action);
  if (!source || source.xp <= 0) return;

  const earnedXp = Math.round(source.xp * (pass.xpMultiplier ?? 1.0));

  // Load the user (just what we need)
  const user = await User.findById(userId).select("seasonXp seasonLevel").lean();
  if (!user) return;

  const oldXp    = user.seasonXp ?? 0;
  const oldLevel = user.seasonLevel ?? 0;
  const newXp    = oldXp + earnedXp;

  // Find the highest level the player has now reached
  const sortedLevels = pass.levels.slice().sort((a, b) => a.level - b.level);
  let newLevel = 0;
  for (const lvl of sortedLevels) {
    if (newXp >= lvl.xpRequired) newLevel = lvl.level;
    else break;
  }

  // Atomically update the user
  await User.updateOne(
    { _id: userId },
    {
      $inc: { seasonXp: earnedXp },
      ...(newLevel > oldLevel ? { $set: { seasonLevel: newLevel } } : {}),
    }
  );

  // Notify on level-up
  if (newLevel > oldLevel) {
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      notifyUser({
        userId,
        type:    "general",
        title:   `🏆 Battle Pass Level ${lvl}!`,
        message: `You reached Level ${lvl} in the ${pass.seasonName} pass!`,
      }).catch(() => {});
    }
  }
}
