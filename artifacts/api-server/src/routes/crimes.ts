/**
 * Street / Runs — Wire Cartel Section 2
 * 5-tier car-crime/cyber-crime/street-crime Runs.
 * All resolution is server-authoritative. Heat rises with activity, mastery improves success.
 */
import { Router } from "express";
import User from "../models/User";
// In-memory hourly run counter
const _runCounters = new Map<string, { count: number; resetAt: number }>();
function _getCrimeRuns(userId: string): number {
  const e = _runCounters.get(userId);
  return (!e || Date.now() > e.resetAt) ? 0 : e.count;
}
function _incrementCrimeRuns(userId: string): void {
  const e = _runCounters.get(userId);
  if (!e || Date.now() > e.resetAt) {
    _runCounters.set(userId, { count: 1, resetAt: Date.now() + 3_600_000 });
  } else { e.count += 1; }
}
import ActionMastery, { masteryGain } from "../models/ActionMastery";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp, stressPenalty } from "../models/User";
import { checkAchievements } from "./achievements";
import { energySufficientExpr, buildRegenPipeline } from "../lib/atomicRegen";
import { getWorldState, worldRunModifiers } from "../models/WorldState";
import { validateBody } from "../middlewares/validate";
import { pursuitResolveSchema, crimesLaunderSchema } from "../lib/schemas";

const router = Router();

// ── Run catalog ─────────────────────────────────────────────────────────────
// tier: 1-5; relevantStat drives formula; heatGain = tier * 4
const RUNS = [
  // ── Tier 1 — Low heat, low mastery ──────────────────────────────────────
  {
    id: "joyriding",          name: "Joyriding",              tier: 1, energyCost: 2, minLevel: 1,
    baseSuccess: 0.72, dcMin: 80,    dcMax: 400,   xp: 12,  dirtyRatio: 1.0,
    relevantStat: "streetCred" as const,
    flavour: "You hotwired a delivery drone and took it for a spin. Returned it. Kind of.",
    description: "Steal a vehicle for kicks. Low heat, decent practice.",
    riskLevel: "low", wantedIncrease: 1, hospitalRisk: 0.05,
  },
  {
    id: "meter_scam",         name: "Parking-Meter Scam",     tier: 1, energyCost: 1, minLevel: 1,
    baseSuccess: 0.80, dcMin: 50,    dcMax: 200,   xp: 8,   dirtyRatio: 1.0,
    relevantStat: "charisma" as const,
    flavour: "Reprogrammed six parking meters to feed you instead. Classic.",
    description: "Scam autonomous parking meters with a signal spoofer.",
    riskLevel: "low", wantedIncrease: 0, hospitalRisk: 0.02,
  },
  {
    id: "small_fencing",      name: "Small-Time Fencing",     tier: 1, energyCost: 2, minLevel: 1,
    baseSuccess: 0.70, dcMin: 100,   dcMax: 500,   xp: 15,  dirtyRatio: 1.0,
    relevantStat: "charisma" as const,
    flavour: "Moved stolen goods through the back of a noodle stand. The noodles were good.",
    description: "Fence stolen goods through underground markets.",
    riskLevel: "low", wantedIncrease: 1, hospitalRisk: 0.05,
  },
  // ── Tier 2 — Building heat ──────────────────────────────────────────────
  {
    id: "chop_strip",         name: "Chop-Shop Stripping",    tier: 2, energyCost: 3, minLevel: 8,
    baseSuccess: 0.58, dcMin: 300,   dcMax: 1_200, xp: 40,  dirtyRatio: 1.0,
    relevantStat: "strength" as const,
    flavour: "Stripped a luxury sedan to components in under 9 minutes. New personal best.",
    description: "Break down stolen vehicles into sellable parts.",
    riskLevel: "medium", wantedIncrease: 2, hospitalRisk: 0.12,
  },
  {
    id: "street_tax",         name: "Street Tax Collection",  tier: 2, energyCost: 3, minLevel: 10,
    baseSuccess: 0.55, dcMin: 400,   dcMax: 1_500, xp: 50,  dirtyRatio: 1.0,
    relevantStat: "strength" as const,
    flavour: "The shopkeeper paid without making eye contact. Smart.",
    description: "Collect protection fees from businesses in your district.",
    riskLevel: "medium", wantedIncrease: 2, hospitalRisk: 0.15,
  },
  {
    id: "pickpocket_distract", name: "Pickpocket-by-Distraction", tier: 2, energyCost: 2, minLevel: 5,
    baseSuccess: 0.62, dcMin: 200,   dcMax: 900,   xp: 30,  dirtyRatio: 1.0,
    relevantStat: "charisma" as const,
    flavour: "Your 'lost dog' routine cleared three wallets in thirty seconds.",
    description: "Social engineering + sleight of hand. Work crowds.",
    riskLevel: "medium", wantedIncrease: 1, hospitalRisk: 0.08,
  },
  // ── Tier 3 — Serious heat ────────────────────────────────────────────────
  {
    id: "armed_carjacking",   name: "Armed Carjacking",       tier: 3, energyCost: 4, minLevel: 15,
    baseSuccess: 0.45, dcMin: 800,   dcMax: 3_500, xp: 100, dirtyRatio: 1.0,
    relevantStat: "strength" as const,
    flavour: "The auto-drive tried to lock you out. You were faster.",
    description: "Force a driver out of a moving vehicle. High risk, high reward.",
    riskLevel: "high", wantedIncrease: 3, hospitalRisk: 0.25,
  },
  {
    id: "warehouse_run",      name: "Warehouse Smuggling Run", tier: 3, energyCost: 5, minLevel: 20,
    baseSuccess: 0.42, dcMin: 1_200, dcMax: 5_000, xp: 130, dirtyRatio: 1.0,
    relevantStat: "streetCred" as const,
    flavour: "Seven checkpoints. Six bribes. One very profitable night.",
    description: "Move contraband through New Vanta's industrial checkpoints.",
    riskLevel: "high", wantedIncrease: 3, hospitalRisk: 0.28,
  },
  {
    id: "race_fraud",         name: "Race-Bet Fraud",         tier: 3, energyCost: 3, minLevel: 18,
    baseSuccess: 0.50, dcMin: 900,   dcMax: 4_000, xp: 110, dirtyRatio: 1.0,
    relevantStat: "intelligence" as const,
    flavour: "You fixed three races before anyone noticed the pattern. Almost.",
    description: "Manipulate underground race betting pools. Needs smarts.",
    riskLevel: "high", wantedIncrease: 2, hospitalRisk: 0.15,
  },
  // ── Tier 4 — Extreme heat ────────────────────────────────────────────────
  {
    id: "bank_truck_heist",   name: "Bank Truck Heist",       tier: 4, energyCost: 6, minLevel: 30,
    baseSuccess: 0.30, dcMin: 5_000, dcMax: 20_000, xp: 350, dirtyRatio: 1.0,
    relevantStat: "strength" as const,
    flavour: "The armoured truck never saw you coming. The cameras did. Not your problem.",
    description: "Intercept a corp bank transport. Goes loud.",
    riskLevel: "extreme", wantedIncrease: 4, hospitalRisk: 0.40,
  },
  {
    id: "datacenter_breach",  name: "Data-Centre Break-In",   tier: 4, energyCost: 6, minLevel: 35,
    baseSuccess: 0.28, dcMin: 6_000, dcMax: 25_000, xp: 400, dirtyRatio: 1.0,
    relevantStat: "intelligence" as const,
    flavour: "You were inside their system for 4.2 seconds. Long enough.",
    description: "Physical + cyber intrusion on a tier-3 data centre.",
    riskLevel: "extreme", wantedIncrease: 4, hospitalRisk: 0.35,
  },
  {
    id: "cartel_supply_run",  name: "Cartel Supply Run",      tier: 4, energyCost: 7, minLevel: 40,
    baseSuccess: 0.25, dcMin: 8_000, dcMax: 35_000, xp: 500, dirtyRatio: 1.0,
    relevantStat: "streetCred" as const,
    flavour: "You moved twelve crates across four district borders. Clean.",
    description: "Run supply for the cartel. Don't ask what's in the crates.",
    riskLevel: "extreme", wantedIncrease: 5, hospitalRisk: 0.45,
  },
  // ── Tier 5 — Legacy solo heists (keep for backward compat) ───────────────
  {
    id: "vault_crack",        name: "Vault Crack",            tier: 5, energyCost: 8, minLevel: 50,
    baseSuccess: 0.20, dcMin: 20_000, dcMax: 80_000, xp: 1_000, dirtyRatio: 1.0,
    relevantStat: "intelligence" as const,
    flavour: "Fourteen layers of encryption. You peeled them like onion skin. Legendary.",
    description: "Crack a maximum-security vault in Downtown Core.",
    riskLevel: "extreme", wantedIncrease: 5, hospitalRisk: 0.60,
  },
];

// Keep backward-compat IDs mapping
const LEGACY_IDS: Record<string, string> = {
  pickpocket: "pickpocket_distract", break_in: "chop_strip", vehicle_theft: "armed_carjacking",
  scam_operation: "meter_scam", smuggling_run: "warehouse_run", heist_solo: "bank_truck_heist",
  data_breach: "datacenter_breach", corporate_espionage: "cartel_supply_run",
  assassination_contract: "cartel_supply_run",
};

function findRun(id: string) {
  return RUNS.find(r => r.id === id) ?? RUNS.find(r => r.id === LEGACY_IDS[id]);
}

// ── GET /api/crimes — list all runs ────────────────────────────────────────
router.get("/", requireAuth, (_req, res) => {
  res.json(RUNS.map(r => ({
    id: r.id, name: r.name, tier: r.tier, flavour: r.flavour, energyCost: r.energyCost,
    minLevel: r.minLevel, baseSuccess: r.baseSuccess, dcRange: [r.dcMin, r.dcMax],
    xp: r.xp, heatGain: r.tier * 4, wantedIncrease: r.wantedIncrease,
    hospitalRisk: r.hospitalRisk, description: r.description, riskLevel: r.riskLevel,
    relevantStat: r.relevantStat,
    // legacy fields for old UI
    nerveCost: r.energyCost,
  })));
});

// ── GET /api/crimes/mastery — player's mastery per run ─────────────────────
router.get("/mastery", requireAuth, async (req: AuthRequest, res) => {
  try {
    const records = await ActionMastery.find({ userId: req.userId, actionType: "run" }).lean();
    const map: Record<string, number> = {};
    for (const r of records) map[r.actionId] = r.mastery;
    res.json(map);
  } catch (err: any) {
    req.log.error({ err }, "get mastery error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/crimes/jail-list — public jail list ────────────────────────────
router.get("/jail-list", requireAuth, async (_req, res) => {
  try {
    const now = new Date();
    const jailed = await User.find({ jailUntil: { $gt: now } })
      .select("username level tag jailUntil jailDuration dc")
      .limit(50).lean();
    res.json(jailed.map(u => ({
      id: u._id, username: u.username, level: u.level, tag: u.tag,
      jailUntil: u.jailUntil, jailDuration: u.jailDuration,
      bailCost: Math.floor(((u.jailDuration ?? 0) / 60000) * 1_000 * 1.5),
    })));
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/crimes/:runId/commit ─────────────────────────────────────────
router.post("/:runId/commit", requireAuth, async (req: AuthRequest, res) => {
  const RUNS_PER_HOUR_CAP = 30; // anti-abuse rate limit
  try {
    const run = findRun(String(req.params.runId));
    if (!run) return res.status(404).json({ message: "Run not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    if (isHospitalized(user)) return res.status(400).json({ message: "You are hospitalized" });
    if (isJailed(user)) return res.status(400).json({ message: "You are in jail" });
    if (user.level < run.minLevel) return res.status(400).json({ message: `Requires level ${run.minLevel}` });
    if (user.energy < run.energyCost) return res.status(400).json({ message: `Not enough energy (need ${run.energyCost})` });

    // Anti-abuse: rate-limit runs per hour via in-memory counter
    if (_getCrimeRuns(String(req.userId)) >= RUNS_PER_HOUR_CAP) {
      return res.status(429).json({ message: "Run rate limit reached. Take a break." });
    }

    // Pursuit gate: if heat >= 80, a pursuit minigame is pending
    if (user.heat >= 80 && !user.pursuiteActive) {
      user.pursuiteActive = true;
      await user.save();
      return res.status(402).json({
        pursuitRequired: true,
        message: "HEAT CRITICAL — a pursuit event must be resolved before your next run.",
        heat: user.heat,
      });
    }

    // Atomically deduct energy
    const gated = await User.findOneAndUpdate(
      { _id: req.userId, ...energySufficientExpr(run.energyCost) },
      buildRegenPipeline({
        energyCost: run.energyCost,
        extraSet: { totalCrimes: { $add: ["$totalCrimes", 1] } },
      }),
      { new: true },
    );
    if (!gated) return res.status(400).json({ message: `Not enough energy (need ${run.energyCost})` });

    // Get or create mastery record
    let masteryDoc = await ActionMastery.findOne({ userId: req.userId, actionId: run.id, actionType: "run" });
    if (!masteryDoc) {
      masteryDoc = new ActionMastery({ userId: req.userId, actionId: run.id, actionType: "run" });
    }
    const currentMastery = masteryDoc.mastery;

    // World state modifiers
    const world = await getWorldState().catch(() => null);
    const worldMods = world ? worldRunModifiers(world) : { payoutMult: 1, heatGainMult: 1 };

    // Success formula (Section 2):
    // success_chance = base_chance[tier] + (mastery_score*0.4) + (relevant_stat/10) - (stress*0.1)
    const statValue = (gated as any)[run.relevantStat] ?? 0;
    const stressPen = stressPenalty(gated);
    const rawSuccess = run.baseSuccess
      + (currentMastery * 0.004)   // mastery up to +0.4 at 100
      + (statValue / 100)          // stat contributes up to ~+0.5 at 50 stat
      - stressPen;
    const successChance = Math.min(0.95, Math.max(0.05, rawSuccess));
    const success = Math.random() < successChance;

    // Update mastery (gain diminishes above 50)
    const gain = masteryGain(currentMastery);
    masteryDoc.mastery = Math.min(100, masteryDoc.mastery + gain);
    masteryDoc.attempts += 1;
    masteryDoc.lastAttemptAt = new Date();
    if (success) masteryDoc.successes += 1;
    await masteryDoc.save();

    // Heat gain = tier * 4 * worldMod
    const heatGain = Math.round(run.tier * 4 * worldMods.heatGainMult);

    let dcGained = 0, xpGained = 0, hospitalized = false, jailed = false, leveled = false;
    let narrative = "";
    let jailUntil: Date | null = null;
    let jailDuration = 0;

    if (success) {
      dcGained = Math.round(
        (run.dcMin + Math.random() * (run.dcMax - run.dcMin)) * worldMods.payoutMult
      );
      const isFirstToday = !gated.lastCrimeDate || gated.lastCrimeDate.toDateString() !== new Date().toDateString();
      xpGained = run.xp * (isFirstToday ? 2 : 1);
      gated.dirtyDc += dcGained;
      gated.successfulCrimes += 1;
      gated.heat = Math.min(100, gated.heat + heatGain);
      gated.heatDecayAt = new Date();
      gated.wantedLevel = Math.min(5, gated.wantedLevel + run.wantedIncrease);
      gated.wantedDecayAt = new Date();
      // Onboarding: first run unlocks stage 1
      if (gated.onboardingStage === 0 && gated.successfulCrimes >= 2) {
        gated.onboardingStage = 1;
      }
      narrative = run.flavour;
    } else {
      // Failure severity bucket (Section 2)
      const roll = Math.random();
      if (roll < 0.60) {
        // Minor fail — no heat, no cash
        narrative = "Aborted at the last second. No gains, no heat. Your heart's still racing.";
        gated.stress = Math.min(100, gated.stress + 5);
      } else if (roll < 0.90) {
        // Bad fail — heat spike + fine
        const fine = Math.floor(run.dcMin * 0.3);
        gated.dirtyDc = Math.max(0, gated.dirtyDc - fine);
        gated.heat = Math.min(100, gated.heat + heatGain * 2);
        gated.wantedLevel = Math.min(5, gated.wantedLevel + run.wantedIncrease);
        narrative = `Sloppy execution. Lost ${fine} DC and things got hot.`;
        gated.stress = Math.min(100, gated.stress + 5);
      } else {
        // Severe fail — jail or hospital
        if (Math.random() < run.hospitalRisk) {
          const duration = (10 + run.tier * 10) * 60 * 1000;
          gated.hospitalizedUntil = new Date(Date.now() + duration);
          hospitalized = true;
          narrative = "Security caught you clean. You woke up in New Vanta General.";
          gated.stress = Math.min(100, gated.stress + 10);
        } else {
          // Wanted level scales jail time: each wanted star adds 30% more time
          const wantedMult = 1 + (gated.wantedLevel ?? 0) * 0.3;
          jailDuration = Math.floor((10 + run.tier * 10) * 60 * 1000 * wantedMult);
          jailUntil = new Date(Date.now() + jailDuration);
          gated.jailUntil = jailUntil;
          gated.jailDuration = jailDuration;
          jailed = true;
          gated.heat = 0;
          gated.heatDecayAt = new Date();
          const wantedStr = gated.wantedLevel >= 4 ? " MOST WANTED — extended sentence." : gated.wantedLevel >= 2 ? " Prior record noted — sentence extended." : "";
          narrative = `Cuffs on. You're in a holding cell.${wantedStr} Bail's open.`;
          gated.stress = Math.min(100, gated.stress + 10);
        }
      }
    }

    // Mood update (inversely proportional to stress)
    gated.mood = Math.max(0, 100 - gated.stress);
    gated.lastCrimeDate = new Date();
    await gated.save();

    // Apply DC + XP + season points atomically
    const crimeSeasonPts = success ? Math.max(1, Math.floor(xpGained / 10)) : 0;
    let rewarded = gated;
    if (dcGained > 0 || xpGained > 0) {
      const r = await User.findByIdAndUpdate(
        gated._id,
        [{ $set: {
          dc:           { $min: [{ $add: ["$dc",           dcGained] },       100_000_000] },
          xp:           { $add: ["$xp",           xpGained] },
          seasonPoints: { $add: ["$seasonPoints", crimeSeasonPts] },
        } }],
        { new: true },
      );
      if (r) {
        rewarded = r;
        leveled = levelUp(rewarded);
        if (leveled) await rewarded.save();
      }
    }

    checkAchievements(String(req.userId)).catch(() => {});
    _incrementCrimeRuns(String(req.userId)); // track hourly rate limit

    res.json({
      success, narrative, dcGained, dirtyDcGained: dcGained, xpGained,
      hospitalized, jailed, jailUntil, leveled,
      newLevel: leveled ? rewarded.level : undefined,
      heatGained: success ? heatGain : 0,
      mastery: masteryDoc.mastery,
      pursuitWarning: rewarded.heat >= 70 && rewarded.heat < 80,
      user: {
        dc: rewarded.dc, energy: rewarded.energy, maxEnergy: rewarded.maxEnergy,
        heat: rewarded.heat, stress: rewarded.stress, xp: rewarded.xp,
        xpToNext: rewarded.xpToNext, level: rewarded.level, wantedLevel: rewarded.wantedLevel,
        hospitalizedUntil: rewarded.hospitalizedUntil, jailUntil: rewarded.jailUntil,
        dirtyDc: rewarded.dirtyDc,
        // legacy nerve field for UI compat
        nerve: rewarded.nerve, maxNerve: rewarded.maxNerve,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "commit run error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/crimes/pursuit/resolve — resolve pursuit event ───────────────
router.post("/pursuit/resolve", requireAuth, validateBody(pursuitResolveSchema), async (req: AuthRequest, res) => {
  try {
    const { outcome } = req.body as { outcome: "bribe" | "outrun" | "busted" };

    // Atomically flip pursuiteActive true -> false. This is the server's record that
    // a pursuit was actually offered; if two requests race (or the pursuit was already
    // resolved), only one can win this update — the loser is rejected instead of both
    // being allowed to apply conflicting outcomes to the same pursuit event.
    const claimed = await User.findOneAndUpdate(
      { _id: req.userId, pursuiteActive: true },
      { $set: { pursuiteActive: false } },
      { new: false },
    );
    if (!claimed) return res.status(400).json({ message: "No active pursuit" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    let message = "";
    if (outcome === "bribe") {
      const bribeCost = Math.floor(user.heat * 500);
      if (user.dc < bribeCost) return res.status(400).json({ message: `Bribe costs ${bribeCost} DC`, bribeCost });
      user.dc -= bribeCost;
      user.heat = 40;
      message = `Slipped Chief Ralston ${bribeCost.toLocaleString()} DC. Heat reset to 40.`;
    } else if (outcome === "outrun") {
      // Skill check: car speed + handling (stub until garage built)
      // Use active car power+handling to compute outrun bonus (0 to 0.40)
      let carBonus = 0;
      if (user.activeCar) {
        try {
          const Car = (await import("../models/Car")).default;
          const activeCar = await Car.findById(user.activeCar).select("power handling").lean();
          if (activeCar) {
            carBonus = Math.min(0.40, ((activeCar as any).power + (activeCar as any).handling) / 500);
          }
        } catch { /* ignore — fallback to 0 */ }
      }
      const successChance = 0.40 + carBonus;
      if (Math.random() < successChance) {
        user.heat = 20;
        message = "You burned them at the lights. Heat reset to 20.";
      } else {
        // Failed outrun → busted
        const dur = 30 * 60 * 1000;
        user.jailUntil = new Date(Date.now() + dur);
        user.jailDuration = dur;
        user.heat = 0;
        message = "Boxed in. Busted. 30 minutes in holding.";
      }
    } else {
      // Busted
      const dur = 20 * 60 * 1000;
      user.jailUntil = new Date(Date.now() + dur);
      user.jailDuration = dur;
      user.heat = 0;
      message = "Hands on the hood. Heat reset to 0. 20 minutes in jail.";
    }

    await user.save();
    res.json({ message, heat: user.heat, jailUntil: user.jailUntil, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "pursuit resolve error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/crimes/bail/:targetId — bail out another player ─────────────
router.post("/bail/:targetId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const payer = await User.findById(req.userId);
    const target = await User.findById(req.params.targetId);
    if (!payer || !target) return res.status(404).json({ message: "User not found" });
    if (!isJailed(target)) return res.status(400).json({ message: "That player is not in jail" });
    if (target._id.equals(payer._id)) return res.status(400).json({ message: "Can't bail yourself out here" });

    const remainingMs = target.jailUntil!.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    const bailCost = Math.floor(remainingMin * 1_000 * 1.5);

    if (payer.dc < bailCost) return res.status(400).json({ message: `Bail costs ${bailCost.toLocaleString()} DC`, bailCost });

    payer.dc -= bailCost;
    payer.reputation += 5;
    target.jailUntil = null;
    target.jailDuration = 0;

    await Promise.all([payer.save(), target.save()]);
    res.json({ message: `You bailed out ${target.username} for ${bailCost.toLocaleString()} DC.`, bailCost, reputation: payer.reputation });
  } catch (err: any) {
    req.log.error({ err }, "bail error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/crimes/escape — attempt jail break ──────────────────────────
router.post("/escape", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!isJailed(user)) return res.status(400).json({ message: "You are not in jail" });

    // One escape attempt per jail stay (tracked via a flag we clear on bail/release)
    // escape_chance = 20% + streetCred/20
    const escapeChance = 0.20 + (user.streetCred / 20) * 0.01;
    if (Math.random() < escapeChance) {
      user.jailUntil = null;
      user.jailDuration = 0;
      await user.save();
      return res.json({ success: true, message: "You slipped through a ventilation shaft. Free." });
    } else {
      // Add 10 more minutes
      user.jailUntil = new Date(user.jailUntil!.getTime() + 10 * 60 * 1000);
      await user.save();
      return res.json({ success: false, message: "Guard spotted you. 10 more minutes added.", jailUntil: user.jailUntil });
    }
  } catch (err: any) {
    req.log.error({ err }, "escape error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/crimes/bribe — clear wanted/heat ────────────────────────────
router.post("/bribe", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);
    if (user.wantedLevel === 0 && user.heat < 20) return res.status(400).json({ message: "No wanted level to clear" });
    const cost = Math.pow(user.wantedLevel, 2) * 1_000 + Math.floor(user.heat * 200);

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: cost } },
      { $inc: { dc: -cost }, $set: { wantedLevel: 0, wantedDecayAt: new Date(), heat: Math.max(0, user.heat - 30) } },
      { new: true },
    );
    if (!updated) return res.status(400).json({ message: "Insufficient DC for bribe", cost });
    res.json({ message: `Bribed. Cost ${cost.toLocaleString()} DC. Heat and wanted level reduced.`, cost, dc: updated.dc, wantedLevel: 0, heat: updated.heat });
  } catch (err: any) {
    req.log.error({ err }, "bribe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/crimes/launder — dirty DC → clean DC via business ───────────
router.post("/launder", requireAuth, validateBody(crimesLaunderSchema), async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };

    const user = await User.findById(req.userId).populate("businesses");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.dirtyDc < amount) return res.status(400).json({ message: "Not enough dirty DC" });

    const businesses = (user.businesses as any[]) || [];
    if (businesses.length === 0) return res.status(400).json({ message: "You need a business to launder money through" });

    // Use best launder rate across owned businesses
    const bestRate = Math.min(...businesses.map((b: any) => b.launderRate ?? 0.30));
    const cleanAmount = Math.floor(amount * (1 - bestRate));
    const lost = amount - cleanAmount;

    user.dirtyDc -= amount;
    user.dc = Math.min(100_000_000, user.dc + cleanAmount);
    await user.save();

    res.json({ message: `Laundered ${amount.toLocaleString()} dirty DC → ${cleanAmount.toLocaleString()} clean DC (lost ${lost.toLocaleString()} DC).`, cleanAmount, lost, dirtyDc: user.dirtyDc, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "launder error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export { RUNS };
export default router;
