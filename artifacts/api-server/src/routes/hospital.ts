import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { isHospitalized } from "../models/User";

const router = Router();

const HEAL_COST_PER_HP = 5;

// GET /api/hospital/status
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "Not found" });
    const hospitalized = user.hospitalizedUntil && user.hospitalizedUntil > new Date();
    res.json({
      hospitalized: !!hospitalized,
      health: user.health,
      maxHealth: user.maxHealth,
      releaseAt: user.hospitalizedUntil,
      timeRemaining: hospitalized ? Math.ceil((user.hospitalizedUntil!.getTime() - Date.now()) / 1000) : 0,
    });
  } catch (err: any) {
    req.log.error({ err }, "hospital status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/hospital/heal
router.post("/heal", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });

    const hosp = isHospitalized(user);
    const missingHp = user.maxHealth - user.health;

    if (missingHp <= 0 && !hosp) {
      return res.status(400).json({ message: "Already at full health" });
    }

    const hpCost = missingHp * HEAL_COST_PER_HP;
    const hospCost = hosp ? 200 : 0;
    const totalCost = hpCost + hospCost;

    if (user.dc < totalCost) {
      return res.status(400).json({ message: `Costs ${totalCost} DC to fully heal. You have ${user.dc} DC.` });
    }

    user.dc -= totalCost;
    user.health = user.maxHealth;
    if (hosp) user.hospitalizedUntil = null;
    await user.save();

    res.json({
      message: `Healed to full health for ${totalCost} DC`,
      health: user.health,
      maxHealth: user.maxHealth,
      dc: user.dc,
      hospitalized: false,
    });
  } catch (err: any) {
    req.log.error({ err }, "heal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/hospital/release-early
router.post("/release-early", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    if (!isHospitalized(user)) return res.status(400).json({ message: "You are not hospitalized" });

    const timeLeftMs = user.hospitalizedUntil!.getTime() - Date.now();
    const cost = Math.max(50, Math.ceil(timeLeftMs / 1000 / 60) * 10);

    if (user.dc < cost) return res.status(400).json({ message: `Early release costs ${cost} DC` });

    user.dc -= cost;
    user.hospitalizedUntil = null;
    await user.save();

    res.json({ message: `Released early for ${cost} DC`, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "early release error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
