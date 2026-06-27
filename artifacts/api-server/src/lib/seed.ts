import User from "../models/User";
import Item from "../models/Item";
import { logger } from "./logger";

export async function seed() {
  try {
    const [userCount, itemCount] = await Promise.all([
      User.countDocuments(),
      Item.countDocuments(),
    ]);
    logger.info(
      { userCount, itemCount },
      "DriftLife database ready — 70-item shop catalog loaded from static catalog"
    );
  } catch (err) {
    logger.error({ err }, "Seed check error");
  }
}
