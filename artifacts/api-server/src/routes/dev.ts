import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { levelUp, xpForLevel } from "../models/User";

const router = Router();

router.use(requireAuth as any);

// Only owner/admin can use dev tools
function devGuard(req: AuthRequest, res: any, next: any) {
  if (req.role !== "owner" && req.role !== "admin") {
    return res.status(403).json({ message: "Owner only" });
  }
  next();
}
router.use(devGuard as any);

// POST /api/dev/add-dc
router.post("/add-dc", async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount) || 10000;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    user.dc += amount;
    await user.save();
    res.json({ message: `Added ${amount} DC`, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "dev add-dc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/dev/set-level
router.post("/set-level", async (req: AuthRequest, res) => {
  try {
    const level = Math.min(100, Math.max(1, Number(req.body.level) || 1));
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    user.level = level;
    user.xp = 0;
    user.xpToNext = xpForLevel(level);
    // Recalculate skill points
    user.skillPoints = level >= 10 ? Math.floor((level - 10) / 5) + 1 : 0;
    await user.save();
    res.json({ message: `Level set to ${level}`, level, skillPoints: user.skillPoints });
  } catch (err: any) {
    req.log.error({ err }, "dev set-level error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/dev/fill-resources
router.post("/fill-resources", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    user.energy = user.maxEnergy;
    user.nerve = user.maxNerve;
    user.health = user.maxHealth;
    user.energyRegenAt = new Date();
    user.nerveRegenAt = new Date();
    await user.save();
    res.json({ message: "Resources filled", energy: user.energy, nerve: user.nerve, health: user.health });
  } catch (err: any) {
    req.log.error({ err }, "dev fill error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/dev/heal
router.post("/heal", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    user.health = user.maxHealth;
    user.hospitalizedUntil = null;
    user.jailUntil = null;
    await user.save();
    res.json({ message: "Healed and released" });
  } catch (err: any) {
    req.log.error({ err }, "dev heal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/dev/clear-wanted
router.post("/clear-wanted", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    user.wantedLevel = 0;
    user.jailUntil = null;
    await user.save();
    res.json({ message: "Wanted level cleared" });
  } catch (err: any) {
    req.log.error({ err }, "dev clear-wanted error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/dev/give-nc
router.post("/give-nc", async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount) || 100;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    user.nc += amount;
    await user.save();
    res.json({ message: `Added ${amount} NC`, nc: user.nc });
  } catch (err: any) {
    req.log.error({ err }, "dev give-nc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/dev/give-frame
router.post("/give-frame", async (req: AuthRequest, res) => {
  try {
    const { frameId } = req.body;
    if (!frameId) return res.status(400).json({ message: "frameId required" });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    if (!user.ownedFrames.includes(frameId)) {
      user.ownedFrames.push(frameId);
      user.markModified("ownedFrames");
    }
    await user.save();
    res.json({ message: `Frame ${frameId} added`, ownedFrames: user.ownedFrames });
  } catch (err: any) {
    req.log.error({ err }, "dev give-frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/dev/add-merit
router.post("/add-merit", async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body.amount) || 500;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    user.merit += amount;
    await user.save();
    res.json({ message: `Added ${amount} M`, merit: user.merit });
  } catch (err: any) {
    req.log.error({ err }, "dev add-merit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
