import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env["JWT_SECRET"] ?? "dev-access-secret";
const REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] ?? "dev-refresh-secret";
const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "30d";

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export function signAccess(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

export function signRefresh(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefresh(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}
