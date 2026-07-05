import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { safeUser } from "./auth";

const router = Router();

const CHAT_FRAMES = [
  { id: "neon_street",   name: "Neon Street",    tier: "standard",  price: 500   },
  { id: "red_heat",      name: "Red Heat",        tier: "standard",  price: 500   },
  { id: "grid_runner",   name: "Grid Runner",     tier: "standard",  price: 500   },
  { id: "suits_gold",    name: "Suits Gold",      tier: "standard",  price: 500   },
  { id: "void_purple",   name: "Void Purple",     tier: "rare",      price: 1500  },
  { id: "toxic_green",   name: "Toxic Green",     tier: "rare",      price: 1500  },
  { id: "chrome_rise",   name: "Chrome Rise",     tier: "rare",      price: 1500  },
  { id: "infrared",      name: "Infrared",        tier: "rare",      price: 1500  },
  { id: "drift_king",    name: "Drift King",      tier: "elite",     price: 4000  },
  { id: "cyber_phantom", name: "Cyber Phantom",   tier: "elite",     price: 4000  },
  { id: "neon_pulse",    name: "Neon Pulse",      tier: "elite",     price: 4000  },
  { id: "nitro_blaze",   name: "Nitro Blaze",     tier: "elite",     price: 4000  },
  { id: "shadow_lord",   name: "Shadow Lord",     tier: "legendary", price: 10000 },
  { id: "galaxy_drift",  name: "Galaxy Drift",    tier: "legendary", price: 10000 },
  { id: "apex_predator", name: "Apex Predator",   tier: "legendary", price: 10000 },
] as const;

const FRAME_IDS = CHAT_FRAMES.map(f => f.id);

// GET /api/chatframes — list all frames + user's owned/equipped
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("nc ownedChatFrames equippedChatFrame").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      frames: CHAT_FRAMES,
      owned: (user as any).ownedChatFrames || [],
      equipped: (user as any).equippedChatFrame || null,
      nc: user.nc,
    });
  } catch (err: any) {
    req.log.error({ err }, "get chatframes error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/chatframes/buy/:frameId — purchase a frame with NC
router.post("/buy/:frameId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { frameId } = req.params;
    const frameData = CHAT_FRAMES.find(f => f.id === frameId);
    if (!frameData) return res.status(404).json({ message: "Frame not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const owned: string[] = (user as any).ownedChatFrames || [];
    if (owned.includes(frameId)) {
      return res.status(400).json({ message: "You already own this frame" });
    }

    if (user.nc < frameData.price) {
      return res.status(400).json({ message: `Not enough UC — need ${frameData.price} UC` });
    }

    user.nc -= frameData.price;
    (user as any).ownedChatFrames = [...owned, frameId];
    await user.save();

    res.json({
      message: `${frameData.name} frame unlocked!`,
      nc: user.nc,
      owned: (user as any).ownedChatFrames,
    });
  } catch (err: any) {
    req.log.error({ err }, "buy chatframe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/chatframes/equip/:frameId — equip an owned frame (or null to remove)
router.post("/equip/:frameId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { frameId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (frameId === "none") {
      (user as any).equippedChatFrame = null;
      await user.save();
      return res.json({ message: "Frame removed", equipped: null, user: safeUser(user) });
    }

    if (!FRAME_IDS.includes(frameId as any)) {
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
