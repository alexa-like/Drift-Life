/**
 * lib/staffEarningsWorker.ts
 *
 * Automatically pays all active staff members their daily DC at midnight
 * Nigeria time (WAT = UTC+1, no DST).  Called on a 1-minute interval from
 * index.ts.
 *
 * Double-pay safety: a module-level variable tracks the WAT calendar date of
 * the last completed payout.  A tick that fires at 00:00 WAT sets it;
 * subsequent ticks within the same WAT date (00:01, 00:02, …) see the date
 * already recorded and skip.  The variable resets automatically on the next
 * calendar day when the date string no longer matches.
 *
 * The manual /staff/earnings/claim route still works — it checks the
 * staffEarningsLastClaimedAt 24-hour cooldown, so auto-pay and manual-claim
 * cannot both fire within the same 24-hour window.
 */

import User from "../models/User";
import { STAFF_TIERS } from "./staffTiers";
import { logger } from "./logger";
import AdminAuditLog from "../models/AdminAuditLog";

/** WAT offset from UTC in minutes (UTC+1, no DST). */
const WAT_OFFSET_MINUTES = 60;

/** Returns the current date string in WAT, e.g. "2026-07-13". */
function watDateString(): string {
  const now = new Date();
  const watMs = now.getTime() + WAT_OFFSET_MINUTES * 60 * 1000;
  const watDate = new Date(watMs);
  return watDate.toISOString().slice(0, 10);
}

/** Returns the current { hour, minute } in WAT. */
function watTime(): { hour: number; minute: number } {
  const now = new Date();
  const watMs = now.getTime() + WAT_OFFSET_MINUTES * 60 * 1000;
  const watDate = new Date(watMs);
  return { hour: watDate.getUTCHours(), minute: watDate.getUTCMinutes() };
}

/** Date string of the last completed auto-payout ("YYYY-MM-DD" in WAT). */
let lastPayoutDate: string | null = null;

/** Pay all active staff their daily DC.  Returns number of staff paid. */
async function payStaffEarnings(): Promise<number> {
  const staffUsers = await User.find({
    staffTier: { $gte: 1, $lte: 5 },
    isBanned: { $ne: true },
  }).select("_id username staffTier staffEarningsTotalDc");

  if (staffUsers.length === 0) return 0;

  const now = new Date();
  let paid = 0;

  for (const u of staffUsers) {
    const tier = u.staffTier as number;
    const tierInfo = STAFF_TIERS[tier];
    if (!tierInfo) continue;

    const amount = tierInfo.dailyDc;

    await User.findByIdAndUpdate(u._id, {
      $inc: { dc: amount, staffEarningsTotalDc: amount },
      $set: { staffEarningsLastClaimedAt: now },
    });

    paid++;
  }

  // Write a single audit log entry for the batch payout
  await AdminAuditLog.create({
    actorId: null,
    actorUsername: "SYSTEM",
    action: "staff_auto_payout",
    details: {
      payoutDate: watDateString(),
      staffPaid: paid,
      triggeredAt: now.toISOString(),
    },
  });

  return paid;
}

/**
 * Single entry point called by the index.ts interval every minute.
 * Fires the payout once per WAT calendar day at 00:00–00:01 WAT.
 */
export async function runStaffEarningsWorker(): Promise<void> {
  const { hour, minute } = watTime();
  const todayWAT = watDateString();

  // Only act during the 00:00 minute in Nigeria time
  if (hour !== 0 || minute !== 0) return;

  // Already paid today — skip
  if (lastPayoutDate === todayWAT) return;

  lastPayoutDate = todayWAT;

  try {
    const count = await payStaffEarnings();
    logger.info({ count, date: todayWAT }, "Staff daily earnings auto-paid");
  } catch (err) {
    // Reset so the next tick can retry
    lastPayoutDate = null;
    logger.error({ err }, "Staff earnings auto-payout failed");
  }
}
