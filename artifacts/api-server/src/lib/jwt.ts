import jwt from "jsonwebtoken";

const ACCESS_SECRET  = process.env["JWT_SECRET"]         ?? "dev-access-secret";
const REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] ?? "dev-refresh-secret";
const ACCESS_EXPIRY  = "15m";
const REFRESH_EXPIRY = "30d";

// Crash fast in production if placeholder secrets are still in use
if (process.env["NODE_ENV"] === "production") {
  if (ACCESS_SECRET === "dev-access-secret" || REFRESH_SECRET === "dev-refresh-secret") {
    console.error("FATAL: JWT_SECRET / JWT_REFRESH_SECRET are using insecure default values in production. " +
      "Set both environment variables and redeploy.");
    process.exit(1);
  }
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export function signAccess(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { algorithm: "HS256", expiresIn: ACCESS_EXPIRY });
}

export function signRefresh(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { algorithm: "HS256", expiresIn: REFRESH_EXPIRY });
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}

export function verifyRefresh(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}
