/**
 * PlayerLoadout — stores a player's active combat loadout.
 * One document per player.  Persists until player changes it.
 * All fields are itemId slugs referencing MiniGameItem.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IPlayerLoadout extends Document {
  userId:            mongoose.Types.ObjectId;
  primaryWeaponId:   string | null;
  secondaryWeaponId: string | null;
  bodyArmorId:       string | null;
  consumableItemId:  string | null;
  consumableCount:   number;  // 0-3
  updatedAt:         Date;
}

const PlayerLoadoutSchema = new Schema<IPlayerLoadout>(
  {
    userId:            { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    primaryWeaponId:   { type: String, default: null },
    secondaryWeaponId: { type: String, default: null },
    bodyArmorId:       { type: String, default: null },
    consumableItemId:  { type: String, default: null },
    consumableCount:   { type: Number, default: 0, min: 0, max: 3 },
  },
  { timestamps: true },
);

export default mongoose.model<IPlayerLoadout>("PlayerLoadout", PlayerLoadoutSchema);
