import { Router } from "express";
import User from "../models/User";

import Notification from "../models/Notification";
import Item, { IItem } from "../models/Item";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, levelUp } from "../lib/regen";
import { checkAchievements } from "./achievements";

const router = Router();

// NPC roster per spec
const NPCS = [
  { id: "street_punk", name: "Street Punk", district: "residential-north", level: 5, hp: 30, strength: 8, dcMin: 500, dcMax: 1000, xp: 50, dropRarity: "common", description: "A desperate kid looking for an easy score." },
  { id: "street_thug", name: "Street Thug", district: "industrial-east", level: 10, hp: 50, strength: 15, dcMin: 1000, dcMax: 3000, xp: 100, dropRarity: "common_uncommon", description: "Muscle for one of the smaller gangs." },
  { id: "gang_member", name: "Gang Member", district: "the-boulevard", level: 15, hp: 60, strength: 20, dcMin: 1000, dcMax: 3000, xp: 100, dropRarity: "common", description: "Mid-tier street soldier." },
  { id: "dock_enforcer", name: "Dock Enforcer", district: "port-district", level: 25, hp: 80, strength: 30, dcMin: 3000, dcMax: 8000, xp: 200, dropRarity: "uncommon", description: "Controls the port's unofficial tax." },
  { id: "security_guard", name: "Security Guard", district: "downtown-core", level: 33, hp: 150, strength: 40, dcMin: 5000, dcMax: 12000, xp: 300, dropRarity: "uncommon_rare", description: "Corporate security — trained, armed, motivated." },
  { id: "shadow_operative", name: "Shadow Operative", district: "tech-quarter", level: 45, hp: 200, strength: 55, dcMin: 10000, dcMax: 25000, xp: 500, dropRarity: "rare", description: "Ghost-tier contractor who doesn't officially exist." },
  { id: "syndicate_boss", name: "Syndicate Boss", district: "the-outskirts", level: 70, hp: 350, strength: 80, dcMin: 30000, dcMax: 80000, xp: 1500, dropRarity: "epic", description: "Runs The Outskirts with an iron fist." },
  { id: "faction_boss", name: "Faction Boss", district: "downtown-core", level: 90, hp: 500, strength: 100, dcMin: 50000, dcMax: 150000, xp: 3000, dropRarity: "epic_legendary", description: "The power behind Downtown Core." },
  { id: "rogue_ai_unit", name: "Rogue AI Unit", district: "the-outskirts", level: 95, hp: 600, strength: 120, dcMin: 80000, dcMax: 200000, xp: 5000, dropRarity: "legendary", description: "A decommissioned corporate AI gone feral." },
];

// GET /api/combat/npcs
router.get("/npcs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const districtNpcs = NPCS.filter(n => n.district === user.district);
    res.json(districtNpcs);
  } catch (err: any) {
    req.log.error({ err }, "get npcs error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/combat/npcs/all
router.get("/npcs/all", requireAuth, async (_req, res) => {
  res.json(NPCS);
});

const NPC_COMBAT_COOLDOWN_MS = 5000; // 5-second cooldown between NPC fights

// POST /api/combat/npc/:npcId
router.post("/npc/:npcId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const npc = NPCS.find(n => n.id === req.params.npcId);
    if (!npc) return res.status(404).json({ message: "NPC not found" });

    // ATOMIC: per-user NPC combat cooldown (prevents concurrent NPC spam)
    const cooldownGate = await User.findOneAndUpdate(
      {
        _id: req.userId,
        $or: [
          { lastNpcCombatAt: null },
          { lastNpcCombatAt: { $exists: false } },
          { lastNpcCombatAt: { $lte: new Date(Date.now() - NPC_COMBAT_COOLDOWN_MS) } },
        ],
      },
      { $set: { lastNpcCombatAt: new Date() } },
      { new: true },
    );
    if (!cooldownGate) {
      return res.status(429).json({ message: "NPC combat cooldown — wait a few seconds" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);
    if (isHospitalized(user)) return res.status(400).json({ message: "You are hospitalized" });
    if (isJailed(user)) return res.status(400).json({ message: "You are in jail" });
    if (user.district !== npc.district) return res.status(400).json({ message: `${npc.name} is only found in ${npc.district.replace(/-/g, " ")}` });
    if (user.level < npc.level - 10) return res.status(400).json({ message: `You are too low-level for this encounter (need level ${Math.max(1, npc.level - 10)})` });

    // Combat formula per spec — load actual weapon strengthBonus
    let weaponBonus = 0;
    if (user.equippedWeapon) {
      const weapon = await Item.findById(user.equippedWeapon).select("strengthBonus").lean();
      weaponBonus = weapon?.strengthBonus ?? 0;
    }
    const playerAttack = (user.strength * 1.5) + Math.floor(Math.random() * 30) + weaponBonus;
    const npcDefense = npc.strength + Math.floor(Math.random() * 20);

    const playerWins = playerAttack > npcDefense;

    let dcGained = 0;
    let xpGained = 0;
    let leveled = false;
    let hospitalized = false;
    let narrative = "";

    user.totalFights += 1;

    if (playerWins) {
      dcGained = Math.floor(npc.dcMin + Math.random() * (npc.dcMax - npc.dcMin));
      xpGained = npc.xp;
      if (user.faction === "street") xpGained = Math.floor(xpGained * 1.1); // +10% xp for Street
      user.dc = Math.min(user.dc + dcGained, 100_000_000);
      user.xp += xpGained;
      user.wins += 1;
      leveled = levelUp(user);
      narrative = `${npc.name} didn't see your counter coming. They hit the pavement. You took ${dcGained} DC and walked away.`;

      // Drop loot
      await grantNpcDrop(user._id.toString(), npc.dropRarity).catch(() => {});
    } else {
      const hpLoss = Math.floor(10 + Math.random() * 20);
      user.health = Math.max(0, user.health - hpLoss);
      user.losses += 1;
      narrative = `${npc.name} had better instincts. You took ${hpLoss} HP damage and retreated.`;

      if (user.health <= 0) {
        const hospDuration = 20 + Math.floor(Math.random() * 10);
        user.hospitalizedUntil = new Date(Date.now() + hospDuration * 60 * 1000);
        user.health = 0;
        hospitalized = true;
        narrative = `${npc.name} put you on the ground. New Vanta General, again.`;
      }
    }

    await user.save();
    checkAchievements(String(req.userId)).catch(() => {});

    // combat results go to notifications only, not the public feed

    res.json({
      playerWins,
      narrative,
      dcGained,
      xpGained,
      leveled,
      hospitalized,
      hospitalizedUntil: user.hospitalizedUntil,
      user: {
        health: user.health,
        maxHealth: user.maxHealth,
        dc: user.dc,
        xp: user.xp,
        xpToNext: user.xpToNext,
        level: user.level,
        wins: user.wins,
        losses: user.losses,
        hospitalizedUntil: user.hospitalizedUntil,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "npc combat error");
    res.status(500).json({ message: "Internal server error" });
  }
});

type DropType = "weapon" | "armor" | "clothing" | "vehicle" | "consumable" | "material" | "badge" | "card" | "misc";
type DropRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type DropSlot = "weapon" | "armor" | "clothing" | "vehicle" | null;

interface DropTemplate {
  name: string;
  rarity: DropRarity;
  type: DropType;
  basePrice: number;
  strengthBonus: number;
  slot: DropSlot;
}

async function grantNpcDrop(userId: string, dropRarity: string): Promise<void> {
  const rarityPool: DropTemplate[] = [
    { name: "Scrap Metal", rarity: "common", type: "material", basePrice: 100, strengthBonus: 0, slot: null },
    { name: "Bandage", rarity: "common", type: "consumable", basePrice: 300, strengthBonus: 0, slot: null },
    { name: "Combat Knife", rarity: "common", type: "weapon", basePrice: 1200, strengthBonus: 2, slot: "weapon" },
    { name: "Pistol", rarity: "uncommon", type: "weapon", basePrice: 15000, strengthBonus: 5, slot: "weapon" },
    { name: "First Aid Kit", rarity: "common", type: "consumable", basePrice: 1000, strengthBonus: 0, slot: null },
    { name: "Leather Jacket", rarity: "uncommon", type: "clothing", basePrice: 8000, strengthBonus: 0, slot: "clothing" },
    { name: "Katana", rarity: "rare", type: "weapon", basePrice: 80000, strengthBonus: 8, slot: "weapon" },
    { name: "Tactical Vest", rarity: "rare", type: "armor", basePrice: 40000, strengthBonus: 3, slot: "armor" },
    { name: "Plasma Pistol", rarity: "epic", type: "weapon", basePrice: 800000, strengthBonus: 15, slot: "weapon" },
    { name: "Plasma Cannon", rarity: "legendary", type: "weapon", basePrice: 25000000, strengthBonus: 30, slot: "weapon" },
  ];

  const roll = Math.random();
  let rarity: DropRarity | null = null;
  if (dropRarity.includes("legendary") && roll < 0.01) rarity = "legendary";
  else if (dropRarity.includes("epic") && roll < 0.04) rarity = "epic";
  else if (dropRarity.includes("rare") && roll < 0.10) rarity = "rare";
  else if (dropRarity.includes("uncommon") && roll < 0.25) rarity = "uncommon";
  else if (roll < 0.60) rarity = "common";
  else return;

  const pool = rarityPool.filter(i => i.rarity === rarity);
  if (!pool.length) return;
  const template = pool[Math.floor(Math.random() * pool.length)];

  // Upsert: increment quantity if item already exists, otherwise create it
  await Item.findOneAndUpdate(
    { owner: userId, name: template.name, type: template.type, rarity: template.rarity },
    {
      $inc: { quantity: 1 },
      $setOnInsert: {
        owner: userId,
        name: template.name,
        type: template.type,
        rarity: template.rarity,
        strengthBonus: template.strengthBonus,
        charismaBonus: 0,
        intelligenceBonus: 0,
        streetCredBonus: 0,
        defenseBonus: 0,
        basePrice: template.basePrice,
        slot: template.slot,
      },
    },
    { upsert: true },
  );
}

// GET /api/combat/targets
// Optional query params: district (override district filter), minLevel, maxLevel
router.get("/targets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const me = await User.findById(req.userId).lean();
    if (!me) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const myAttackCooldowns: Array<{ targetId: string; until: Date }> = (me as any).attackCooldowns || [];

    const district = (req.query.district as string) || me.district;
    const minLevel = req.query.minLevel ? Math.max(1, parseInt(req.query.minLevel as string)) : Math.max(1, me.level - 25);
    const maxLevel = req.query.maxLevel ? parseInt(req.query.maxLevel as string) : me.level + 25;

    const targets = await User.find({
      _id: { $ne: req.userId },
      banned: false,
      district,
      level: { $gte: minLevel, $lte: maxLevel },
      isEmailVerified: true,
    })
      .select("username avatar faction level rank district wins losses health maxHealth wantedLevel equippedFrame")
      .limit(20)
      .lean();

    res.json(targets.map(t => {
      const cooldown = myAttackCooldowns.find(c => c.targetId === String(t._id));
      const onCooldown = cooldown && new Date(cooldown.until) > now;
      const hosp = (t as any).hospitalizedUntil && new Date((t as any).hospitalizedUntil) > now;
      return {
        id: t._id,
        username: t.username,
        avatar: t.avatar,
        faction: (t as any).faction,
        level: t.level,
        rank: t.rank,
        district: t.district,
        wins: t.wins,
        losses: t.losses,
        wantedLevel: (t as any).wantedLevel,
        equippedFrame: (t as any).equippedFrame,
        isHospitalized: !!hosp,
        attackCooldown: onCooldown ? cooldown.until : null,
      };
    }));
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
    if (attacker.level < 10) return res.status(400).json({ message: "PvP unlocks at level 10" });
    if (attacker.district !== defender.district) return res.status(400).json({ message: "Target must be in the same district" });
    if (Math.abs(attacker.level - defender.level) > 25) return res.status(400).json({ message: "Target is too far outside your level range (max ±25)" });

    // Daily attack limit
    const now = new Date();
    if (attacker.attackResetAt < now) {
      attacker.attacksToday = 0;
      attacker.attackResetAt = new Date(new Date().setUTCHours(24, 0, 0, 0));
    }
    const maxAttacks = 15;
    if (attacker.attacksToday >= maxAttacks) return res.status(400).json({ message: `Daily PvP limit reached (${maxAttacks}/day)` });

    // Per-target cooldown
    const cdIdx = attacker.attackCooldowns.findIndex(c => c.targetId === targetId);
    if (cdIdx !== -1 && attacker.attackCooldowns[cdIdx].until > now) {
      return res.status(400).json({ message: "This target is on cooldown for 60 minutes", cooldownUntil: attacker.attackCooldowns[cdIdx].until });
    }

    attacker.attacksToday += 1;
    // Set per-target cooldown
    const newUntil = new Date(now.getTime() + 60 * 60 * 1000);
    if (cdIdx !== -1) {
      attacker.attackCooldowns[cdIdx].until = newUntil;
    } else {
      attacker.attackCooldowns.push({ targetId, until: newUntil });
    }

    // PvP formula per spec — load actual weapon strengthBonus and armor defenseBonus
    const [aWpn, dWpn, dArmor] = await Promise.all([
      attacker.equippedWeapon ? Item.findById(attacker.equippedWeapon).select("strengthBonus").lean() : null,
      defender.equippedWeapon ? Item.findById(defender.equippedWeapon).select("strengthBonus").lean() : null,
      defender.equippedArmor ? Item.findById(defender.equippedArmor).select("defenseBonus").lean() : null,
    ]);
    const aWpnBonus = aWpn?.strengthBonus ?? 0;
    const dWpnBonus = dWpn?.strengthBonus ?? 0;
    const dArmorBonus = dArmor?.defenseBonus ?? 0;
    const attackerRoll = (attacker.strength + Math.floor(Math.random() * 10)) + aWpnBonus;
    const defenderRoll = (defender.strength + Math.floor(Math.random() * 10)) + dWpnBonus + dArmorBonus;

    const attackerWins = attackerRoll > defenderRoll;
    attacker.totalFights += 1;
    defender.totalFights += 1;

    let dcGained = 0;
    let xpGained = 0;
    let defenderHospitalized = false;
    let attackerHospitalized = false;
    let leveled = false;
    let narrative = "";
    let atkHpLoss = 0;
    let defHpLoss = 0;

    if (attackerWins) {
      attacker.wins += 1;
      defender.losses += 1;

      // Steal 10% of wallet, cap 500,000 DC
      dcGained = Math.min(Math.floor(defender.dc * 0.10), 500000);
      if (user_faction_bonus(attacker)) dcGained = Math.floor(dcGained * 1.10);
      dcGained = Math.max(0, dcGained);
      attacker.dc = Math.min(attacker.dc + dcGained, 100_000_000);
      defender.dc = Math.max(0, defender.dc - dcGained);

      xpGained = 20 + attacker.level * 2;
      attacker.xp += xpGained;
      leveled = levelUp(attacker);

      // Attacker loses some HP
      atkHpLoss = Math.floor(5 + Math.random() * 15);
      attacker.health = Math.max(0, attacker.health - atkHpLoss);

      // Defender takes full damage
      defHpLoss = Math.floor(20 + Math.random() * 30);
      defender.health = Math.max(0, defender.health - defHpLoss);
      if (defender.health <= 0) {
        const hospDur = 20 + Math.floor(Math.random() * 10);
        defender.hospitalizedUntil = new Date(now.getTime() + hospDur * 60 * 1000);
        defender.health = 0;
        defenderHospitalized = true;
      }

      narrative = `Your roll: ${attackerRoll} vs ${defender.username}'s ${defenderRoll}. Victory. ${dcGained} DC seized from their wallet.${defenderHospitalized ? " They've been sent to the hospital." : ""}`;

      await Notification.create({
        userId: defender._id,
        type: "combat",
        message: `${attacker.username} attacked and defeated you. You lost ${dcGained} DC.${defenderHospitalized ? " You were hospitalized." : ""}`,
      }).catch(() => {});
    } else {
      attacker.losses += 1;
      defender.wins += 1;

      atkHpLoss = Math.floor(15 + Math.random() * 20);
      attacker.health = Math.max(0, attacker.health - atkHpLoss);
      if (attacker.health <= 0) {
        const hospDur = 20 + Math.floor(Math.random() * 10);
        attacker.hospitalizedUntil = new Date(now.getTime() + hospDur * 60 * 1000);
        attacker.health = 0;
        attackerHospitalized = true;
      }

      narrative = `Your roll: ${attackerRoll} vs ${defender.username}'s ${defenderRoll}. They repelled you.${attackerHospitalized ? " You were hospitalized." : ""}`;

      await Notification.create({
        userId: defender._id,
        type: "combat",
        message: `${attacker.username} attacked you, but you fought them off!`,
      }).catch(() => {});
    }

    // Atomic updates — use $inc so concurrent attacks on the same users don't overwrite each other.
    // attacksToday uses $set (not $inc) so a daily reset is reflected correctly in DB.
    const atkInc: Record<string, number> = { totalFights: 1 };
    const atkSet: Record<string, any> = {
      attacksToday: attacker.attacksToday,  // computed in-memory; handles reset + increment
      attackCooldowns: attacker.attackCooldowns,
      attackResetAt: attacker.attackResetAt,
    };
    if (attackerWins) {
      atkInc.wins = 1;
      atkInc.dc = dcGained;
      atkInc.xp = xpGained;
      if (attackerHospitalized) { atkSet.health = 0; atkSet.hospitalizedUntil = attacker.hospitalizedUntil; }
      else { atkInc.health = -atkHpLoss; }
      if (leveled) {
        atkSet.level = attacker.level; atkSet.xpToNext = attacker.xpToNext;
        atkSet.maxHealth = attacker.maxHealth; atkSet.maxEnergy = attacker.maxEnergy;
        atkSet.maxNerve = attacker.maxNerve; atkSet.rank = attacker.rank;
        atkSet.skillPoints = attacker.skillPoints;
      }
    } else {
      atkInc.losses = 1;
      if (attackerHospitalized) { atkSet.health = 0; atkSet.hospitalizedUntil = attacker.hospitalizedUntil; }
      else { atkInc.health = -atkHpLoss; }
    }

    const defInc: Record<string, number> = { totalFights: 1 };
    const defSet: Record<string, any> = {};
    if (attackerWins) {
      defInc.losses = 1;
      defInc.dc = -dcGained;
      if (defenderHospitalized) { defSet.health = 0; defSet.hospitalizedUntil = defender.hospitalizedUntil; }
      else { defInc.health = -defHpLoss; }
    } else {
      defInc.wins = 1;
    }

    await Promise.all([
      User.findByIdAndUpdate(attacker._id, { $inc: atkInc, $set: atkSet }),
      User.findByIdAndUpdate(defender._id, { $inc: defInc, ...(Object.keys(defSet).length ? { $set: defSet } : {}) }),
    ]);
    checkAchievements(String(req.userId)).catch(() => {});

    // pvp results go to notifications only, not the public feed

    res.json({
      attackerWins,
      narrative,
      dcGained,
      xpGained,
      leveled,
      defenderHospitalized,
      attackerHospitalized,
      attackerRoll,
      defenderRoll,
      user: {
        health: attacker.health,
        maxHealth: attacker.maxHealth,
        dc: attacker.dc,
        xp: attacker.xp,
        xpToNext: attacker.xpToNext,
        level: attacker.level,
        wins: attacker.wins,
        losses: attacker.losses,
        attacksToday: attacker.attacksToday,
        hospitalizedUntil: attacker.hospitalizedUntil,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "attack error");
    res.status(500).json({ message: "Internal server error" });
  }
});

function user_faction_bonus(user: InstanceType<typeof User>): boolean {
  return user.faction === "street";
}

export default router;
