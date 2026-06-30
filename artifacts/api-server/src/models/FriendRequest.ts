import mongoose, { Document, Schema } from "mongoose";

export interface IFriendRequest extends Document {
  from: mongoose.Types.ObjectId;
  to: mongoose.Types.ObjectId;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
}

const FriendRequestSchema = new Schema<IFriendRequest>(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Unique: only one pending request can exist between any two users at a time
FriendRequestSchema.index({ from: 1, to: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
FriendRequestSchema.index({ to: 1, status: 1 });

export default mongoose.model<IFriendRequest>("FriendRequest", FriendRequestSchema);
