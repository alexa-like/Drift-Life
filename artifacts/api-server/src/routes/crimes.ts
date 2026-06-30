import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp } from "../lib/regen";
import { checkAchievements } from "./achievements";

const router = Router();

// Full crime list per spec
const CRIMES = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    flavour: "You lifted a wallet. It had a loyalty card and 42 DC. New Vanta is as disappointing as always.",
    nerveCost: 2,
    minLevel: 1,
    baseSuccess: 0.65,
    dcMin: 50,
    dcMax: 300,
    xp: 10,
    wantedIncrease: 1,
    hospitalRisk: 0.10,
    hospitalDuration: 20 * 60 * 1000,
    description: "Lift wallets from distracted citizens in the crowd.",
    riskLevel: "low",
  },
  {
    id: "break_in",
    name: "Break-In",
    flavour: "You bypassed the mag-lock. Inside: dusty server racks and someone's lunch. Still profitable.",
    nerveCost: 4,
    minLevel: 8,
    baseSuccess: 0.50,
    dcMin: 200,
    dcMax: 800,
    xp: 30,
    wantedIncrease: 2,
    hospitalRisk: 0.20,
    hospitalDuration: 45 * 60 * 1000,
    description: "Break into a residential unit or small business.",
    riskLevel: "medium",
  },
  {
    id: "vehicle_theft",
    name: "Vehicle Theft",
    flavour: "The auto-drive fought you for three blocks. You won. The car smells like synthetic coffee.",
    nerveCost: 5,
    minLevel: 10,
    baseSuccess: 0.40,
    dcMin: 400,
    dcMax: 1500,
    xp: 50,
    wantedIncrease: 2,
    hospitalRisk: 0.15,
    hospitalDuration: 45 * 60 * 1000,
    description: "Boost a vehicle from the street.",
    riskLevel: "medium",
  },
  {
    id: "scam_operation",
    name: "Scam Operation",
    flavour: "You sold them a 'certified' datacube. It had a cat video on it. Still counts.",
    nerveCost: 3,
    minLevel: 5,
    baseSuccess: 0.55,
    dcMin: 500,
    dcMax: 2000,
    xp: 40,
    wantedIncrease: 1,
    hospitalRisk: 0.05,
    hospitalDuration: 20 * 60 * 1000,
    description: "Run a social engineering scam on a mark.",
    riskLevel: "low",
  },
  {
    id: "smuggling_run",
    name: "Smuggling Run",
    flavour: "Checkpoint 7 nearly had you. You made it through with contraband strapped to your spine.",
    nerveCost: 6,
    minLevel: 20,
    baseSuccess: 0.45,
    dcMin: 800,
    dcMax: 3000,
    xp: 80,
    wantedIncrease: 3,
    hospitalRisk: 0.30,
    hospitalDuration: 2 * 60 * 60 * 1000,
    description: "Move contraband through New Vanta's checkpoints.",
    riskLevel: "high",
  },
  {
    id: "heist_solo",
    name: "Heist (Solo)",
    flavour: "The vault sang when you cracked it. The alarm sang louder. You ran faster.",
    nerveCost: 8,
    minLevel: 25,
    baseSuccess: 0.30,
    dcMin: 2000,
    dcMax: 8000,
    xp: 150,
    wantedIncrease: 4,
    hospitalRisk: 0.40,
    hospitalDuration: 2 * 60 * 60 * 1000,
    description: "Solo heist on a mid-tier corporate facility.",
    riskLevel: "high",
  },
  {
    id: "data_breach",
    name: "Data Breach",
    flavour: "You were inside their system for 4.2 seconds. Long enough to drain six figures.",
    nerveCost: 5,
    minLevel: 15,
    baseSuccess: 0.50,
    dcMin: 1000,
    dcMax: 4000,
    xp: 100,
    wantedIncrease: 2,
    hospitalRisk: 0.10,
    hospitalDuration: 45 * 60 * 1000,
    description: "Breach a corporate data network and extract credentials.",
    riskLevel: "medium",
  },
  {
    id: "corporate_espionage",
    name: "Corporate Espionage",
    flavour: "Their head of security shook your hand at the door. He had no idea.",
    nerveCost: 7,
    minLevel: 30,
    baseSuccess: 0.35,
    dcMin: 3000,
    dcMax: 10000,
    xp: 200,
    wantedIncrease: 3,
    hospitalRisk: 0.25,
    hospitalDuration: 2 * 60 * 60 * 1000,
    description: "Infiltrate a corporation and steal classified intelligence.",
    riskLevel: "high",
  },
  {
    id: "assassination_contract",
    name: "Assassination Contract",
    flavour: "Clean shot. The city barely noticed. You noticed the DC transfer.",
    nerveCost: 10,
    minLevel: 40,
    baseSuccess: 0.25,
    dcMin: 10000,
    dcMax: 30000,
    xp: 500,
    wantedIncrease: 5,
    hospitalRisk: 0.50,
    hospitalDuration: 4 * 60 * 60 * 1000,
    description: "Take out a high-value target for an anonymous client.",
    riskLevel: "extreme",
  },
  {
    id: "vault_crack",
    name: "Vault Crack",
    flavour: "Fourteen layers of encryption. You peeled them like onion skin. Legendary.",
    nerveCost: 12,
    minLevel: 50,
    baseSuccess: 0.20,
    dcMin: 20000,
    dcMax: 80000,
    xp: 1000,
    wantedIncrease: 5,
    hospitalRisk: 0.60,
    hospitalDuration: 4 * 60 * 60 * 1000,
    description: "Crack a maximum-security vault in Downtown Core.",
    riskLevel: "extreme",
  },
];

// GET /api/crimes
router.get("/", requireAuth, async (_req, res) => {
  res.json(CRIMES.map(c => ({
    id: c.id,
    name: c.name,
    flavour: c.flavour,
    nerveCost: c.nerveCost,
    minLevel: c.minLevel,
    baseSuccess: c.baseSuccess,
    dcRange: [c.dcMin, c.dcMax],
    xp: c.xp,
    wantedIncrease: c.wantedIncrease,
    hospitalRisk: c.hospitalRisk,
    description: c.description,
    riskLevel: c.riskLevel,
  })));
});

// POST /api/crimes/:crimeId/commit
router.post("/:crimeId/commit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const crime = CRIMES.find(c => c.id === req.params.crimeId);
    if (!crime) return res.status(404).json({ message: "Crime not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    if (isHospitalized(user)) return res.status(400).json({ message: "You are hospitalized and cannot commit crimes" });
    if (isJailed(user)) return res.status(400).json({ message: "You are jailed" });
    if (user.level < crime.minLevel) return res.status(400).json({ message: `Requires level ${crime.minLevel}` });
    if (user.nerve < crime.nerveCost) return res.status(400).json({ message: `Not enough nerve (need ${crime.nerveCost})` });
    if (user.wantedLevel >= 5 && ["corporate_espionage","assassination_contract","vault_crack"].includes(crime.id)) {
      return res.status(400).json({ message: "Too hot. Max wanted level blocks extreme crimes." });
    }

    user.nerve -= crime.nerveCost;
    user.totalCrimes += 1;

    const nowDate = new Date();
    const todayStr = nowDate.toDateString();
    const isFirstCrimeToday = !user.lastCrimeDate || user.lastCrimeDate.toDateString() !== todayStr;
    user.lastCrimeDate = nowDate;

    // Success formula from spec
    const intBonus = (user.intelligence - 5) * 0.01;
    const factionBonus = (user.faction === "suits" && ["scam_operation","corporate_espionage"].includes(crime.id)) ? 0.05
      : (user.faction === "street" && ["break_in","heist_solo"].includes(crime.id)) ? 0.05
      : (user.faction === "grid" && ["data_breach","scam_operation"].includes(crime.id)) ? 0.05 : 0;
    const successChance = Math.min(0.95, crime.baseSuccess + intBonus + factionBonus);
    const roll = Math.random();
    const success = roll < successChance;

    let dcGained = 0;
    let xpGained = 0;
    let hospitalized = false;
    let leveled = false;
    let narrative = "";

    if (success) {
      dcGained = Math.floor(crime.dcMin + Math.random() * (crime.dcMax - crime.dcMin));
      xpGained = crime.xp * (isFirstCrimeToday ? 2 : 1);
      user.dc = Math.min(user.dc + dcGained, 100_000_000);
      user.xp += xpGained;
      user.successfulCrimes += 1;
      user.wantedLevel = Math.min(5, user.wantedLevel + crime.wantedIncrease);
      user.wantedDecayAt = new Date();
      leveled = levelUp(user);
      narrative = crime.flavour;
    } else {
      // Failure: hospital risk
      if (Math.random() < crime.hospitalRisk) {
        user.hospitalizedUntil = new Date(Date.now() + crime.hospitalDuration);
        hospitalized = true;
        narrative = `The security system flagged your biometrics. You woke up in New Vanta General.`;
      } else {
        narrative = `You aborted. No DC. No arrest. Just a close call and a racing heart.`;
      }
    }

    await user.save();
    checkAchievements(String(req.userId)).catch(() => {});

    // Feed post
    await FeedEvent.create({
      type: "crime",
      actor: user.username,
      actorId: user._id,
      message: `${user.username} ${success ? "pulled off" : "botched"} a ${crime.name}${dcGained ? ` — +${dcGained} DC` : ""}`,
      dc: dcGained,
      xp: xpGained,
    }).catch(() => {});

    res.json({
      success,
      narrative,
      dcGained,
      xpGained,
      hospitalized,
      hospitalizedUntil: user.hospitalizedUntil,
      leveled,
      newLevel: leveled ? user.level : undefined,
      user: {
        dc: user.dc,
        nerve: user.nerve,
        maxNerve: user.maxNerve,
        xp: user.xp,
        xpToNext: user.xpToNext,
        level: user.level,
        wantedLevel: user.wantedLevel,
        hospitalizedUntil: user.hospitalizedUntil,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "commit crime error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/crimes/bribe — bribe Chief Ralston to clear wanted level
router.post("/bribe", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    if (user.wantedLevel === 0) return res.status(400).json({ message: "You have no wanted level to clear" });

    // Cost: wantedLevel² × 1,000 DC
    const cost = Math.pow(user.wantedLevel, 2) * 1000;

    if (user.dc < cost) {
      return res.status(400).json({ message: `Bribe costs ${cost.toLocaleString()} DC (wanted level ${user.wantedLevel})`, cost });
    }

    user.dc -= cost;
    user.wantedLevel = 0;
    user.wantedDecayAt = new Date();
    await user.save();

    res.json({
      message: `Chief Ralston pockets ${cost.toLocaleString()} DC without making eye contact. Your record is clean.`,
      cost,
      dc: user.dc,
      wantedLevel: 0,
    });
  } catch (err: any) {
    req.log.error({ err }, "bribe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
