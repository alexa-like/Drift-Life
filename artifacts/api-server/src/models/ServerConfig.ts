import mongoose, { Schema, Document } from "mongoose";

export interface IServerConfig extends Document {
  key: string;
  value: Record<string, unknown>;
  updatedAt: Date;
}

const ServerConfigSchema = new Schema<IServerConfig>({
  key:       { type: String, required: true, unique: true },
  value:     { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IServerConfig>("ServerConfig", ServerConfigSchema);
