import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/inventory
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await Item.find({ owner: req.userId }).lean();
    res.json(items.map(i => ({
      id: i._id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
      strengthBonus: i.strengthBonus,
      charismaBonus: i.charismaBonus,
      intelligenceBonus: i.intelligenceBonus,
      streetCredBonus: i.streetCredBonus,
      defenseBonus: i.defenseBonus,
      travelEnergyReduction: i.travelEnergyReduction,
      effect: i.effect,
      description: i.description,
      basePrice: i.basePrice,
      quantity: i.quantity,
      equipped: i.equipped,
      slot: i.slot,
      marketListed: i.marketListed,
      blackMarket: i.blackMarket,
    })));
  } catch (err: any) {
    req.log.error({ err }, "inventory error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/inventory/:id/equip
router.post("/:id/equip", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (!item.slot) return res.status(400).json({ message: "Item cannot be equipped" });
    if (item.marketListed) return res.status(400).json({ message: "Cancel market listing before equipping" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Unequip current item in that slot
    const slotField = item.slot === "weapon" ? "equippedWeapon"
      : item.slot === "armor" ? "equippedArmor"
      : item.slot === "clothing" ? "equippedClothing"
      : "equippedVehicle";

    const currentEquipped = (user as any)[slotField];
    if (currentEquipped) {
      const old = await Item.findById(currentEquipped);
      if (old) {
        old.equipped = false;
        await old.save();
        // Remove old bonuses
        user.strength = Math.max(0, user.strength - (old.strengthBonus || 0));
        user.charisma = Math.max(0, user.charisma - (old.charismaBonus || 0));
        user.intelligence = Math.max(0, user.intelligence - (old.intelligenceBonus || 0));
        user.streetCred = Math.max(0, user.streetCred - (old.streetCredBonus || 0));
      }
    }

    item.equipped = true;
    await item.save();

    (user as any)[slotField] = item._id;
    user.strength += item.strengthBonus || 0;
    user.charisma += item.charismaBonus || 0;
    user.intelligence += item.intelligenceBonus || 0;
    user.streetCred += item.streetCredBonus || 0;

    await user.save();

    res.json({
      message: `${item.name} equipped`,
      stats: { strength: user.strength, charisma: user.charisma, intelligence: user.intelligence, streetCred: user.streetCred },
    });
  } catch (err: any) {
    req.log.error({ err }, "equip error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/inventory/:id/unequip
router.post("/:id/unequip", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, owner: req.userId, equipped: true });
    if (!item) return res.status(404).json({ message: "Item not found or not equipped" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    item.equipped = false;
    await item.save();

    const slotField = item.slot === "weapon" ? "equippedWeapon"
      : item.slot === "armor" ? "equippedArmor"
      : item.slot === "clothing" ? "equippedClothing"
      : "equippedVehicle";
    (user as any)[slotField] = null;
    user.strength = Math.max(10, user.strength - (item.strengthBonus || 0));
    user.charisma = Math.max(5, user.charisma - (item.charismaBonus || 0));
    user.intelligence = Math.max(5, user.intelligence - (item.intelligenceBonus || 0));
    user.streetCred = Math.max(0, user.streetCred - (item.streetCredBonus || 0));

    await user.save();
    res.json({ message: `${item.name} unequipped` });
  } catch (err: any) {
    req.log.error({ err }, "unequip error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/inventory/:id/use
router.post("/:id/use", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.type !== "consumable") return res.status(400).json({ message: "Item is not consumable" });
    if (item.quantity < 1) return res.status(400).json({ message: "No quantity remaining" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let effectMessage = "";
    const effect = item.effect || "";

    // Parse and apply effect
    if (effect.includes("energy:")) {
      const amt = parseInt(effect.match(/energy:(\d+)/)?.[1] || "0");
      user.energy = Math.min(user.maxEnergy, user.energy + amt);
      effectMessage += `+${amt} Energy. `;
    }
    if (effect.includes("nerve:")) {
      const amt = parseInt(effect.match(/nerve:(\d+)/)?.[1] || "0");
      user.nerve = Math.min(user.maxNerve, user.nerve + amt);
      effectMessage += `+${amt} Nerve. `;
    }
    if (effect.includes("health:")) {
      const amt = parseInt(effect.match(/health:(\d+)/)?.[1] || "0");
      user.health = Math.min(user.maxHealth, user.health + amt);
      effectMessage += `+${amt} HP. `;
    }
    if (effect.includes("hospital:-")) {
      const mins = parseInt(effect.match(/hospital:-(\d+)/)?.[1] || "0");
      if (user.hospitalizedUntil && user.hospitalizedUntil > new Date()) {
        user.hospitalizedUntil = new Date(user.hospitalizedUntil.getTime() - mins * 60 * 1000);
        if (user.hospitalizedUntil <= new Date()) user.hospitalizedUntil = null;
        effectMessage += `-${mins} min hospital time. `;
      }
    }
    if (effect === "clear_hospital") {
      user.hospitalizedUntil = null;
      user.health = user.maxHealth;
      effectMessage = "Hospitalization cleared. Full health restored.";
    }

    item.quantity -= 1;
    if (item.quantity <= 0) {
      await Item.deleteOne({ _id: item._id });
    } else {
      await item.save();
    }
    await user.save();

    res.json({
      message: effectMessage || "Item used.",
      user: { energy: user.energy, maxEnergy: user.maxEnergy, nerve: user.nerve, maxNerve: user.maxNerve, health: user.health, maxHealth: user.maxHealth, hospitalizedUntil: user.hospitalizedUntil },
    });
  } catch (err: any) {
    req.log.error({ err }, "use item error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/inventory/:id/salvage
router.post("/:id/salvage", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.equipped) return res.status(400).json({ message: "Unequip the item before salvaging" });
    if (item.marketListed) return res.status(400).json({ message: "Cancel market listing before salvaging" });

    const salvageValue = Math.floor((item.basePrice || 0) * 0.15);
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.dc += salvageValue;
    await user.save();
    await Item.deleteOne({ _id: item._id });

    res.json({ message: `Salvaged ${item.name} for ${salvageValue} DC`, dcGained: salvageValue, newDc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "salvage error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
