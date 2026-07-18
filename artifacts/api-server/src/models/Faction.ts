import mongoose, { Document, Schema } from "mongoose";

// ── Invite sub-document ────────────────────────────────────────────────────────
export interface IFactionInvite {
  userId:    mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  invitedAt: Date;
  note:      string;
}

// ── News log entry ─────────────────────────────────────────────────────────────
export type FactionNewsType =
  | "join" | "leave" | "kick" | "promote" | "demote"
  | "donate" | "withdraw" | "invite_accepted" | "leadership_transfer"
  | "war" | "crime_success" | "crime_failed" | "founded";

export interface IFactionNewsEntry {
  type:      string;
  message:   string;
  createdAt: Date;
}

// ── Main interface ─────────────────────────────────────────────────────────────
export interface IFaction extends Document {
  _id:          mongoose.Types.ObjectId;
  name:         string;
  tag:          string;
  description:  string;
  color:        string;
  emblem:       string;
  leaderId:     mongoose.Types.ObjectId;
  coLeaderIds:  mongoose.Types.ObjectId[];
  officerIds:   mongoose.Types.ObjectId[];
  memberIds:    mongoose.Types.ObjectId[];
  recruitIds:   mongoose.Types.ObjectId[];
  treasury:     number;
  level:        number;
  xp:           number;
  maxMembers:   number;
  respect:      number;
  isRecruiting: boolean;
  pendingInvites: IFactionInvite[];
  newsLog:      IFactionNewsEntry[];
  createdAt:    Date;
  updatedAt:    Date;
}

// ── Sub-schemas ────────────────────────────────────────────────────────────────
const InviteSchema = new Schema<IFactionInvite>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invitedAt: { type: Date, default: Date.now },
    note:      { type: String, default: "", maxlength: 200 },
  },
  { _id: false }
);

const NewsSchema = new Schema<IFactionNewsEntry>(
  {
    type:      { type: String, required: true },
    message:   { type: String, required: true, maxlength: 300 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main schema ────────────────────────────────────────────────────────────────
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
    pendingInvites: { type: [InviteSchema], default: [] },
    newsLog:        { type: [NewsSchema],   default: [] },
  },
  { timestamps: true }
);

FactionSchema.index({ respect: -1, level: -1 });

/**
 * Append a news entry. Caller must save() the faction afterward.
 * Keeps the log capped at 100 entries (oldest evicted).
 */
export function addFactionNews(
  faction: IFaction,
  type: FactionNewsType | string,
  message: string
): void {
  (faction as any).newsLog.push({ type, message, createdAt: new Date() });
  if ((faction as any).newsLog.length > 100) {
    (faction as any).newsLog = (faction as any).newsLog.slice(-100);
  }
  faction.markModified("newsLog");
}

export const FACTION_CREATE_COST  = 10_000_000;
export const FACTION_CREATE_LEVEL = 20;

export default mongoose.model<IFaction>("Faction", FactionSchema);
