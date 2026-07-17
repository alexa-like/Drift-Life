import { Router } from "express";
import mongoose from "mongoose";
import Guild from "../models/Guild";
import User from "../models/User";
import { GANG_UPGRADES } from "../models/GangUpgrade";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

// Add upgrades field to Guild schema if not already present
Guild.schema.add({ upgrades: { type: [String], default: [] } });

const router = Router();

// GET /api/gang-upgrades — catalog + guild purchased upgrades + treasury
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId guildRole");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const guild = await Guild.findById(user.guildId).select("treasury level upgrades maxMembers");
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    const purchased: string[] = (guild as any).upgrades ?? [];

    res.json({
      catalog: GANG_UPGRADES,
      purchased,
      treasury: guild.treasury,
      guildLevel: guild.level,
      maxMembers: guild.maxMembers,
    });
  } catch (err) {
    logger.error({ err }, "gang-upgrades GET /");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-upgrades/buy — purchase an upgrade
router.post("/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { upgradeId } = req.body as { upgradeId: string };

    const user = await User.findById(req.userId).select("guildId guildRole");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (user.guildRole !== "leader" && user.guildRole !== "officer")
      return res.status(403).json({ message: "Only leaders and officers can purchase upgrades" });

    const def = GANG_UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return res.status(400).json({ message: "Upgrade not found in catalog" });

    const guild = await Guild.findById(user.guildId);
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    if (guild.level < def.requiredGuildLevel)
      return res.status(400).json({ message: `Guild must be level ${def.requiredGuildLevel} to purchase this upgrade` });

    const purchased: string[] = (guild as any).upgrades ?? [];
    const timesOwned = purchased.filter((u) => u === upgradeId).length;
    if (timesOwned >= def.maxPurchases)
      return res.status(400).json({ message: "Upgrade already purchased (max purchases reached)" });

    // Atomically deduct treasury
    const updatedGuild = await Guild.findOneAndUpdate(
      { _id: user.guildId, treasury: { $gte: def.cost } },
      { $inc: { treasury: -def.cost }, $push: { upgrades: upgradeId } },
      { returnDocument: 'after' }
    );
    if (!updatedGuild) return res.status(400).json({ message: "Not enough treasury funds" });

    // Apply immediate side effects
    const sideEffects: Record<string, number> = {
      expand_roster_1: 5,
      expand_roster_2: 10,
      expand_roster_3: 15,
    };
    if (sideEffects[upgradeId] !== undefined) {
      updatedGuild.maxMembers = (updatedGuild.maxMembers ?? 15) + sideEffects[upgradeId];
      await updatedGuild.save();
    }

    const newPurchased: string[] = (updatedGuild as any).upgrades ?? [];

    res.json({
      message: `${def.name} purchased successfully`,
      purchased: newPurchased,
      treasury: updatedGuild.treasury,
      maxMembers: updatedGuild.maxMembers,
    });
  } catch (err) {
    logger.error({ err }, "gang-upgrades POST /buy");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
