import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

export const SKILL_CATALOG = {
  hustler: {
    name: "The Hustler",
    theme: "Economy",
    nodes: [
      { id: "fast_hands",       name: "Fast Hands",       effect: "Job DC rewards +10%",           cost: 1, apex: false },
      { id: "market_shark",     name: "Market Shark",     effect: "Market fees -1%",               cost: 1, apex: false },
      { id: "business_empire",  name: "Business Empire",  effect: "Property income +20%",          cost: 2, apex: false },
      { id: "dc_magnet",        name: "DC Magnet",        effect: "All DC gains +10%",             cost: 2, apex: false },
      { id: "the_mogul",        name: "The Mogul",        effect: "Can own any property type",     cost: 3, apex: true  },
    ],
  },
  fighter: {
    name: "The Fighter",
    theme: "Combat",
    nodes: [
      { id: "iron_fist",        name: "Iron Fist",        effect: "Attack power +10%",             cost: 1, apex: false },
      { id: "thick_skin",       name: "Thick Skin",       effect: "Defense +10%",                  cost: 1, apex: false },
      { id: "street_brawler",   name: "Street Brawler",   effect: "Arena win grants +50 bonus DC", cost: 2, apex: false },
      { id: "relentless",       name: "Relentless",       effect: "Adrenaline regen +1 per 30 min", cost: 2, apex: false },
      { id: "the_undisputed",   name: "The Undisputed",   effect: "5% one-hit KO chance in Arena", cost: 3, apex: true  },
    ],
  },
  ghost: {
    name: "The Ghost",
    theme: "Stealth",
    nodes: [
      { id: "light_feet",       name: "Light Feet",       effect: "Crime detection chance -10%",   cost: 1, apex: false },
      { id: "inside_man",       name: "Inside Man",       effect: "Crime DC rewards +15%",         cost: 1, apex: false },
      { id: "clean_hands",      name: "Clean Hands",      effect: "VANTA flags clear 2x faster",   cost: 2, apex: false },
      { id: "shadow",           name: "Shadow",           effect: "Wanted level decays 2x faster", cost: 2, apex: false },
      { id: "the_phantom",      name: "The Phantom",      effect: "1 free crime escape per day",   cost: 3, apex: true  },
    ],
  },
  connector: {
    name: "The Connector",
    theme: "Social",
    nodes: [
      { id: "silver_tongue",    name: "Silver Tongue",    effect: "Trade value +10%",              cost: 1, apex: false },
      { id: "network",          name: "Network",          effect: "Guild XP sharing +50%",         cost: 1, apex: false },
      { id: "reputation",       name: "Reputation",       effect: "Referral rewards +25%",         cost: 2, apex: false },
      { id: "city_voice",       name: "City Voice",       effect: "Feed posts get 2x engagement",  cost: 2, apex: false },
      { id: "the_mayor",        name: "The Mayor",        effect: "Ability to start city-wide votes", cost: 3, apex: true },
    ],
  },
} as const;

type TreeKey = keyof typeof SKILL_CATALOG;
const ALL_TREE_KEYS = Object.keys(SKILL_CATALOG) as TreeKey[];

function getNodeById(nodeId: string): { treeKey: TreeKey; node: (typeof SKILL_CATALOG)[TreeKey]["nodes"][number] } | null {
  for (const treeKey of ALL_TREE_KEYS) {
    const node = SKILL_CATALOG[treeKey].nodes.find((n) => n.id === nodeId);
    if (node) return { treeKey, node };
  }
  return null;
}

// GET /api/skills
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("level skillPoints unlockedSkills skillTree secondarySkill");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      skillPoints: user.skillPoints,
      skillTree: user.skillTree,
      secondarySkill: user.secondarySkill,
      unlockedSkills: user.unlockedSkills,
      catalog: SKILL_CATALOG,
      canSelectPrimary: user.level >= 10 && !user.skillTree,
      canSelectSecondary: user.level >= 50 && user.skillTree && !user.secondarySkill,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/skills/tree  — choose primary skill tree
router.post("/tree", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { tree } = req.body as { tree: string };
    if (!ALL_TREE_KEYS.includes(tree as TreeKey)) return res.status(400).json({ message: "Invalid tree" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.level < 10) return res.status(400).json({ message: "Requires level 10 to choose a skill tree" });
    if (user.skillTree) return res.status(400).json({ message: "Primary skill tree already chosen" });

    user.skillTree = tree;
    await user.save();

    res.json({ message: `Primary tree set to ${SKILL_CATALOG[tree as TreeKey].name}`, skillTree: tree });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/skills/secondary  — choose secondary skill tree
router.post("/secondary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { tree } = req.body as { tree: string };
    if (!ALL_TREE_KEYS.includes(tree as TreeKey)) return res.status(400).json({ message: "Invalid tree" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.level < 50) return res.status(400).json({ message: "Requires level 50 to choose a secondary tree" });
    if (!user.skillTree) return res.status(400).json({ message: "Choose a primary tree first" });
    if (user.skillTree === tree) return res.status(400).json({ message: "Secondary must differ from primary tree" });
    if (user.secondarySkill) return res.status(400).json({ message: "Secondary tree already chosen" });

    user.secondarySkill = tree;
    await user.save();

    res.json({ message: `Secondary tree set to ${SKILL_CATALOG[tree as TreeKey].name}`, secondarySkill: tree });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/skills/unlock  — spend a skill point on a node
router.post("/unlock", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { nodeId } = req.body as { nodeId: string };
    const found = getNodeById(nodeId);
    if (!found) return res.status(400).json({ message: "Unknown skill node" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { treeKey, node } = found;

    if (user.skillTree !== treeKey && user.secondarySkill !== treeKey) {
      return res.status(400).json({ message: "You have not chosen this skill tree" });
    }
    if (user.unlockedSkills.includes(nodeId)) {
      return res.status(400).json({ message: "Node already unlocked" });
    }
    if (user.skillPoints < node.cost) {
      return res.status(400).json({ message: `Requires ${node.cost} skill point(s) — you have ${user.skillPoints}` });
    }

    user.skillPoints -= node.cost;
    user.unlockedSkills.push(nodeId);
    await user.save();

    res.json({ message: `Unlocked: ${node.name}`, unlockedSkills: user.unlockedSkills, skillPoints: user.skillPoints });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
