/**
 * PlayerMiniGameInventory — tracks a player's owned combat items.
 * One document per player.  Items reference MiniGameItem by itemId slug.
 */
import mongoose, { Document, Schema } from "mongoose";

interface InventoryStack {
  itemId: string;
  quantity: number;
}

const InventoryStackSchema = new Schema<InventoryStack>(
  {
    itemId:   { type: String, required: true },
    quantity: { type: Number, required: true, default: 1, min: 0 },
  },
  { _id: false },
);

export interface IPlayerMiniGameInventory extends Document {
  userId: mongoose.Types.ObjectId;
  weapons:     InventoryStack[];
  armor:       InventoryStack[];
  consumables: InventoryStack[];
  ammo:        InventoryStack[];
  updatedAt:   Date;
}

const PlayerMiniGameInventorySchema = new Schema<IPlayerMiniGameInventory>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    weapons:     { type: [InventoryStackSchema], default: [] },
    armor:       { type: [InventoryStackSchema], default: [] },
    consumables: { type: [InventoryStackSchema], default: [] },
    ammo:        { type: [InventoryStackSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model<IPlayerMiniGameInventory>(
  "PlayerMiniGameInventory",
  PlayerMiniGameInventorySchema,
);
