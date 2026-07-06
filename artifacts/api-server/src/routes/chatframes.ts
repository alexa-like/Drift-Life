import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { safeUser } from "./auth";

const router = Router();

// Master frame catalog — IDs and prices only. Visual data lives on the frontend.
const FRAME_CATALOG = [
  { id: "neon_drift",          rarity: "elite",     priceNC: 500  },
  { id: "grid_static",         rarity: "elite",     priceNC: 500  },
  { id: "street_phantom",      rarity: "elite",     priceNC: 500  },
  { id: "urban_heat",          rarity: "elite",     priceNC: 500  },
  { id: "signal_breach",       rarity: "elite",     priceNC: 500  },
  { id: "night_market",        rarity: "elite",     priceNC: 500  },
  { id: "chrome_edge",         rarity: "elite",     priceNC: 500  },
  { id: "void_signal",         rarity: "elite",     priceNC: 500  },
  { id: "apex",                rarity: "legendary", priceNC: 2000 },
  { id: "blackout_protocol",   rarity: "legendary", priceNC: 2000 },
  { id: "nova_circuit",        rarity: "legendary", priceNC: 2000 },
  { id: "sovereign",           rarity: "legendary", priceNC: 2000 },
] as const;

type FrameId = typeof FRAME_CATALOG[number]["id"];
const FRAME_IDS = FRAME_CATALOG.map(f => f.id) as string[];

// GET /api/chatframes — list catalog + user's owned/equipped state
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("nc ownedChatFrames equippedChatFrame")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      catalog: FRAME_CATALOG,
      owned:    (user as any).ownedChatFrames   || [],
      equipped: (user as any).equippedChatFrame || null,
      nc:       (user as any).nc                 ?? 0,
    });
  } catch (err: any) {
    req.log.error({ err }, "get chatframes error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/chatframes/buy/:frameId — purchase with NC
router.post("/buy/:frameId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const frameId = String(req.params.frameId);
    const catalogEntry = FRAME_CATALOG.find(f => f.id === frameId);
    if (!catalogEntry) return res.status(404).json({ message: "Frame not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const owned: string[] = (user as any).ownedChatFrames || [];
    if (owned.includes(frameId)) {
      return res.status(400).json({ message: "You already own this frame" });
    }

    const nc: number = (user as any).nc ?? 0;
    if (nc < catalogEntry.priceNC) {
      return res.status(400).json({
        message: `Not enough NC — need ${catalogEntry.priceNC} NC`,
      });
    }

    (user as any).nc = nc - catalogEntry.priceNC;
    (user as any).ownedChatFrames = [...owned, frameId];
    await user.save();

    res.json({
      message: `Frame unlocked!`,
      nc:    (user as any).nc,
      owned: (user as any).ownedChatFrames,
    });
  } catch (err: any) {
    req.log.error({ err }, "buy chatframe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/chatframes/equip/:frameId — equip an owned frame; "none" to unequip
router.post("/equip/:frameId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const frameId = String(req.params.frameId);
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (frameId === "none") {
      (user as any).equippedChatFrame = null;
      await user.save();
      return res.json({ message: "Frame removed", equipped: null, user: safeUser(user) });
    }

    if (!FRAME_IDS.includes(frameId)) {
      return res.status(404).json({ message: "Frame not found" });
    }

    const owned: string[] = (user as any).ownedChatFrames || [];
    if (!owned.includes(frameId)) {
      return res.status(403).json({ message: "You don't own this frame" });
    }

    (user as any).equippedChatFrame = frameId;
    await user.save();

    res.json({ message: "Frame equipped!", equipped: frameId, user: safeUser(user) });
  } catch (err: any) {
    req.log.error({ err }, "equip chatframe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
