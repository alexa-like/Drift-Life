/**
 * Vanta utility — fire automated detection events with deduplication.
 * Prevents log spam by refusing to create a new entry if an identical
 * unresolved entry already exists for the same player+trigger within 24 h.
 */
import mongoose from "mongoose";
import VantaLog, { VantaTrigger, VantaSeverity } from "../models/VantaLog";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fireVantaEvent(
  playerId: mongoose.Types.ObjectId | string,
  playerName: string,
  trigger: VantaTrigger,
  severity: VantaSeverity,
  details: string,
): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
    const existing = await VantaLog.exists({
      playerId,
      trigger,
      dismissed: false,
      createdAt: { $gte: cutoff },
    });
    if (existing) return; // already logged recently
    await VantaLog.create({ playerId, playerName, trigger, severity, details });
  } catch {
    // Never let moderation failures crash game routes
  }
}
