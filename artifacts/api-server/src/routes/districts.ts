import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";

const router = Router();

// 7 districts per spec
export const DISTRICTS = [
  {
    id: "residential-north",
    name: "Residential North",
    faction: "neutral",
    dangerLevel: 1,
    travelEnergyCost: 3,
    minLevel: 1,
    color: "#39d353",
    primaryActivity: "Starter jobs, low-risk crimes, safe zone",
    description: "The city's oldest neighbourhood. Crumbling but liveable.",
    npcs: ["Street Punk", "Chief Ralston"],
  },
  {
    id: "tech-quarter",
    name: "Tech Quarter",
    faction: "grid",
    dangerLevel: 2,
    travelEnergyCost: 5,
    minLevel: 5,
    color: "#00d4ff",
    primaryActivity: "Hacking jobs, data crimes, Grid NPCs",
    description: "Server farms and Grid operatives. Information is power.",
    npcs: ["Shadow Operative", "Ghost"],
  },
  {
    id: "the-boulevard",
    name: "The Boulevard",
    faction: "neutral",
    dangerLevel: 3,
    travelEnergyCost: 8,
    minLevel: 5,
    color: "#a855f7",
    primaryActivity: "Social hub, clubs, mid-tier jobs",
    description: "Neon lights, clubs, and deals that look legitimate.",
    npcs: ["Gang Member", "Cleo"],
  },
  {
    id: "industrial-east",
    name: "Industrial East",
    faction: "street",
    dangerLevel: 4,
    travelEnergyCost: 8,
    minLevel: 8,
    color: "#ff6b35",
    primaryActivity: "Dock work, gang crimes, Street NPCs",
    description: "Warehouses, docks, and the Street Syndicate's turf.",
    npcs: ["Street Thug", "Mama Nova"],
  },
  {
    id: "port-district",
    name: "Port District",
    faction: "street",
    dangerLevel: 4,
    travelEnergyCost: 8,
    minLevel: 8,
    color: "#ff6b35",
    primaryActivity: "Smuggling, black market, cargo jobs",
    description: "The city's lifeline and its deepest wound. Everything illegal flows through here.",
    npcs: ["Dock Enforcer", "Marco"],
  },
  {
    id: "downtown-core",
    name: "Downtown Core",
    faction: "suits",
    dangerLevel: 5,
    travelEnergyCost: 12,
    minLevel: 15,
    color: "#f59e0b",
    primaryActivity: "Corporate jobs, high-level PvP, elite crimes",
    description: "The Suits own this place. Everything here is expensive, dangerous, or both.",
    npcs: ["Security Guard", "Faction Boss", "Director Webb"],
  },
  {
    id: "the-outskirts",
    name: "The Outskirts",
    faction: "uncontrolled",
    dangerLevel: 5,
    travelEnergyCost: 12,
    minLevel: 20,
    color: "#ff2d55",
    primaryActivity: "Rarest loot, boss NPCs, extreme rewards",
    description: "Beyond the walls. No laws. No safety nets. Only predators.",
    npcs: ["Syndicate Boss", "Rogue AI Unit"],
  },
];

// GET /api/districts
router.get("/", requireAuth, async (_req, res) => {
  res.json(DISTRICTS);
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

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    if (user.district === district.id) return res.status(400).json({ message: "You are already in this district" });
    if (user.level < district.minLevel) return res.status(400).json({ message: `Level ${district.minLevel} required to enter ${district.name}` });

    const hospUntil = user.hospitalizedUntil;
    if (hospUntil && hospUntil > new Date()) return res.status(400).json({ message: "Cannot travel while hospitalized" });

    if (user.energy < district.travelEnergyCost) {
      return res.status(400).json({ message: `Not enough energy. Travel to ${district.name} costs ${district.travelEnergyCost} energy.` });
    }

    user.energy -= district.travelEnergyCost;
    user.district = district.id;
    await user.save();

    res.json({
      message: `Traveled to ${district.name}`,
      district: district.id,
      energyCost: district.travelEnergyCost,
      user: { energy: user.energy, maxEnergy: user.maxEnergy, district: user.district },
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
      .select("username avatar faction level equippedFrame")
      .limit(50)
      .lean();
    res.json(players.map(p => ({ id: p._id, username: p.username, avatar: p.avatar, faction: (p as any).faction, level: p.level, equippedFrame: (p as any).equippedFrame })));
  } catch (err: any) {
    req.log.error({ err }, "district players error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
