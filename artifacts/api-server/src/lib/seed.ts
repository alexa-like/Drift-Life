import User from "../models/User";
import Item from "../models/Item";
import { logger } from "./logger";
import { seedArenaItems } from "./arenaItemSeed";
import GameEmoji, { EMOJI_CATALOG } from "../models/GameEmoji";

async function seedGameEmojis(): Promise<void> {
  const count = await GameEmoji.countDocuments();
  if (count >= EMOJI_CATALOG.length) return;
  for (const e of EMOJI_CATALOG) {
    await GameEmoji.updateOne({ slug: e.slug }, { $setOnInsert: e }, { upsert: true });
  }
  logger.info(`Seeded ${EMOJI_CATALOG.length} game emojis`);
}

export async function seed() {
  try {
    await Promise.all([
      seedArenaItems(),
      seedGameEmojis(),
    ]);
    const [userCount, itemCount] = await Promise.all([
      User.countDocuments(),
      Item.countDocuments(),
    ]);
    logger.info(
      { userCount, itemCount },
      "Neonoir database ready"
    );
  } catch (err) {
    logger.error({ err }, "Seed check error");
  }
}
