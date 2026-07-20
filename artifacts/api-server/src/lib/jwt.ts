import jwt from "jsonwebtoken";

const ACCESS_SECRET  = "14c76b7dbfcc8911d31a330629afc4d08b3385a0bb24bfb47a350a7d733e790922462cafd2a9f9765edbb63a79172254272166a0a3ea02ac89e76362eec2614e";
const REFRESH_SECRET = "6f96176551d78a7da5120470f0224c71b5a1f2348677c3d8f17ca7449f9c102ffbd2735542537384cb6d4a1f806d5bc11bff305173d264b5361100dfaa9f7969";
const ACCESS_EXPIRY  = "15m";
const REFRESH_EXPIRY = "30d";

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
