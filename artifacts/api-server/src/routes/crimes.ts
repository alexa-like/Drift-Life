import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp } from "../lib/regen";
import { checkAchievements } from "./achievements";
import { nerveSufficientExpr, buildRegenPipeline } from "../lib/atomicRegen";

const router = Router();

const CRIMES = [
  { id: "pickpocket",           name: "Pickpocket",             flavour: "You lifted a wallet. It had a loyalty card and 42 DC. New Vanta is as disappointing as always.",                             nerveCost: 2,  minLevel: 1,  baseSuccess: 0.65, dcMin: 50,    dcMax: 300,   xp: 10,  wantedIncrease: 1, hospitalRisk: 0.10, hospitalDuration: 20*60*1000,   description: "Lift wallets from distracted citizens.",                     riskLevel: "low" },
  { id: "break_in",             name: "Break-In",               flavour: "You bypassed the mag-lock. Inside: dusty server racks and someone's lunch. Still profitable.",                               nerveCost: 4,  minLevel: 8,  baseSuccess: 0.50, dcMin: 200,   dcMax: 800,   xp: 30,  wantedIncrease: 2, hospitalRisk: 0.20, hospitalDuration: 45*60*1000,   description: "Break into a residential unit or small business.",           riskLevel: "medium" },
  { id: "vehicle_theft",        name: "Vehicle Theft",          flavour: "The auto-drive fought you for three blocks. You won. The car smells like synthetic coffee.",                                  nerveCost: 5,  minLevel: 10, baseSuccess: 0.40, dcMin: 400,   dcMax: 1500,  xp: 50,  wantedIncrease: 2, hospitalRisk: 0.15, hospitalDuration: 45*60*1000,   description: "Boost a vehicle from the street.",                           riskLevel: "medium" },
  { id: "scam_operation",       name: "Scam Operation",         flavour: "You sold them a 'certified' datacube. It had a cat video on it. Still counts.",                                               nerveCost: 3,  minLevel: 5,  baseSuccess: 0.55, dcMin: 500,   dcMax: 2000,  xp: 40,  wantedIncrease: 1, hospitalRisk: 0.05, hospitalDuration: 20*60*1000,   description: "Run a social engineering scam on a mark.",                   riskLevel: "low" },
  { id: "smuggling_run",        name: "Smuggling Run",          flavour: "Checkpoint 7 nearly had you. You made it through with contraband strapped to your spine.",                                    nerveCost: 6,  minLevel: 20, baseSuccess: 0.45, dcMin: 800,   dcMax: 3000,  xp: 80,  wantedIncrease: 3, hospitalRisk: 0.30, hospitalDuration: 2*60*60*1000, description: "Move contraband through New Vanta's checkpoints.",           riskLevel: "high" },
  { id: "heist_solo",           name: "Heist (Solo)",           flavour: "The vault sang when you cracked it. The alarm sang louder. You ran faster.",                                                  nerveCost: 8,  minLevel: 25, baseSuccess: 0.30, dcMin: 2000,  dcMax: 8000,  xp: 150, wantedIncrease: 4, hospitalRisk: 0.40, hospitalDuration: 2*60*60*1000, description: "Solo heist on a mid-tier corporate facility.",               riskLevel: "high" },
  { id: "data_breach",          name: "Data Breach",            flavour: "You were inside their system for 4.2 seconds. Long enough to drain six figures.",                                             nerveCost: 5,  minLevel: 15, baseSuccess: 0.50, dcMin: 1000,  dcMax: 4000,  xp: 100, wantedIncrease: 2, hospitalRisk: 0.10, hospitalDuration: 45*60*1000,   description: "Breach a corporate data network and extract credentials.",   riskLevel: "medium" },
  { id: "corporate_espionage",  name: "Corporate Espionage",    flavour: "Their head of security shook your hand at the door. He had no idea.",                                                         nerveCost: 7,  minLevel: 30, baseSuccess: 0.35, dcMin: 3000,  dcMax: 10000, xp: 200, wantedIncrease: 3, hospitalRisk: 0.25, hospitalDuration: 2*60*60*1000, description: "Infiltrate a corporation and steal classified intelligence.", riskLevel: "high" },
  { id: "assassination_contract",name:"Assassination Contract", flavour: "Clean shot. The city barely noticed. You noticed the DC transfer.",                                                           nerveCost: 10, minLevel: 40, baseSuccess: 0.25, dcMin: 10000, dcMax: 30000, xp: 500, wantedIncrease: 5, hospitalRisk: 0.50, hospitalDuration: 4*60*60*1000, description: "Take out a high-value target for an anonymous client.",      riskLevel: "extreme" },
  { id: "vault_crack",          name: "Vault Crack",            flavour: "Fourteen layers of encryption. You peeled them like onion skin. Legendary.",                                                  nerveCost: 12, minLevel: 50, baseSuccess: 0.20, dcMin: 20000, dcMax: 80000, xp: 1000,wantedIncrease: 5, hospitalRisk: 0.60, hospitalDuration: 4*60*60*1000, description: "Crack a maximum-security vault in Downtown Core.",           riskLevel: "extreme" },
];

// GET /api/crimes
router.get("/", requireAuth, (_req, res) => {
  res.json(CRIMES.map(c => ({
    id: c.id, name: c.name, flavour: c.flavour, nerveCost: c.nerveCost, minLevel: c.minLevel,
    baseSuccess: c.baseSuccess, dcRange: [c.dcMin, c.dcMax], xp: c.xp,
    wantedIncrease: c.wantedIncrease, hospitalRisk: c.hospitalRisk,
    description: c.description, riskLevel: c.riskLevel,
  })));
});

// POST /api/crimes/:crimeId/commit
router.post("/:crimeId/commit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const crime = CRIMES.find(c => c.id === req.params.crimeId);
    if (!crime) return res.status(404).json({ message: "Crime not found" });

    // Read user for preliminary checks only — regen computed DB-side below
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user); // in-memory for checks only — not saved

    if (isHospitalized(user)) return res.status(400).json({ message: "You are hospitalized and cannot commit crimes" });
    if (isJailed(user))       return res.status(400).json({ message: "You are jailed" });
    if (user.level < crime.minLevel) return res.status(400).json({ message: `Requires level ${crime.minLevel}` });
    if (user.wantedLevel >= 5 && ["corporate_espionage","assassination_contract","vault_crack"].includes(crime.id)) {
      return res.status(400).json({ message: "Too hot. Max wanted level blocks extreme crimes." });
    }

    // FULLY ATOMIC: regen computed server-side in pipeline; $expr condition
    // checks effective nerve (including regen) before deducting — zero race window.
    const gated = await User.findOneAndUpdate(
      {
        _id: req.userId,
        ...nerveSufficientExpr(crime.nerveCost),
      },
      buildRegenPipeline({
        nerveCost: crime.nerveCost,
        extraSet:  { totalCrimes: { $add: ["$totalCrimes", 1] } },
      }),
      { new: true },
    );
    if (!gated) {
      return res.status(400).json({ message: `Not enough nerve (need ${crime.nerveCost})` });
    }

    const nowDate = new Date();
    const isFirstCrimeToday = !gated.lastCrimeDate || gated.lastCrimeDate.toDateString() !== nowDate.toDateString();
    gated.lastCrimeDate = nowDate;

    // Success formula
    const intBonus     = (gated.intelligence - 5) * 0.01;
    const factionBonus = (gated.faction === "suits" && ["scam_operation","corporate_espionage"].includes(crime.id)) ? 0.05
                       : (gated.faction === "street" && ["break_in","heist_solo"].includes(crime.id)) ? 0.05
                       : (gated.faction === "grid"   && ["data_breach","scam_operation"].includes(crime.id)) ? 0.05 : 0;
    const successChance = Math.min(0.95, crime.baseSuccess + intBonus + factionBonus);
    const success = Math.random() < successChance;

    let dcGained = 0, xpGained = 0, hospitalized = false, leveled = false, narrative = "";

    if (success) {
      dcGained = Math.floor(crime.dcMin + Math.random() * (crime.dcMax - crime.dcMin));
      xpGained = crime.xp * (isFirstCrimeToday ? 2 : 1);
      gated.successfulCrimes += 1;
      gated.wantedLevel = Math.min(5, gated.wantedLevel + crime.wantedIncrease);
      gated.wantedDecayAt = new Date();
      narrative = crime.flavour;
    } else {
      if (Math.random() < crime.hospitalRisk) {
        gated.hospitalizedUntil = new Date(Date.now() + crime.hospitalDuration);
        hospitalized = true;
        narrative = "The security system flagged your biometrics. You woke up in New Vanta General.";
      } else {
        narrative = "You aborted. No DC. No arrest. Just a close call and a racing heart.";
      }
    }

    await gated.save(); // saves wantedLevel, hospitalizedUntil, lastCrimeDate, successfulCrimes

    // Apply DC + XP atomically with wallet cap via pipeline
    let rewarded = gated;
    if (dcGained > 0 || xpGained > 0) {
      const r = await User.findByIdAndUpdate(
        gated._id,
        [{ $set: { dc: { $min: [{ $add: ["$dc", dcGained] }, 100_000_000] }, xp: { $add: ["$xp", xpGained] } } }],
        { new: true },
      );
      if (r) {
        rewarded = r;
        leveled = levelUp(rewarded);
        if (leveled) await rewarded.save();
      }
    }

    checkAchievements(String(req.userId)).catch(() => {});

    await FeedEvent.create({
      type: "crime", actor: rewarded.username, actorId: rewarded._id,
      message: `${rewarded.username} ${success ? "pulled off" : "botched"} a ${crime.name}${dcGained ? ` — +${dcGained} DC` : ""}`,
      dc: dcGained, xp: xpGained,
    }).catch(() => {});

    res.json({
      success, narrative, dcGained, xpGained, hospitalized,
      hospitalizedUntil: rewarded.hospitalizedUntil,
      leveled, newLevel: leveled ? rewarded.level : undefined,
      user: { dc: rewarded.dc, nerve: rewarded.nerve, maxNerve: rewarded.maxNerve, xp: rewarded.xp, xpToNext: rewarded.xpToNext, level: rewarded.level, wantedLevel: rewarded.wantedLevel, hospitalizedUntil: rewarded.hospitalizedUntil },
    });
  } catch (err: any) {
    req.log.error({ err }, "commit crime error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/crimes/bribe — clear wanted level
router.post("/bribe", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);
    if (user.wantedLevel === 0) return res.status(400).json({ message: "You have no wanted level to clear" });
    const cost = Math.pow(user.wantedLevel, 2) * 1000;

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: cost } },
      { $inc: { dc: -cost }, $set: { wantedLevel: 0, wantedDecayAt: new Date() } },
      { new: true },
    );
    if (!updated) return res.status(400).json({ message: "Insufficient DC for bribe", cost });

    res.json({ message: `Chief Ralston pockets ${cost.toLocaleString()} DC without making eye contact. Your record is clean.`, cost, dc: updated.dc, wantedLevel: 0 });
  } catch (err: any) {
    req.log.error({ err }, "bribe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
