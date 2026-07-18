import mongoose, { Document, Schema } from "mongoose";

export interface IFaction extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  tag: string;
  description: string;
  color: string;
  emblem: string;
  leaderId: mongoose.Types.ObjectId;
  coLeaderIds: mongoose.Types.ObjectId[];
  officerIds: mongoose.Types.ObjectId[];
  memberIds: mongoose.Types.ObjectId[];
  recruitIds: mongoose.Types.ObjectId[];
  treasury: number;
  level: number;
  xp: number;
  maxMembers: number;
  respect: number;
  isRecruiting: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FactionSchema = new Schema<IFaction>(
  {
    name:         { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    tag:          { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 2, maxlength: 5 },
    description:  { type: String, default: "", maxlength: 300 },
    color:        { type: String, default: "#00d4ff" },
    emblem:       { type: String, default: "◆" },
    leaderId:     { type: Schema.Types.ObjectId, ref: "User", required: true },
    coLeaderIds:  [{ type: Schema.Types.ObjectId, ref: "User" }],
    officerIds:   [{ type: Schema.Types.ObjectId, ref: "User" }],
    memberIds:    [{ type: Schema.Types.ObjectId, ref: "User" }],
    recruitIds:   [{ type: Schema.Types.ObjectId, ref: "User" }],
    treasury:     { type: Number, default: 0 },
    level:        { type: Number, default: 1 },
    xp:           { type: Number, default: 0 },
    maxMembers:   { type: Number, default: 50 },
    respect:      { type: Number, default: 0 },
    isRecruiting: { type: Boolean, default: true },
  },
  { timestamps: true }
);

FactionSchema.index({ respect: -1, level: -1 });

export const FACTION_CREATE_COST  = 10_000_000;
export const FACTION_CREATE_LEVEL = 20;

export default mongoose.model<IFaction>("Faction", FactionSchema);
