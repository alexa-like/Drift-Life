import mongoose from "mongoose";
import { logger } from "./logger";
import { seedRaceCars } from "../seeds/raceCars";
import { seedRoyaleItems } from "../seeds/royaleItems";

// NOTE: Arena/combat MiniGameItem definitions (weapons, armor, consumables, ammo) are
// seeded exclusively by `lib/arenaItemSeed.ts` (invoked from `lib/seed.ts` at boot).
// `seeds/miniGameItems.ts` is a legacy duplicate of the same catalog with stale stat
// values (e.g. wrong consumable rarities/heal amounts) — it must NOT be run alongside
// arenaItemSeed, since both upsert the same itemIds and whichever ran last silently won.

let isConnected = false;

/** Startup migration: purge stored XSS payloads from the chat collection.
 *  Targets only messages that contain raw HTML tags (<script, <img, <svg, etc.)
 *  which should never appear since sanitizeContent() strips them at write time.
 *  Safe to leave in permanently — deleteMany with 0 matches is a no-op. */
async function purgeXssMessages() {
  try {
    const col = mongoose.connection.collection("chatmessages");
    // Match any message whose content contains an HTML opening tag
    const result = await col.deleteMany({ content: { $regex: /<\s*(script|img|svg|iframe|object|embed|link|style|form|input|meta|base)/i } });
    if (result.deletedCount > 0) {
      logger.info({ count: result.deletedCount }, "XSS migration: removed chat messages containing raw HTML tags");
    }
  } catch (err) {
    logger.warn({ err }, "XSS migration: skipped (non-fatal)");
  }
}

export async function connectDB() {
  if (isConnected) return;

  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI environment variable is required");

  await mongoose.connect(uri, { dbName: "neonoir" });
  isConnected = true;
  logger.info("MongoDB connected");

  // Run one-time XSS cleanup on startup
  void purgeXssMessages();

  // Seed catalogs (no-ops if already seeded; errors are logged, not thrown).
  // Arena combat items are seeded separately by seed() → seedArenaItems() at boot.
  seedRaceCars().catch(err => logger.warn({ err }, "seed: raceCars failed"));
  seedRoyaleItems().catch(err => logger.warn({ err }, "seed: royaleItems failed"));

  mongoose.connection.on("error", (err) => {
    logger.error({ err }, "MongoDB error");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
    isConnected = false;
  });
}
