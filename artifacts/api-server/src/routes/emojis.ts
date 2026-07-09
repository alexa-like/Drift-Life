import { Router } from "express";
import GameEmoji, { EMOJI_CATALOG } from "../models/GameEmoji";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /api/emojis — full emoji catalog
router.get("/", requireAuth, async (_req, res) => {
  try {
    const emojis = await GameEmoji.find().lean();
    if (emojis.length === 0) {
      // Fallback to static catalog if DB not seeded yet
      return res.json(EMOJI_CATALOG);
    }
    res.json(emojis.map(e => ({
      slug:        e.slug,
      displayName: e.displayName,
      emoji:       e.emoji,
      theme:       e.theme,
    })));
  } catch {
    // Never crash for emoji lookup — return static catalog
    res.json(EMOJI_CATALOG);
  }
});

export default router;
