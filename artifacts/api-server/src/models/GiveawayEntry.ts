import mongoose, { Document, Schema } from "mongoose";

export interface IGiveawayEntry extends Document {
  _id: mongoose.Types.ObjectId;
  giveawayId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  enteredAt: Date;
}

const GiveawayEntrySchema = new Schema<IGiveawayEntry>({
  giveawayId: { type: Schema.Types.ObjectId, ref: "Giveaway", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  enteredAt: { type: Date, default: Date.now },
});

// Server-side one-entry-per-user-per-giveaway enforcement — never just a UI check.
GiveawayEntrySchema.index({ giveawayId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IGiveawayEntry>("GiveawayEntry", GiveawayEntrySchema);
