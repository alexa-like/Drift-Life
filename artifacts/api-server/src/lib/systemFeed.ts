import FeedEvent from "../models/FeedEvent";

/**
 * Post a system-generated event to the global feed.
 * Silent-fails — feed posts should never crash the calling action.
 */
export async function postToSystemFeed(
  category: string,
  message: string,
  _mentionedUsers: string[] = [],
): Promise<void> {
  try {
    await FeedEvent.create({
      type: "system",
      actor: "System",
      actorId: null,
      target: null,
      targetId: null,
      message,
      dc: 0,
      xp: 0,
    });
  } catch (e) {
    console.error("Failed to post to system feed:", e);
  }
}
