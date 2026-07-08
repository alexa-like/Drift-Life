/**
 * Seed — race cars for the Racing Royale and player garage.
 * 50 items: cars + car parts.
 * Run once at startup if RaceCar / CarPart collections are empty.
 */
import RaceCar from "../models/RaceCar";
import CarPart from "../models/CarPart";
import { logger } from "../lib/logger";

const RACE_CARS = [
  // ── COMMON (3 cars) ────────────────────────────────────────────────────────
  { carId: "rustbucket_common",  name: "Rustbucket",  tier: "common",    baseStats: { topSpeed: 40, acceleration: 30, handling: 30, nitro: 20 }, flavorText: "Held together by optimism and rust." },
  { carId: "scooter_common",     name: "Scooter",     tier: "common",    baseStats: { topSpeed: 35, acceleration: 45, handling: 50, nitro: 15 }, flavorText: "Nimble. Embarrassing, but nimble." },
  { carId: "city_bike_common",   name: "City Bike",   tier: "common",    baseStats: { topSpeed: 38, acceleration: 40, handling: 55, nitro: 18 }, flavorText: "Fast in traffic. Terrible everywhere else." },

  // ── UNCOMMON (3 cars) ──────────────────────────────────────────────────────
  { carId: "hatchback_uncommon", name: "Hatchback",   tier: "uncommon",  baseStats: { topSpeed: 55, acceleration: 45, handling: 55, nitro: 30 }, flavorText: "The everyman's weapon." },
  { carId: "muscle_car_uncommon",name: "Muscle Car",  tier: "uncommon",  baseStats: { topSpeed: 65, acceleration: 60, handling: 40, nitro: 40 }, flavorText: "Overpowered on a straight line. Problem?" },
  { carId: "sport_bike_uncommon",name: "Sport Bike",  tier: "uncommon",  baseStats: { topSpeed: 68, acceleration: 70, handling: 65, nitro: 35 }, flavorText: "Leans into corners like it means it." },

  // ── RARE (3 cars) ──────────────────────────────────────────────────────────
  { carId: "sports_car_rare",    name: "Sports Car",  tier: "rare",      baseStats: { topSpeed: 75, acceleration: 70, handling: 65, nitro: 50 }, flavorText: "It was made for this." },
  { carId: "drift_coupe_rare",   name: "Drift Coupe", tier: "rare",      baseStats: { topSpeed: 70, acceleration: 65, handling: 80, nitro: 55 }, flavorText: "The road is a suggestion." },
  { carId: "race_moto_rare",     name: "Racing Motorcycle", tier: "rare", baseStats: { topSpeed: 78, acceleration: 80, handling: 70, nitro: 48 }, flavorText: "One with the road. One with the risk." },

  // ── EPIC (3 cars) ──────────────────────────────────────────────────────────
  { carId: "supercar_epic",      name: "Supercar",    tier: "epic",      baseStats: { topSpeed: 88, acceleration: 82, handling: 75, nitro: 65 }, flavorText: "Designed in a wind tunnel. Tested on the street." },
  { carId: "hyperbike_epic",     name: "Hyperbike",   tier: "epic",      baseStats: { topSpeed: 92, acceleration: 88, handling: 70, nitro: 60 }, flavorText: "Borderline illegal in seven cities." },
  { carId: "elec_racer_epic",    name: "Electric Racer", tier: "epic",   baseStats: { topSpeed: 85, acceleration: 92, handling: 78, nitro: 70 }, flavorText: "Silent but devastating." },

  // ── LEGENDARY (3 cars) ─────────────────────────────────────────────────────
  { carId: "cyberjet_legendary", name: "Cyberjet",    tier: "legendary", baseStats: { topSpeed: 100, acceleration: 95, handling: 90, nitro: 85 }, flavorText: "Built from parts that shouldn't exist yet." },
  { carId: "neon_beast_legendary",name: "Neon Beast", tier: "legendary", baseStats: { topSpeed: 98,  acceleration: 92, handling: 95, nitro: 80 }, flavorText: "Corners like a thought. Hits like a freight train." },
  { carId: "hovercar_legendary", name: "Hovercar",    tier: "legendary", baseStats: { topSpeed: 95,  acceleration: 90, handling: 100, nitro: 90 }, flavorText: "The road is optional." },
];

const CAR_PARTS = [
  // ── COMMON ─────────────────────────────────────────────────────────────────
  { partId: "std_engine_common",   name: "Standard Engine",  partType: "engine",  tier: "common",    statBoost: { topSpeed: 2, acceleration: 1 },         flavorText: "Gets the job done." },
  { partId: "basic_tires_common",  name: "Basic Tires",      partType: "tires",   tier: "common",    statBoost: { handling: 2 },                           flavorText: "Round. That's a start." },
  { partId: "basic_spoiler_common",name: "Basic Spoiler",    partType: "spoiler", tier: "common",    statBoost: { handling: 1, topSpeed: 1 },              flavorText: "Mostly decorative. A little functional." },
  { partId: "std_brakes_common",   name: "Standard Brakes",  partType: "bodyKit", tier: "common",    statBoost: { handling: 2 },                           flavorText: "Stops when asked. Eventually." },
  { partId: "oil_can_common",      name: "Oil Can",           partType: "engine",  tier: "common",    statBoost: { acceleration: 2 },                       flavorText: "+2 acceleration. Happy engine." },

  // ── UNCOMMON ───────────────────────────────────────────────────────────────
  { partId: "v6_engine_uncommon",  name: "V6 Engine",         partType: "engine",  tier: "uncommon",  statBoost: { topSpeed: 5, acceleration: 4 },          flavorText: "Six cylinders. Six reasons to go faster." },
  { partId: "race_tires_uncommon", name: "Racing Tires",      partType: "tires",   tier: "uncommon",  statBoost: { handling: 5, acceleration: 2 },          flavorText: "Wider contact patch. More grip." },
  { partId: "sm_spoiler_uncommon", name: "Small Spoiler",     partType: "spoiler", tier: "uncommon",  statBoost: { handling: 3, topSpeed: 2 },              flavorText: "Downforce. Real downforce." },
  { partId: "disc_brakes_uncommon",name: "Disc Brakes",       partType: "bodyKit", tier: "uncommon",  statBoost: { handling: 4 },                           flavorText: "Four-piston. Better stopping power." },
  { partId: "repair_kit_uncommon", name: "Repair Kit",        partType: "bodyKit", tier: "uncommon",  statBoost: { topSpeed: 1, acceleration: 1, handling: 1 }, flavorText: "Everything tightened, oiled, calibrated." },

  // ── RARE ───────────────────────────────────────────────────────────────────
  { partId: "v8_engine_rare",      name: "V8 Engine",         partType: "engine",  tier: "rare",      statBoost: { topSpeed: 10, acceleration: 8 },         flavorText: "Eight cylinders. No compromises." },
  { partId: "slick_tires_rare",    name: "Slick Tires",       partType: "tires",   tier: "rare",      statBoost: { handling: 10, acceleration: 3 },         flavorText: "No tread. Maximum contact. Perfect." },
  { partId: "race_spoiler_rare",   name: "Racing Spoiler",    partType: "spoiler", tier: "rare",      statBoost: { handling: 8, topSpeed: 4 },              flavorText: "Keeps you planted through corners." },
  { partId: "nitro_tank_rare",     name: "Nitro Tank",        partType: "nitro",   tier: "rare",      statBoost: { nitro: 15 },                             flavorText: "+15 nitro power. Hold it until the right moment." },
  { partId: "adv_repair_rare",     name: "Advanced Repair Kit",partType: "bodyKit",tier: "rare",      statBoost: { topSpeed: 3, acceleration: 3, handling: 3 }, flavorText: "Precision tuning. Every bolt." },

  // ── EPIC ───────────────────────────────────────────────────────────────────
  { partId: "elec_engine_epic",    name: "Electric Engine",   partType: "engine",  tier: "epic",      statBoost: { topSpeed: 12, acceleration: 18 },        flavorText: "Instant torque. Zero mercy." },
  { partId: "perf_tires_epic",     name: "Performance Tires", partType: "tires",   tier: "epic",      statBoost: { handling: 15, acceleration: 5 },         flavorText: "Compound designed for one thing: grip." },
  { partId: "carbon_spoiler_epic", name: "Carbon Spoiler",    partType: "spoiler", tier: "epic",      statBoost: { handling: 12, topSpeed: 6 },             flavorText: "Lightweight, stiff, and fast." },
  { partId: "double_nitro_epic",   name: "Double Nitro",      partType: "nitro",   tier: "epic",      statBoost: { nitro: 25 },                             flavorText: "Two tanks. Twice the surge." },
  { partId: "supercharger_epic",   name: "Supercharger",      partType: "engine",  tier: "epic",      statBoost: { topSpeed: 10, acceleration: 12 },        flavorText: "Forces more air in. More boom." },

  // ── LEGENDARY ──────────────────────────────────────────────────────────────
  { partId: "fusion_engine_leg",   name: "Fusion Engine",     partType: "engine",  tier: "legendary", statBoost: { topSpeed: 20, acceleration: 18 },        flavorText: "Does not run on anything you can buy at a gas station." },
  { partId: "holo_tires_leg",      name: "Holographic Tires", partType: "tires",   tier: "legendary", statBoost: { handling: 20, acceleration: 8 },         flavorText: "Phase-shifts through road imperfections." },
  { partId: "quantum_brakes_leg",  name: "Quantum Brakes",    partType: "bodyKit", tier: "legendary", statBoost: { handling: 18, topSpeed: 5 },             flavorText: "Stops on a photon." },
  { partId: "inf_nitro_leg",       name: "Infinite Nitro",    partType: "nitro",   tier: "legendary", statBoost: { nitro: 40 },                             flavorText: "The tank does not empty. Classified." },
  { partId: "time_warp_leg",       name: "Time Warp Module",  partType: "nitro",   tier: "legendary", statBoost: { nitro: 35, topSpeed: 10 },               flavorText: "Speed so intense it bends local physics." },
];

export async function seedRaceCars(): Promise<void> {
  const [carCount, partCount] = await Promise.all([
    RaceCar.countDocuments(),
    CarPart.countDocuments(),
  ]);

  if (carCount === 0) {
    logger.info("Seeding race cars…");
    await RaceCar.insertMany(
      RACE_CARS.map(c => ({ ...c, imageCard: `/assets/cars/${c.carId}.webp` })),
    );
    logger.info(`Seeded ${RACE_CARS.length} race cars`);
  }

  if (partCount === 0) {
    logger.info("Seeding car parts…");
    await CarPart.insertMany(
      CAR_PARTS.map(p => ({ ...p, imageCard: `/assets/parts/${p.partId}.webp` })),
    );
    logger.info(`Seeded ${CAR_PARTS.length} car parts`);
  }
}
