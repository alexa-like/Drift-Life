/**
 * Garage — Wire Cartel Section 3
 * Car ownership, tuning, chop shop, impound.
 */
import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Car, { generateVin, tuningStat, PartQuality } from "../models/Car";

import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed } from "../models/User";
import { energySufficientExpr, buildRegenPipeline } from "../lib/atomicRegen";
import { validateBody } from "../middlewares/validate";
import { garageBuySchema, garageTuneSchema, garageSetActiveSchema } from "../lib/schemas";

const router = Router();

// ── Starter car catalog ─────────────────────────────────────────────────────
export const STARTER_CARS = [
  { make: "Ryker",    model: "Ghost 200",   year: 2039, power: 12, handling: 10, grip: 10, nitro: 5,  price: 8_000,  description: "A stripped-down budget runner. Gets the job done." },
  { make: "Nomad",    model: "Street HX",   year: 2041, power: 15, handling: 14, grip: 11, nitro: 8,  price: 15_000, description: "Reliable mid-weight with good handling baseline." },
  { make: "Corvan",   model: "V-Blade",     year: 2043, power: 20, handling: 12, grip: 9,  nitro: 12, price: 25_000, description: "High power, stiff chassis. Drift specialist." },
  { make: "Synapse",  model: "Nexus-R",     year: 2044, power: 18, handling: 18, grip: 15, nitro: 10, price: 40_000, description: "Balanced high-spec racer. Popular in circuit events." },
  { make: "Ashford",  model: "Phantom GT",  year: 2045, power: 25, handling: 20, grip: 18, nitro: 15, price: 75_000, description: "Corporate-grade performance. Turns heads everywhere." },
];

// ── Parts catalog ───────────────────────────────────────────────────────────
export const PARTS_CATALOG = [
  { id: "turbo_common",      type: "turbo_kit",        quality: "common" as PartQuality,    stat: "power",    baseCost: 2_000,  description: "Stock turbo upgrade. +Power." },
  { id: "turbo_rare",        type: "turbo_kit",        quality: "rare" as PartQuality,      stat: "power",    baseCost: 8_000,  description: "Performance turbo. Bigger gains." },
  { id: "turbo_legendary",   type: "turbo_kit",        quality: "legendary" as PartQuality, stat: "power",    baseCost: 30_000, description: "Track-spec twin-turbo. Maximum power." },
  { id: "suspension_common", type: "sport_suspension", quality: "common" as PartQuality,    stat: "handling", baseCost: 1_500,  description: "Lowering springs. Better corner feel." },
  { id: "suspension_rare",   type: "sport_suspension", quality: "rare" as PartQuality,      stat: "handling", baseCost: 6_000,  description: "Coilover kit with adjustable damping." },
  { id: "slicks_common",     type: "racing_slicks",    quality: "common" as PartQuality,    stat: "grip",     baseCost: 1_200,  description: "Street-legal semi-slicks. More grip." },
  { id: "slicks_rare",       type: "racing_slicks",    quality: "rare" as PartQuality,      stat: "grip",     baseCost: 5_000,  description: "Track-compound slicks. Serious grip." },
  { id: "nos_common",        type: "nos_canister",     quality: "common" as PartQuality,    stat: "nitro",    baseCost: 800,    description: "Small NOS canister. Quick burst." },
  { id: "nos_rare",          type: "nos_canister",     quality: "rare" as PartQuality,      stat: "nitro",    baseCost: 3_500,  description: "High-capacity NOS system. Sustained boost." },
];

// ── GET /api/garage — list player's cars ────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("cars activeCar").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const cars = await Car.find({ _id: { $in: user.cars } }).lean();
    const activeCarId = user.activeCar?.toString();
    res.json(cars.map(c => ({ ...c, id: c._id, isActive: c._id.toString() === activeCarId })));
  } catch (err: any) {
    req.log.error({ err }, "get garage error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/garage/buy — buy a car from catalog ──────────────────────────
router.post("/buy", requireAuth, validateBody(garageBuySchema), async (req: AuthRequest, res) => {
  try {
    const { carIndex, name } = req.body as { carIndex: number; name?: string };
    const blueprint = STARTER_CARS[carIndex];
    if (!blueprint) return res.status(400).json({ message: "Invalid car" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);
    if (user.dc < blueprint.price) return res.status(400).json({ message: `Costs ${blueprint.price.toLocaleString()} DC` });
    if (user.cars.length >= 5) return res.status(400).json({ message: "Garage full (max 5 cars)" });

    user.dc -= blueprint.price;

    const car = new Car({
      ownerId: user._id,
      name: name?.trim() || `${blueprint.make} ${blueprint.model}`,
      make: blueprint.make, model: blueprint.model, year: blueprint.year,
      power: blueprint.power, handling: blueprint.handling,
      grip: blueprint.grip, nitro: blueprint.nitro,
      vin: generateVin(),
    });
    await car.save();

    user.cars.push(car._id);
    if (!user.activeCar) user.activeCar = car._id;

    // Onboarding: getting first car advances stage
    if (user.onboardingStage === 1) user.onboardingStage = 2;

    await user.save();
    res.status(201).json({ message: `Purchased ${car.name}!`, car });
  } catch (err: any) {
    req.log.error({ err }, "buy car error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/garage/catalog — browse cars ──────────────────────────────────
router.get("/catalog", requireAuth, (_req, res) => {
  res.json(STARTER_CARS.map((c, i) => ({ ...c, index: i })));
});

// ── GET /api/garage/parts — parts catalog ──────────────────────────────────
router.get("/parts", requireAuth, (_req, res) => res.json(PARTS_CATALOG));

// ── POST /api/garage/:carId/tune — tune a stat ──────────────────────────────
router.post("/:carId/tune", requireAuth, validateBody(garageTuneSchema), async (req: AuthRequest, res) => {
  try {
    const { stat, partId, energyToSpend = 3 } = req.body as { stat: "power"|"handling"|"grip"|"nitro"|"durability"; partId?: string; energyToSpend?: number };

    const car = await Car.findOne({ _id: req.params.carId, ownerId: req.userId });
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (car.impoundedUntil && car.impoundedUntil > new Date()) return res.status(400).json({ message: "Car is impounded" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);
    if (isHospitalized(user)) return res.status(400).json({ message: "You are hospitalized" });

    // Part quality
    let quality: PartQuality = "common";
    let partCost = 0;
    if (partId) {
      const part = PARTS_CATALOG.find(p => p.id === partId);
      if (!part) return res.status(400).json({ message: "Part not found" });
      quality = part.quality;
      partCost = part.baseCost;
      if (user.dc < partCost) return res.status(400).json({ message: `Part costs ${partCost.toLocaleString()} DC` });
    }

    // Energy cost
    const energyCost = Math.min(10, Math.max(1, energyToSpend));
    const gated = await User.findOneAndUpdate(
      { _id: req.userId, ...energySufficientExpr(energyCost) },
      buildRegenPipeline({ energyCost }),
      { new: true },
    );
    if (!gated) return res.status(400).json({ message: `Not enough energy (need ${energyCost})` });

    const currentStat = (car as any)[stat] as number;
    const gain = tuningStat(energyCost, currentStat, quality);

    // Apply gain
    (car as any)[stat] = parseFloat((currentStat + gain).toFixed(2));

    if (partCost > 0) {
      gated.dc -= partCost;
      await gated.save();
      if (partId) {
        const part = PARTS_CATALOG.find(p => p.id === partId)!;
        car.parts.push({
          partId, type: part.type as any, quality,
          statAffected: stat as any, bonus: gain, installedAt: new Date(),
        });
      }
    }

    car.buildHistory.push({ stat: stat as any, gain, energyCost, cashCost: partCost, at: new Date() });
    await car.save();

    res.json({ stat, gain: parseFloat(gain.toFixed(3)), newValue: (car as any)[stat], car, dc: gated.dc, energy: gated.energy });
  } catch (err: any) {
    req.log.error({ err }, "tune error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/garage/:carId/chop — chop shop: destroy car for parts ─────────
router.post("/:carId/chop", requireAuth, async (req: AuthRequest, res) => {
  try {
    const car = await Car.findOne({ _id: req.params.carId, ownerId: req.userId });
    if (!car) return res.status(404).json({ message: "Car not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Remove car from user inventory
    user.cars = user.cars.filter(id => !id.equals(car._id));
    if (user.activeCar?.equals(car._id)) user.activeCar = user.cars[0] ?? null;

    // Generate 3-6 random parts as DC value
    const totalStatValue = car.power + car.handling + car.grip + car.nitro;
    const numParts = Math.floor(3 + Math.random() * 4);
    const chopValue = Math.floor(totalStatValue * 200 * (0.5 + Math.random() * 0.5));
    user.dirtyDc += chopValue;

    const PART_NAMES = ["Engine Block", "Suspension Kit", "Brake Assembly", "Turbo Core", "Axle Shaft", "ECU Module"];
    const parts = Array.from({ length: numParts }, () => PART_NAMES[Math.floor(Math.random() * PART_NAMES.length)]);

    await car.deleteOne();
    await user.save();

    // chops are private — no feed post

    res.json({ message: "Car chopped for parts.", parts, chopValue, dirtyDc: user.dirtyDc });
  } catch (err: any) {
    req.log.error({ err }, "chop error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/garage/:carId/impound-release — pay to release impounded car ──
router.post("/:carId/impound-release", requireAuth, async (req: AuthRequest, res) => {
  try {
    const car = await Car.findOne({ _id: req.params.carId, ownerId: req.userId });
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (!car.impoundedUntil || car.impoundedUntil <= new Date()) {
      return res.status(400).json({ message: "Car is not impounded" });
    }

    const remainingMs = car.impoundedUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    const cost = Math.floor(remainingMin * 500);

    const user = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: cost } },
      { $inc: { dc: -cost } },
      { new: true },
    );
    if (!user) return res.status(400).json({ message: `Release costs ${cost.toLocaleString()} DC`, cost });

    car.impoundedUntil = null;
    await car.save();
    res.json({ message: `Car released for ${cost.toLocaleString()} DC.`, cost, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "impound release error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/garage/set-active — switch active car ─────────────────────────
router.post("/set-active", requireAuth, validateBody(garageSetActiveSchema), async (req: AuthRequest, res) => {
  try {
    const { carId } = req.body as { carId: string };
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.cars.some(id => id.toString() === carId)) return res.status(403).json({ message: "Not your car" });
    user.activeCar = new mongoose.Types.ObjectId(carId);
    await user.save();
    res.json({ message: "Active car updated", activeCar: carId });
  } catch (err: any) {
    req.log.error({ err }, "set active car error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
