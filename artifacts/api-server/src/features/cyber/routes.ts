/**
 * Cyber — Wire Cartel Section 8 (cybernetic implants)
 * Install/remove implants that boost stats but increase humanityLoss.
 * Humanity thresholds apply negative effects at 3, 6, 9 implants.
 */
import { Router } from "express";
import User, { applyRegen } from "../../models/User";
import { requireAuth, AuthRequest } from "../../middlewares/auth";

const router = Router();

export const IMPLANT_CATALOG = [
  {
    id: "ocular_hud", name: "Ocular HUD", slot: "optical",
    cost: 5_000, humanityCost: 1, minLevel: 5,
    stats: { intelligence: 3 },
    description: "HUD projected on your retina. +3 INT.",
  },
  {
    id: "street_scanner", name: "Street Scanner Array", slot: "optical",
    cost: 9_000, humanityCost: 1, minLevel: 10,
    stats: { streetCred: 8 },
    description: "360° threat assessment overlay. +8 SC.",
  },
  {
    id: "reflex_wire", name: "Reflex Wire Mesh", slot: "skeletal",
    cost: 8_000, humanityCost: 2, minLevel: 10,
    stats: { strength: 5, streetCred: 3 },
    description: "Sub-dermal reaction accelerators. +5 STR, +3 SC.",
  },
  {
    id: "titanium_bones", name: "Titanium Bone Lace", slot: "skeletal",
    cost: 20_000, humanityCost: 3, minLevel: 25,
    stats: { strength: 15 },
    description: "Full skeletal reinforcement. +15 STR. Heavy.",
  },
  {
    id: "subdermal_armor", name: "Subdermal Armor Plates", slot: "dermal",
    cost: 15_000, humanityCost: 3, minLevel: 20,
    stats: { strength: 8 },
    description: "Ceramic mesh under the skin. +8 STR.",
  },
  {
    id: "vocal_modulator", name: "Vocal Modulator", slot: "dermal",
    cost: 6_000, humanityCost: 1, minLevel: 8,
    stats: { charisma: 6 },
    description: "Voice synthesis built into your larynx. +6 CHA.",
  },
  {
    id: "social_chip", name: "Social Dynamics Chip", slot: "neural",
    cost: 10_000, humanityCost: 2, minLevel: 12,
    stats: { charisma: 10 },
    description: "Reads micro-expressions in real time. +10 CHA.",
  },
  {
    id: "neural_boost", name: "Neural Boost Chip", slot: "neural",
    cost: 12_000, humanityCost: 2, minLevel: 15,
    stats: { intelligence: 8, charisma: 2 },
    description: "Cognitive co-processor wired in. +8 INT, +2 CHA.",
  },
  {
    id: "crypto_cortex", name: "Crypto Cortex Module", slot: "neural",
    cost: 25_000, humanityCost: 3, minLevel: 30,
    stats: { intelligence: 15, streetCred: 5 },
    description: "Decryption co-processor hardwired to optic nerve. +15 INT, +5 SC.",
  },
  {
    id: "cardiac_booster", name: "Cardiac Booster", slot: "cardiac",
    cost: 18_000, humanityCost: 2, minLevel: 18,
    stats: { strength: 5, intelligence: 5 },
    description: "Enhanced circulation and pressure management. +5 STR, +5 INT.",
  },
];

export const HUMANITY_THRESHOLDS = [
  { at: 3, label: "Augmented", effect: "Stress regenerates 5% faster. Your body feels foreign to you." },
  { at: 6, label: "Machine-Adjacent", effect: "Stress regen +10%. Charisma checks lose 5% effectiveness. People notice the tells." },
  { at: 9, label: "Post-Human", effect: "Stress regen +15%. Charisma -10%. 5% chance per action of a glitch auto-fail." },
];

// GET /api/cyber/catalog
router.get("/catalog", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("level humanityLoss implants dc").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const installed = (user.implants ?? []) as any[];
    const installedIds = new Set(installed.map((i: any) => i.id));
    const installedSlots = new Set(
      installed.map((i: any) => {
        const cat = IMPLANT_CATALOG.find(c => c.id === i.id);
        return cat?.slot;
      }).filter(Boolean)
    );

    res.json({
      catalog: IMPLANT_CATALOG.map(imp => ({
        ...imp,
        installed: installedIds.has(imp.id),
        slotTaken: !installedIds.has(imp.id) && installedSlots.has(imp.slot),
        available: user.level >= imp.minLevel,
        canAfford: (user.dc ?? 0) >= imp.cost,
      })),
      installed,
      humanityLoss: user.humanityLoss ?? 0,
      activeThreshold: HUMANITY_THRESHOLDS.filter(t => (user.humanityLoss ?? 0) >= t.at).pop() ?? null,
      thresholds: HUMANITY_THRESHOLDS,
    });
  } catch (err: any) {
    req.log.error({ err }, "cyber catalog error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/cyber/install/:implantId
router.post("/install/:implantId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const implant = IMPLANT_CATALOG.find(i => i.id === req.params.implantId);
    if (!implant) return res.status(404).json({ message: "Implant not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    if (user.level < implant.minLevel)
      return res.status(400).json({ message: `Requires level ${implant.minLevel}` });
    if (user.dc < implant.cost)
      return res.status(400).json({ message: `Costs ${implant.cost.toLocaleString()} DC` });

    const installed = (user.implants ?? []) as any[];

    if (installed.some((i: any) => i.id === implant.id))
      return res.status(400).json({ message: "Already installed" });

    // Slot conflict check
    const slotConflict = installed.find((i: any) => {
      const cat = IMPLANT_CATALOG.find(c => c.id === i.id);
      return cat?.slot === implant.slot;
    });
    if (slotConflict)
      return res.status(400).json({
        message: `${implant.slot} slot occupied by ${slotConflict.name}. Remove it first.`,
      });

    // Deduct cost, apply stats, increase humanity loss
    user.dc -= implant.cost;
    user.humanityLoss = (user.humanityLoss ?? 0) + implant.humanityCost;

    for (const [stat, val] of Object.entries(implant.stats)) {
      if (stat in user) (user as any)[stat] = ((user as any)[stat] ?? 0) + (val as number);
    }

    installed.push({ id: implant.id, name: implant.name, slot: implant.slot, installedAt: new Date() });
    user.implants = installed as any;

    await user.save();

    const newThreshold = HUMANITY_THRESHOLDS.filter(t => user.humanityLoss >= t.at).pop() ?? null;

    res.json({
      message: `${implant.name} installed. Humanity -${implant.humanityCost}.`,
      humanityLoss: user.humanityLoss,
      newThreshold,
      dc: user.dc,
      statsGained: implant.stats,
    });
  } catch (err: any) {
    req.log.error({ err }, "cyber install error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/cyber/remove/:implantId
router.post("/remove/:implantId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const implant = IMPLANT_CATALOG.find(i => i.id === req.params.implantId);
    if (!implant) return res.status(404).json({ message: "Implant not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const installed = (user.implants ?? []) as any[];
    const idx = installed.findIndex((i: any) => i.id === implant.id);
    if (idx < 0) return res.status(400).json({ message: "Implant not installed" });

    const removalCost = Math.floor(implant.cost * 0.3);
    if (user.dc < removalCost)
      return res.status(400).json({ message: `Removal surgery costs ${removalCost.toLocaleString()} DC` });

    user.dc -= removalCost;

    // Remove stat bonuses
    for (const [stat, val] of Object.entries(implant.stats)) {
      if (stat in user) (user as any)[stat] = Math.max(0, ((user as any)[stat] ?? 0) - (val as number));
    }

    // Partial humanity recovery (half, rounded up)
    const recovered = Math.ceil(implant.humanityCost / 2);
    user.humanityLoss = Math.max(0, (user.humanityLoss ?? 0) - recovered);

    installed.splice(idx, 1);
    user.implants = installed as any;

    await user.save();

    res.json({
      message: `${implant.name} removed. +${recovered} humanity recovered. Cost ${removalCost.toLocaleString()} DC.`,
      humanityLoss: user.humanityLoss,
      dc: user.dc,
    });
  } catch (err: any) {
    req.log.error({ err }, "cyber remove error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
