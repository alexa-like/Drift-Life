/**
 * Called after a level-up to advance onboarding stage 3→4 when player hits level 5.
 * Also fires referral reward check.
 * Safe to call fire-and-forget.
 */
import User from "../models/User";
import { notifyUser } from "./notifyUser";
import { postToSystemFeed } from "./systemFeed";
import { checkReferralReward } from "./referralReward";
import { logEconomy } from "./economyLog";

export async function checkOnboardingProgression(
  userId: string,
  prevLevel: number,
  newLevel: number,
): Promise<void> {
  try {
    // Referral reward at level 5 (regardless of onboarding stage)
    if (prevLevel < 5 && newLevel >= 5) {
      checkReferralReward(userId).catch(() => {});
    }

    // Onboarding stage 3 → 4 at level 5
    if (prevLevel < 5 && newLevel >= 5) {
      const user = await User.findOne({ _id: userId, onboardingStage: 3 })
        .select("username onboardingStage dc titles");
      if (!user) return;

      // Advance stage atomically
      const updated = await User.findOneAndUpdate(
        { _id: userId, onboardingStage: 3 },
        {
          $set: { onboardingStage: 4 },
          $inc: { dc: 2000 },
          $addToSet: { titles: "New Vanta Citizen" },
        },
        { returnDocument: "after" },
      );
      if (!updated) return; // Already advanced

      logEconomy("dc_in", 2000, "onboarding_stage4_reward", {
        userId,
        username: user.username,
      });

      await notifyUser({
        userId,
        type: "achievements",
        message: "🏙️ New Vanta Citizen! You've unlocked the full city. 2,000 DC and the 'New Vanta Citizen' title have been added.",
      });

      await postToSystemFeed(
        "onboarding",
        `[🏙️ CITY] ${user.username} just joined the game. Another soul for New Vanta.`,
        [user.username],
      );
    }
  } catch {
    // Non-fatal
  }
}
