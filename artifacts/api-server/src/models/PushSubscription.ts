import mongoose, { Document, Schema } from "mongoose";

export interface IPushSubscription extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint:  { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth:   { type: String, required: true },
    },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
