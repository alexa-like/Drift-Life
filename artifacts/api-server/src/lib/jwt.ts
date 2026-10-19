import jwt from "jsonwebtoken";

const DEFAULT_ACCESS_SECRET  = "14c76b7dbfcc8911d31a330629afc4d08b3385a0bb24bfb47a350a7d733e790922462cafd2a9f9765edbb63a79172254272166a0a3ea02ac89e76362eec2614e";
const DEFAULT_REFRESH_SECRET = "6f96176551d78a7da5120470f0224c71b5a1f2348677c3d8f17ca7449f9c102ffbd2735542537384cb6d4a1f806d5bc11bff305173d264b5361100dfaa9f7969";
const ACCESS_EXPIRY  = "15m";
const REFRESH_EXPIRY = "30d";

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

function getAccessSecret(): string {
  const secret = process.env["JWT_ACCESS_SECRET"] || process.env["JWT_SECRET"];
  if (secret) return secret;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("FATAL: JWT_ACCESS_SECRET or JWT_SECRET must be set in production");
  }
  return DEFAULT_ACCESS_SECRET;
}

function getRefreshSecret(): string {
  const secret = process.env["JWT_REFRESH_SECRET"] || process.env["JWT_SECRET"];
  if (secret) return secret;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("FATAL: JWT_REFRESH_SECRET or JWT_SECRET must be set in production");
  }
  return DEFAULT_REFRESH_SECRET;
}

export function signAccess(payload: JwtPayload): string {
  return jwt.sign(payload, getAccessSecret(), { algorithm: "HS256", expiresIn: ACCESS_EXPIRY });
}

export function signRefresh(payload: JwtPayload): string {
  return jwt.sign(payload, getRefreshSecret(), { algorithm: "HS256", expiresIn: REFRESH_EXPIRY });
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, getAccessSecret(), { algorithms: ["HS256"] }) as JwtPayload;
}

export function verifyRefresh(token: string): JwtPayload {
  return jwt.verify(token, getRefreshSecret(), { algorithms: ["HS256"] }) as JwtPayload;
}
