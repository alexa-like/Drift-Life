/**
 * leaderboardHighlights.ts — Tier 8 §8.1
 *
 * Call right after any write that can change a player's standing on a weekly
 * MiniGameLeaderboard (routes/race.ts, routes/arena.ts). Computes the
 * player's live rank the same way routes/mini-leaderboard.ts's GET route
 * does (countDocuments of strictly-better scores + 1), and posts a
 * system-feed highlight the first time this entry reaches #1 or the top 3
 * this week.
 *
 * Dedup: `lastAnnouncedRank` on the entry (models/MiniGameLeaderboard.ts)
 * tracks the best rank already announced this week. We only post again if
 * the player's rank *improves* past that — a player sitting at #1 for many
 * more wins is announced once, not once per win, while a genuine climb
 * (e.g. #5 -> #2 -> #1) still gets announced at each new best. The update
 * that claims the announcement is guarded so concurrent writers for the
 * same entry never double-post.
 */
import mongoose from "mongoose";
import MiniGameLeaderboard, { LeaderboardType } from "../models/MiniGameLeaderboard";
import { postToSystemFeed } from "./systemFeed";

const ASCENDING: LeaderboardType[] = ["race_fastest_2p", "race_fastest_4p"];

const LEADERBOARD_LABELS: Record<LeaderboardType, string> = {
  combat_wins:     "Combat Wins",
  combat_streak:   "Combat Win Streak",
  race_wins:       "Race Wins",
  race_fastest_2p: "Fastest Race (2-Player)",
  race_fastest_4p: "Fastest Race (4-Player)",
};

export async function announceLeaderboardMilestone(
  leaderboardType: LeaderboardType,
  weekStart: Date,
  userId: mongoose.Types.ObjectId | string,
  username: string,
): Promise<void> {
  try {
    const entry = await MiniGameLeaderboard.findOne({ leaderboardType, weekStart, userId }).lean();
    if (!entry) return;

    const ascending = ASCENDING.includes(leaderboardType);
    const betterCount = await MiniGameLeaderboard.countDocuments(
      ascending
        ? { leaderboardType, weekStart, score: { $lt: entry.score } }
        : { leaderboardType, weekStart, score: { $gt: entry.score } },
    );
    const rank = betterCount + 1;
    if (rank > 3) return;

    const currentBest = (entry as any).lastAnnouncedRank ?? Infinity;
    if (rank >= currentBest) return; // already announced this rank (or a better one) this week

    // Atomic guard: only the first concurrent caller to observe this improvement wins the post.
    const claim = await MiniGameLeaderboard.updateOne(
      {
        _id: entry._id,
        $or: [{ lastAnnouncedRank: { $exists: false } }, { lastAnnouncedRank: null }, { lastAnnouncedRank: { $gt: rank } }],
      },
      { $set: { lastAnnouncedRank: rank } },
    );
    if (claim.modifiedCount === 0) return;

    const label = LEADERBOARD_LABELS[leaderboardType];
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
    const message = rank === 1
      ? `${medal} @${username} just claimed #1 on the ${label} leaderboard this week!`
      : `${medal} @${username} just broke into the Top 3 on the ${label} leaderboard this week (#${rank})!`;

    await postToSystemFeed("leaderboard_highlight", message, [username]);
  } catch (err) {
    console.error("announceLeaderboardMilestone failed:", err);
  }
}
