import User from "../models/User";
import Notification from "../models/Notification";
import mongoose from "mongoose";

const MAX_NOTIFS = 30;

/**
 * Parse all @username tokens from a message body.
 * Returns unique lowercase usernames (no duplicates, no self-mention).
 */
export function parseMentions(text: string): string[] {
  const matches = text.match(/@([\w]{2,32})/g) ?? [];
  const unique = [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
  return unique;
}

/**
 * Create mention notifications for every @username found in `text`.
 * - Skips the sender themselves.
 * - Caps each recipient at MAX_NOTIFS: oldest are deleted before inserting.
 * - Fire-and-forget safe: all errors are swallowed.
 */
export async function notifyMentions(opts: {
  text: string;
  senderId: mongoose.Types.ObjectId | string;
  senderName: string;
  sourceLabel: string;   // e.g. "Global Chat", "City Feed", "Faction Chat"
  sourcePage: string;    // e.g. "chat", "feed"  — used as the link target
}): Promise<void> {
  try {
    const { text, senderId, senderName, sourceLabel, sourcePage } = opts;
    const usernames = parseMentions(text);
    if (usernames.length === 0) return;

    const targets = await User.find({
      username: { $in: usernames.map(u => new RegExp(`^${u}$`, "i")) },
      _id: { $ne: senderId },
      banned: false,
    }).select("_id").lean();

    if (targets.length === 0) return;

    await Promise.all(targets.map(async (target) => {
      try {
        const count = await Notification.countDocuments({ userId: target._id });
        if (count >= MAX_NOTIFS) {
          const excess = count - MAX_NOTIFS + 1;
          const oldest = await Notification.find({ userId: target._id })
            .sort({ createdAt: 1 })
            .limit(excess)
            .select("_id")
            .lean();
          await Notification.deleteMany({ _id: { $in: oldest.map(o => o._id) } });
        }
        await Notification.create({
          userId: target._id,
          type: "mention",
          message: `${senderName} mentioned you in ${sourceLabel}`,
          read: false,
          link: `page:${sourcePage}`,
        });
      } catch { /* individual failure — ignore */ }
    }));
  } catch { /* top-level failure — ignore */ }
}
