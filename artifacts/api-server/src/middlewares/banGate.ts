import { Response, NextFunction } from "express";
import { verifyAccess } from "../lib/jwt";
import User from "../models/User";
import { AuthRequest } from "./auth";

// Paths a banned user may still reach (relative to the /api mount point).
// Everything else is rejected with 403 so banned players are funneled into
// the ban-appeal flow instead of being fully locked out of the game.
const ALLOWED_PREFIXES = ["/auth/logout", "/auth/refresh", "/user/me", "/ban-appeal"];

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));
}

/**
 * Global ban enforcement. Mounted at the /api prefix, ahead of the routers.
 * Decodes the bearer token (if any) and, for banned users, blocks every path
 * except the small allowlist above. Requests without a valid token pass
 * through untouched — requireAuth on the destination route still handles
 * authentication itself.
 */
export async function banGate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  let userId: string;
  try {
    userId = verifyAccess(header.slice(7)).userId;
  } catch {
    // Invalid/expired token — let the downstream requireAuth reject it normally.
    next();
    return;
  }

  if (isAllowed(req.path)) {
    next();
    return;
  }

  try {
    const user = await User.findById(userId).select("banned banReason").lean();
    if (!user || !(user as any).banned) {
      next();
      return;
    }
    res.status(403).json({
      code: "BANNED",
      message: `Your account is suspended: ${(user as any).banReason ?? "policy violation"}. Visit the ban appeal page to contact staff.`,
    });
  } catch (err) {
    req.log?.error({ err }, "banGate DB lookup failed — failing closed");
    res.status(503).json({ message: "Service temporarily unavailable" });
  }
}
