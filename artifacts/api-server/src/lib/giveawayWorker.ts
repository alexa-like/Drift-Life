/**
 * lib/giveawayWorker.ts — Tier 5 §5.1 background worker
 *
 * Single polling loop for all giveaway maintenance, called on an interval from
 * index.ts. Combines:
 *   - §5.1 resolution sweep: live giveaways whose liveExpiresAt has passed
 *   - §3.3 draft sweep: expired drafts (absorbed here per the NOTE left in
 *     routes/giveaways.ts — there must be exactly one interval for this feature)
 *
 * Double-processing safety: resolveGiveaway() itself performs the atomic
 * status "live" -> terminal findOneAndUpdate claim, so even if two ticks of
 * this worker (or a tick + the §4.4 cap-reached trigger) race on the same
 * giveaway, only one can ever win the claim and actually distribute — the
 * other silently no-ops. The worker does not need (and must not add) a
 * second, separate locking layer on top of that.
 */

import Giveaway from "../models/Giveaway";
import { resolveGiveaway } from "./resolveGiveaway";
import { sweepExpiredDrafts } from "../routes/giveaways";

/** §5.1 — resolve every live giveaway whose timer has expired. */
async function sweepExpiredLiveGiveaways(): Promise<void> {
  const expired = await Giveaway.find({
    status: "live",
    liveExpiresAt: { $lte: new Date() },
  }).select("_id").lean();

  if (expired.length === 0) return;

  const results = await Promise.allSettled(
    expired.map((g) => resolveGiveaway(g._id)),
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[giveaway-worker] ${failures.length}/${expired.length} timer-expiry resolutions failed:`,
      failures.map((f) => (f as PromiseRejectedResult).reason),
    );
  }
}

/** Single entry point the startup worker in index.ts calls on an interval. */
export async function runGiveawayMaintenance(): Promise<void> {
  await sweepExpiredDrafts();
  await sweepExpiredLiveGiveaways();
}
