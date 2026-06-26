import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const DISTRICTS = [
  {
    id: "neon-bazaar",
    name: "Neon Bazaar",
    description: "The chaotic heart of New Vanta. Street vendors, data-runners, and tourists.",
    dangerLevel: 1,
    minLevel: 1,
    color: "#00d4ff",
    npcs: ["Street Trader", "Data Courier", "Black Market Dealer"],
  },
  {
    id: "chrome-quarter",
    name: "Chrome Quarter",
    description: "Industrial zone of body-mod clinics and gray-market chop shops.",
    dangerLevel: 2,
    minLevel: 3,
    color: "#94a3b8",
    npcs: ["Ripperdoc", "Parts Dealer", "Gang Enforcer"],
  },
  {
    id: "rust-ward",
    name: "Rust Ward",
    description: "Decaying slums where the desperate scrape by. High crime, no law.",
    dangerLevel: 3,
    minLevel: 5,
    color: "#ff6b35",
    npcs: ["Gang Boss", "Scav", "Fixer"],
  },
  {
    id: "apex-spire",
    name: "Apex Spire",
    description: "Gleaming corporate towers above the smog. Security is everywhere.",
    dangerLevel: 4,
    minLevel: 8,
    color: "#a855f7",
    npcs: ["Corp Security", "Executive", "Netrunner"],
  },
  {
    id: "undernet",
    name: "The Undernet",
    description: "Underground tunnels and server farms. Original city buried below.",
    dangerLevel: 5,
    minLevel: 12,
    color: "#f59e0b",
    npcs: ["Ghost", "Archive AI", "Deep Fixer"],
  },
];

// GET /api/districts
router.get("/", requireAuth, async (_req, res) => {
  res.json(DISTRICTS);
});

// GET /api/districts/:id
router.get("/:id", requireAuth, async (req, res) => {
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
    if (user.level < district.minLevel)
      return res.status(400).json({ message: `Requires level ${district.minLevel} to travel here` });

    user.district = district.id;
    await user.save();

    res.json({ message: `Traveled to ${district.name}`, district: district.id });
  } catch (err: any) {
    req.log.error({ err }, "travel error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
