import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { isHospitalized, hospitalTimeRemaining } from "../lib/regen";

const router = Router();

const HEAL_COST_PER_HP = 5; // DC per HP restored

// GET /api/hospital/status
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select("health maxHealth hospitalizedUntil dc").lean();
  if (!user) return res.status(404).json({ message: "Not found" });
  const hospitalized = user.hospitalizedUntil && user.hospitalizedUntil > new Date();
  res.json({
    hospitalized: !!hospitalized,
    health: user.health,
    maxHealth: user.maxHealth,
    releaseAt: user.hospitalizedUntil,
    timeRemaining: hospitalized ? Math.ceil((user.hospitalizedUntil!.getTime() - Date.now()) / 1000) : 0,
  });
});

// POST /api/hospital/heal
router.post("/heal", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });

    const missingHp = user.maxHealth - user.health;
    if (missingHp <= 0 && !isHospitalized(user))
      return res.status(400).json({ message: "Already at full health" });

    const cost = missingHp * HEAL_COST_PER_HP + (isHospitalized(user) ? 200 : 0);
    if (user.dc < cost)
      return res.status(400).json({ message: `Not enough DC. Costs ${cost} DC to fully heal.` });

    user.dc -= cost;
    user.health = user.maxHealth;
    user.hospitalizedUntil = null;
    await user.save();

    res.json({
      message: `Healed to full health for ${cost} DC`,
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

export default router;
