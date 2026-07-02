import { Router } from "express";
import Property, { PROPERTY_CATALOG, calcPropertyIncome, upgradeCost, PropertyType } from "../models/Property";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/properties — list catalog + my properties
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("level dc properties unlockedSkills");
    if (!user) return res.status(404).json({ message: "User not found" });

    const myProps = await Property.find({ ownerId: req.userId });

    const catalog = Object.entries(PROPERTY_CATALOG).map(([type, data]) => {
      const owned = myProps.filter((p) => p.type === type);
      return {
        type,
        name: data.name,
        cost: data.cost,
        baseIncome: data.baseIncome,
        description: data.description,
        minLevel: data.minLevel,
        storageSlots: data.storageSlots,
        locked: user.level < data.minLevel && !user.unlockedSkills.includes("the_mogul"),
        owned: owned.map((p) => ({
          id: p._id,
          upgradeLevel: p.upgradeLevel,
          pendingIncome: calcPropertyIncome(p.type, p.upgradeLevel, p.lastCollectedAt),
          lastCollectedAt: p.lastCollectedAt,
          maxUpgrades: 5,
        })),
      };
    });

    res.json(catalog);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/properties/buy — purchase a property
router.post("/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type } = req.body as { type: string };
    const catalog = PROPERTY_CATALOG[type as PropertyType];
    if (!catalog) return res.status(400).json({ message: "Invalid property type" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.level < catalog.minLevel && !user.unlockedSkills.includes("the_mogul")) {
      return res.status(400).json({ message: `Requires level ${catalog.minLevel} (or The Mogul skill)` });
    }
    if (user.dc < catalog.cost) {
      return res.status(400).json({ message: `Costs ${catalog.cost.toLocaleString()} DC` });
    }

    user.dc -= catalog.cost;
    const prop = await Property.create({
      ownerId: user._id,
      type,
      name: catalog.name,
    });

    if (!user.properties) user.properties = [];
    user.properties.push(prop._id);
    await user.save();

    res.status(201).json({
      message: `Purchased ${catalog.name}`,
      property: { id: prop._id, type: prop.type, name: prop.name, upgradeLevel: 0 },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/properties/:id/upgrade — upgrade a property
router.post("/:id/upgrade", requireAuth, async (req: AuthRequest, res) => {
  try {
    const prop = await Property.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (prop.upgradeLevel >= 5) return res.status(400).json({ message: "Already at max upgrade level" });

    const cost = upgradeCost(prop.type, prop.upgradeLevel);
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.dc < cost) return res.status(400).json({ message: `Upgrade costs ${cost.toLocaleString()} DC` });

    user.dc -= cost;
    prop.upgradeLevel += 1;

    await Promise.all([user.save(), prop.save()]);

    res.json({
      message: `Upgraded to level ${prop.upgradeLevel}`,
      upgradeLevel: prop.upgradeLevel,
      nextUpgradeCost: prop.upgradeLevel < 5 ? upgradeCost(prop.type, prop.upgradeLevel) : null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/properties/:id/collect — collect income
router.post("/:id/collect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const prop = await Property.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!prop) return res.status(404).json({ message: "Property not found" });

    const income = calcPropertyIncome(prop.type, prop.upgradeLevel, prop.lastCollectedAt);
    if (income < 1) return res.status(400).json({ message: "No income to collect yet" });

    prop.lastCollectedAt = new Date();
    await prop.save();

    const hustlerBonus = 1;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessEmpireBonus = user.unlockedSkills.includes("business_empire") ? 1.2 : 1;
    const dcMagnetBonus = user.unlockedSkills.includes("dc_magnet") ? 1.1 : 1;
    const finalIncome = Math.floor(income * businessEmpireBonus * dcMagnetBonus * hustlerBonus);

    user.dc += finalIncome;
    await user.save();

    res.json({ message: `Collected ${finalIncome.toLocaleString()} DC`, income: finalIncome });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
