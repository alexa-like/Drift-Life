import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { safeUser } from "./auth";

const router = Router();

// GET /api/settings — get current player settings
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      appearOffline: user.appearOffline,
      dmPrivacy: user.dmPrivacy,
      liteModeEnabled: user.liteModeEnabled,
      notificationPrefs: user.notificationPrefs,
      telegramNotifications: user.telegramNotifications,
      telegramId: user.telegramId,
      uiScale: (user as any).uiScale ?? 0.85,
      uiTheme: (user as any).uiTheme ?? "dark",
    });
  } catch (err: any) {
    req.log.error({ err }, "get settings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/settings — update player settings
router.patch("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      appearOffline,
      dmPrivacy,
      liteModeEnabled,
      telegramNotifications,
      notificationPrefs,
      uiScale,
      uiTheme,
    } = req.body;

    if (appearOffline !== undefined) user.appearOffline = Boolean(appearOffline);
    if (dmPrivacy !== undefined && ["anyone", "nobody"].includes(dmPrivacy)) {
      user.dmPrivacy = dmPrivacy;
    }
    if (liteModeEnabled !== undefined) user.liteModeEnabled = Boolean(liteModeEnabled);
    if (telegramNotifications !== undefined) user.telegramNotifications = Boolean(telegramNotifications);
    if (notificationPrefs && typeof notificationPrefs === "object") {
      const prefs = user.notificationPrefs || {
        achievements: true, dms: true, xpBoost: true,
      };
      if (notificationPrefs.achievements !== undefined) prefs.achievements = Boolean(notificationPrefs.achievements);
      if (notificationPrefs.dms !== undefined) prefs.dms = Boolean(notificationPrefs.dms);
      if (notificationPrefs.xpBoost !== undefined) prefs.xpBoost = Boolean(notificationPrefs.xpBoost);
      user.notificationPrefs = prefs;
    }
    if (uiScale !== undefined) {
      const s = Number(uiScale);
      if (!isNaN(s)) (user as any).uiScale = Math.min(1.2, Math.max(0.6, s));
    }
    if (uiTheme !== undefined && ["dark", "light"].includes(uiTheme)) {
      (user as any).uiTheme = uiTheme;
    }

    await user.save();
    res.json(safeUser(user));
  } catch (err: any) {
    req.log.error({ err }, "patch settings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
