/**
 * lib/giveawayAltFarming.ts — Tier 6 §6.1/§6.2
 *
 * Detects alt-account farming on a single giveaway: multiple entrants sharing
 * an IP (via lastLoginIp/loginIpHistory overlap, the same signal auth.ts's
 * existing alt-account check uses). Fires a critical VantaLog entry AND
 * immediately locks every implicated account via `underReview` — enforcement
 * happens at detection time, not after staff review (§6.2).
 */

import mongoose from "mongoose";
import User from "../models/User";
import GiveawayEntry from "../models/GiveawayEntry";
import { fireVantaEvent } from "./vanta";

/** All IPs ever associated with a login for this user, deduped, "unknown" stripped. */
function ipSet(user: { lastLoginIp?: string | null; loginIpHistory?: string[] }): Set<string> {
  const ips = [user.lastLoginIp, ...(user.loginIpHistory ?? [])].filter(
    (ip): ip is string => Boolean(ip) && ip !== "unknown",
  );
  return new Set(ips);
}

/**
 * Call right after a new GiveawayEntry is created. Checks the new entrant's
 * IP history against every other entrant already in this giveaway; on any
 * overlap, flags BOTH accounts as underReview and logs a single Vanta entry
 * covering the pair. Never throws — a detection failure must not break entry.
 */
export async function checkGiveawayAltFarming(
  giveawayId: mongoose.Types.ObjectId,
  enteringUserId: mongoose.Types.ObjectId | string,
): Promise<void> {
  try {
    const enteringUser = await User.findById(enteringUserId)
      .select("username lastLoginIp loginIpHistory")
      .lean();
    if (!enteringUser) return;

    const myIps = ipSet(enteringUser);
    if (myIps.size === 0) return; // nothing to compare against

    const otherEntryUserIds = await GiveawayEntry.find({
      giveawayId,
      userId: { $ne: enteringUserId },
    }).distinct("userId");
    if (otherEntryUserIds.length === 0) return;

    const others = await User.find({ _id: { $in: otherEntryUserIds } })
      .select("username lastLoginIp loginIpHistory")
      .lean();

    for (const other of others) {
      const theirIps = ipSet(other);
      const sharedIp = [...myIps].find((ip) => theirIps.has(ip));
      if (!sharedIp) continue;

      const reason = `Shared login IP ${sharedIp} with account "${other.username}" while entering the same giveaway`;
      const otherReason = `Shared login IP ${sharedIp} with account "${enteringUser.username}" while entering the same giveaway`;

      // Lock both accounts immediately — enforcement at detection time, not
      // after staff review (§6.2). Tier 4's enter route already rejects any
      // underReview account, so this closes the loop end-to-end.
      await User.updateOne(
        { _id: enteringUserId },
        { $set: { underReview: true, underReviewReason: reason } },
      );
      await User.updateOne(
        { _id: other._id },
        { $set: { underReview: true, underReviewReason: otherReason } },
      );

      const details = `Giveaway ${giveawayId}: accounts "${enteringUser.username}" and "${other.username}" both entered from shared IP ${sharedIp}`;
      await fireVantaEvent(enteringUserId, enteringUser.username, "giveaway_alt_farming", "critical", details);
      await fireVantaEvent(other._id, other.username, "giveaway_alt_farming", "critical", details);
    }
  } catch (err) {
    console.error("[giveaway-alt-farming] detection error:", err);
  }
}
