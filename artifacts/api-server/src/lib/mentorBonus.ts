/**
 * Mentor Bonus — Tier 9.3
 * Award DC to a player's mentor when the player crosses level milestones.
 * Call fire-and-forget after any levelUp() that returns true.
 */
import User from "../models/User";
import { notifyUser } from "./notifyUser";

/** Milestones at which the mentor receives a DC bonus. */
const MENTOR_LEVEL_BONUSES: Record<number, number> = {
  10:  500,
  20: 1_000,
  30: 2_000,
};

/**
 * @param menteeId   - user who just leveled up
 * @param oldLevel   - level before levelUp()
 * @param newLevel   - level after levelUp()
 */
export async function checkMentorLevelBonus(
  menteeId: string,
  oldLevel: number,
  newLevel: number,
): Promise<void> {
  const thresholds = (Object.keys(MENTOR_LEVEL_BONUSES) as unknown as number[])
    .filter(lvl => oldLevel < Number(lvl) && newLevel >= Number(lvl));

  if (thresholds.length === 0) return;

  const mentee = await User.findById(menteeId).select("mentorId username").lean();
  if (!mentee?.mentorId) return;

  const mentorId = String(mentee.mentorId);

  for (const threshold of thresholds) {
    const bonus = MENTOR_LEVEL_BONUSES[threshold];
    await User.findByIdAndUpdate(mentorId, { $inc: { dc: bonus } });

    notifyUser({
      userId: mentorId,
      type: "general",
      message: `Your mentee ${mentee.username} reached Level ${threshold}! Mentor bonus: ${bonus.toLocaleString()} DC.`,
      link: "/mentor",
      push: { title: "🎓 Mentor Bonus!", body: `+${bonus.toLocaleString()} DC deposited.` },
    }).catch(() => {});
  }
}
