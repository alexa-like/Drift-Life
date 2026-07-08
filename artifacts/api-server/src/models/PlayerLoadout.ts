/**
 * PlayerLoadout — stores a player's active combat loadout.
 * One document per player.  Persists until player changes it.
 * All fields are itemId slugs referencing MiniGameItem.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IPlayerLoadout extends Document {
  userId:      mongoose.Types.ObjectId;
  weapon:      string | null;   // MiniGameItem itemId
  armor:       string | null;
  consumable1: string | null;
  consumable2: string | null;
  ammoType:    string | null;
  updatedAt:   Date;
}

const PlayerLoadoutSchema = new Schema<IPlayerLoadout>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    weapon:      { type: String, default: null },
    armor:       { type: String, default: null },
    consumable1: { type: String, default: null },
    consumable2: { type: String, default: null },
    ammoType:    { type: String, default: null },
  },
  { timestamps: true },
);

export default mongoose.model<IPlayerLoadout>("PlayerLoadout", PlayerLoadoutSchema);
