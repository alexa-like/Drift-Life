import { Router } from "express";
import CraftingJob from "../models/CraftingJob";
import User from "../models/User";
import Item from "../models/Item";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

export interface CraftingRecipe {
  id: string;
  name: string;
  outputName: string;
  outputType: string;
  outputQuantity: number;
  durationMinutes: number;
  craftingXpRequired: number;
  ingredients: Array<{ name: string; quantity: number; type: string }>;
  dcCost: number;
  description: string;
}

export const RECIPES: CraftingRecipe[] = [
  {
    id: "energy_drink",
    name: "Brew Energy Drinks",
    outputName: "Energy Drink",
    outputType: "consumable",
    outputQuantity: 3,
    durationMinutes: 5,
    craftingXpRequired: 0,
    ingredients: [{ name: "Chemicals", quantity: 1, type: "material" }],
    dcCost: 200,
    description: "Combine raw chemicals into three energy drinks. The taste is questionable.",
  },
  {
    id: "repair_kit",
    name: "Assemble Repair Kit",
    outputName: "Repair Kit",
    outputType: "consumable",
    outputQuantity: 1,
    durationMinutes: 10,
    craftingXpRequired: 0,
    ingredients: [
      { name: "Scrap Metal", quantity: 1, type: "material" },
      { name: "Chemicals", quantity: 1, type: "material" },
    ],
    dcCost: 350,
    description: "Basic field repair kit. Restores 50 HP when used.",
  },
  {
    id: "first_aid_kit",
    name: "First Aid Kit",
    outputName: "First Aid Kit",
    outputType: "consumable",
    outputQuantity: 1,
    durationMinutes: 15,
    craftingXpRequired: 100,
    ingredients: [
      { name: "Chemicals", quantity: 2, type: "material" },
      { name: "Fabric", quantity: 1, type: "material" },
    ],
    dcCost: 500,
    description: "Medical kit. Reduces hospital recovery time by 50%.",
  },
  {
    id: "tactical_vest",
    name: "Forge Tactical Vest",
    outputName: "Tactical Vest",
    outputType: "armor",
    outputQuantity: 1,
    durationMinutes: 60,
    craftingXpRequired: 500,
    ingredients: [
      { name: "Scrap Metal", quantity: 5, type: "material" },
      { name: "Fabric", quantity: 3, type: "material" },
    ],
    dcCost: 2_500,
    description: "Solid protection. Adds +15 defense.",
  },
  {
    id: "street_blade",
    name: "Forge Street Blade",
    outputName: "Street Blade",
    outputType: "weapon",
    outputQuantity: 1,
    durationMinutes: 45,
    craftingXpRequired: 300,
    ingredients: [
      { name: "Scrap Metal", quantity: 3, type: "material" },
      { name: "Leather", quantity: 1, type: "material" },
    ],
    dcCost: 1_500,
    description: "A reliable close-combat weapon. +12 strength bonus.",
  },
  {
    id: "nano_suit",
    name: "Construct Nano Suit",
    outputName: "Nano Suit",
    outputType: "armor",
    outputQuantity: 1,
    durationMinutes: 480,
    craftingXpRequired: 5000,
    ingredients: [
      { name: "Nano Materials", quantity: 5, type: "material" },
      { name: "Rare Metal", quantity: 2, type: "material" },
      { name: "Electronics", quantity: 5, type: "material" },
    ],
    dcCost: 500_000,
    description: "Legendary adaptive armor. Maximum protection.",
  },
];

const CRAFTING_MASTERY: Array<{ name: string; xpRequired: number }> = [
  { name: "Scavenger",      xpRequired: 0 },
  { name: "Tinkerer",       xpRequired: 100 },
  { name: "Artisan",        xpRequired: 500 },
  { name: "Craftsman",      xpRequired: 1_500 },
  { name: "Engineer",       xpRequired: 4_000 },
  { name: "Inventor",       xpRequired: 10_000 },
  { name: "Master Crafter", xpRequired: 25_000 },
  { name: "Legendary Smith",xpRequired: 60_000 },
];

function getMastery(craftingXp: number): { level: number; name: string; nextAt: number | null } {
  let level = 0;
  for (let i = 0; i < CRAFTING_MASTERY.length; i++) {
    if (craftingXp >= CRAFTING_MASTERY[i].xpRequired) level = i;
  }
  return {
    level,
    name: CRAFTING_MASTERY[level].name,
    nextAt: CRAFTING_MASTERY[level + 1]?.xpRequired ?? null,
  };
}

// GET /api/crafting/recipes
router.get("/recipes", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("craftingXp");
    if (!user) return res.status(404).json({ message: "User not found" });

    const mastery = getMastery(user.craftingXp);

    res.json({
      mastery,
      craftingXp: user.craftingXp,
      recipes: RECIPES.map((r) => ({
        ...r,
        locked: user.craftingXp < r.craftingXpRequired,
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/crafting/jobs — my active/pending jobs
router.get("/jobs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const jobs = await CraftingJob.find({ playerId: req.userId, collected: false }).sort({ completesAt: 1 });
    const now = Date.now();
    res.json(
      jobs.map((j) => ({
        id: j._id,
        recipeId: j.recipeId,
        recipeName: j.recipeName,
        outputName: j.outputName,
        outputQuantity: j.outputQuantity,
        startedAt: j.startedAt,
        completesAt: j.completesAt,
        ready: now >= j.completesAt.getTime(),
        minutesRemaining: Math.max(0, Math.ceil((j.completesAt.getTime() - now) / 60000)),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/crafting/start — start a crafting job
router.post("/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { recipeId } = req.body as { recipeId: string };
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return res.status(400).json({ message: "Unknown recipe" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.craftingXp < recipe.craftingXpRequired) {
      return res.status(400).json({ message: `Requires ${recipe.craftingXpRequired} crafting XP` });
    }

    const activeJobs = await CraftingJob.countDocuments({ playerId: req.userId, collected: false });
    if (activeJobs >= 3) return res.status(400).json({ message: "Max 3 active crafting jobs at a time" });

    if (user.dc < recipe.dcCost) return res.status(400).json({ message: `Costs ${recipe.dcCost.toLocaleString()} DC` });

    user.dc -= recipe.dcCost;
    user.craftingXp += Math.floor(recipe.durationMinutes * 0.5);
    await user.save();

    const job = await CraftingJob.create({
      playerId: user._id,
      recipeId: recipe.id,
      recipeName: recipe.name,
      outputType: recipe.outputType,
      outputName: recipe.outputName,
      outputQuantity: recipe.outputQuantity,
      completesAt: new Date(Date.now() + recipe.durationMinutes * 60_000),
    });

    res.status(201).json({
      message: `Crafting started: ${recipe.name}`,
      job: {
        id: job._id,
        completesAt: job.completesAt,
        minutesRemaining: recipe.durationMinutes,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/crafting/:id/collect — collect completed job
router.post("/:id/collect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const job = await CraftingJob.findOne({ _id: req.params.id, playerId: req.userId });
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.collected) return res.status(400).json({ message: "Already collected" });
    if (new Date() < job.completesAt) return res.status(400).json({ message: "Craft not complete yet" });

    job.collected = true;
    await job.save();

    const ITEM_STATS: Record<string, Record<string, number>> = {
      "Tactical Vest": { defenseBonus: 15 },
      "Street Blade": { strengthBonus: 12 },
      "Nano Suit": { defenseBonus: 50 },
      "Energy Drink": {},
      "Repair Kit": {},
      "First Aid Kit": {},
    };

    const items: { name: string; id: string }[] = [];
    for (let i = 0; i < job.outputQuantity; i++) {
      const item = await Item.create({
        name: job.outputName,
        type: job.outputType,
        rarity: job.outputType === "consumable" ? "common" : "rare",
        description: `Crafted by player`,
        owner: req.userId,
        ...( ITEM_STATS[job.outputName] ?? {} ),
      });
      items.push({ name: item.name, id: item._id.toString() });
    }

    res.json({ message: `Collected ${job.outputQuantity}x ${job.outputName}`, items });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/crafting/:id/skip — skip timer with NC (1 NC per minute)
router.post("/:id/skip", requireAuth, async (req: AuthRequest, res) => {
  try {
    const job = await CraftingJob.findOne({ _id: req.params.id, playerId: req.userId });
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.collected) return res.status(400).json({ message: "Already collected" });

    const minutesRemaining = Math.ceil((job.completesAt.getTime() - Date.now()) / 60_000);
    if (minutesRemaining <= 0) return res.status(400).json({ message: "Already complete — collect it" });

    const ncCost = Math.max(5, minutesRemaining);

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.nc < ncCost) return res.status(400).json({ message: `Costs ${ncCost} NC to skip` });

    user.nc -= ncCost;
    await user.save();

    job.completesAt = new Date();
    await job.save();

    res.json({ message: `Timer skipped for ${ncCost} NC`, ncSpent: ncCost });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
