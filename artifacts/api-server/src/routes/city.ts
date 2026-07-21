/**
 * City — Wire Cartel Section 5
 * Careers, businesses, housing (properties), banking interest, court system.
 */
import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp } from "../models/User";
import { energySufficientExpr, buildRegenPipeline } from "../lib/atomicRegen";
import { checkMentorLevelBonus } from "../lib/mentorBonus";

const router = Router();

// ── Career ladder ─────────────────────────────────────────────────────────────
const CAREERS = [
  { id: "street_cleaner",   tier: 1, name: "Street Cleaner",      salaryPerShift: 300,   energyCost: 2, statGain: { streetCred: 0.1 }, promotionXp: 200,   minLevel: 1,  description: "Keeps New Vanta slightly less filthy." },
  { id: "courier",          tier: 1, name: "Courier",             salaryPerShift: 500,   energyCost: 2, statGain: { charisma: 0.1 },   promotionXp: 300,   minLevel: 1,  description: "Move parcels and envelopes across the city." },
  { id: "mechanic",         tier: 2, name: "Auto Mechanic",       salaryPerShift: 900,   energyCost: 3, statGain: { strength: 0.15 },  promotionXp: 800,   minLevel: 5,  description: "Fix vehicles legally. Good pay for the grind." },
  { id: "data_entry",       tier: 2, name: "Data Entry Clerk",    salaryPerShift: 700,   energyCost: 2, statGain: { intelligence: 0.15 }, promotionXp: 600, minLevel: 5,  description: "Push data for a corp. Mind-numbing, steady." },
  { id: "security",         tier: 3, name: "Security Guard",      salaryPerShift: 1_500, energyCost: 3, statGain: { strength: 0.2 },   promotionXp: 2_000, minLevel: 10, description: "Corporate security. Uniform. Benefits. No soul." },
  { id: "accountant",       tier: 3, name: "Accountant",          salaryPerShift: 2_000, energyCost: 2, statGain: { intelligence: 0.2 }, promotionXp: 2_500, minLevel: 10, description: "Cook the books — legally." },
  { id: "corporate_lawyer", tier: 4, name: "Corporate Lawyer",    salaryPerShift: 5_000, energyCost: 4, statGain: { charisma: 0.3 },   promotionXp: 8_000, minLevel: 25, description: "The law is a tool. You are the craftsman." },
  { id: "engineer",         tier: 4, name: "Systems Engineer",    salaryPerShift: 6_000, energyCost: 4, statGain: { intelligence: 0.3 }, promotionXp: 10_000, minLevel: 25, description: "Build the infrastructure corps run on." },
  { id: "exec",             tier: 5, name: "Corporate Executive",  salaryPerShift: 15_000, energyCost: 5, statGain: { charisma: 0.5 },  promotionXp: 50_000, minLevel: 40, description: "Corner office. Expense account. Soul: optional." },
];

// ── GET /api/city/careers — list careers ────────────────────────────────────
router.get("/careers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("level").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(CAREERS.map(c => ({ ...c, available: user.level >= c.minLevel })));
  } catch (err: any) {
    req.log.error({ err }, "get careers error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/city/careers/:careerId/work — work a career shift ─────────────
router.post("/careers/:careerId/work", requireAuth, async (req: AuthRequest, res) => {
  try {
    const career = CAREERS.find(c => c.id === req.params.careerId);
    if (!career) return res.status(404).json({ message: "Career not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);

    if (isHospitalized(user)) return res.status(400).json({ message: "You are hospitalized" });
    if (isJailed(user)) return res.status(400).json({ message: "You are in jail" });
    if (user.level < career.minLevel) return res.status(400).json({ message: `Requires level ${career.minLevel}` });
    if (user.energy < career.energyCost) return res.status(400).json({ message: `Need ${career.energyCost} energy` });

    // Atomically deduct energy
    const gated = await User.findOneAndUpdate(
      { _id: req.userId, ...energySufficientExpr(career.energyCost) },
      buildRegenPipeline({ energyCost: career.energyCost }),
      { returnDocument: 'after', updatePipeline: true },
    );
    if (!gated) return res.status(400).json({ message: `Not enough energy (need ${career.energyCost})` });

    // Salary is always clean DC (careers are legal)
    gated.dc = Math.min(100_000_000, gated.dc + career.salaryPerShift);
    gated.xp += Math.floor(career.salaryPerShift / 10);

    // Stat gain
    for (const [stat, gain] of Object.entries(career.statGain)) {
      (gated as any)[stat] = parseFloat(((gated as any)[stat] + gain).toFixed(3));
    }

    // Stress rises with long work shifts
    gated.stress = Math.min(100, gated.stress + 2);
    gated.mood = Math.max(0, 100 - gated.stress);

    // Onboarding: having a job advances stage
    if (gated.onboardingStage === 2) gated.onboardingStage = 3;

    const leveled = levelUp(gated);
    await gated.save();
    if (leveled) {
      checkMentorLevelBonus(String(req.userId), (gated.level ?? 1) - 1, gated.level ?? 1).catch(() => {});
    }

    res.json({
      salary: career.salaryPerShift, statGain: career.statGain, energy: gated.energy,
      dc: gated.dc, xp: gated.xp, stress: gated.stress, leveled,
      newLevel: leveled ? gated.level : undefined,
    });
  } catch (err: any) {
    req.log.error({ err }, "career work error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/city/court — check if player is awaiting trial ─────────────────
router.get("/court", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("jailUntil jailDuration dc intelligence charisma").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.jailUntil || user.jailUntil <= new Date()) {
      return res.json({ inJail: false });
    }
    const remainingMs = user.jailUntil.getTime() - Date.now();
    // Fight chance = 20% + intelligence/10 * 2%
    const fightChance = Math.min(0.60, 0.20 + (user.intelligence / 10) * 0.02);
    // Plead: 50% sentence reduction, guaranteed
    const guiltyDuration = Math.floor(remainingMs * 0.50);
    res.json({
      inJail: true, jailUntil: user.jailUntil, remainingMs,
      options: {
        plead: { reduction: 0.50, newDuration: guiltyDuration, description: "Plead guilty — guaranteed 50% sentence reduction." },
        fight: { chance: fightChance, fullDismissal: true, failPenalty: "sentence increased by 50%", description: "Fight the charges — chance of full dismissal." },
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "court error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/city/court/plead — plead guilty ───────────────────────────────
router.post("/court/plead", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.jailUntil || user.jailUntil <= new Date()) return res.status(400).json({ message: "Not in jail" });
    const newRelease = new Date(Date.now() + (user.jailUntil.getTime() - Date.now()) * 0.50);
    user.jailUntil = newRelease;
    await user.save();
    res.json({ message: "Guilty plea accepted. Sentence halved.", jailUntil: user.jailUntil });
  } catch (err: any) {
    req.log.error({ err }, "plead error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/city/court/fight — fight the charges ──────────────────────────
router.post("/court/fight", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.jailUntil || user.jailUntil <= new Date()) return res.status(400).json({ message: "Not in jail" });
    const fightChance = Math.min(0.60, 0.20 + (user.intelligence / 10) * 0.02);
    if (Math.random() < fightChance) {
      user.jailUntil = null; user.jailDuration = 0;
      await user.save();
      return res.json({ success: true, message: "Charges dismissed! You walk free." });
    } else {
      user.jailUntil = new Date(user.jailUntil.getTime() * 1.5);
      await user.save();
      return res.json({ success: false, message: "Judge wasn't buying it. Sentence extended by 50%.", jailUntil: user.jailUntil });
    }
  } catch (err: any) {
    req.log.error({ err }, "fight charges error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
