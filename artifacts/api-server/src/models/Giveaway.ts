import mongoose, { Document, Schema } from "mongoose";

export interface IGiveawayPledgeItem {
  itemId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  iconUrl: string | null;
}

export interface IGiveawayWinner {
  userId: mongoose.Types.ObjectId;
  dc: number;
  uc: number;
  keys: number;
  items: Array<{ itemId: mongoose.Types.ObjectId; quantity: number }>;
  frames: string[];
}

export interface IGiveaway extends Document {
  _id: mongoose.Types.ObjectId;
  host: mongoose.Types.ObjectId;
  isOwnerHosted: boolean;
  isAnonymous: boolean;
  status: "draft" | "live" | "ended" | "refunded";
  pledge: {
    dc: number;
    uc: number; // nc field on User
    keys: number;
    items: IGiveawayPledgeItem[];
    frames: string[]; // frame ids from FRAME_CATALOG
  };
  pledgeValueDc: number; // total DC-equivalent value at creation, from §2.2 valuation
  ucTopUpPaid: number;
  maxEntrants: number;
  entrantCount: number; // denormalized count, incremented atomically on entry (§4.3)
  durationMs: number; // total chosen live duration, ≤ 3 days in ms
  createdAt: Date;
  draftExpiresAt: Date | null; // only meaningful while status === "draft"
  liveExpiresAt: Date | null; // only set once status flips to "live"
  cardImageUrl: string | null;  // set once, never regenerated (§3.4)
  cardImageData: Buffer | null; // PNG bytes; served via GET /api/giveaways/:id/card
  resolvedAt: Date | null;
  winners: IGiveawayWinner[];
  feedEventId: mongoose.Types.ObjectId | null;
}

const GiveawayPledgeItemSchema = new Schema<IGiveawayPledgeItem>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    iconUrl: { type: String, default: null },
  },
  { _id: false }
);

const GiveawayWinnerSchema = new Schema<IGiveawayWinner>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dc: { type: Number, default: 0 },
    uc: { type: Number, default: 0 },
    keys: { type: Number, default: 0 },
    items: [{
      itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
      quantity: { type: Number, required: true, min: 1 },
    }],
    frames: [{ type: String }],
  },
  { _id: false }
);

const GiveawaySchema = new Schema<IGiveaway>({
  host: { type: Schema.Types.ObjectId, ref: "User", required: true },
  isOwnerHosted: { type: Boolean, default: false },
  isAnonymous: { type: Boolean, default: false },
  status: { type: String, enum: ["draft", "live", "ended", "refunded"], required: true, default: "draft" },
  pledge: {
    dc: { type: Number, default: 0 },
    uc: { type: Number, default: 0 },
    keys: { type: Number, default: 0 },
    items: { type: [GiveawayPledgeItemSchema], default: [] },
    frames: { type: [String], default: [] },
  },
  pledgeValueDc: { type: Number, required: true, default: 0 },
  ucTopUpPaid: { type: Number, default: 0 },
  maxEntrants: { type: Number, required: true },
  entrantCount: { type: Number, default: 0 },
  durationMs: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  draftExpiresAt: { type: Date, default: null },
  liveExpiresAt: { type: Date, default: null },
  cardImageUrl:  { type: String, default: null },
  cardImageData: { type: Buffer, default: null },
  resolvedAt: { type: Date, default: null },
  winners: { type: [GiveawayWinnerSchema], default: [] },
  feedEventId: { type: Schema.Types.ObjectId, ref: "FeedEvent", default: null },
});

// For Tier 2's concurrent-open-giveaway-per-host check.
GiveawaySchema.index({ host: 1, status: 1 });
// For Tier 5's resolution worker poll (live giveaways past their expiry).
GiveawaySchema.index({ status: 1, liveExpiresAt: 1 });
// For draft auto-expiry sweeps (Tier 3.3).
GiveawaySchema.index({ status: 1, draftExpiresAt: 1 });

export default mongoose.model<IGiveaway>("Giveaway", GiveawaySchema);
