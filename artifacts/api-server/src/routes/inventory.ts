import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import PlayerGarage from "../models/PlayerGarage";
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
      travelTimeReduction: i.travelTimeReduction,
      effect: i.effect,
      description: i.description,
      basePrice: i.basePrice,
      quantity: i.quantity,
      equipped: i.equipped,
      inTrade: (i as any).inTrade ?? false,
      slot: i.slot,
      marketListed: i.marketListed,
      blackMarket: i.blackMarket,
      imageUrl: i.imageUrl ?? null,
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
    if ((item as any).inTrade) return res.status(400).json({ message: "Cancel the pending trade offer before equipping" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Unequip current item in that slot
    const slotField = item.slot === "enhancement" ? "equippedEnhancement"
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

    const slotField = item.slot === "enhancement" ? "equippedEnhancement"
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
    if (effect.includes("all_stats_timed:")) {
      const m = effect.match(/all_stats_timed:(\d+):(\d+(?:\.\d+)?)/);
      if (m) {
        const amt = parseInt(m[1]);
        const hours = parseFloat(m[2]);
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        for (const buffType of ["strength", "charisma", "intelligence", "streetCred"]) {
          user.activeBuffs.push({ buffType, value: amt, expiresAt });
        }
        effectMessage += `+${amt} to all stats for ${hours}h. `;
      }
    }
    if (effect.includes("adrenaline:")) {
      // Legacy adrenaline items now grant energy (10 energy per 1 adrenaline)
      const amt = parseInt(effect.match(/adrenaline:(\d+)/)?.[1] || "0");
      const energyAmt = amt * 10;
      user.energy = Math.min(user.maxEnergy, user.energy + energyAmt);
      effectMessage += `+${energyAmt} Energy. `;
    }
    if (effect.includes("nitro:")) {
      const amt = parseInt(effect.match(/nitro:(\d+)/)?.[1] || "0");
      user.nitro = Math.min(user.maxNitro, user.nitro + amt);
      effectMessage += `+${amt} Nitro. `;
    }
    if (effect.includes("energy_full:")) {
      user.energy = user.maxEnergy;
      effectMessage += `Energy fully restored. `;
    }
    if (effect === "service_car") {
      const garage = await PlayerGarage.findOne({ userId: req.userId });
      if (!garage || !garage.activeCar) {
        return res.status(400).json({ message: "No active race car selected. Go to the Garage and select a car first." });
      }
      const ownedCar = garage.cars.find((c: any) => c.carId === garage.activeCar);
      if (!ownedCar) {
        return res.status(400).json({ message: "Active car not found in your garage." });
      }
      const prev = ownedCar.condition ?? 100;
      ownedCar.condition = 100;
      garage.markModified("cars");
      await garage.save();
      effectMessage = `Race car serviced — condition restored from ${prev}% to 100%. `;
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
    const { confirm } = req.body;
    if (!confirm) return res.status(400).json({ message: "confirm:true required to salvage" });

    const item = await Item.findOne({ _id: req.params.id, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.equipped) return res.status(400).json({ message: "Unequip the item before salvaging" });
    if (item.marketListed) return res.status(400).json({ message: "Cancel market listing before salvaging" });
    if ((item as any).inTrade) return res.status(400).json({ message: "Cancel the pending trade offer before salvaging" });

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

// POST /api/inventory/salvage-all-commons — salvage all common rarity items at once
router.post("/salvage-all-commons", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await Item.find({ owner: req.userId, rarity: "common", equipped: false, marketListed: false });
    if (!items.length) return res.status(400).json({ message: "No common items to salvage" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let totalDc = 0;
    const ids = items.map(i => { totalDc += Math.floor((i.basePrice || 0) * 0.15); return i._id; });

    user.dc += totalDc;
    await user.save();
    await Item.deleteMany({ _id: { $in: ids } });

    res.json({ message: `Salvaged ${items.length} common items for ${totalDc} DC`, count: items.length, dcGained: totalDc, newDc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "salvage-all-commons error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/inventory/:id/list — list item on market
router.post("/:id/list", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { price } = req.body;
    const listPrice = Math.floor(Number(price));
    if (!listPrice || listPrice <= 0) return res.status(400).json({ message: "Valid price required" });

    const item = await Item.findOne({ _id: req.params.id, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.equipped) return res.status(400).json({ message: "Unequip before listing" });
    if (item.marketListed) return res.status(400).json({ message: "Already listed on market" });
    if ((item as any).inTrade) return res.status(400).json({ message: "Cancel the pending trade offer before listing" });

    item.marketListed = true;
    item.marketPrice = listPrice;
    item.marketListedAt = new Date();
    await item.save();

    res.json({ message: `${item.name} listed for ${listPrice.toLocaleString()} DC` });
  } catch (err: any) {
    req.log.error({ err }, "list item error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/inventory/trade — send item to another player by tag
router.post("/trade", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId, targetTag } = req.body;
    if (!itemId || !targetTag) return res.status(400).json({ message: "itemId and targetTag required" });

    const [item, recipient] = await Promise.all([
      Item.findOne({ _id: itemId, owner: req.userId }),
      User.findOne({ tag: targetTag }),
    ]);

    if (!item) return res.status(404).json({ message: "Item not found" });
    if (!recipient) return res.status(404).json({ message: "Player not found" });
    if (String(recipient._id) === req.userId) return res.status(400).json({ message: "Cannot trade with yourself" });
    if (item.equipped) return res.status(400).json({ message: "Unequip before trading" });
    if (item.marketListed) return res.status(400).json({ message: "Cancel market listing before trading" });

    item.owner = recipient._id;
    item.equipped = false;
    await item.save();

    res.json({ message: `${item.name} sent to ${recipient.username}` });
  } catch (err: any) {
    req.log.error({ err }, "trade error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/inventory/buy-loadout-slot — 300 NC × (slot#), max +3 extra slots
router.post("/buy-loadout-slot", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("nc purchasedLoadoutSlots")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentSlots = (user as any).purchasedLoadoutSlots ?? 0;
    if (currentSlots >= 3)
      return res.status(400).json({ message: "Maximum 3 additional loadout slots already purchased" });

    const ncCost = 300 * (currentSlots + 1); // 300, 600, 900

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, nc: { $gte: ncCost } },
      { $inc: { nc: -ncCost, purchasedLoadoutSlots: 1 } },
      { returnDocument: "after" },
    );
    if (!updated)
      return res.status(400).json({
        message: `Not enough NC — slot costs ${ncCost} NC`,
        notEnoughNc: true,
        ncRequired: ncCost,
      });

    const newSlots = (updated as any).purchasedLoadoutSlots ?? 0;
    res.json({
      purchasedLoadoutSlots: newSlots,
      ncSpent: ncCost,
      newNc: (updated as any).nc,
      message: `Loadout slot unlocked! You now have ${newSlots} extra slot${newSlots !== 1 ? "s" : ""}.`,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
