import mongoose, { Document, Schema } from "mongoose";

export interface IBid {
  bidderId: mongoose.Types.ObjectId;
  bidderName: string;
  amount: number;
  placedAt: Date;
}

export interface IAuctionListing extends Document {
  _id: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  sellerName: string;
  itemId: mongoose.Types.ObjectId;
  itemSnapshot: {
    name: string;
    type: string;
    rarity: string;
    description: string;
    iconUrl: string | null;
  };
  startingPrice: number;
  currentBid: number;
  currentBidderId: mongoose.Types.ObjectId | null;
  currentBidderName: string | null;
  buyoutPrice: number | null;
  endsAt: Date;
  status: "active" | "sold" | "expired" | "cancelled";
  bids: IBid[];
  createdAt: Date;
  updatedAt: Date;
}

const AuctionListingSchema = new Schema<IAuctionListing>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sellerName: { type: String, required: true },
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    itemSnapshot: {
      name: { type: String, required: true },
      type: { type: String, required: true },
      rarity: { type: String, required: true },
      description: { type: String, default: "" },
      iconUrl: { type: String, default: null },
    },
    startingPrice: { type: Number, required: true, min: 1 },
    currentBid: { type: Number, default: 0 },
    currentBidderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    currentBidderName: { type: String, default: null },
    buyoutPrice: { type: Number, default: null },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "sold", "expired", "cancelled"], default: "active" },
    bids: [
      {
        bidderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        bidderName: { type: String, required: true },
        amount: { type: Number, required: true },
        placedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

AuctionListingSchema.index({ status: 1, endsAt: 1 });
AuctionListingSchema.index({ sellerId: 1 });

export default mongoose.model<IAuctionListing>("AuctionListing", AuctionListingSchema);
