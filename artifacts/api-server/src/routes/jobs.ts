import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp } from "../lib/regen";

const router = Router();

const JOBS = [
  {
    id: "data_courier",
    name: "Data Courier",
    minLevel: 1,
    energyCost: 10,
    dcMin: 80,
    dcMax: 150,
    xp: 8,
    description: "Deliver encrypted packages across the city.",
  },
  {
    id: "street_vendor",
    name: "Street Vendor",
    minLevel: 1,
    energyCost: 8,
    dcMin: 60,
    dcMax: 120,
    xp: 6,
    description: "Hawk noodles and spare parts in Neon Bazaar.",
  },
  {
    id: "bouncer",
    name: "Club Bouncer",
    minLevel: 3,
    energyCost: 12,
    dcMin: 150,
    dcMax: 250,
    xp: 15,
    description: "Keep the riff-raff out of Neon District clubs.",
  },
  {
    id: "netrunner",
    name: "Freelance Netrunner",
    minLevel: 5,
    energyCost: 15,
    dcMin: 250,
    dcMax: 450,
    xp: 25,
    description: "Hire yourself out for short-term ICE breaks.",
  },
  {
    id: "fixer",
    name: "Corporate Fixer",
    minLevel: 8,
    energyCost: 20,
    dcMin: 400,
    dcMax: 700,
    xp: 40,
    description: "Arrange deals between corps and street talent.",
  },
];

// GET /api/jobs
router.get("/", requireAuth, async (_req, res) => {
  res.json(JOBS);
});

// POST /api/jobs/:jobId/work
router.post("/:jobId/work", requireAuth, async (req: AuthRequest, res) => {
  try {
    const job = JOBS.find(j => j.id === req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    if (isHospitalized(user))
      return res.status(400).json({ message: "You are hospitalized" });
    if (isJailed(user))
      return res.status(400).json({ message: "You are in jail" });
    if (user.level < job.minLevel)
      return res.status(400).json({ message: `Requires level ${job.minLevel}` });
    if (user.energy < job.energyCost)
      return res.status(400).json({ message: "Not enough energy" });

    user.energy -= job.energyCost;
    const dcGained = Math.floor(job.dcMin + Math.random() * (job.dcMax - job.dcMin));
    const xpGained = job.xp;
    user.dc += dcGained;
    user.xp += xpGained;
    user.job = job.id;
    const leveled = levelUp(user);

    await user.save();

    await FeedEvent.create({
      type: "job",
      actor: user.username,
      actorId: user._id,
      message: `${user.username} worked as ${job.name} and earned ${dcGained} DC`,
      dc: dcGained,
      xp: xpGained,
    });

    res.json({
      dcGained,
      xpGained,
      leveled,
      newLevel: leveled ? user.level : undefined,
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

export default router;
