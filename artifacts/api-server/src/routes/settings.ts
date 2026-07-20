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
        combat: true, crimes: true, faction: true, banking: true,
      };
      if (notificationPrefs.achievements !== undefined) prefs.achievements = Boolean(notificationPrefs.achievements);
      if (notificationPrefs.dms          !== undefined) prefs.dms          = Boolean(notificationPrefs.dms);
      if (notificationPrefs.xpBoost      !== undefined) prefs.xpBoost      = Boolean(notificationPrefs.xpBoost);
      if (notificationPrefs.combat       !== undefined) prefs.combat        = Boolean(notificationPrefs.combat);
      if (notificationPrefs.crimes       !== undefined) prefs.crimes        = Boolean(notificationPrefs.crimes);
      if (notificationPrefs.faction      !== undefined) prefs.faction       = Boolean(notificationPrefs.faction);
      if (notificationPrefs.banking      !== undefined) prefs.banking       = Boolean(notificationPrefs.banking);
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

// PATCH /api/settings/nav — save player nav order & default page
router.patch("/nav", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { navOrder, defaultPage } = req.body as { navOrder?: string[]; defaultPage?: string | null };
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (navOrder !== undefined && Array.isArray(navOrder)) (user as any).navOrder = navOrder;
    if (defaultPage !== undefined) (user as any).defaultPage = defaultPage ?? null;
    await user.save();
    res.json({ message: "Navigation preferences saved", navOrder: (user as any).navOrder, defaultPage: (user as any).defaultPage });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
