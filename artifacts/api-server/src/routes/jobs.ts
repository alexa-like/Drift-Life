import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp } from "../lib/regen";

const router = Router();

const JOBS = [
  { id: "delivery_driver",    name: "Delivery Driver",     district: "any",               minLevel: 1,  energyCost: 2, dcMin: 100,  dcMax: 250,  xpPerJob: 8,   cooldownMin: 30,  miniGame: "timing",  description: "Move packages across New Vanta's grid." },
  { id: "street_performer",   name: "Street Performer",    district: "the-boulevard",     minLevel: 1,  energyCost: 1, dcMin: 50,   dcMax: 200,  xpPerJob: 5,   cooldownMin: 20,  miniGame: "rhythm",  description: "Work the crowd on The Boulevard." },
  { id: "building_super",     name: "Building Super",      district: "residential-north", minLevel: 1,  energyCost: 2, dcMin: 120,  dcMax: 280,  xpPerJob: 8,   cooldownMin: 40,  miniGame: "pattern", description: "Maintain the crumbling residential blocks." },
  { id: "bartender",          name: "Bartender",           district: "the-boulevard",     minLevel: 1,  energyCost: 2, dcMin: 150,  dcMax: 300,  xpPerJob: 10,  cooldownMin: 30,  miniGame: "rhythm",  description: "Pour drinks and overhear secrets at a Boulevard bar." },
  { id: "security_guard",     name: "Security Guard",      district: "residential-north", minLevel: 1,  energyCost: 3, dcMin: 150,  dcMax: 350,  xpPerJob: 12,  cooldownMin: 60,  miniGame: "timing",  description: "Patrol the residential blocks." },
  { id: "club_promoter",      name: "Club Promoter",       district: "the-boulevard",     minLevel: 5,  energyCost: 1, dcMin: 300,  dcMax: 600,  xpPerJob: 20,  cooldownMin: 45,  miniGame: "rhythm",  description: "Pack the clubs and take your cut." },
  { id: "dock_worker",        name: "Dock Worker",         district: "industrial-east",   minLevel: 5,  energyCost: 3, dcMin: 250,  dcMax: 500,  xpPerJob: 18,  cooldownMin: 45,  miniGame: "timing",  description: "Unload cargo from Port District ships." },
  { id: "data_courier",       name: "Data Courier",        district: "tech-quarter",      minLevel: 5,  energyCost: 2, dcMin: 300,  dcMax: 700,  xpPerJob: 22,  cooldownMin: 45,  miniGame: "typing",  description: "Deliver encrypted payloads for the Grid." },
  { id: "street_dealer",      name: "Street Dealer",       district: "industrial-east",   minLevel: 8,  energyCost: 2, dcMin: 400,  dcMax: 800,  xpPerJob: 30,  cooldownMin: 60,  miniGame: "timing",  description: "Move product through Industrial East back alleys." },
  { id: "smuggler",           name: "Smuggler",            district: "port-district",     minLevel: 10, energyCost: 3, dcMin: 500,  dcMax: 1200, xpPerJob: 40,  cooldownMin: 60,  miniGame: "pattern", description: "Run contraband through port checkpoints." },
  { id: "freight_driver",     name: "Freight Driver",      district: "industrial-east",   minLevel: 10, energyCost: 3, dcMin: 350,  dcMax: 750,  xpPerJob: 25,  cooldownMin: 60,  miniGame: "timing",  description: "Drive heavy cargo rigs across the city." },
  { id: "corporate_spy",      name: "Corporate Spy",       district: "downtown-core",     minLevel: 15, energyCost: 3, dcMin: 800,  dcMax: 2000, xpPerJob: 60,  cooldownMin: 120, miniGame: "typing",  description: "Embed in a corporation and extract intel." },
  { id: "hacker_for_hire",    name: "Hacker-for-Hire",     district: "tech-quarter",      minLevel: 15, energyCost: 3, dcMin: 700,  dcMax: 1800, xpPerJob: 55,  cooldownMin: 90,  miniGame: "typing",  description: "Break ICE for anonymous clients." },
  { id: "black_market_broker",name: "Black Market Broker", district: "port-district",     minLevel: 20, energyCost: 3, dcMin: 900,  dcMax: 2500, xpPerJob: 70,  cooldownMin: 120, miniGame: "pattern", description: "Mediate illegal trades in the Port District." },
  { id: "bounty_hunter",      name: "Bounty Hunter",       district: "the-outskirts",     minLevel: 20, energyCost: 4, dcMin: 1000, dcMax: 3000, xpPerJob: 90,  cooldownMin: 180, miniGame: "timing",  description: "Track down marked targets in the Outskirts." },
  { id: "financial_analyst",  name: "Financial Analyst",   district: "downtown-core",     minLevel: 25, energyCost: 4, dcMin: 1200, dcMax: 3000, xpPerJob: 80,  cooldownMin: 150, miniGame: "typing",  description: "Crunch numbers for corporate clients. Legally." },
  { id: "arms_runner",        name: "Arms Runner",         district: "the-outskirts",     minLevel: 25, energyCost: 4, dcMin: 1500, dcMax: 4000, xpPerJob: 110, cooldownMin: 180, miniGame: "pattern", description: "Move weapons through the lawless Outskirts." },
  { id: "scavenger",          name: "Scavenger",           district: "any",               minLevel: 1,  energyCost: 3, dcMin: 200,  dcMax: 600,  xpPerJob: 15,  cooldownMin: 90,  miniGame: "pattern", description: "Pick through the ruins of New Vanta for sellables." },
];

// GET /api/jobs
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const cooldowns = (user as any).jobCooldowns || {};

    const jobsWithStatus = JOBS.map(j => {
      const cooldownUntil = cooldowns[j.id] ? new Date(cooldowns[j.id]) : null;
      const onCooldown = cooldownUntil && cooldownUntil > now;
      const districtMatch = j.district === "any" || j.district === user.district;
      const levelOk = user.level >= j.minLevel;
      return {
        ...j,
        available: districtMatch && levelOk && !onCooldown,
        onCooldown,
        cooldownUntil: onCooldown ? cooldownUntil : null,
        districtMatch,
      };
    });

    res.json(jobsWithStatus);
  } catch (err: any) {
    req.log.error({ err }, "get jobs error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/jobs/:jobId/work
router.post("/:jobId/work", requireAuth, async (req: AuthRequest, res) => {
  try {
    const job = JOBS.find(j => j.id === req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    if (isHospitalized(user)) return res.status(400).json({ message: "You are hospitalized" });
    if (isJailed(user)) return res.status(400).json({ message: "You are in jail" });
    if (user.level < job.minLevel) return res.status(400).json({ message: `Requires level ${job.minLevel}` });
    if (job.district !== "any" && user.district !== job.district) {
      return res.status(400).json({ message: `This job is only available in ${job.district.replace(/-/g, " ")}` });
    }
    if (user.energy < job.energyCost) return res.status(400).json({ message: `Not enough energy (need ${job.energyCost})` });

    // Check cooldown
    const cooldowns = (user as any).jobCooldowns || {};
    const cooldownUntil = cooldowns[job.id] ? new Date(cooldowns[job.id]) : null;
    if (cooldownUntil && cooldownUntil > new Date()) {
      const secsLeft = Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000);
      return res.status(400).json({ message: `On cooldown. ${secsLeft}s remaining.`, cooldownUntil });
    }

    user.energy -= job.energyCost;

    // Faction bonus
    let dcMultiplier = 1;
    if (user.faction === "suits") dcMultiplier = 1.10;
    if (user.faction === "grid") {
      user.energy += Math.floor(job.energyCost * 0.10);
      dcMultiplier = 1;
    }

    const dcGained = Math.floor((job.dcMin + Math.random() * (job.dcMax - job.dcMin)) * dcMultiplier);
    const xpGained = job.xpPerJob;
    user.dc += dcGained;
    user.xp += xpGained;
    user.job = job.id;

    // Set cooldown
    const newCooldowns = { ...(user as any).jobCooldowns?.toJSON?.() || cooldowns };
    newCooldowns[job.id] = new Date(Date.now() + job.cooldownMin * 60 * 1000);
    (user as any).jobCooldowns = newCooldowns;

    const leveled = levelUp(user);
    await user.save();

    // 30% chance to trigger the job's assigned mini-game
    const miniGameTriggered = Math.random() < 0.30;
    const miniGameType = miniGameTriggered ? job.miniGame : null;

    await FeedEvent.create({
      type: "job",
      actor: user.username,
      actorId: user._id,
      message: `${user.username} completed a shift as ${job.name} and earned ${dcGained} DC`,
      dc: dcGained,
      xp: xpGained,
    }).catch(() => {});

    res.json({
      dcGained,
      xpGained,
      leveled,
      newLevel: leveled ? user.level : undefined,
      miniGameTriggered,
      miniGameType,
      cooldownUntil: newCooldowns[job.id],
      user: {
        dc: user.dc,
        energy: user.energy,
        maxEnergy: user.maxEnergy,
        xp: user.xp,
        xpToNext: user.xpToNext,
        level: user.level,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "work job error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/jobs/minigame/complete — apply bonus after mini-game
router.post("/minigame/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { multiplier } = req.body;
    if (!multiplier || multiplier < 1 || multiplier > 1.6) {
      return res.status(400).json({ message: "Invalid multiplier" });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const bonus = Math.floor(user.dc * 0.02 * (multiplier - 1) * 100);
    user.dc += bonus;
    await user.save();
    res.json({ bonus, newDc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "minigame complete error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
