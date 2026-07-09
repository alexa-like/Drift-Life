/**
 * PlayerMiniGameInventory — tracks a player's owned combat items.
 * One document per player.  Items reference MiniGameItem by itemId slug.
 */
import mongoose, { Document, Schema } from "mongoose";

interface WeaponStack {
  itemId: string;
  durability: number;
}

interface ConsumableStack {
  itemId: string;
  quantity: number;
}

const WeaponStackSchema = new Schema<WeaponStack>(
  {
    itemId:     { type: String, required: true },
    durability: { type: Number, required: true, default: 100, min: 0 },
  },
  { _id: false },
);

const ConsumableStackSchema = new Schema<ConsumableStack>(
  {
    itemId:   { type: String, required: true },
    quantity: { type: Number, required: true, default: 1, min: 0 },
  },
  { _id: false },
);

export interface IPlayerMiniGameInventory extends Document {
  userId: mongoose.Types.ObjectId;
  primaryWeapons:   WeaponStack[];
  secondaryWeapons: WeaponStack[];
  bodyArmors:       WeaponStack[];
  consumables:      ConsumableStack[];
  ammo: {
    pistol_rounds:   number;
    smg_rounds:      number;
    rifle_rounds:    number;
    shotgun_shells:  number;
    sniper_rounds:   number;
    lmg_rounds:      number;
  };
  updatedAt: Date;
}

const PlayerMiniGameInventorySchema = new Schema<IPlayerMiniGameInventory>(
  {
    userId:           { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    primaryWeapons:   { type: [WeaponStackSchema], default: [] },
    secondaryWeapons: { type: [WeaponStackSchema], default: [] },
    bodyArmors:       { type: [WeaponStackSchema], default: [] },
    consumables:      { type: [ConsumableStackSchema], default: [] },
    ammo: {
      pistol_rounds:  { type: Number, default: 0 },
      smg_rounds:     { type: Number, default: 0 },
      rifle_rounds:   { type: Number, default: 0 },
      shotgun_shells: { type: Number, default: 0 },
      sniper_rounds:  { type: Number, default: 0 },
      lmg_rounds:     { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

PlayerMiniGameInventorySchema.index({ userId: 1 });

export default mongoose.model<IPlayerMiniGameInventory>(
  "PlayerMiniGameInventory",
  PlayerMiniGameInventorySchema,
);
