import FeedEvent from "../models/FeedEvent";

interface FeedEventInput {
  type: string;
  actor: string;
  actorId?: string;
  actorFrame?: string | null;
  actorFrameColor?: string | null;
  actorAvatarUrl?: string | null;
  target?: string | null;
  targetId?: string | null;
  message: string;
  dc?: number;
  xp?: number;
}

export async function emitFeedEvent(data: FeedEventInput): Promise<void> {
  try {
    await (FeedEvent as any).create({
      type: data.type,
      actor: data.actor,
      actorId: data.actorId || null,
      target: data.target || null,
      targetId: data.targetId || null,
      message: data.message,
      dc: data.dc ?? 0,
      xp: data.xp ?? 0,
    });
  } catch {
    // Non-fatal — feed events should never crash callers
  }
}
