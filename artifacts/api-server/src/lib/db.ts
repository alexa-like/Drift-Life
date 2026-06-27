import mongoose from "mongoose";
import { logger } from "./logger";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI environment variable is required");

  await mongoose.connect(uri, { dbName: "driftlife" });
  isConnected = true;
  logger.info("MongoDB connected");

  mongoose.connection.on("error", (err) => {
    logger.error({ err }, "MongoDB error");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
    isConnected = false;
  });
}
