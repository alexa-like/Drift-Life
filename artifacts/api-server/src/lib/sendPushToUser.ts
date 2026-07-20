/**
 * Push-only helper: send a Web Push notification to a single user without
 * creating an in-app Notification document. Use when you've already persisted
 * the Notification record and only need the push leg (e.g. outbid, mention).
 */
import mongoose from "mongoose";
import PushSubscription from "../models/PushSubscription";
import User from "../models/User";
import { isWebPushConfigured, sendPushNotification, PushPayload } from "./webPush";
import { logger } from "./logger";

/**
 * Send a push notification to a user.
 * @param userId   Target user's ObjectId or string.
 * @param payload  Push notification payload.
 * @param prefKey  Optional notificationPrefs key. If the user has explicitly
 *                 set prefs[prefKey] === false the push is skipped.
 */
export async function sendPushToUser(
  userId: string | mongoose.Types.ObjectId,
  payload: PushPayload,
  prefKey?: string,
): Promise<void> {
  if (!isWebPushConfigured()) return;
  try {
    if (prefKey) {
      const user = await User.findById(userId).select("notificationPrefs").lean();
      if (!user) return;
      const prefs: Record<string, unknown> = (user as any).notificationPrefs ?? {};
      if (prefs[prefKey] === false) return;
    }

    const subs = await PushSubscription.find({ userId }).lean();
    if (!subs.length) return;

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await sendPushNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        } catch (err: any) {
          if (err.expired) {
            PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
          }
        }
      }),
    );
  } catch (err) {
    logger.error({ err }, "sendPushToUser failed");
  }
}
