import mongoose, { Schema } from "mongoose";
const CrimeLogSchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  crimeId:      { type: String, required: true },
  crimeName:    { type: String, required: true },
  district:     { type: String, default: "downtown" },
  outcome:      { type: String, enum: ["success", "jailed"], required: true },
  dcEarned:     { type: Number, default: 0 },
  xpEarned:     { type: Number, default: 0 },
  jailDuration: { type: Number, default: 0 },
  createdAt:    { type: Date, default: Date.now }
}, { timestamps: false });
export default mongoose.model("CrimeLog", CrimeLogSchema);
