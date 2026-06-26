import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

function devOnly(req: AuthRequest, res: any, next: any) {
  if (process.env["NODE_ENV"] !== "development") {
    return res.status(403).json({ message: "Dev-only endpoint" });
  }
  next();
}

router.use(requireAuth as any);
router.use(devOnly as any);

// POST /api/dev/add-dc
router.post("/add-dc", async (req: AuthRequest, res) => {
  const amount = Number(req.body.amount) || 10000;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "Not found" });
  user.dc += amount;
  await user.save();
  res.json({ message: `Added ${amount} DC`, dc: user.dc });
});

// POST /api/dev/set-level
router.post("/set-level", async (req: AuthRequest, res) => {
  const level = Number(req.body.level) || 1;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "Not found" });
  user.level = level;
  user.xp = 0;
  await user.save();
  res.json({ message: `Level set to ${level}`, level });
});

// POST /api/dev/fill-resources
router.post("/fill-resources", async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "Not found" });
  user.energy = user.maxEnergy;
  user.nerve = user.maxNerve;
  user.health = user.maxHealth;
  await user.save();
  res.json({ message: "Resources filled", energy: user.energy, nerve: user.nerve, health: user.health });
});

// POST /api/dev/heal
router.post("/heal", async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "Not found" });
  user.health = user.maxHealth;
  user.hospitalizedUntil = null;
  await user.save();
  res.json({ message: "Healed and released from hospital" });
});

// POST /api/dev/clear-wanted
router.post("/clear-wanted", async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "Not found" });
  user.wantedLevel = 0;
  user.jailUntil = null;
  await user.save();
  res.json({ message: "Wanted level cleared" });
});

export default router;
