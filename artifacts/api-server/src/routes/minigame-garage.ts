/**
 * Mini-Game Garage — manage owned race cars, tuning, sell, scrap.
 * GET  /api/minigame-garage/         — get garage + catalog lookup
 * POST /api/minigame-garage/select   — set active car
 * POST /api/minigame-garage/tune     — equip parts / customization
 * POST /api/minigame-garage/sell     — sell car for DC
 * POST /api/minigame-garage/scrap    — scrap car for parts
 */
import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import PlayerGarage from "../models/PlayerGarage";
import RaceCar from "../models/RaceCar";
import CarPart from "../models/CarPart";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// Compute a car's total stats: base RaceCar stats + all equipped CarPart boosts, clamped 0-100
function computeTotalStats(
  base: { topSpeed: number; acceleration: number; handling: number; nitro: number },
  parts: Array<{ statBoost: { topSpeed?: number; acceleration?: number; handling?: number; nitro?: number } } | null>,
) {
  const total = { ...base };
  for (const part of parts) {
    if (!part) continue;
    total.topSpeed     = Math.min(100, total.topSpeed     + (part.statBoost.topSpeed     ?? 0));
    total.acceleration = Math.min(100, total.acceleration + (part.statBoost.acceleration ?? 0));
    total.handling     = Math.min(100, total.handling     + (part.statBoost.handling     ?? 0));
    total.nitro        = Math.min(100, total.nitro        + (part.statBoost.nitro        ?? 0));
  }
  return total;
}

// Sell values by tier
const SELL_VALUE: Record<string, number> = {
  common:    500,
  uncommon:  1_500,
  rare:      5_000,
  epic:      15_000,
  legendary: 50_000,
};

// Car tier lookup — must match seeded RaceCar carId slugs (see seeds/raceCars.ts)
const CAR_TIERS: Record<string, string> = {
  rustbucket_common:  "common",
  scooter_common:     "common",
  city_bike_common:   "common",
  hatchback_uncommon: "uncommon",
  muscle_car_uncommon:"uncommon",
  sport_bike_uncommon:"uncommon",
  sports_car_rare:    "rare",
  drift_coupe_rare:   "rare",
  race_moto_rare:     "rare",
  supercar_epic:      "epic",
  hyperbike_epic:     "epic",
  elec_racer_epic:    "epic",
  cyberjet_legendary: "legendary",
  neon_beast_legendary:"legendary",
  hovercar_legendary: "legendary",
};

// ── GET /api/minigame-garage/catalog — all active RaceCar + CarPart defs ──────
router.get("/catalog", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const [cars, parts] = await Promise.all([
      RaceCar.find({ isActive: true }).lean(),
      CarPart.find({ isActive: true }).lean(),
    ]);
    res.json({ cars, parts });
  } catch (err: any) {
    _req.log.error({ err }, "minigame-garage catalog error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/minigame-garage/ ─────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const garage = await PlayerGarage.findOne({ userId: req.userId }).lean() ?? {
      userId: new mongoose.Types.ObjectId(req.userId), cars: [], parts: [], activeCar: null,
    };

    const carIds  = garage.cars.map(c => c.carId);
    const partIds = garage.parts.map(p => p.partId);
    const [carDefs, partDefs] = await Promise.all([
      carIds.length  ? RaceCar.find({ carId: { $in: carIds } }).lean()   : [],
      partIds.length ? CarPart.find({ partId: { $in: partIds } }).lean() : [],
    ]);
    const carDefMap  = Object.fromEntries(carDefs.map(c => [c.carId, c]));
    const partDefMap = Object.fromEntries(partDefs.map(p => [p.partId, p]));

    const enrichedCars = garage.cars.map(c => {
      const def = carDefMap[c.carId] ?? null;
      const equippedPartDefs = Object.values(c.equippedParts).map(pid => (pid ? partDefMap[pid] ?? null : null));
      const totalStats = def ? computeTotalStats(def.baseStats, equippedPartDefs) : null;
      return { ...c, def, totalStats };
    });

    const enrichedParts = garage.parts.map(p => ({ ...p, def: partDefMap[p.partId] ?? null }));

    res.json({
      garage: { ...garage, cars: enrichedCars, parts: enrichedParts },
    });
  } catch (err) {
    req.log.error({ err }, "minigame-garage get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/minigame-garage/select ─────────────────────────────────────────
router.post("/select", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { carId } = req.body as { carId: string };
    const garage = await PlayerGarage.findOne({ userId: req.userId });
    if (!garage) {
      res.status(404).json({ message: "Garage not found" });
      return;
    }
    const owned = garage.cars.find(c => c.carId === carId);
    if (!owned) {
      res.status(400).json({ message: "You don't own this car" });
      return;
    }
    garage.activeCar = carId;
    await garage.save();
    res.json({ message: "Active car updated", activeCar: carId });
  } catch (err) {
    req.log.error({ err }, "minigame-garage select error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/minigame-garage/tune ───────────────────────────────────────────
router.post("/tune", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      carId,
      equippedParts,
      customization,
    } = req.body as {
      carId: string;
      equippedParts?: { engine?: string | null; tires?: string | null; nitro?: string | null; bodyKit?: string | null; spoiler?: string | null };
      customization?: { paint?: string; underglow?: string; decals?: string; rims?: string };
    };

    const garage = await PlayerGarage.findOne({ userId: req.userId });
    if (!garage) {
      res.status(404).json({ message: "Garage not found" });
      return;
    }
    const car = garage.cars.find(c => c.carId === carId);
    if (!car) {
      res.status(400).json({ message: "You don't own this car" });
      return;
    }

    // Validate equipped parts exist in garage.parts inventory
    if (equippedParts) {
      const slots = Object.values(equippedParts).filter(Boolean) as string[];
      for (const partId of slots) {
        const owned = garage.parts.find(p => p.partId === partId && p.quantity > 0);
        if (!owned) {
          res.status(400).json({ message: `You don't own part: ${partId}` });
          return;
        }
      }
      if (equippedParts.engine  !== undefined) car.equippedParts.engine  = equippedParts.engine  ?? null;
      if (equippedParts.tires   !== undefined) car.equippedParts.tires   = equippedParts.tires   ?? null;
      if (equippedParts.nitro   !== undefined) car.equippedParts.nitro   = equippedParts.nitro   ?? null;
      if (equippedParts.bodyKit !== undefined) car.equippedParts.bodyKit = equippedParts.bodyKit ?? null;
      if (equippedParts.spoiler !== undefined) car.equippedParts.spoiler = equippedParts.spoiler ?? null;
    }

    if (customization) {
      if (customization.paint)     car.customization.paint     = customization.paint;
      if (customization.underglow) car.customization.underglow = customization.underglow;
      if (customization.decals)    car.customization.decals    = customization.decals;
      if (customization.rims)      car.customization.rims      = customization.rims;
    }

    await garage.save();
    res.json({ message: "Car tuned", car });
  } catch (err) {
    req.log.error({ err }, "minigame-garage tune error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/minigame-garage/sell ───────────────────────────────────────────
router.post("/sell", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { carId } = req.body as { carId: string };
    const garage = await PlayerGarage.findOne({ userId: req.userId });
    if (!garage) {
      res.status(404).json({ message: "Garage not found" });
      return;
    }
    const idx = garage.cars.findIndex(c => c.carId === carId);
    if (idx === -1) {
      res.status(400).json({ message: "You don't own this car" });
      return;
    }

    const tier = CAR_TIERS[carId] ?? "common";
    const dcValue = SELL_VALUE[tier] ?? 500;

    garage.cars.splice(idx, 1);
    if (garage.activeCar === carId) {
      garage.activeCar = garage.cars[0]?.carId ?? null;
    }
    await garage.save();
    await User.updateOne({ _id: req.userId }, { $inc: { dc: dcValue } });

    res.json({ message: `Sold for ${dcValue.toLocaleString()} DC`, dcGained: dcValue });
  } catch (err) {
    req.log.error({ err }, "minigame-garage sell error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/minigame-garage/scrap ──────────────────────────────────────────
router.post("/scrap", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { carId } = req.body as { carId: string };
    const garage = await PlayerGarage.findOne({ userId: req.userId });
    if (!garage) {
      res.status(404).json({ message: "Garage not found" });
      return;
    }
    const idx = garage.cars.findIndex(c => c.carId === carId);
    if (idx === -1) {
      res.status(400).json({ message: "You don't own this car" });
      return;
    }

    // Return any parts currently equipped on this specific car instance
    const car = garage.cars[idx];
    const ep = car.equippedParts ?? {};
    const equippedIds = [ep.engine, ep.tires, ep.nitro, ep.bodyKit, ep.spoiler].filter(Boolean) as string[];

    // Fall back to tier-based table only when the car has no equipped parts
    const tier = CAR_TIERS[carId] ?? "common";
    const SCRAP_FALLBACK: Record<string, Array<{ partId: string; qty: number }>> = {
      common:    [{ partId: "std_engine_common",  qty: 1 }],
      uncommon:  [{ partId: "v6_engine_uncommon", qty: 1 }, { partId: "race_tires_uncommon", qty: 1 }],
      rare:      [{ partId: "v8_engine_rare",     qty: 1 }, { partId: "slick_tires_rare",    qty: 1 }, { partId: "nitro_tank_rare", qty: 1 }],
      epic:      [{ partId: "elec_engine_epic",   qty: 1 }, { partId: "perf_tires_epic",     qty: 1 }, { partId: "double_nitro_epic", qty: 1 }, { partId: "carbon_spoiler_epic", qty: 1 }],
      legendary: [{ partId: "fusion_engine_leg",  qty: 2 }, { partId: "holo_tires_leg",      qty: 1 }, { partId: "inf_nitro_leg", qty: 1 }, { partId: "quantum_brakes_leg", qty: 1 }],
    };
    const parts: Array<{ partId: string; qty: number }> = equippedIds.length > 0
      ? equippedIds.map(partId => ({ partId, qty: 1 }))
      : (SCRAP_FALLBACK[tier] ?? SCRAP_FALLBACK.common);

    for (const { partId, qty } of parts) {
      const existing = garage.parts.find(p => p.partId === partId);
      if (existing) {
        existing.quantity += qty;
      } else {
        garage.parts.push({ partId, quantity: qty, condition: 100 });
      }
    }

    garage.cars.splice(idx, 1);
    if (garage.activeCar === carId) {
      garage.activeCar = garage.cars[0]?.carId ?? null;
    }
    await garage.save();

    res.json({ message: "Car scrapped", partsGained: parts });
  } catch (err) {
    req.log.error({ err }, "minigame-garage scrap error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
