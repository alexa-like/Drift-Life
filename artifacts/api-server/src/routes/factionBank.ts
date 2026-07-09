import { Router } from "express";
import Guild from "../models/Guild";
import FactionBankLog from "../models/FactionBankLog";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const GUILD_PERKS: Record<string, { name: string; cost: number; description: string }> = {
  street_network:   { name: "Street Network",   cost: 50_000,  description: "+10% crime XP for all members for 7 days." },
  combat_training:  { name: "Combat Training",  cost: 50_000,  description: "+5% arena win chance for all members for 7 days." },
  turf_logistics:   { name: "Turf Logistics",   cost: 75_000,  description: "+20% turf race win chance for 7 days." },
  energy_racket:    { name: "Energy Racket",    cost: 150_000, description: "+15% energy regen for all members for 7 days." },
};

function isOfficerPlus(role: string | null | undefined): boolean {
  return role === "leader" || role === "officer";
}

// GET /api/faction/bank
router.get("/bank", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId guildRole");
    if (!user?.guildId) return res.status(400).json({ message: "Not in a guild" });

    const guild = await Guild.findById(user.guildId).lean();
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    const logs = await FactionBankLog.find({ factionId: user.guildId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Prune expired perks inline (non-mutating for GET)
    const now = new Date();
    const activePerks = (guild.activePerks ?? []).filter((p: any) => p.expiresAt > now);

    res.json({
      bankBalance: guild.bankBalance ?? 0,
      activePerks,
      availablePerks: Object.entries(GUILD_PERKS).map(([id, p]) => ({ id, ...p })),
      logs: logs.map(l => ({
        id: l._id,
        username: l.username,
        amount: l.amount,
        type: l.type,
        createdAt: l.createdAt,
      })),
    });
  } catch (err: any) {
    req.log.error({ err }, "faction bank GET error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/faction/bank/deposit
router.post("/bank/deposit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt < 1) return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(req.userId);
    if (!user?.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (user.dc < amt) return res.status(400).json({ message: "Not enough DC" });

    const guild = await Guild.findById(user.guildId);
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    user.dc -= amt;
    guild.bankBalance = (guild.bankBalance ?? 0) + amt;

    await Promise.all([user.save(), guild.save()]);

    await FactionBankLog.create({
      factionId: guild._id,
      userId: user._id,
      username: user.username,
      amount: amt,
      type: "deposit",
    });

    res.json({ message: `Deposited ${amt.toLocaleString()} DC to guild bank`, bankBalance: guild.bankBalance, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "faction bank deposit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/faction/bank/withdraw
router.post("/bank/withdraw", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt < 1) return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(req.userId);
    if (!user?.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (!isOfficerPlus(user.guildRole)) return res.status(403).json({ message: "Officer+ only" });

    const guild = await Guild.findById(user.guildId);
    if (!guild) return res.status(404).json({ message: "Guild not found" });
    if ((guild.bankBalance ?? 0) < amt) return res.status(400).json({ message: "Not enough in guild bank" });

    guild.bankBalance = (guild.bankBalance ?? 0) - amt;
    user.dc = Math.min(100_000_000, user.dc + amt);

    await Promise.all([user.save(), guild.save()]);

    await FactionBankLog.create({
      factionId: guild._id,
      userId: user._id,
      username: user.username,
      amount: amt,
      type: "withdraw",
    });

    res.json({ message: `Withdrew ${amt.toLocaleString()} DC from guild bank`, bankBalance: guild.bankBalance, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "faction bank withdraw error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/faction/perks/buy
router.post("/perks/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { perkId } = req.body;
    const perk = GUILD_PERKS[perkId as string];
    if (!perk) return res.status(404).json({ message: "Unknown perk" });

    const user = await User.findById(req.userId);
    if (!user?.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (!isOfficerPlus(user.guildRole)) return res.status(403).json({ message: "Officer+ only" });

    const guild = await Guild.findById(user.guildId);
    if (!guild) return res.status(404).json({ message: "Guild not found" });
    if ((guild.bankBalance ?? 0) < perk.cost) return res.status(400).json({ message: `Insufficient guild bank balance (need ${perk.cost.toLocaleString()} DC)` });

    guild.bankBalance = (guild.bankBalance ?? 0) - perk.cost;

    // Prune expired perks
    const now = new Date();
    guild.activePerks = (guild.activePerks ?? []).filter((p: any) => p.expiresAt > now);

    // Check if already active
    const already = guild.activePerks.find((p: any) => p.perkId === perkId);
    if (already) {
      // Extend by 7 days from now
      already.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else {
      guild.activePerks.push({ perkId: perkId as string, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    }

    await guild.save();

    res.json({ message: `Activated perk: ${perk.name}`, bankBalance: guild.bankBalance, activePerks: guild.activePerks });
  } catch (err: any) {
    req.log.error({ err }, "faction perk buy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
