import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";
import { energySufficientExpr, buildRegenPipeline } from "../lib/atomicRegen";

const router = Router();

export const DISTRICTS = [
  { id: "neon_strip", name: "Neon Strip",       faction: "neutral",      dangerLevel: 1, travelEnergyCost: 5,  minLevel: 5,  color: "#ff00cc", primaryActivity: "Entertainment district. Clubs, gambling dens, underground pharmacy.", description: "Neon lights, music, and deals that look legitimate. Easy pickings if you know where to look.", npcs: ["Club Promoter", "Gig Worker", "Underground Dealer"] },
  { id: "docks",      name: "The Docks",        faction: "street",       dangerLevel: 2, travelEnergyCost: 8,  minLevel: 10, color: "#00aaff", primaryActivity: "Smugglers and import brokers. Things fall off ships here.",           description: "Things fall off ships here. Everyone looks the other way.",                     npcs: ["Sal the Broker", "Dock Enforcer", "Harbor Rat"] },
  { id: "slums",      name: "The Slums",        faction: "street",       dangerLevel: 3, travelEnergyCost: 10, minLevel: 15, color: "#ff6b35", primaryActivity: "Poverty and desperation. Cheap goods, street crime, gang territory.", description: "Poverty breeds danger. The gangs run everything and nobody asks questions.",    npcs: ["Gang Captain", "Street Doc", "Fence"] },
  { id: "corp_zone",  name: "Corporate Zone",   faction: "suits",        dangerLevel: 2, travelEnergyCost: 12, minLevel: 20, color: "#f59e0b", primaryActivity: "Glass towers and private security. Expensive, clean, dangerous in a different way.", description: "Glass towers and private security. Everything here costs more than you think.", npcs: ["Corporate Fixer", "Security Guard", "Data Broker"] },
  { id: "industrial", name: "Industrial Sector",faction: "neutral",      dangerLevel: 4, travelEnergyCost: 15, minLevel: 25, color: "#888888", primaryActivity: "Factories and workshops. Black market parts, dirty jobs.",            description: "Factories and workshops. Black market parts and dirty jobs for those who ask.", npcs: ["Chop Shop Owner", "Arms Dealer", "Mechanic"] },
  { id: "outskirts",  name: "The Outskirts",    faction: "uncontrolled", dangerLevel: 5, travelEnergyCost: 20, minLevel: 35, color: "#ff2d55", primaryActivity: "City's edge. Lawless. Best loot, worst odds.",                        description: "Beyond the walls. No laws. No safety nets. Only predators.",                   npcs: ["Syndicate Boss", "Rogue AI Unit", "Wasteland Raider"] },
];

// GET /api/districts
router.get("/", requireAuth, async (_req, res) => {
  try {
    const counts = await User.aggregate([
      { $match: { banned: false, isEmailVerified: true } },
      { $group: { _id: "$district", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    for (const c of counts) if (c._id) countMap[c._id] = c.count;
    res.json(DISTRICTS.map(d => ({ ...d, population: countMap[d.id] || 0 })));
  } catch {
    res.json(DISTRICTS.map(d => ({ ...d, population: 0 })));
  }
});

// GET /api/districts/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const district = DISTRICTS.find(d => d.id === req.params.id);
  if (!district) return res.status(404).json({ message: "District not found" });
  const population = await User.countDocuments({ district: req.params.id, banned: false });
  res.json({ ...district, population });
});

// POST /api/districts/:id/travel
router.post("/:id/travel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const district = DISTRICTS.find(d => d.id === req.params.id);
    if (!district) return res.status(404).json({ message: "District not found" });

    // Read user for preliminary checks only — regen computed DB-side below
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user); // in-memory for checks only — not saved

    if (user.district === district.id) return res.status(400).json({ message: "You are already in this district" });
    if (user.level < district.minLevel) return res.status(400).json({ message: `Level ${district.minLevel} required to enter ${district.name}` });
    if (user.hospitalizedUntil && user.hospitalizedUntil > new Date()) return res.status(400).json({ message: "Cannot travel while hospitalized" });

    // FULLY ATOMIC: regen computed server-side; $expr checks effective energy before deducting
    const updated = await User.findOneAndUpdate(
      {
        _id: req.userId,
        ...energySufficientExpr(district.travelEnergyCost),
      },
      buildRegenPipeline({
        energyCost: district.travelEnergyCost,
        extraSet:   {
          district:        district.id,
          status:          "abroad",
          currentLocation: district.id,
        },
      }),
      { new: true },
    );

    if (!updated) {
      return res.status(400).json({
        message: `Not enough energy. Travel to ${district.name} costs ${district.travelEnergyCost} energy.`,
      });
    }

    res.json({
      message: `Traveled to ${district.name}`,
      district: district.id,
      energyCost: district.travelEnergyCost,
      user: {
        energy:          updated.energy,
        maxEnergy:       updated.maxEnergy,
        district:        updated.district,
        status:          updated.status,
        currentLocation: updated.currentLocation,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "travel error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/districts/:id/players
router.get("/:id/players", requireAuth, async (req, res) => {
  try {
    const players = await User.find({ district: req.params.id, banned: false, isEmailVerified: true })
      .select("username avatar faction level")
      .limit(50).lean();
    res.json(players.map(p => ({ id: p._id, username: p.username, avatar: p.avatar, faction: (p as any).faction, level: p.level })));
  } catch (err: any) {
    req.log.error({ err }, "district players error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
