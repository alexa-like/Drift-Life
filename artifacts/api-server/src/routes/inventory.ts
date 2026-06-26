import { Router } from "express";
import mongoose from "mongoose";
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
      damage: i.damage,
      defense: i.defense,
      effect: i.effect,
      description: i.description,
      equipped: i.equipped,
      slot: i.slot,
      marketListed: i.marketListed,
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

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Unequip current slot
    if (item.slot === "weapon" && user.equippedWeapon) {
      await Item.updateOne({ _id: user.equippedWeapon }, { equipped: false });
      const old = await Item.findById(user.equippedWeapon);
      if (old) { user.strength -= old.damage; }
    }
    if (item.slot === "armor" && user.equippedArmor) {
      await Item.updateOne({ _id: user.equippedArmor }, { equipped: false });
      const old = await Item.findById(user.equippedArmor);
      if (old) { user.defense -= old.defense; }
    }

    item.equipped = true;
    await item.save();

    if (item.slot === "weapon") {
      user.equippedWeapon = item._id;
      user.strength += item.damage;
    } else {
      user.equippedArmor = item._id;
      user.defense += item.defense;
    }
    await user.save();

    res.json({ message: `Equipped ${item.name}`, strength: user.strength, defense: user.defense });
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

    if (item.slot === "weapon") {
      user.equippedWeapon = null;
      user.strength = Math.max(10, user.strength - item.damage);
    } else if (item.slot === "armor") {
      user.equippedArmor = null;
      user.defense = Math.max(10, user.defense - item.defense);
    }
    await user.save();

    res.json({ message: `Unequipped ${item.name}` });
  } catch (err: any) {
    req.log.error({ err }, "unequip error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
