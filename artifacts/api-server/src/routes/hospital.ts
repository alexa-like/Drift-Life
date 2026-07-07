import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Item from "../models/Item";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { isHospitalized } from "../models/User";

const router = Router();

// GET /api/hospital/status — returns tier (light/serious/critical) based on time remaining
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "Not found" });
    const hosp = user.hospitalizedUntil && user.hospitalizedUntil > new Date();

    // Subscriber hospital speed reduction
    const { getActiveTier } = await import("../lib/subscription");
    const subTier = getActiveTier(user as any);
    const speedReduction = subTier?.hospitalSpeedPct ?? 0;

    const rawTimeRemaining = hosp ? Math.ceil((user.hospitalizedUntil!.getTime() - Date.now()) / 1000) : 0;
    const timeRemaining = speedReduction > 0
      ? Math.ceil(rawTimeRemaining * (1 - speedReduction / 100))
      : rawTimeRemaining;
    const minsRemaining = Math.ceil(timeRemaining / 60);

    // Triage tier determines cost per minute and label
    let tier: "light" | "serious" | "critical";
    let costPerMin: number;
    if (minsRemaining <= 5) {
      tier = "light";      costPerMin = 25;
    } else if (minsRemaining <= 30) {
      tier = "serious";    costPerMin = 50;
    } else {
      tier = "critical";   costPerMin = 75;
    }
    const dischargeCost = hosp ? Math.max(25, minsRemaining * costPerMin) : 0;

    res.json({
      hospitalized: !!hosp,
      health: user.health,
      maxHealth: user.maxHealth,
      releaseAt: user.hospitalizedUntil,
      timeRemaining,
      dischargeCost,
      tier,
      minsRemaining,
    });
  } catch (err: any) {
    req.log.error({ err }, "hospital status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/hospital/use-item — use a consumable item from inventory to restore HP / reduce hospital time
router.post("/use-item", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ message: "itemId required" });

    // Validate ObjectId before querying — non-ObjectId strings throw a Mongoose CastError
    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const item = await Item.findOne({
      _id: new mongoose.Types.ObjectId(itemId),
      owner: new mongoose.Types.ObjectId(String(req.userId)),
    });
    if (!item) return res.status(404).json({ message: "Item not found in your inventory" });
    if (item.type !== "consumable") return res.status(400).json({ message: "Not a consumable item" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const effect = item.effect || "";
    let effectMessage = "";

    if (effect.includes("hospital:-")) {
      const mins = parseInt(effect.match(/hospital:-(\d+)/)?.[1] || "0");
      if (user.hospitalizedUntil && user.hospitalizedUntil > new Date()) {
        user.hospitalizedUntil = new Date(user.hospitalizedUntil.getTime() - mins * 60 * 1000);
        if (user.hospitalizedUntil <= new Date()) {
          user.hospitalizedUntil = null;
          user.health = user.maxHealth;
          effectMessage = `Hospital time cleared. Health fully restored.`;
        } else {
          effectMessage = `-${mins} minutes hospital time.`;
        }
      } else {
        effectMessage = "You are not hospitalized.";
      }
    } else if (effect.includes("hospital_pct:-")) {
      const pct = parseInt(effect.match(/hospital_pct:-(\d+)/)?.[1] || "0");
      if (user.hospitalizedUntil && user.hospitalizedUntil > new Date()) {
        const remaining = user.hospitalizedUntil.getTime() - Date.now();
        const reduction = Math.floor(remaining * (pct / 100));
        user.hospitalizedUntil = new Date(user.hospitalizedUntil.getTime() - reduction);
        if (user.hospitalizedUntil <= new Date()) {
          user.hospitalizedUntil = null;
          user.health = user.maxHealth;
        }
        effectMessage = `-${pct}% hospital time.`;
      } else {
        effectMessage = "You are not hospitalized.";
      }
    } else if (effect === "clear_hospital") {
      user.hospitalizedUntil = null;
      user.health = user.maxHealth;
      effectMessage = "Hospitalization cleared. Full health restored.";
    } else if (effect.includes("health:")) {
      const amt = parseInt(effect.match(/health:(\d+)/)?.[1] || "0");
      user.health = Math.min(user.maxHealth, user.health + amt);
      effectMessage = `+${amt} HP restored.`;
    } else {
      effectMessage = "Item used.";
    }

    if (effect.includes("energy:")) {
      const amt = parseInt(effect.match(/energy:(\d+)/)?.[1] || "0");
      user.energy = Math.min(user.maxEnergy, user.energy + amt);
    }
    if (effect.includes("nerve:")) {
      const amt = parseInt(effect.match(/nerve:(\d+)/)?.[1] || "0");
      user.nerve = Math.min(user.maxNerve, user.nerve + amt);
    }

    item.quantity -= 1;
    if (item.quantity <= 0) {
      await Item.deleteOne({ _id: item._id });
    } else {
      await item.save();
    }
    await user.save();

    const stillHosp = user.hospitalizedUntil && user.hospitalizedUntil > new Date();
    res.json({
      message: effectMessage,
      hospitalized: !!stillHosp,
      hospitalizedUntil: user.hospitalizedUntil,
      health: user.health,
      maxHealth: user.maxHealth,
    });
  } catch (err: any) {
    req.log.error({ err }, "hospital use-item error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/hospital/discharge — tiered discharge cost (light 25/min, serious 50/min, critical 75/min)
router.post("/discharge", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    if (!isHospitalized(user)) return res.status(400).json({ message: "You are not hospitalized" });

    const timeLeftMs = user.hospitalizedUntil!.getTime() - Date.now();
    const minsLeft = Math.ceil(timeLeftMs / 60000);
    const costPerMin = minsLeft <= 5 ? 25 : minsLeft <= 30 ? 50 : 75;
    const cost = Math.max(25, minsLeft * costPerMin);

    if (user.dc < cost) return res.status(400).json({ message: `Early discharge costs ${cost} DC (${minsLeft} min remaining)` });

    user.dc -= cost;
    user.hospitalizedUntil = null;
    user.health = user.maxHealth;
    await user.save();

    res.json({ message: `Discharged early for ${cost} DC. Health fully restored.`, dc: user.dc, health: user.health });
  } catch (err: any) {
    req.log.error({ err }, "discharge error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/hospital/heal — pay DC to fully heal + discharge
router.post("/heal", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });

    const hosp = isHospitalized(user);
    const missingHp = user.maxHealth - user.health;

    if (missingHp <= 0 && !hosp) {
      return res.status(400).json({ message: "Already at full health" });
    }

    const hpCost = missingHp * 5;
    let hospCost = 0;
    if (hosp) {
      const timeLeftMs = user.hospitalizedUntil!.getTime() - Date.now();
      hospCost = Math.max(50, Math.ceil(timeLeftMs / 60000) * 50);
    }
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

// POST /api/hospital/release-early — alias for discharge
router.post("/release-early", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    if (!isHospitalized(user)) return res.status(400).json({ message: "You are not hospitalized" });

    const timeLeftMs = user.hospitalizedUntil!.getTime() - Date.now();
    const minsLeft = Math.ceil(timeLeftMs / 60000);
    const cost = Math.max(50, minsLeft * 50);

    if (user.dc < cost) return res.status(400).json({ message: `Early release costs ${cost} DC` });

    user.dc -= cost;
    user.hospitalizedUntil = null;
    user.health = user.maxHealth;
    await user.save();

    res.json({ message: `Released early for ${cost} DC. Health restored.`, dc: user.dc, health: user.health });
  } catch (err: any) {
    req.log.error({ err }, "early release error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
