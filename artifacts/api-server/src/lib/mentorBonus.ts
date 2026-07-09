import User, { levelUp } from "../models/User";
import { logger } from "./logger";

/**
 * Apply XP to a user, adding mentor relationship bonuses:
 *   - Mentee at level ≤ 10 with a mentor: +10% XP
 *   - Mentor passively receives +5% of XP earned by their mentee
 *
 * Caller must call user.save() after this function.
 * Returns the actual XP amount applied to the mentee.
 */
export async function applyXpWithMentorBonus(
  user: InstanceType<typeof User>,
  baseXp: number,
): Promise<number> {
  const mentorId = (user as any).mentorId;

  // Mentee bonus: +10% for levels 1–10 while paired
  const xp = mentorId && user.level <= 10 ? Math.ceil(baseXp * 1.1) : baseXp;

  // Apply XP then check for level-up
  user.xp += xp;
  levelUp(user);

  // Passive mentor bonus: +5% of BASE XP (fire-and-forget, never throws)
  if (mentorId) {
    const mentorBonus = Math.ceil(baseXp * 0.05);
    if (mentorBonus > 0) {
      User.findById(mentorId)
        .then(mentor => {
          if (!mentor) return;
          mentor.xp += mentorBonus;
          levelUp(mentor);
          return mentor.save();
        })
        .catch(err => logger.warn({ err }, "mentor XP bonus failed"));
    }
  }

  return xp;
}
