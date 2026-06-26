import { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../lib/jwt";

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
  try {
    const payload = verifyAccess(token);
    req.userId = payload.userId;
    req.username = payload.username;
    req.role = payload.role;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
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

export function requireDev(req: AuthRequest, res: Response, next: NextFunction): void {
  if (process.env["NODE_ENV"] !== "development") {
    res.status(403).json({ message: "Dev-only endpoint" });
    return;
  }
  requireAuth(req, res, next);
}
