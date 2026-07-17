import User from "../models/User";
import Item from "../models/Item";
import { logger } from "./logger";
import { seedArenaItems } from "./arenaItemSeed";
export async function seed() {
  try {
    await Promise.all([
      seedArenaItems(),
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
