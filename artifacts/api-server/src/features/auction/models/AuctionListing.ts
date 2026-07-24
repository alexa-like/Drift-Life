/**
 * AuctionListing — fully bot-operated auction house (Tier 5.6).
 * Players never create listings; a cron job spins up new auctions for
 * random Epic/Legendary MiniGameItems on a rolling 30–120 min schedule.
 * Players may only bid.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IAuctionBid {
  bidderId: mongoose.Types.ObjectId;
  bidderName: string;
  amount: number;
  timestamp: Date;
}

export interface IAuctionListing extends Document {
  _id: mongoose.Types.ObjectId;
  itemId: string;            // MiniGameItem.itemId slug
  itemName: string;
  itemCategory: string;
  itemTier: "epic" | "legendary";
  itemImage: string | null;
  currentBid: number;
  currentBidderId: mongoose.Types.ObjectId | null;
  currentBidderName: string | null;
  minimumBid: number;
  bidIncrement: number;
  expiresAt: Date;
  status: "active" | "sold" | "expired";
  bids: IAuctionBid[];
  createdAt: Date;
  updatedAt: Date;
}

const AuctionListingSchema = new Schema<IAuctionListing>(
  {
    itemId:       { type: String, required: true },
    itemName:     { type: String, required: true },
    itemCategory: { type: String, required: true },
    itemTier:     { type: String, enum: ["epic", "legendary"], required: true },
    itemImage:    { type: String, default: null },
    currentBid:       { type: Number, default: 0 },
    currentBidderId:  { type: Schema.Types.ObjectId, ref: "User", default: null },
    currentBidderName: { type: String, default: null },
    minimumBid:   { type: Number, required: true },
    bidIncrement: { type: Number, required: true },
    expiresAt:    { type: Date, required: true },
    status:       { type: String, enum: ["active", "sold", "expired"], default: "active" },
    bids: [
      {
        bidderId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
        bidderName: { type: String, required: true },
        amount:     { type: Number, required: true },
        timestamp:  { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

AuctionListingSchema.index({ status: 1, expiresAt: 1 });
AuctionListingSchema.index({ itemId: 1, status: 1 });

export default mongoose.model<IAuctionListing>("AuctionListing", AuctionListingSchema);
