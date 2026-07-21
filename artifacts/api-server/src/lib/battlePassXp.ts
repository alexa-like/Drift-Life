import { BattlePass } from "../models/BattlePass";
import User from "../models/User";
import { notifyUser } from "./notifyUser";
import { notifyTelegram } from "./telegram";

/** Mentor XP bonus multiplier — both mentor and mentee earn +15% battle pass XP. */
const MENTOR_XP_BONUS = 1.15;

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

  // Load the user (just what we need)
  const user = await User.findById(userId).select("seasonXp seasonLevel mentorId menteeIds").lean();
  if (!user) return;

  // Apply mentor/mentee XP bonus (+15% if in an active mentorship)
  const hasMentorship = !!(user.mentorId || ((user.menteeIds ?? []).length > 0));
  const mentorMultiplier = hasMentorship ? MENTOR_XP_BONUS : 1.0;

  const earnedXp = Math.round(source.xp * (pass.xpMultiplier ?? 1.0) * mentorMultiplier);

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
    // Look up Telegram data once for all level-up notifications
    const tgUser = await User.findById(userId).select("telegramId telegramNotifications").lean().catch(() => null);
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      notifyUser({
        userId,
        type:    "general",
        message: `You reached Level ${lvl} in the ${pass.seasonName} pass!`,
        link:    "/battle-pass",
        push:    { title: `🏆 Battle Pass Level ${lvl}!` },
      }).catch(() => {});
      notifyTelegram(
        tgUser as any,
        `🏆 <b>Battle Pass Level ${lvl}!</b>\n\nYou reached Level ${lvl} in the <b>${pass.seasonName}</b> season pass!`,
      ).catch(() => {});
    }
  }
}
