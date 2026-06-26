import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp } from "../lib/regen";

const router = Router();

const CRIMES = [
  {
    id: "pickpocket",
    name: "Pickpocket",
    nerveCost: 2,
    minLevel: 1,
    successRate: 0.75,
    dcMin: 50,
    dcMax: 200,
    xp: 10,
    description: "Lift wallets from distracted citizens.",
    wantedIncrease: 0,
    jailTime: 60,
  },
  {
    id: "hack_terminal",
    name: "Hack Terminal",
    nerveCost: 4,
    minLevel: 2,
    successRate: 0.60,
    dcMin: 150,
    dcMax: 400,
    xp: 25,
    description: "Breach a public data terminal for creds.",
    wantedIncrease: 1,
    jailTime: 180,
  },
  {
    id: "mug_runner",
    name: "Mug a Runner",
    nerveCost: 6,
    minLevel: 3,
    successRate: 0.55,
    dcMin: 300,
    dcMax: 800,
    xp: 40,
    description: "Jump a courier in a back alley.",
    wantedIncrease: 1,
    jailTime: 300,
  },
  {
    id: "corp_heist",
    name: "Corp Data Heist",
    nerveCost: 10,
    minLevel: 5,
    successRate: 0.45,
    dcMin: 500,
    dcMax: 1500,
    xp: 80,
    description: "Steal sensitive data from a corporate node.",
    wantedIncrease: 2,
    jailTime: 600,
  },
  {
    id: "black_market",
    name: "Black Market Deal",
    nerveCost: 8,
    minLevel: 4,
    successRate: 0.50,
    dcMin: 400,
    dcMax: 1200,
    xp: 60,
    description: "Move contraband through back channels.",
    wantedIncrease: 1,
    jailTime: 360,
  },
  {
    id: "assassinate",
    name: "Assassination Contract",
    nerveCost: 15,
    minLevel: 8,
    successRate: 0.35,
    dcMin: 1000,
    dcMax: 3000,
    xp: 150,
    description: "Take out a high-value target.",
    wantedIncrease: 3,
    jailTime: 1200,
  },
];

// GET /api/crimes
router.get("/", requireAuth, async (_req, res) => {
  res.json(CRIMES.map(c => ({
    id: c.id,
    name: c.name,
    nerveCost: c.nerveCost,
    minLevel: c.minLevel,
    successRate: c.successRate,
    dcRange: [c.dcMin, c.dcMax],
    xp: c.xp,
    description: c.description,
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

    if (isHospitalized(user))
      return res.status(400).json({ message: "You are hospitalized" });
    if (isJailed(user))
      return res.status(400).json({ message: "You are in jail" });
    if (user.level < crime.minLevel)
      return res.status(400).json({ message: `Requires level ${crime.minLevel}` });
    if (user.nerve < crime.nerveCost)
      return res.status(400).json({ message: "Not enough nerve" });

    user.nerve -= crime.nerveCost;
    user.totalCrimes += 1;

    const roll = Math.random();
    const stealthBonus = (user.stealth / 100) * 0.1;
    const success = roll < crime.successRate + stealthBonus;

    let dcGained = 0;
    let xpGained = 0;
    let message = "";
    let jailed = false;
    let leveled = false;

    if (success) {
      dcGained = Math.floor(crime.dcMin + Math.random() * (crime.dcMax - crime.dcMin));
      xpGained = crime.xp;
      user.dc += dcGained;
      user.xp += xpGained;
      user.successfulCrimes += 1;
      if (crime.wantedIncrease > 0) {
        user.wantedLevel = Math.min(5, user.wantedLevel + crime.wantedIncrease);
      }
      leveled = levelUp(user);
      message = `SUCCESS — ${crime.name} netted +${dcGained} DC`;
    } else {
      // Caught — jail
      if (Math.random() < 0.6) {
        user.jailUntil = new Date(Date.now() + crime.jailTime * 1000);
        jailed = true;
        message = `BUSTED — Jailed for ${crime.jailTime}s`;
      } else {
        message = `FAILED — ${crime.name} botched, but you escaped`;
      }
    }

    await user.save();

    await FeedEvent.create({
      type: "crime",
      actor: user.username,
      actorId: user._id,
      message: `${user.username} ${success ? "pulled off" : "botched"} a ${crime.name}`,
      dc: dcGained,
      xp: xpGained,
    });

    res.json({
      success,
      message,
      dcGained,
      xpGained,
      jailed,
      jailDuration: jailed ? crime.jailTime : 0,
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
        jailUntil: user.jailUntil,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "commit crime error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
