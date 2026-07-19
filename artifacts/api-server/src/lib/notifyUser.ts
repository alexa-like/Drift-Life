/**
 * Central helper for creating in-app notifications and, when configured,
 * delivering a Web Push notification to every active browser subscription.
 *
 * Usage:
 *   import { notifyUser } from "../lib/notifyUser";
 *   await notifyUser({ userId, type: "combat", message: "You won the fight!", link: "/arena" });
 */
import mongoose from "mongoose";
import Notification from "../models/Notification";
import PushSubscription from "../models/PushSubscription";
import User from "../models/User";
import { isWebPushConfigured, sendPushNotification, PushPayload } from "./webPush";
import { logger } from "./logger";

export type NotifType =
  | "achievements"
  | "dms"
  | "xpBoost"
  | "combat"
  | "crimes"
  | "faction"
  | "banking"
  | "general";

interface NotifyOpts {
  userId: string | mongoose.Types.ObjectId;
  type: NotifType;
  message: string;
  link?: string;
  /** Optional overrides for the push notification title/body when they differ from `message`. */
  push?: Partial<PushPayload>;
}

export async function notifyUser(opts: NotifyOpts): Promise<void> {
  const { userId, type, message, link = null, push: pushOverride = {} } = opts;

  // 1. Always persist an in-app notification
  try {
    await Notification.create({ userId, type, message, link });
  } catch (err) {
    logger.error({ err }, "notifyUser: DB create failed");
  }

  // 2. Web Push — skip if VAPID keys are not configured
  if (!isWebPushConfigured()) return;

  try {
    const user = await User.findById(userId).select("notificationPrefs").lean();
    if (!user) return;

    const prefs: Record<string, unknown> = (user as any).notificationPrefs ?? {};

    // Respect per-type opt-out (default is ON when the field is absent)
    if (type !== "general" && prefs[type] === false) return;

    const subs = await PushSubscription.find({ userId }).lean();
    if (!subs.length) return;

    const payload: PushPayload = {
      title: pushOverride.title ?? "Neonoir",
      body:  pushOverride.body  ?? message,
      icon:  pushOverride.icon  ?? "/favicon.svg",
      badge: pushOverride.badge ?? "/favicon.svg",
      link:  link ?? "/notifications",
      tag:   type,
    };

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await sendPushNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        } catch (err: any) {
          if (err.expired) {
            // Stale subscription — remove silently
            await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
          }
        }
      })
    );
  } catch (err) {
    logger.error({ err }, "notifyUser: push delivery failed");
  }
}
