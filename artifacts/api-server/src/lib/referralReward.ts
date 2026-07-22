/**
 * Fire when a player reaches level 5.
 * If they were referred, reward the referrer with NC.
 * Safe to call multiple times — `referralRewardsClaimed` acts as a guard.
 */
import User from "../models/User";
import { notifyUser } from "./notifyUser";
import { postToSystemFeed } from "./systemFeed";
import { logEconomy } from "./economyLog";

export async function checkReferralReward(userId: string): Promise<void> {
  try {
    const player = await User.findById(userId).select("referredBy username level referralRewardsClaimed").lean();
    if (!player) return;
    // Only fire exactly once, at level 5
    if (!player.referredBy || (player.referralRewardsClaimed ?? 0) > 0) return;

    // Mark claimed atomically first to prevent double-payment
    const claimed = await User.findOneAndUpdate(
      { _id: userId, referralRewardsClaimed: { $lt: 1 } },
      { $inc: { referralRewardsClaimed: 1 } },
    );
    if (!claimed) return; // Another concurrent call already handled it

    // Find referrer
    const referrer = await User.findOne({ referralCode: player.referredBy })
      .select("username nc referralCount titles referralRewardsClaimed");
    if (!referrer) return;

    const isFirstReferral = (referrer.referralCount ?? 0) <= 1;
    const ncReward = isFirstReferral ? 500 : 300;

    // Grant NC atomically
    await User.findByIdAndUpdate(referrer._id, { $inc: { nc: ncReward } });
    logEconomy("nc_in", ncReward, "referral_reward", {
      userId: String(referrer._id),
      username: referrer.username,
    });

    // Grant "City Connector" flair on first successful referral
    if (isFirstReferral) {
      await User.findByIdAndUpdate(referrer._id, {
        $addToSet: { titles: "City Connector" },
      });
    }

    // Notify referrer
    await notifyUser({
      userId: String(referrer._id),
      type: "achievements",
      message: `Referral Reward! ${player.username} you referred has reached Level 5! You earned ${ncReward} NC.${isFirstReferral ? ' You also received the "City Connector" title!' : ""}`,
    });

    // Notify the new player
    await notifyUser({
      userId,
      type: "achievements",
      message: "Referral Bonus! 1,000 DC has been added to your account — courtesy of the friend who brought you here.",
    });

    // Grant new player 1,000 DC referral bonus
    await User.findByIdAndUpdate(userId, { $inc: { dc: 1000 } });
    logEconomy("dc_in", 1000, "referral_new_player_bonus", {
      userId,
      username: player.username,
    });

    // Milestone feed post every 10 referrals
    const newCount = referrer.referralCount ?? 1;
    if (newCount > 0 && newCount % 10 === 0) {
      await postToSystemFeed(
        "referral",
        `[🌐 NETWORK] ${referrer.username} has brought ${newCount} new citizens to New Vanta.`,
        [referrer.username],
      );
    }
  } catch {
    // Non-fatal — never let referral errors bubble up to game routes
  }
}
