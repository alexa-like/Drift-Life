import mongoose, { Document, Schema } from "mongoose";

export interface IGuild extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  tag: string;
  description: string;
  faction: "suits" | "street" | "grid" | null;
  leaderId: mongoose.Types.ObjectId;
  officers: mongoose.Types.ObjectId[];
  members: mongoose.Types.ObjectId[];
  recruits: mongoose.Types.ObjectId[];
  treasury: number;
  level: number;
  xp: number;
  emblem: string | null;
  maxMembers: number;
  // Turf war fields (Section 6)
  weeklyTurfPoints: number;
  controlledDistricts: string[];
  lastTurfResetAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const GuildSchema = new Schema<IGuild>(
  {
    name: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    tag: { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 2, maxlength: 5 },
    description: { type: String, default: "", maxlength: 300 },
    faction: { type: String, enum: ["suits", "street", "grid", null], default: null },
    leaderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    officers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    recruits: [{ type: Schema.Types.ObjectId, ref: "User" }],
    treasury: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    emblem: { type: String, default: null },
    maxMembers: { type: Number, default: 15 },
    weeklyTurfPoints: { type: Number, default: 0 },
    controlledDistricts: [{ type: String }],
    lastTurfResetAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IGuild>("Guild", GuildSchema);
