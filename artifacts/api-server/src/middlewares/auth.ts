import { Request, Response, NextFunction } from "express";
import { verifyAccess, JwtPayload } from "../lib/jwt";
import User from "../models/User";

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
  role?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing token" });
    return;
  }
  const token = header.slice(7);
  let payload: JwtPayload;
  try {
    payload = verifyAccess(token);
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  req.userId   = payload.userId;
  req.username = payload.username;
  req.role     = payload.role;

  // Check banned status on every request — a banned user with a valid 15-min token must
  // not be able to continue acting. Fail CLOSED on DB error: a transient Mongo hiccup
  // must never let a banned (or unverifiable) user continue acting.
  User.findById(payload.userId)
    .select("banned lastActiveAt")
    .lean()
    .then((user) => {
      if (!user || (user as any).banned) {
        res.status(401).json({ message: "Account suspended" });
        return;
      }
      const lastActive: Date | undefined = (user as any).lastActiveAt;
      if (!lastActive || Date.now() - lastActive.getTime() > 60_000) {
        User.updateOne({ _id: payload.userId }, { lastActiveAt: new Date() }).catch(() => {});
      }
      next();
    })
    .catch((err) => {
      req.log?.error({ err }, "auth ban-check DB lookup failed — failing closed");
      res.status(503).json({ message: "Service temporarily unavailable" });
    });
}

export function requireOwner(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.role !== "owner" && req.role !== "admin") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  });
}

export function requireStaff(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.role !== "owner" && req.role !== "admin" && req.role !== "staff") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  });
}

export function requireDev(req: AuthRequest, res: Response, next: NextFunction): void {
  if (process.env["NODE_ENV"] !== "development") {
    res.status(403).json({ message: "Dev-only endpoint" });
    return;
  }
  requireAuth(req, res, next);
}
