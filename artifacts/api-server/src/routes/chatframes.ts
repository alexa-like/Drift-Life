import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { safeUser } from "./auth";

const router = Router();

// Master frame catalog — IDs and prices only. Visual data lives on the frontend.
// Exported so other systems (e.g. Tier 7 owner-hosted giveaways) can validate a
// frame id is real without duplicating this list.
export const FRAME_CATALOG = [
  // ── Elite (900 NC) ────────────────────────────────────────────────────────
  { id: "neon_drift",          rarity: "elite",     priceNC: 900  },
  { id: "grid_static",         rarity: "elite",     priceNC: 900  },
  { id: "street_phantom",      rarity: "elite",     priceNC: 900  },
  { id: "urban_heat",          rarity: "elite",     priceNC: 900  },
  { id: "signal_breach",       rarity: "elite",     priceNC: 900  },
  { id: "night_market",        rarity: "elite",     priceNC: 900  },
  { id: "chrome_edge",         rarity: "elite",     priceNC: 900  },
  { id: "void_signal",         rarity: "elite",     priceNC: 900  },
  { id: "cyberkitty",          rarity: "elite",     priceNC: 900  },
  { id: "cyberfrost",          rarity: "elite",     priceNC: 900  },
  { id: "retro_miami",         rarity: "elite",     priceNC: 900  },
  { id: "sakura",              rarity: "elite",     priceNC: 900  },
  { id: "halloween",           rarity: "elite",     priceNC: 900  },
  { id: "cyberbloom",          rarity: "elite",     priceNC: 900  },
  // ── Legendary (3,500 NC) ──────────────────────────────────────────────────
  { id: "apex",                rarity: "legendary", priceNC: 3500 },
  { id: "blackout_protocol",   rarity: "legendary", priceNC: 3500 },
  { id: "nova_circuit",        rarity: "legendary", priceNC: 3500 },
  { id: "sovereign",           rarity: "legendary", priceNC: 3500 },
  { id: "cybersanta",          rarity: "legendary", priceNC: 3500 },
  { id: "cyberdragon",         rarity: "legendary", priceNC: 3500 },
  { id: "netrunner",           rarity: "legendary", priceNC: 3500 },
  { id: "golden_new_year",     rarity: "legendary", priceNC: 3500 },
  // ── Mythic (rarest, most expensive) ──────────────────────────────────────
  { id: "lunar_stallion",      rarity: "mythic",    priceNC: 7500  },
  { id: "lightwalker",         rarity: "mythic",    priceNC: 7500  },
  { id: "prestige_frame_P1",   rarity: "mythic",    priceNC: 6000  },
  { id: "prestige_frame_P2",   rarity: "mythic",    priceNC: 8000  },
  { id: "prestige_frame_P3",   rarity: "mythic",    priceNC: 10000 },
  { id: "prestige_frame_P4",   rarity: "mythic",    priceNC: 12000 },
  // ── Subscriber-exclusive (granted only via active paid subscription —
  //    a paid perk, not a free/random grant; priceNC: 0 means "not sold
  //    directly", not "free") ────────────────────────────────────────────────
  { id: "sub_street_runner",   rarity: "elite",     priceNC: 0 },
  { id: "sub_neon_syndicate",  rarity: "elite",     priceNC: 0 },
  { id: "sub_apex_sovereign",  rarity: "legendary", priceNC: 0 },
] as const;

type FrameId = typeof FRAME_CATALOG[number]["id"];
export const FRAME_IDS = FRAME_CATALOG.map(f => f.id) as string[];

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
