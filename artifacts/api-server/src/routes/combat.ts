import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp } from "../lib/regen";

const router = Router();

// GET /api/combat/targets
router.get("/targets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const me = await User.findById(req.userId).lean();
    if (!me) return res.status(404).json({ message: "User not found" });

    const targets = await User.find({
      _id: { $ne: req.userId },
      banned: false,
      level: { $gte: me.level - 5, $lte: me.level + 5 },
    })
      .select("username avatar level rank district wins losses health maxHealth")
      .limit(10)
      .lean();

    res.json(targets.map(t => ({
      id: t._id,
      username: t.username,
      avatar: t.avatar,
      level: t.level,
      rank: t.rank,
      district: t.district,
      wins: t.wins,
      losses: t.losses,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get targets error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/combat/attack
router.post("/attack", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ message: "targetId required" });
    if (targetId === req.userId) return res.status(400).json({ message: "Cannot attack yourself" });

    const [attacker, defender] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetId),
    ]);

    if (!attacker) return res.status(404).json({ message: "Attacker not found" });
    if (!defender) return res.status(404).json({ message: "Target not found" });

    applyRegen(attacker);

    if (isHospitalized(attacker)) return res.status(400).json({ message: "You are hospitalized" });
    if (isJailed(attacker)) return res.status(400).json({ message: "You are in jail" });
    if (isHospitalized(defender)) return res.status(400).json({ message: "Target is already hospitalized" });

    // Combat formula
    const attackRoll = attacker.strength + attacker.speed + Math.random() * 20;
    const defenseRoll = defender.defense + defender.stealth + Math.random() * 20;

    const attackerWins = attackRoll > defenseRoll;
    const dmgToDefender = Math.max(5, Math.floor(attacker.strength * 1.5 + Math.random() * 10));
    const dmgToAttacker = Math.max(2, Math.floor(defender.strength * 0.8 + Math.random() * 8));

    let dcGained = 0;
    let xpGained = 0;
    let defenderHospitalized = false;
    let attackerHospitalized = false;
    let leveled = false;

    if (attackerWins) {
      defender.health = Math.max(0, defender.health - dmgToDefender);
      attacker.health = Math.max(0, attacker.health - Math.floor(dmgToAttacker * 0.3));
      attacker.wins += 1;
      defender.losses += 1;
      attacker.totalFights += 1;
      defender.totalFights += 1;

      // Loot some DC
      dcGained = Math.floor(Math.min(defender.dc * 0.05, 500) + Math.random() * 100);
      dcGained = Math.max(50, dcGained);
      attacker.dc += dcGained;
      defender.dc = Math.max(0, defender.dc - dcGained);

      xpGained = 20 + attacker.level * 2;
      attacker.xp += xpGained;
      leveled = levelUp(attacker);

      if (defender.health <= 0) {
        defender.health = 0;
        defender.hospitalizedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 min
        defenderHospitalized = true;
      }

      await Notification.create({
        userId: defender._id,
        type: "combat",
        message: `${attacker.username} attacked you and won! You lost ${dcGained} DC.${defenderHospitalized ? " You were hospitalized." : ""}`,
      });
    } else {
      // Defender wins
      attacker.health = Math.max(0, attacker.health - dmgToDefender);
      defender.health = Math.max(0, defender.health - Math.floor(dmgToAttacker * 0.2));
      attacker.losses += 1;
      defender.wins += 1;
      attacker.totalFights += 1;
      defender.totalFights += 1;

      if (attacker.health <= 0) {
        attacker.health = 0;
        attacker.hospitalizedUntil = new Date(Date.now() + 5 * 60 * 1000);
        attackerHospitalized = true;
      }

      await Notification.create({
        userId: defender._id,
        type: "combat",
        message: `${attacker.username} attacked you, but you fought them off!`,
      });
    }

    await Promise.all([attacker.save(), defender.save()]);

    await FeedEvent.create({
      type: "fight",
      actor: attacker.username,
      actorId: attacker._id,
      target: defender.username,
      targetId: defender._id,
      message: attackerWins
        ? `${attacker.username} defeated ${defender.username} and took ${dcGained} DC`
        : `${attacker.username} attacked ${defender.username} but was repelled`,
      dc: dcGained,
      xp: xpGained,
    });

    res.json({
      attackerWins,
      dcGained,
      xpGained,
      leveled,
      newLevel: leveled ? attacker.level : undefined,
      defenderHospitalized,
      attackerHospitalized,
      message: attackerWins
        ? `Victory! Took ${dcGained} DC from ${defender.username}`
        : `Defeated by ${defender.username}`,
      attacker: {
        health: attacker.health,
        maxHealth: attacker.maxHealth,
        dc: attacker.dc,
        xp: attacker.xp,
        xpToNext: attacker.xpToNext,
        level: attacker.level,
        wins: attacker.wins,
        losses: attacker.losses,
        hospitalizedUntil: attacker.hospitalizedUntil,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "attack error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
