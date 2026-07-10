import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { SHOP_ITEMS } from "./market";
import { DISTRICTS } from "./districts";

const router = Router();

// GET /api/search?q=term — unified search across players, items, districts
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) {
      res.json({ players: [], items: [], districts: [] });
      return;
    }
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(safe, "i");

    const playerDocs = await User.find({
      username: re,
      banned: false,
      isEmailVerified: true,
    })
      .select("username avatar faction level rank district tag")
      .limit(6)
      .lean();

    const players = playerDocs.map(u => ({
      id: String(u._id),
      username: u.username,
      tag: (u as any).tag,
      avatar: u.avatar,
      faction: (u as any).faction ?? null,
      level: u.level,
    }));

    const items = SHOP_ITEMS.filter(i => re.test(i.name)).slice(0, 6).map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
    }));

    const districts = DISTRICTS.filter(d => re.test(d.name)).slice(0, 6).map(d => ({
      id: d.id,
      name: d.name,
      dangerLevel: d.dangerLevel,
      minLevel: d.minLevel,
    }));

    res.json({ players, items, districts });
  } catch (err: any) {
    req.log.error({ err }, "unified search error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
