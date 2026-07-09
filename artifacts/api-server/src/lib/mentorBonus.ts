import User from "../models/User";
import { levelUp } from "../models/User";
import { logger } from "./logger";

/**
 * Apply XP to a user, adding mentor relationship bonuses:
 *   - Mentee at level ≤ 10 with a mentor: +10% XP
 *   - Mentor passively receives +5% of XP earned by their mentee
 *
 * Returns the actual XP amount applied to the mentee.
 */
export async function applyXpWithMentorBonus(
  user: InstanceType<typeof User>,
  baseXp: number,
): Promise<number> {
  let xp = baseXp;
  const mentorId = (user as any).mentorId;

  // Mentee bonus: +10% for levels 1-10 while paired
  if (mentorId && user.level <= 10) {
    xp = Math.ceil(xp * 1.1);
  }

  levelUp(user, xp);

  // Passive mentor bonus: +5% of mentee XP (fire-and-forget, never throws)
  if (mentorId) {
    const mentorBonus = Math.ceil(baseXp * 0.05);
    if (mentorBonus > 0) {
      User.findById(mentorId)
        .then(mentor => {
          if (!mentor) return;
          levelUp(mentor, mentorBonus);
          return mentor.save();
        })
        .catch(err => logger.warn({ err }, "mentor XP bonus failed"));
    }
  }

  return xp;
}
