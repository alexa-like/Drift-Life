import mongoose, { Document, Schema } from "mongoose";

export interface ICraftingJob extends Document {
  _id: mongoose.Types.ObjectId;
  playerId: mongoose.Types.ObjectId;
  recipeId: string;
  recipeName: string;
  outputType: string;
  outputName: string;
  outputQuantity: number;
  startedAt: Date;
  completesAt: Date;
  collected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CraftingJobSchema = new Schema<ICraftingJob>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipeId: { type: String, required: true },
    recipeName: { type: String, required: true },
    outputType: { type: String, required: true },
    outputName: { type: String, required: true },
    outputQuantity: { type: Number, default: 1 },
    startedAt: { type: Date, default: Date.now },
    completesAt: { type: Date, required: true },
    collected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CraftingJobSchema.index({ playerId: 1, collected: 1 });

export default mongoose.model<ICraftingJob>("CraftingJob", CraftingJobSchema);
