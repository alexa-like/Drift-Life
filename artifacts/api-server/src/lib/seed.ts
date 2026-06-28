import User from "../models/User";
import Item from "../models/Item";
import { seedFrames } from "../models/Frame";
import { logger } from "./logger";

export async function seed() {
  try {
    const [userCount, itemCount] = await Promise.all([
      User.countDocuments(),
      Item.countDocuments(),
    ]);
    await seedFrames();
    logger.info(
      { userCount, itemCount },
      "DriftLife database ready — frames seeded to MongoDB"
    );
  } catch (err) {
    logger.error({ err }, "Seed check error");
  }
}
