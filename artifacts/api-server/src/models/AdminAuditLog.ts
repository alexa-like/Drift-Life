import mongoose, { Schema, Document } from "mongoose";

export interface IAdminAuditLog extends Document {
  actorId: string;
  actorUsername: string;
  action: string;
  targetId?: string;
  targetUsername?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>({
  actorId:        { type: String, required: true, index: true },
  actorUsername:  { type: String, required: true },
  action:         { type: String, required: true, index: true },
  targetId:       { type: String },
  targetUsername: { type: String },
  details:        { type: Schema.Types.Mixed },
  createdAt:      { type: Date, default: Date.now, index: true },
});

export default mongoose.model<IAdminAuditLog>("AdminAuditLog", AdminAuditLogSchema);

export async function logAdminAction(params: {
  actorId: string;
  actorUsername: string;
  action: string;
  targetId?: string;
  targetUsername?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await mongoose.model<IAdminAuditLog>("AdminAuditLog").create(params);
  } catch {
    // Audit logging must never break the underlying admin action.
  }
}
