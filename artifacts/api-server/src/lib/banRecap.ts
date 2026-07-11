/**
 * banRecap.ts — Tier 8 §8.3
 *
 * Weekly scheduled post reporting the number of accounts banned that week.
 * Count-only, by design: no username is ever included, so there is nothing
 * to mask here. If a future post on this system ever needs to include a
 * partially-masked name, build lib/maskUsername.ts then (single shared
 * `al******a`-style implementation, reused everywhere) — do not inline
 * string-slice a username at any call site.
 *
 * Idempotency mirrors postWeeklyRecap() in routes/leaderboard.ts: a
 * persisted marker in ServerConfig means it's safe to poll this on an
 * hourly interval — it only actually posts once per new week. Skips
 * posting when the count is 0, matching the existing weekly-recap
 * convention of omitting empty categories rather than spamming the feed.
 */
import User from "../models/User";
import ServerConfig from "../models/ServerConfig";
import { postToSystemFeed } from "./systemFeed";

const BAN_RECAP_KEY = "moderation:lastWeeklyBanRecap";

function getMondayMidnightUTC(): Date {
  const now = new Date();
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export async function postWeeklyBanRecap(): Promise<boolean> {
  const monday = getMondayMidnightUTC();
  const marker = await ServerConfig.findOne({ key: BAN_RECAP_KEY }).lean();
  const lastRecap = marker ? new Date((marker.value as any).at) : null;
  if (lastRecap && lastRecap.getTime() >= monday.getTime()) {
    return false; // already posted for this week
  }

  const weekAgo = new Date(monday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const count = await User.countDocuments({ bannedAt: { $gte: weekAgo, $lt: monday } });

  if (count > 0) {
    await postToSystemFeed(
      "moderation_recap",
      `:shield: ${count} account${count === 1 ? "" : "s"} banned this week for rule violations. Play clean, city.`,
    );
  }

  await ServerConfig.findOneAndUpdate(
    { key: BAN_RECAP_KEY },
    { $set: { value: { at: new Date() } } },
    { upsert: true },
  );
  return true;
}
