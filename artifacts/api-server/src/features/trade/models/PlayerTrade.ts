import mongoose, { Document, Schema } from "mongoose";

export interface ITradeOffer {
  dc: number;
  itemIds: mongoose.Types.ObjectId[];
  itemNames: string[];
}

export interface IPlayerTrade extends Document {
  _id: mongoose.Types.ObjectId;
  initiatorId: mongoose.Types.ObjectId;
  initiatorName: string;
  targetId: mongoose.Types.ObjectId;
  targetName: string;
  initiatorOffer: ITradeOffer;
  targetOffer: ITradeOffer;
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  initiatorConfirmed: boolean;
  targetConfirmed: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TradeOfferSchema = new Schema<ITradeOffer>(
  {
    dc: { type: Number, default: 0, min: 0 },
    itemIds: [{ type: Schema.Types.ObjectId, ref: "Item" }],
    itemNames: [{ type: String }],
  },
  { _id: false }
);

const PlayerTradeSchema = new Schema<IPlayerTrade>(
  {
    initiatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    initiatorName: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetName: { type: String, required: true },
    initiatorOffer: { type: TradeOfferSchema, required: true },
    targetOffer: { type: TradeOfferSchema, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled", "completed"],
      default: "pending",
    },
    initiatorConfirmed: { type: Boolean, default: false },
    targetConfirmed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

PlayerTradeSchema.index({ initiatorId: 1, status: 1 });
PlayerTradeSchema.index({ targetId: 1, status: 1 });

export default mongoose.model<IPlayerTrade>("PlayerTrade", PlayerTradeSchema);
