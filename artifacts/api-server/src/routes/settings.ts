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
    } = req.body;

    if (appearOffline !== undefined) user.appearOffline = Boolean(appearOffline);
    if (dmPrivacy !== undefined && ["anyone", "nobody"].includes(dmPrivacy)) {
      user.dmPrivacy = dmPrivacy;
    }
    if (liteModeEnabled !== undefined) user.liteModeEnabled = Boolean(liteModeEnabled);
    if (telegramNotifications !== undefined) user.telegramNotifications = Boolean(telegramNotifications);
    if (notificationPrefs && typeof notificationPrefs === "object") {
      const prefs = user.notificationPrefs || {
        achievements: true, dms: true, frameGifts: true, xpBoost: true, weeklyFrame: true,
      };
      if (notificationPrefs.achievements !== undefined) prefs.achievements = Boolean(notificationPrefs.achievements);
      if (notificationPrefs.dms !== undefined) prefs.dms = Boolean(notificationPrefs.dms);
      if (notificationPrefs.frameGifts !== undefined) prefs.frameGifts = Boolean(notificationPrefs.frameGifts);
      if (notificationPrefs.xpBoost !== undefined) prefs.xpBoost = Boolean(notificationPrefs.xpBoost);
      if (notificationPrefs.weeklyFrame !== undefined) prefs.weeklyFrame = Boolean(notificationPrefs.weeklyFrame);
      user.notificationPrefs = prefs;
    }

    await user.save();
    res.json(safeUser(user));
  } catch (err: any) {
    req.log.error({ err }, "patch settings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
