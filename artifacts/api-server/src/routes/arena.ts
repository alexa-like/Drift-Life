/**
 * Arena — Tier 4 combat queue + turn-based match engine.
 * POST /api/arena/queue/join
 * POST /api/arena/queue/leave
 * GET  /api/arena/match/:matchId
 * POST /api/arena/match/:matchId/action
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import User, { computeMaxHp } from "../models/User";
import CombatMatch from "../models/CombatMatch";
import PlayerLoadout from "../models/PlayerLoadout";
import PlayerMiniGameInventory from "../models/PlayerMiniGameInventory";
import MiniGameItem from "../models/MiniGameItem";
import MiniGameLeaderboard from "../models/MiniGameLeaderboard";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { fireMissionEvent } from "../lib/missionEvents";
import { checkAchievements } from "./achievements";
import { emitFeedEvent } from "../lib/feedEvents";
import { announceLeaderboardMilestone } from "../lib/leaderboardHighlights";
import { getActiveFlashEvent, awardEventPoints } from "../lib/eventEngine";

const router = Router();

// ── AI name pool ──────────────────────────────────────────────────────────────
const AI_NAMES = [
  "Razor_K","Ghost_47","Viper_X","Neon_Dawn","Iron_Fist","Shadow_91","Blaze_7","Cypher_Zero",
  "Wraith_4","Apex_Reaper","Glitch_5","Toxin_88","Nova_Rex","Chrome_69","Static_X","Phantom_03",
  "Ruin_9","Havoc_77","Inferno_12","Surge_44","Dusk_Rider","Void_Echo","Titan_X3","Pulse_66",
  "Kraken_8","Specter_19","Null_77","Nexus_55","Omega_33","Flash_Kill","Steel_Nerve","Dark_Byte",
  "Tempest_7","Reaper_X0","Wrath_21","Blood_Fang","Terror_99","Night_Lock","Vex_73","Striker_Z",
  "Acid_Rain","Arc_Flash","Burn_Mark","Cold_Cut","Death_Wish","Edge_Lord","Fury_86","Grid_Lock",
  "Hex_Bomb","Ice_Pick",
];

// ── In-memory queue ───────────────────────────────────────────────────────────
interface QueueEntry {
  userId:    string;
  username:  string;
  level:     number;
  score:     number;
  joinedAt:  Date;
  loadout:   LoadoutSnapshot;
}

interface LoadoutSnapshot {
  // Legacy fields
  weapon:            string | null;
  armor:             string | null;
  consumable1:       string | null;
  consumable2:       string | null;
  ammoType:          string | null;
  hp:                number;
  damage:            number;
  defense:           number;
  accuracy:          number;
  weaponEffect?:      string | null;
  weaponEffectChance?: number;
  armorEffect?:       string | null;
  armorEffectChance?:  number;
  ammoArmorPierce?:   number;
  ammoEffect?:        string | null;
  ammoEffectChance?:  number;
  // New Tier 2 fields
  primaryWeaponId:   string | null;
  secondaryWeaponId: string | null;
  bodyArmorId:       string | null;
  consumableItemId:  string | null;
  consumableCount:   number;
  damageMin:         number;
  damageMax:         number;
  weaponAccuracy:    number;
  specialEffect:     string | null;
  specialChance:     number;
  armorHp:           number;
  strengthBonus:     number;
  armorBlocksStun?:   boolean;
  armorReflectPercent?: number;
}

const combatQueue = new Map<string, QueueEntry>();
const ENERGY_COST = 5; // Energy to queue for arena (replaces adrenaline)

// ── Score formula ─────────────────────────────────────────────────────────────
function skillScore(level: number, wins: number, totalFights: number, gearTier: number): number {
  const winRate = totalFights > 0 ? wins / totalFights : 0.5;
  return (level * 10) + (gearTier * 100) + (winRate * 50);
}

function tierToNumber(tier: string): number {
  return { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[tier] ?? 1;
}

// ── Resolve loadout stats ─────────────────────────────────────────────────────
async function resolveLoadoutStats(userId: string, level: number, prestige: number, accuracyBonus = 0): Promise<LoadoutSnapshot> {
  const loadout = await PlayerLoadout.findOne({ userId }).lean();
  const maxHp = computeMaxHp(level, prestige);

  if (!loadout) {
    return {
      weapon: null, armor: null, consumable1: null, consumable2: null, ammoType: null,
      hp: maxHp, damage: 15, defense: 0, accuracy: Math.min(99, 85 + Math.round(accuracyBonus * 100)),
      weaponEffect: null, weaponEffectChance: 0, armorEffect: null, armorEffectChance: 0,
      ammoArmorPierce: 0, ammoEffect: null, ammoEffectChance: 0,
      primaryWeaponId: null, secondaryWeaponId: null, bodyArmorId: null,
      consumableItemId: null, consumableCount: 0,
      damageMin: 10, damageMax: 20, weaponAccuracy: 75,
      specialEffect: null, specialChance: 0, armorHp: 0, strengthBonus: 0,
    };
  }

  // Fetch user strength
  const userDoc = await User.findById(userId).select("strength").lean();
  const strength = (userDoc as any)?.strength ?? 10;
  const strengthBonus = Math.floor(strength * 0.08);

  // Fetch item definitions
  const allIds = [
    loadout.primaryWeaponId,
    loadout.secondaryWeaponId,
    loadout.bodyArmorId,
    loadout.consumableItemId,
  ].filter(Boolean) as string[];
  const defs = allIds.length ? await MiniGameItem.find({ itemId: { $in: allIds } }).lean() : [];
  const defMap = Object.fromEntries(defs.map(d => [d.itemId, d]));

  const primaryWeapon   = loadout.primaryWeaponId   ? defMap[loadout.primaryWeaponId]   ?? null : null;
  const secondaryWeapon = loadout.secondaryWeaponId ? defMap[loadout.secondaryWeaponId] ?? null : null;
  const bodyArmor       = loadout.bodyArmorId       ? defMap[loadout.bodyArmorId]       ?? null : null;

  // Use primary weapon for combat stats; fall back to secondary
  const activeWeapon = primaryWeapon ?? secondaryWeapon;

  const damageMin      = (activeWeapon as any)?.stats?.damageMin ?? 10;
  const damageMax      = (activeWeapon as any)?.stats?.damageMax ?? 20;
  const weaponAccuracy = (activeWeapon as any)?.stats?.accuracy  ?? 75;
  const specialEffect  = (activeWeapon as any)?.stats?.specialEffect ?? null;
  const specialChance  = (activeWeapon as any)?.stats?.specialChance ?? 0;

  const damage   = Math.floor((damageMin + damageMax) / 2) + strengthBonus;
  const accuracy = Math.min(99, weaponAccuracy + Math.round(accuracyBonus * 100));

  const armorHp              = (bodyArmor as any)?.armorHp ?? 0;
  const armorSpecialEffect   = (bodyArmor as any)?.stats?.specialEffect ?? null;
  const armorSpecialChance   = (bodyArmor as any)?.stats?.specialChance ?? 0;
  const armorBlocksStun      = (bodyArmor as any)?.stats?.blocksStun ?? false;
  const armorReflectPercent  = (bodyArmor as any)?.stats?.reflectPercent ?? 0;

  return {
    // Legacy compat
    weapon:      loadout.primaryWeaponId,
    armor:       loadout.bodyArmorId,
    consumable1: loadout.consumableItemId,
    consumable2: null,
    ammoType:    null,
    hp:          maxHp,
    damage,
    defense:     0,
    accuracy,
    weaponEffect:       specialEffect,
    weaponEffectChance: specialChance,
    armorEffect:        armorSpecialEffect,
    armorEffectChance:  armorSpecialChance,
    ammoArmorPierce:    0,
    ammoEffect:         null,
    ammoEffectChance:   0,
    // New fields
    primaryWeaponId:   loadout.primaryWeaponId,
    secondaryWeaponId: loadout.secondaryWeaponId,
    bodyArmorId:       loadout.bodyArmorId,
    consumableItemId:  loadout.consumableItemId,
    consumableCount:   loadout.consumableCount,
    damageMin,
    damageMax,
    weaponAccuracy,
    specialEffect,
    specialChance,
    armorHp,
    strengthBonus,
    armorBlocksStun,
    armorReflectPercent,
  };
}

// ── AI loadout generator ──────────────────────────────────────────────────────
async function generateAILoadout(playerLevel: number): Promise<LoadoutSnapshot> {
  const tierTarget = playerLevel >= 30 ? "legendary" : playerLevel >= 20 ? "epic" : playerLevel >= 10 ? "rare" : playerLevel >= 5 ? "uncommon" : "common";
  const rifles  = await MiniGameItem.find({ category: "assault_rifle", tier: tierTarget }).lean();
  const armors  = await MiniGameItem.find({ category: "body_armor",    tier: tierTarget }).lean();

  const weapon = rifles.length ? rifles[Math.floor(Math.random() * rifles.length)] : null;
  const armor  = armors.length ? armors[Math.floor(Math.random() * armors.length)]  : null;

  const variance = 0.9 + Math.random() * 0.2;
  const maxHp = computeMaxHp(playerLevel, 0);
  const hp    = Math.floor(maxHp * variance);
  const damageMin: number = (weapon as any)?.stats?.damageMin ?? 10;
  const damageMax: number = (weapon as any)?.stats?.damageMax ?? 20;
  const strengthBonus = Math.floor(playerLevel * 0.08);
  const damage = Math.floor(((damageMin + damageMax) / 2 + strengthBonus) * variance);
  const weaponAccuracy: number = (weapon as any)?.stats?.accuracy ?? 75;
  const specialEffect: string | null = (weapon as any)?.stats?.specialEffect ?? null;
  const specialChance: number = (weapon as any)?.stats?.specialChance ?? 0;
  const armorHp: number = (armor as any)?.armorHp ?? 0;
  const armorSpecialEffect: string | null = (armor as any)?.stats?.specialEffect ?? null;
  const armorSpecialChance: number = (armor as any)?.stats?.specialChance ?? 0;

  return {
    weapon:      weapon?.itemId ?? null,
    armor:       armor?.itemId  ?? null,
    consumable1: null,
    consumable2: null,
    ammoType:    null,
    hp, damage, defense: 0,
    accuracy: Math.min(99, weaponAccuracy + Math.floor(Math.random() * 5)),
    weaponEffect:        specialEffect,
    weaponEffectChance:  specialChance,
    armorEffect:         armorSpecialEffect,
    armorEffectChance:   armorSpecialChance,
    ammoArmorPierce: 0, ammoEffect: null, ammoEffectChance: 0,
    primaryWeaponId:   weapon?.itemId ?? null,
    secondaryWeaponId: null,
    bodyArmorId:       armor?.itemId  ?? null,
    consumableItemId:  null,
    consumableCount:   0,
    damageMin,
    damageMax,
    weaponAccuracy,
    specialEffect,
    specialChance,
    armorHp,
    strengthBonus,
  };
}

// ── POST /api/arena/queue/join ────────────────────────────────────────────────
router.post("/queue/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("username level prestige wins totalFights energy maxEnergy combatWinStreak combatAccuracyBonus");
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    if (combatQueue.has(req.userId!)) {
      res.status(400).json({ message: "Already in queue" });
      return;
    }

    // Check for active match
    const active = await CombatMatch.findOne({ $or: [{ player1Id: req.userId }, { player2Id: req.userId }], status: { $in: ["waiting","active"] } });
    if (active) {
      res.json({ matchId: active.matchId, status: "already_in_match" });
      return;
    }

    // Deduct energy to queue
    if (user.energy < ENERGY_COST) {
      res.status(400).json({ message: `Not enough Energy — need ${ENERGY_COST} to queue for the arena` });
      return;
    }
    user.energy -= ENERGY_COST;
    await user.save();

    const loadout = await resolveLoadoutStats(req.userId!, user.level, (user as any).prestige ?? 0, (user as any).combatAccuracyBonus ?? 0);

    // Validate primary weapon requirement
    if (!loadout.primaryWeaponId) {
      // Refund energy
      user.energy = Math.min(user.maxEnergy, user.energy + ENERGY_COST);
      await user.save();
      res.status(400).json({ message: "You must equip a primary weapon to queue for the arena" });
      return;
    }

    // Check primary weapon has durability > 0
    const inv = await PlayerMiniGameInventory.findOne({ userId: req.userId }).lean();
    const primaryEntry = inv?.primaryWeapons.find(w => w.itemId === loadout.primaryWeaponId);
    if (!primaryEntry || primaryEntry.durability <= 0) {
      user.energy = Math.min(user.maxEnergy, user.energy + ENERGY_COST);
      await user.save();
      res.status(400).json({ message: "Your primary weapon is destroyed — repair or replace it before queuing" });
      return;
    }

    // Build warnings for missing ammo / armor + consumable clamp
    const warnings: string[] = [];

    // Clamp consumable count to actual inventory quantity (Issue 4)
    if (loadout.consumableItemId && loadout.consumableCount > 0) {
      const invConsumable = inv?.consumables.find(c => c.itemId === loadout.consumableItemId);
      const ownedQty = invConsumable?.quantity ?? 0;
      if (loadout.consumableCount > ownedQty) {
        loadout.consumableCount = ownedQty;
        if (ownedQty === 0) loadout.consumableItemId = null;
        warnings.push(`Consumable count clamped to ${ownedQty} — that's all you own`);
      }
    }
    const ammoCategory = loadout.primaryWeaponId
      ? await MiniGameItem.findOne({ itemId: loadout.primaryWeaponId }).select("ammoCategory").lean().then(d => (d as any)?.ammoCategory ?? null)
      : null;
    if (ammoCategory && inv?.ammo) {
      const ammoCount = (inv.ammo as any)[ammoCategory] ?? 0;
      if (ammoCount === 0) warnings.push(`No ${ammoCategory} in inventory — you'll fight with reduced effectiveness`);
    }
    if (!loadout.bodyArmorId) {
      warnings.push("No body armor equipped — you have no armor protection");
    }

    const score = skillScore(user.level, user.wins, user.totalFights, tierToNumber("common"));

    const entry: QueueEntry = {
      userId: req.userId!,
      username: user.username,
      level: user.level,
      score,
      joinedAt: new Date(),
      loadout,
    };
    combatQueue.set(req.userId!, entry);

    // Try immediate match
    const matchId = await tryMatch(entry);
    if (matchId) {
      combatQueue.delete(req.userId!);
      res.json({ matchId, status: "matched", warnings });
    } else {
      res.json({ status: "queued", position: combatQueue.size, warnings });
    }
  } catch (err) {
    req.log.error({ err }, "arena queue join error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/arena/queue/leave ───────────────────────────────────────────────
router.post("/queue/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!combatQueue.has(req.userId!)) {
      res.status(400).json({ message: "Not in queue" });
      return;
    }
    combatQueue.delete(req.userId!);
    await User.updateOne(
      { _id: req.userId },
      [{ $set: { energy: { $min: ["$maxEnergy", { $add: ["$energy", ENERGY_COST] }] } } }],
    );
    res.json({ message: "Left queue — energy refunded" });
  } catch (err) {
    req.log.error({ err }, "arena queue leave error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/arena/queue/status ───────────────────────────────────────────────
router.get("/queue/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const inQueue = combatQueue.has(req.userId!);
    const activeMatch = await CombatMatch.findOne({
      $or: [{ player1Id: req.userId }, { player2Id: req.userId }],
      status: { $in: ["waiting", "active"] },
    }).select("matchId status");
    res.json({ inQueue, activeMatch: activeMatch ? { matchId: activeMatch.matchId, status: activeMatch.status } : null });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

async function tryMatch(challenger: QueueEntry): Promise<string | null> {
  const SKILL_RANGE = 0.1;
  const candidates = [...combatQueue.values()].filter(e =>
    e.userId !== challenger.userId &&
    Math.abs(e.score - challenger.score) <= challenger.score * SKILL_RANGE,
  );

  if (candidates.length === 0) return null;

  const opponent = candidates[Math.floor(Math.random() * candidates.length)];
  combatQueue.delete(opponent.userId);

  const match = await CombatMatch.create({
    matchId:      randomUUID(),
    player1Id:    challenger.userId,
    player2Id:    opponent.userId,
    isPlayer2AI:  false,
    aiName:       null,
    player1Loadout: challenger.loadout,
    player2Loadout: opponent.loadout,
    player1HP:    challenger.loadout.hp,
    player2HP:    opponent.loadout.hp,
    player1CurrentArmorHp: challenger.loadout.armorHp,
    player2CurrentArmorHp: opponent.loadout.armorHp,
    status:       "active",
    currentTurn:  1,
    currentTurnDeadline: new Date(Date.now() + 60_000),
    rewardsGranted: false,
  });

  return match.matchId;
}

async function fillWithAI(entry: QueueEntry): Promise<string> {
  const user = await User.findById(entry.userId).select("level");
  const aiLoadout = await generateAILoadout(user?.level ?? 1);
  const aiName = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];

  const match = await CombatMatch.create({
    matchId:      randomUUID(),
    player1Id:    entry.userId,
    player2Id:    null,
    isPlayer2AI:  true,
    aiName,
    player1Loadout: entry.loadout,
    player2Loadout: aiLoadout,
    player1HP:    entry.loadout.hp,
    player2HP:    aiLoadout.hp,
    player1CurrentArmorHp: entry.loadout.armorHp,
    player2CurrentArmorHp: aiLoadout.armorHp,
    status:       "active",
    currentTurn:  1,
    currentTurnDeadline: new Date(Date.now() + 60_000),
    rewardsGranted: false,
  });

  return match.matchId;
}

// ── Queue worker ──────────────────────────────────────────────────────────────
async function matchPair(a: QueueEntry, b: QueueEntry): Promise<string> {
  const match = await CombatMatch.create({
    matchId:         randomUUID(),
    player1Id:       a.userId,
    player2Id:       b.userId,
    isPlayer2AI:     false,
    aiName:          null,
    player1Loadout:  a.loadout,
    player2Loadout:  b.loadout,
    player1HP:       a.loadout.hp,
    player2HP:       b.loadout.hp,
    player1CurrentArmorHp: a.loadout.armorHp,
    player2CurrentArmorHp: b.loadout.armorHp,
    status:          "active",
    currentTurn:     1,
    currentTurnDeadline: new Date(Date.now() + 60_000),
    rewardsGranted:  false,
  });
  return match.matchId;
}

setInterval(async () => {
  const now = Date.now();
  const entries = [...combatQueue.entries()];
  const matched = new Set<string>();

  for (const [userId, entry] of entries) {
    if (matched.has(userId)) continue;

    const age = now - entry.joinedAt.getTime();
    if (age < 5_000) continue;

    if (age >= 30_000) {
      combatQueue.delete(userId);
      matched.add(userId);
      await fillWithAI(entry).catch(() => {});
      continue;
    }

    const range = age >= 15_000 ? 0.25 : 0.10;
    const opp = entries.find(([id, e]) =>
      id !== userId &&
      !matched.has(id) &&
      Math.abs(e.score - entry.score) <= entry.score * range,
    );
    if (opp) {
      const [oppId, oppEntry] = opp;
      combatQueue.delete(userId);
      combatQueue.delete(oppId);
      matched.add(userId);
      matched.add(oppId);
      await matchPair(entry, oppEntry).catch(() => {});
    }
  }
}, 5_000);

// ── GET /api/arena/match/:matchId ─────────────────────────────────────────────
router.get("/match/:matchId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const match = await CombatMatch.findOne({ matchId: req.params["matchId"] }).lean();
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }

    const isPlayer1 = match.player1Id?.toString() === req.userId;
    const isPlayer2 = match.player2Id?.toString() === req.userId;
    if (!isPlayer1 && !isPlayer2) { res.status(403).json({ message: "Not your match" }); return; }

    res.json({ match });
  } catch (err) {
    req.log.error({ err }, "arena match get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Element effect configuration ─────────────────────────────────────────────
interface ActiveEffect { effect: string; turnsLeft: number; value: number; }

const EFFECT_CONFIG: Record<string, { turns: number; value: number }> = {
  burn:       { turns: 3, value: 10 },
  bleed:      { turns: 3, value: 5  },
  toxic:      { turns: 4, value: 8  },
  shock:      { turns: 1, value: 0  },
  stun:       { turns: 1, value: 0  },
  regen:      { turns: 2, value: 15 },
  regen_field:{ turns: 99,value: 20 },
  berserk:    { turns: 4, value: 0  }, // handled in fireWeapon multiplier
  shield:     { turns: 2, value: 100 }, // adds temporary armorHp
};

/** Apply start-of-turn effects (DoT, regen, stun) to both players. */
function applyActiveEffects(
  p1HP: number, p2HP: number,
  p1Max: number, p2Max: number,
  p1Effects: ActiveEffect[], p2Effects: ActiveEffect[],
  p1Name: string, p2Name: string,
): { p1HP: number; p2HP: number; p1Effects: ActiveEffect[]; p2Effects: ActiveEffect[]; narratives: string[]; p1Stunned: boolean; p2Stunned: boolean } {
  const narratives: string[] = [];

  function tick(hp: number, max: number, effects: ActiveEffect[], name: string) {
    const remaining: ActiveEffect[] = [];
    let stunned = false;
    for (const eff of effects) {
      if (["burn", "bleed", "toxic"].includes(eff.effect)) {
        hp = Math.max(0, hp - eff.value);
        const left = eff.turnsLeft - 1;
        narratives.push(`${name} takes ${eff.value} ${eff.effect} damage${left > 0 ? ` (${left} turns left)` : " — effect fades"}`);
        if (left > 0) remaining.push({ ...eff, turnsLeft: left });
      } else if (["regen", "regen_field"].includes(eff.effect)) {
        const gained = Math.min(eff.value, max - hp);
        hp = Math.min(max, hp + eff.value);
        const left = eff.turnsLeft - 1;
        if (gained > 0) narratives.push(`${name} regenerates ${gained} HP`);
        if (left > 0) remaining.push({ ...eff, turnsLeft: left });
      } else if (["stun", "shock"].includes(eff.effect)) {
        stunned = true;
        narratives.push(`${name} is stunned — action skipped!`);
      }
    }
    return { hp, effects: remaining, stunned };
  }

  const r1 = tick(p1HP, p1Max, p1Effects, p1Name);
  const r2 = tick(p2HP, p2Max, p2Effects, p2Name);

  return { p1HP: r1.hp, p2HP: r2.hp, p1Effects: r1.effects, p2Effects: r2.effects, narratives, p1Stunned: r1.stunned, p2Stunned: r2.stunned };
}

/** Push a new status effect onto a player's active effects (refreshes if already present). */
function addEffect(effects: ActiveEffect[], effectName: string): ActiveEffect[] {
  const cfg = EFFECT_CONFIG[effectName];
  if (!cfg) return effects;
  const others = effects.filter(e => e.effect !== effectName);
  return [...others, { effect: effectName, turnsLeft: cfg.turns, value: cfg.value }];
}

// ── Damage formula (legacy — kept for auto-resolve and backward compat) ───────
function calcDamage(
  attackerLoadout: LoadoutSnapshot,
  defenderLoadout: LoadoutSnapshot,
  attackerName: string,
  defenderName: string,
  weaponName: string | null,
  isDefending: boolean,
): { damage: number; narrative: string; isCrit: boolean; triggeredEffect: string | null; extraAttack: boolean; retaliateDmg: number } {

  const defArmorEffect  = defenderLoadout.armorEffect  ?? null;
  const defArmorChance  = defenderLoadout.armorEffectChance  ?? 0;
  const atkWeaponEffect = attackerLoadout.weaponEffect ?? null;
  const atkWeaponChance = attackerLoadout.weaponEffectChance ?? 0;
  const atkAmmoEffect   = attackerLoadout.ammoEffect   ?? null;
  const atkAmmoChance   = attackerLoadout.ammoEffectChance   ?? 0;
  const atkArmoPierce   = attackerLoadout.ammoArmorPierce    ?? 0;

  if (defArmorEffect === "dodge" && Math.random() * 100 < defArmorChance) {
    return { damage: 0, narrative: `${defenderName} dodges the attack!`, isCrit: false, triggeredEffect: null, extraAttack: false, retaliateDmg: 0 };
  }

  const hit = Math.random() * 100 < (attackerLoadout.accuracy ?? 85);
  if (!hit) return { damage: 0, narrative: `${attackerName} missed!`, isCrit: false, triggeredEffect: null, extraAttack: false, retaliateDmg: 0 };

  if (defArmorEffect === "block" && Math.random() * 100 < defArmorChance) {
    return { damage: 0, narrative: `${defenderName} blocks the attack completely!`, isCrit: false, triggeredEffect: null, extraAttack: false, retaliateDmg: 0 };
  }

  const effectiveDefense = Math.floor(defenderLoadout.defense * (1 - atkArmoPierce));
  const defBonus = isDefending ? Math.floor(effectiveDefense * 0.5) : 0;

  const variance = Math.floor((Math.random() - 0.3) * 12);
  const base = Math.max(1, attackerLoadout.damage + variance);
  const raw = Math.max(1, base - effectiveDefense - defBonus);

  const naturalCrit = Math.random() < 0.1;
  const critNegated = naturalCrit && defArmorEffect === "anti_crit" && Math.random() * 100 < defArmorChance;
  const isCrit = naturalCrit && !critNegated;

  let finalDmg = isCrit ? Math.floor(raw * 1.5) : raw;
  if (atkWeaponEffect === "headshot" && Math.random() * 100 < atkWeaponChance) {
    finalDmg = Math.floor(finalDmg * 1.5);
  }

  const extraAttack = atkWeaponEffect === "double_fire" && Math.random() * 100 < atkWeaponChance;

  let triggeredEffect: string | null = null;
  if (atkWeaponEffect && EFFECT_CONFIG[atkWeaponEffect] && Math.random() * 100 < atkWeaponChance) {
    triggeredEffect = atkWeaponEffect;
  }
  if (!triggeredEffect && atkAmmoEffect && EFFECT_CONFIG[atkAmmoEffect]) {
    if (Math.random() * 100 < atkAmmoChance) {
      triggeredEffect = atkAmmoEffect;
    }
  }

  const retaliateDmg = (defArmorEffect === "retaliate" && Math.random() * 100 < defArmorChance) ? 30 : 0;

  const weapon = weaponName ?? "fists";
  let narrative = `${attackerName} hits ${defenderName} with ${weapon} for ${finalDmg} damage`;
  if (isCrit)             narrative += " [CRITICAL!]";
  if (critNegated)        narrative += " [crit blocked]";
  if (isDefending && defBonus > 0) narrative += ` (blocked ${defBonus})`;
  if (atkArmoPierce > 0) narrative += " [AP]";
  if (extraAttack)        narrative += " — fires again!";
  if (triggeredEffect)    narrative += ` [${triggeredEffect.toUpperCase()}!]`;
  if (retaliateDmg > 0)   narrative += ` ↩ ${defenderName} retaliates for ${retaliateDmg}`;

  return { damage: finalDmg, narrative, isCrit, triggeredEffect, extraAttack, retaliateDmg };
}

// ── New Tier 3 weapon fire helper ─────────────────────────────────────────────
interface FireResult {
  damage: number;
  narrative: string;
  triggeredEffect: string | null;
  extraAttack: boolean;
  armorAbsorbed: number;
  newArmorHp: number;
}

function fireWeapon(
  attackerName: string,
  defenderName: string,
  weaponName: string,
  damageMin: number,
  damageMax: number,
  weaponAccuracy: number,
  specialEffect: string | null,
  specialChance: number,
  strengthBonus: number,
  defenderArmorHp: number,
  defenderArmorEffect: string | null,
  defenderArmorChance: number,
  multiplier = 1,
): FireResult {
  // Accuracy roll
  if (Math.random() * 100 > weaponAccuracy) {
    return { damage: 0, narrative: `${attackerName} missed with ${weaponName}!`, triggeredEffect: null, extraAttack: false, armorAbsorbed: 0, newArmorHp: defenderArmorHp };
  }

  // Base damage roll
  const rolled = Math.floor(Math.random() * (damageMax - damageMin + 1)) + damageMin;
  let rawDmg = Math.max(1, Math.floor((rolled + strengthBonus) * multiplier));

  // Armor absorb special effect
  let armorAbsorbed = 0;
  let newArmorHp = defenderArmorHp;
  if (defenderArmorEffect === "absorb" && Math.random() * 100 < defenderArmorChance) {
    rawDmg = Math.floor(rawDmg * 0.85);
  }

  // armor_pierce: skip armor
  const armorPierce = specialEffect === "armor_pierce";

  if (!armorPierce && newArmorHp > 0) {
    armorAbsorbed = Math.min(newArmorHp, rawDmg);
    newArmorHp = Math.max(0, newArmorHp - rawDmg);
    rawDmg = Math.max(0, rawDmg - armorAbsorbed);
  }

  let triggeredEffect: string | null = null;
  let extraAttack = false;
  const narrativeParts: string[] = [`${attackerName} fires ${weaponName} at ${defenderName} for ${rawDmg} dmg`];

  if (armorAbsorbed > 0) narrativeParts.push(`(${armorAbsorbed} absorbed by armor)`);
  if (armorPierce)        narrativeParts.push("[ARMOR PIERCE]");

  if (specialEffect && specialChance > 0 && Math.random() * 100 < specialChance) {
    switch (specialEffect) {
      case "bleed":
        triggeredEffect = "bleed";
        narrativeParts.push("[BLEED!]");
        break;
      case "stun":
        triggeredEffect = "stun";
        narrativeParts.push("[STUN!]");
        break;
      case "knockback":
        triggeredEffect = "knockback";
        narrativeParts.push("[KNOCKBACK!]");
        break;
      case "double_tap":
        extraAttack = true;
        narrativeParts.push("[DOUBLE TAP!]");
        break;
      case "armor_pierce":
        // already handled above
        break;
      case "berserk":
        triggeredEffect = "berserk";
        narrativeParts.push("[BERSERK!]");
        break;
      case "shield":
        triggeredEffect = "shield";
        narrativeParts.push("[SHIELD!]");
        break;
    }
  }

  return {
    damage: rawDmg,
    narrative: narrativeParts.join(" "),
    triggeredEffect,
    extraAttack,
    armorAbsorbed,
    newArmorHp,
  };
}

function aiPickAction(match: any, aiIsP2: boolean, aiConsumablesUsed: string[]): string {
  const myHP     = aiIsP2 ? match.player2HP : match.player1HP;
  const myMaxHP  = aiIsP2 ? match.player2Loadout.hp : match.player1Loadout.hp;
  const myLoadout: LoadoutSnapshot = aiIsP2 ? match.player2Loadout : match.player1Loadout;
  const pct = myHP / myMaxHP;

  const hasConsumable = myLoadout.consumableItemId && !aiConsumablesUsed.includes(myLoadout.consumableItemId ?? "") && (myLoadout.consumableCount ?? 0) > 0;
  if (pct < 0.35 && hasConsumable) return "use_consumable";

  const turns = match.turns ?? [];
  if (turns.length >= 2) {
    const prev   = turns[turns.length - 2];
    const latest = turns[turns.length - 1];
    const prevHP   = aiIsP2 ? prev.player2HpAfter   : prev.player1HpAfter;
    const latestHP = aiIsP2 ? latest.player2HpAfter : latest.player1HpAfter;
    const dmgLastTurn = prevHP - latestHP;
    if (dmgLastTurn > myMaxHP * 0.2 && Math.random() < 0.4) return "defend";
  }
  if (pct < 0.5 && Math.random() < 0.2) return "defend";

  const roll = Math.random();
  if (roll < 0.65) return "fire_primary";
  if (roll < 0.80) return "defend";
  return "fire_primary";
}

// ── Resolve consumable heal amount ────────────────────────────────────────────
async function resolveHealAmount(itemId: string | null): Promise<number> {
  if (!itemId) return 30;
  const def = await MiniGameItem.findOne({ itemId }).lean();
  return (def as any)?.stats?.healAmount ?? 30;
}

// ── POST /api/arena/match/:matchId/action ─────────────────────────────────────
router.post("/match/:matchId/action", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action: rawAction, expectedTurn } = req.body as {
      action: string;
      expectedTurn?: number;
    };

    // Normalize action aliases
    const ACTION_MAP: Record<string, string> = {
      attack:       "fire_primary",
      fire_primary: "fire_primary",
      fire_secondary: "fire_secondary",
      use_item:     "use_consumable",
      use_consumable: "use_consumable",
      reload:       "reload",
      special:      "special",
      melee:        "melee",
      defend:       "defend",
    };
    const action = ACTION_MAP[rawAction];
    if (!action) {
      res.status(400).json({ message: "Invalid action" }); return;
    }

    const match = await CombatMatch.findOne({
      matchId: req.params["matchId"],
      status:  "active",
      ...(expectedTurn != null ? { currentTurn: expectedTurn } : {}),
    });
    if (!match) {
      const exists = await CombatMatch.findOne({ matchId: req.params["matchId"] }).select("status currentTurn").lean();
      if (!exists) { res.status(404).json({ message: "Match not found" }); return; }
      if (exists.status !== "active") { res.status(400).json({ message: "Match is not active" }); return; }
      res.status(409).json({ message: "Turn already resolved — refresh match state", currentTurn: exists.currentTurn });
      return;
    }

    const isP1 = match.player1Id?.toString() === req.userId;
    const isP2 = !match.isPlayer2AI && match.player2Id?.toString() === req.userId;
    if (!isP1 && !isP2) { res.status(403).json({ message: "Not your match" }); return; }

    // Simultaneous resolution: both players submit independently; no "not your turn" block.
    // (For AI matches: player submits, AI resolves same turn below.)

    const [p1User, p2NameResolved] = await Promise.all([
      User.findById(match.player1Id).select("username").lean(),
      match.isPlayer2AI ? Promise.resolve(match.aiName || "Opponent") : User.findById(match.player2Id).select("username").lean().then(u => (u as any)?.username ?? "Opponent"),
    ]);
    const p1Name = (p1User as any)?.username ?? "Player";
    const p2Name = p2NameResolved;

    const lastTurn = match.turns[match.turns.length - 1];
    const p1WasDefending = action === "defend" && isP1 || (lastTurn?.player1Action === "defend");
    const p2WasDefending = action === "defend" && isP2 || (lastTurn?.player2Action === "defend");

    const p1ConsUsed = match.player1ConsumablesUsed ?? [];
    const p2ConsUsed = match.player2ConsumablesUsed ?? [];

    let p1Effects: ActiveEffect[] = ((match as any).player1ActiveEffects ?? []) as ActiveEffect[];
    let p2Effects: ActiveEffect[] = ((match as any).player2ActiveEffects ?? []) as ActiveEffect[];

    // ── Apply start-of-turn status effects ────────────────────────────────────
    const efxResult = applyActiveEffects(
      match.player1HP, match.player2HP,
      match.player1Loadout.hp, match.player2Loadout.hp,
      p1Effects, p2Effects,
      p1Name, p2Name,
    );
    let p1HPAfter = efxResult.p1HP;
    let p2HPAfter = efxResult.p2HP;
    p1Effects = efxResult.p1Effects;
    p2Effects = efxResult.p2Effects;
    const efxNarratives = efxResult.narratives;

    // Check stun/knockback flags from previous turn (simultaneous resolution)
    const p1StunNextTurn = (match as any).player1StunNextTurn ?? false;
    const p2StunNextTurn = (match as any).player2StunNextTurn ?? false;
    const p1KnockedBack = (match as any).player1KnockedBack ?? false;
    const p2KnockedBack = (match as any).player2KnockedBack ?? false;
    // Reset per-turn flags
    (match as any).player1StunNextTurn = false;
    (match as any).player2StunNextTurn = false;
    (match as any).player1KnockedBack = false;
    (match as any).player2KnockedBack = false;

    const p1Stunned = efxResult.p1Stunned || p1StunNextTurn;
    const p2Stunned = efxResult.p2Stunned || p2StunNextTurn;

    const myStunned = (isP1 && (p1Stunned || p1KnockedBack)) || (isP2 && (p2Stunned || p2KnockedBack));
    const effectiveAction = myStunned ? "melee" : action;

    let narrative = "";
    let player1Effect: string | null = null;
    let player2Effect: string | null = null;

    // ── Early-exit: DoT may have already killed someone ────────────────────────
    const dotKilledP1 = p1HPAfter <= 0;
    const dotKilledP2 = p2HPAfter <= 0;
    if (dotKilledP1 || dotKilledP2) {
      const dotNarrative = efxNarratives.join(" | ") || "Status effect ended the match";
      match.turns.push({
        turnNumber:     match.currentTurn,
        player1Action:  "auto_attack" as any,
        player2Action:  "auto_attack" as any,
        player1HpAfter: p1HPAfter,
        player2HpAfter: p2HPAfter,
        player1Effect:  null,
        player2Effect:  null,
        narrative:      dotNarrative,
        resolvedAt:     new Date(),
      });
      match.player1HP = p1HPAfter;
      match.player2HP = p2HPAfter;
      match.currentTurn += 1;
      match.currentTurnDeadline = new Date(Date.now() + 60_000);
      (match as any).player1ActiveEffects = p1Effects;
      (match as any).player2ActiveEffects = p2Effects;
      match.status = "complete";
      if (dotKilledP1 && dotKilledP2) match.winnerId = null;
      else if (dotKilledP2)           match.winnerId = match.player1Id;
      else                            match.winnerId = match.player2Id ?? null;
      match.rewardsGranted = false;
      await match.save();
      const claimed = await CombatMatch.findOneAndUpdate(
        { matchId: match.matchId, rewardsGranted: false },
        { $set: { rewardsGranted: true } },
        { new: false },
      );
      if (claimed) await grantCombatRewards(match);
      res.json({ match });
      return;
    }

    // Current armor HP values (live from match document)
    let p1ArmorHp = (match as any).player1CurrentArmorHp ?? match.player1Loadout.armorHp ?? 0;
    let p2ArmorHp = (match as any).player2CurrentArmorHp ?? match.player2Loadout.armorHp ?? 0;

    // ── Apply player action ────────────────────────────────────────────────────
    if (effectiveAction === "defend") {
      narrative = myStunned
        ? `${isP1 ? p1Name : p2Name} is stunned and cannot act!`
        : `${isP1 ? p1Name : p2Name} braces for impact`;

    } else if (effectiveAction === "use_consumable") {
      const myLoadout = isP1 ? match.player1Loadout : match.player2Loadout;
      const myConsUsed = isP1 ? p1ConsUsed : p2ConsUsed;
      const consumable = myLoadout.consumableItemId && !myConsUsed.includes(myLoadout.consumableItemId ?? "") && (myLoadout.consumableCount ?? 0) > 0
        ? myLoadout.consumableItemId : null;
      if (!consumable) { res.status(400).json({ message: "No consumable available" }); return; }

      const consDef = await MiniGameItem.findOne({ itemId: consumable }).lean();
      const consEffect = (consDef as any)?.stats?.specialEffect ?? null;
      const healAmount = await resolveHealAmount(consumable);

      if (isP1) {
        p1HPAfter = Math.min(match.player1Loadout.hp, p1HPAfter + healAmount);
        match.player1ConsumablesUsed = [...p1ConsUsed, consumable];
        player1Effect = "heal";
        if (consEffect === "regen" || consEffect === "regen_field") p1Effects = addEffect(p1Effects, consEffect);
        if (consEffect === "clear_bleed") p1Effects = p1Effects.filter(e => e.effect !== "bleed");
      } else {
        p2HPAfter = Math.min(match.player2Loadout.hp, p2HPAfter + healAmount);
        match.player2ConsumablesUsed = [...p2ConsUsed, consumable];
        player2Effect = "heal";
        if (consEffect === "regen" || consEffect === "regen_field") p2Effects = addEffect(p2Effects, consEffect);
        if (consEffect === "clear_bleed") p2Effects = p2Effects.filter(e => e.effect !== "bleed");
      }
      narrative = `${isP1 ? p1Name : p2Name} used ${(consDef as any)?.name ?? "consumable"} — healed ${healAmount} HP`;
      fireMissionEvent(String(req.userId), "consumable").catch(() => {});

    } else if (effectiveAction === "melee") {
      // Melee: strength-based, always hits, no weapon needed (spec 3.10)
      const userDoc = await User.findById(req.userId).select("strength").lean();
      const strength = (userDoc as any)?.strength ?? 10;
      const meleeDmg = Math.floor(Math.random() * 7) + 8 + Math.floor(strength * 0.05);
      const attackerName = isP1 ? p1Name : p2Name;
      const defenderName = isP1 ? (match.isPlayer2AI ? (match.aiName || "Opponent") : p2Name) : p1Name;
      if (isP1) {
        p2HPAfter = Math.max(0, p2HPAfter - meleeDmg);
        player2Effect = "hit";
      } else {
        p1HPAfter = Math.max(0, p1HPAfter - meleeDmg);
        player1Effect = "hit";
      }
      narrative = `${attackerName} smashes ${defenderName} for ${meleeDmg} melee damage!`;

    } else {
      // fire_primary / fire_secondary / reload / special
      const attackerName = isP1 ? p1Name : (match.isPlayer2AI ? (match.aiName || "Opponent") : p2Name);
      const defenderName = isP1 ? (match.isPlayer2AI ? (match.aiName || "Opponent") : p2Name) : p1Name;
      const attackerLoadout = isP1 ? match.player1Loadout : match.player2Loadout;
      const defenderArmorHp = isP1 ? p2ArmorHp : p1ArmorHp;
      const defenderArmorEffect = isP1 ? (match.player2Loadout.armorEffect ?? null) : (match.player1Loadout.armorEffect ?? null);
      const defenderArmorChance = isP1 ? (match.player2Loadout.armorEffectChance ?? 0) : (match.player1Loadout.armorEffectChance ?? 0);
      const defenderBlocksStun     = isP1 ? !!(match.player2Loadout as any).armorBlocksStun     : !!(match.player1Loadout as any).armorBlocksStun;
      const defenderReflectPercent = isP1 ? ((match.player2Loadout as any).armorReflectPercent ?? 0) : ((match.player1Loadout as any).armorReflectPercent ?? 0);

      const isPrimary = effectiveAction === "fire_primary" || effectiveAction === "reload" || effectiveAction === "special";

      // ── Ammo check: if out of ammo for fire_primary/fire_secondary, fall back to melee ──
      let ammoFallbackToMelee = false;
      if ((effectiveAction === "fire_primary" || effectiveAction === "fire_secondary") && !match.isPlayer2AI) {
        const checkWeaponId = isPrimary
          ? (attackerLoadout.primaryWeaponId ?? attackerLoadout.weapon)
          : (attackerLoadout.secondaryWeaponId ?? null);
        if (checkWeaponId) {
          const checkWeaponDef = await MiniGameItem.findOne({ itemId: checkWeaponId }).select("ammoCategory").lean();
          const checkAmmoCategory = (checkWeaponDef as any)?.ammoCategory ?? null;
          if (checkAmmoCategory) {
            const attackerUserId = isP1 ? match.player1Id?.toString() : match.player2Id?.toString();
            if (attackerUserId) {
              const attackerInv = await PlayerMiniGameInventory.findOne({ userId: attackerUserId }).lean();
              const ammoCount = attackerInv ? ((attackerInv.ammo as any)?.[checkAmmoCategory] ?? 0) : 0;
              if (ammoCount <= 0) {
                ammoFallbackToMelee = true;
                const userDocMelee = await User.findById(attackerUserId).select("strength").lean();
                const strengthMelee = (userDocMelee as any)?.strength ?? 10;
                const meleeDmgFallback = Math.floor(Math.random() * 7) + 8 + Math.floor(strengthMelee * 0.05);
                if (isP1) {
                  p2HPAfter = Math.max(0, p2HPAfter - meleeDmgFallback);
                  player2Effect = "hit";
                } else {
                  p1HPAfter = Math.max(0, p1HPAfter - meleeDmgFallback);
                  player1Effect = "hit";
                }
                narrative = `Out of ammo -- melee attack! ${attackerName} smashes ${defenderName} for ${meleeDmgFallback} damage`;
                (match as any).player1CurrentArmorHp = p1ArmorHp;
                (match as any).player2CurrentArmorHp = p2ArmorHp;
              }
            }
          }
        }
      }

      if (!ammoFallbackToMelee) {
        const weaponItemId = isPrimary
          ? (attackerLoadout.primaryWeaponId ?? attackerLoadout.weapon)
          : (attackerLoadout.secondaryWeaponId ?? null);

        const weaponDef = weaponItemId ? await MiniGameItem.findOne({ itemId: weaponItemId }).lean() : null;
        const weaponName = (weaponDef as any)?.name ?? (isPrimary ? "Primary Weapon" : "Secondary Weapon");

        const damageMin: number = (attackerLoadout as any).damageMin ?? (weaponDef as any)?.stats?.damageMin ?? 10;
        const damageMax: number = (attackerLoadout as any).damageMax ?? (weaponDef as any)?.stats?.damageMax ?? 20;
        const weaponAccuracy: number = (attackerLoadout as any).weaponAccuracy ?? (weaponDef as any)?.stats?.accuracy ?? 75;
        const specialEffect: string | null = (attackerLoadout as any).specialEffect ?? (weaponDef as any)?.stats?.specialEffect ?? null;
        const specialChance: number = (attackerLoadout as any).specialChance ?? (weaponDef as any)?.stats?.specialChance ?? 0;
        const strengthBonus: number = (attackerLoadout as any).strengthBonus ?? 0;

        let multiplier = 1;
        if (effectiveAction === "special") multiplier = 1.5;
        if (effectiveAction === "reload")  multiplier = 0.6;

        const result = fireWeapon(
          attackerName, defenderName, weaponName,
          damageMin, damageMax, weaponAccuracy,
          specialEffect, specialChance, strengthBonus,
          defenderArmorHp, defenderArmorEffect, defenderArmorChance,
          multiplier,
        );

        // Helper: apply triggered effect to defender/attacker
        function applyTriggeredEffect(triggeredEffect: string | null, toDefenderEffects: ActiveEffect[], toAttackerEffects: ActiveEffect[], defenderArmorHpRef: { val: number }, attackerHpRef: { val: number }, defenderHpRef: { val: number }, dmgHit: number, setDefenderStun: () => void, setDefenderKnockback: () => void) {
          if (!triggeredEffect) return { defEffects: toDefenderEffects, atkEffects: toAttackerEffects };
          let defEffects = toDefenderEffects;
          let atkEffects = toAttackerEffects;
          if (triggeredEffect === "stun") {
            if (defenderBlocksStun) {
              // Legendary armor perk (e.g. Exo-Armor): stun negated entirely.
            } else {
              setDefenderStun();
            }
          } else if (triggeredEffect === "knockback") {
            setDefenderKnockback();
          } else if (triggeredEffect === "bleed") {
            // bleed: dps = floor(hitDamage * 0.08), 2 turns (spec 3.3)
            const bleedDps = Math.max(1, Math.floor(dmgHit * 0.08));
            const existing = defEffects.find(e => e.effect === "bleed");
            defEffects = defEffects.filter(e => e.effect !== "bleed");
            defEffects = [...defEffects, { effect: "bleed", turnsLeft: 2, value: existing ? Math.max(existing.value, bleedDps) : bleedDps }];
          } else if (triggeredEffect === "shield") {
            // shield: adds 100 temp armorHp to attacker for 2 turns (spec 3.3)
            atkEffects = addEffect(atkEffects, "shield");
          } else if (triggeredEffect === "berserk") {
            // berserk: store on attacker for 4 turns (spec 3.3)
            atkEffects = addEffect(atkEffects, "berserk");
          } else if (EFFECT_CONFIG[triggeredEffect]) {
            defEffects = addEffect(defEffects, triggeredEffect);
          }
          return { defEffects, atkEffects };
        }

        if (isP1) {
          p2HPAfter  = Math.max(0, p2HPAfter - result.damage);
          p2ArmorHp  = result.newArmorHp;
          if (result.damage > 0) player2Effect = "hit";
          const { defEffects: newP2Efx, atkEffects: newP1Efx } = applyTriggeredEffect(
            result.triggeredEffect, p2Effects, p1Effects,
            { val: p2ArmorHp }, { val: p1HPAfter }, { val: p2HPAfter },
            result.damage,
            () => { (match as any).player2StunNextTurn = true; },
            () => { (match as any).player2KnockedBack = true; },
          );
          p2Effects = newP2Efx; p1Effects = newP1Efx;
          // Shield: apply armorHp bonus to attacker (p1)
          if (result.triggeredEffect === "shield") p1ArmorHp += 100;
          // Reflect: defender's armor reflects a % of the hit back at the attacker
          if (result.damage > 0 && defenderReflectPercent > 0) {
            const reflected = Math.max(0, Math.floor(result.damage * (defenderReflectPercent / 100)));
            if (reflected > 0) {
              p1HPAfter = Math.max(0, p1HPAfter - reflected);
              narrative = result.narrative + ` | Exo-Armor reflects ${reflected} dmg back!`;
            }
          }
          // Double tap: second shot
          if (result.extraAttack) {
            const r2 = fireWeapon(
              attackerName, defenderName, weaponName,
              damageMin, damageMax, weaponAccuracy,
              null, 0, strengthBonus,
              p2ArmorHp, defenderArmorEffect, defenderArmorChance,
            );
            p2HPAfter = Math.max(0, p2HPAfter - r2.damage);
            p2ArmorHp = r2.newArmorHp;
            narrative = result.narrative + ` | Second shot: ${r2.narrative}`;
            if (r2.damage > 0 && defenderReflectPercent > 0) {
              const reflected2 = Math.max(0, Math.floor(r2.damage * (defenderReflectPercent / 100)));
              if (reflected2 > 0) {
                p1HPAfter = Math.max(0, p1HPAfter - reflected2);
                narrative += ` | Exo-Armor reflects ${reflected2} dmg back!`;
              }
            }
            if (isPrimary) (match as any).player1RoundsFiredPrimary = ((match as any).player1RoundsFiredPrimary ?? 0) + 1; // count second tap too
          }
          // Track rounds fired
          if (isPrimary) (match as any).player1RoundsFiredPrimary = ((match as any).player1RoundsFiredPrimary ?? 0) + 1;
          else           (match as any).player1RoundsFiredSecondary = ((match as any).player1RoundsFiredSecondary ?? 0) + 1;
        } else {
          p1HPAfter  = Math.max(0, p1HPAfter - result.damage);
          p1ArmorHp  = result.newArmorHp;
          if (result.damage > 0) player1Effect = "hit";
          const { defEffects: newP1Efx, atkEffects: newP2Efx } = applyTriggeredEffect(
            result.triggeredEffect, p1Effects, p2Effects,
            { val: p1ArmorHp }, { val: p2HPAfter }, { val: p1HPAfter },
            result.damage,
            () => { (match as any).player1StunNextTurn = true; },
            () => { (match as any).player1KnockedBack = true; },
          );
          p1Effects = newP1Efx; p2Effects = newP2Efx;
          // Shield: apply armorHp bonus to attacker (p2)
          if (result.triggeredEffect === "shield") p2ArmorHp += 100;
          // Reflect: defender's armor reflects a % of the hit back at the attacker
          if (result.damage > 0 && defenderReflectPercent > 0) {
            const reflected = Math.max(0, Math.floor(result.damage * (defenderReflectPercent / 100)));
            if (reflected > 0) {
              p2HPAfter = Math.max(0, p2HPAfter - reflected);
              narrative = result.narrative + ` | Exo-Armor reflects ${reflected} dmg back!`;
            }
          }
          if (result.extraAttack) {
            const r2 = fireWeapon(
              attackerName, defenderName, weaponName,
              damageMin, damageMax, weaponAccuracy,
              null, 0, strengthBonus,
              p1ArmorHp, defenderArmorEffect, defenderArmorChance,
            );
            p1HPAfter = Math.max(0, p1HPAfter - r2.damage);
            p1ArmorHp = r2.newArmorHp;
            narrative = result.narrative + ` | Second shot: ${r2.narrative}`;
            if (r2.damage > 0 && defenderReflectPercent > 0) {
              const reflected2 = Math.max(0, Math.floor(r2.damage * (defenderReflectPercent / 100)));
              if (reflected2 > 0) {
                p2HPAfter = Math.max(0, p2HPAfter - reflected2);
                narrative += ` | Exo-Armor reflects ${reflected2} dmg back!`;
              }
            }
            if (isPrimary) (match as any).player2RoundsFiredPrimary = ((match as any).player2RoundsFiredPrimary ?? 0) + 1;
          }
          if (isPrimary) (match as any).player2RoundsFiredPrimary = ((match as any).player2RoundsFiredPrimary ?? 0) + 1;
          else           (match as any).player2RoundsFiredSecondary = ((match as any).player2RoundsFiredSecondary ?? 0) + 1;
        }

        if (!result.extraAttack) narrative = result.narrative;
        if (effectiveAction === "reload")  narrative = `${attackerName} reloads and fires — ${narrative.toLowerCase()}`;
        if (effectiveAction === "special") narrative = `${attackerName} unleashes a special attack — ${narrative.toLowerCase()}`;

        // Update live armor HP in match
        (match as any).player1CurrentArmorHp = p1ArmorHp;
        (match as any).player2CurrentArmorHp = p2ArmorHp;
      }
    } // end else fire_primary/fire_secondary/reload/special

    // ── AI counter-action (if vs AI) ─────────────────────────────────────────
    let aiNarrative = "";
    let aiAction: string | null = null;
    if (match.isPlayer2AI) {
      const aiJustStunned = !!(
        isP1 &&
        p2Effects.some(e => ["stun", "shock"].includes(e.effect) && e.turnsLeft >= (EFFECT_CONFIG[e.effect]?.turns ?? 1))
      );
      const aiKnockedBack = (match as any).player2KnockedBack ?? false;
      const aiStunned = efxResult.p2Stunned || p2StunNextTurn || aiJustStunned || aiKnockedBack;
      aiAction = aiStunned ? "defend" : aiPickAction({ ...match.toObject(), player1HP: p1HPAfter, player2HP: p2HPAfter }, true, p2ConsUsed);

      if (!aiStunned && (aiAction === "use_consumable" || aiAction === "use_item")) {
        const aiLoadout = match.player2Loadout;
        const aiConsumable = aiLoadout.consumableItemId && !p2ConsUsed.includes(aiLoadout.consumableItemId ?? "") && (aiLoadout.consumableCount ?? 0) > 0
          ? aiLoadout.consumableItemId : null;
        if (aiConsumable) {
          const consDef = await MiniGameItem.findOne({ itemId: aiConsumable }).lean();
          const consEffect = (consDef as any)?.stats?.specialEffect ?? null;
          const healAmount = await resolveHealAmount(aiConsumable);
          p2HPAfter = Math.min(match.player2Loadout.hp, p2HPAfter + healAmount);
          match.player2ConsumablesUsed = [...p2ConsUsed, aiConsumable];
          player2Effect = "heal";
          if (consEffect === "regen" || consEffect === "regen_field") p2Effects = addEffect(p2Effects, consEffect);
          aiNarrative = `${match.aiName} used a med-kit — healed ${healAmount} HP`;
        } else {
          aiAction = "fire_primary";
        }
      }

      if (aiStunned) {
        aiNarrative = `${match.aiName} is stunned and cannot act!`;
      } else if (aiAction === "defend") {
        aiNarrative = `${match.aiName} braces for impact`;
      } else if (aiAction === "fire_primary" || aiAction === "attack" || aiAction == null) {
        const aiLoadout = match.player2Loadout;
        const aiWeaponId = aiLoadout.primaryWeaponId ?? aiLoadout.weapon;
        const aiWeaponDef = aiWeaponId ? await MiniGameItem.findOne({ itemId: aiWeaponId }).lean() : null;
        const aiWeaponName = (aiWeaponDef as any)?.name ?? "Weapon";
        const aiDmgMin: number = (aiLoadout as any).damageMin ?? (aiWeaponDef as any)?.stats?.damageMin ?? 10;
        const aiDmgMax: number = (aiLoadout as any).damageMax ?? (aiWeaponDef as any)?.stats?.damageMax ?? 20;
        const aiAccuracy: number = (aiLoadout as any).weaponAccuracy ?? (aiWeaponDef as any)?.stats?.accuracy ?? 75;
        const aiSpecialEffect: string | null = (aiLoadout as any).specialEffect ?? (aiWeaponDef as any)?.stats?.specialEffect ?? null;
        const aiSpecialChance: number = (aiLoadout as any).specialChance ?? (aiWeaponDef as any)?.stats?.specialChance ?? 0;
        const aiStrBonus: number = (aiLoadout as any).strengthBonus ?? 0;

        const aiResult = fireWeapon(
          (match.aiName || "Opponent"), p1Name, aiWeaponName,
          aiDmgMin, aiDmgMax, aiAccuracy,
          aiSpecialEffect, aiSpecialChance, aiStrBonus,
          p1ArmorHp,
          match.player1Loadout.armorEffect ?? null,
          match.player1Loadout.armorEffectChance ?? 0,
        );
        p1HPAfter = Math.max(0, p1HPAfter - aiResult.damage);
        p1ArmorHp = aiResult.newArmorHp;
        (match as any).player1CurrentArmorHp = p1ArmorHp;
        if (aiResult.damage > 0) player1Effect = "hit";

        const p1BlocksStun     = !!(match.player1Loadout as any).armorBlocksStun;
        const p1ReflectPercent = (match.player1Loadout as any).armorReflectPercent ?? 0;
        if (p1ReflectPercent > 0 && aiResult.damage > 0) {
          const aiReflected = Math.max(0, Math.floor(aiResult.damage * (p1ReflectPercent / 100)));
          if (aiReflected > 0) {
            p2HPAfter = Math.max(0, p2HPAfter - aiReflected);
            aiResult.narrative += ` | Exo-Armor reflects ${aiReflected} dmg back!`;
          }
        }

        if (aiResult.triggeredEffect === "stun") {
          if (p1BlocksStun) {
            aiResult.narrative += " | Exo-Armor blocks the stun!";
          } else {
            (match as any).player1StunNextTurn = true;
          }
        } else if (aiResult.triggeredEffect === "knockback") {
          (match as any).player1KnockedBack = true;
        } else if (aiResult.triggeredEffect === "bleed") {
          const bleedDps = Math.max(1, Math.floor(aiResult.damage * 0.08));
          p1Effects = p1Effects.filter(e => e.effect !== "bleed");
          p1Effects = [...p1Effects, { effect: "bleed", turnsLeft: 2, value: bleedDps }];
        } else if (aiResult.triggeredEffect === "shield") {
          p2ArmorHp += 100;
          p2Effects = addEffect(p2Effects, "shield");
        } else if (aiResult.triggeredEffect === "berserk") {
          p2Effects = addEffect(p2Effects, "berserk");
        } else if (aiResult.triggeredEffect && EFFECT_CONFIG[aiResult.triggeredEffect]) {
          p1Effects = addEffect(p1Effects, aiResult.triggeredEffect);
        }
        (match as any).player2RoundsFiredPrimary = ((match as any).player2RoundsFiredPrimary ?? 0) + 1;
        aiNarrative = aiResult.narrative;
      }
    }

    // ── Build turn record ─────────────────────────────────────────────────────
    const allNarratives = [...efxNarratives, narrative, aiNarrative].filter(Boolean);
    const fullNarrative = allNarratives.join(" | ");
    const turnRecord = {
      turnNumber:     match.currentTurn,
      player1Action:  (isP1 ? effectiveAction : (match.isPlayer2AI ? aiAction ?? "fire_primary" : "auto_attack")) as any,
      player2Action:  (isP1 ? (match.isPlayer2AI ? aiAction ?? "fire_primary" : "auto_attack") : effectiveAction) as any,
      player1HpAfter: p1HPAfter,
      player2HpAfter: p2HPAfter,
      player1Effect,
      player2Effect,
      narrative:      fullNarrative,
      resolvedAt:     new Date(),
    };

    match.turns.push(turnRecord);
    match.player1HP = p1HPAfter;
    match.player2HP = p2HPAfter;
    match.currentTurn += 1;
    match.currentTurnDeadline = new Date(Date.now() + 60_000);
    (match as any).player1ActiveEffects = p1Effects;
    (match as any).player2ActiveEffects = p2Effects;

    const p1Dead = p1HPAfter <= 0;
    const p2Dead = p2HPAfter <= 0;

    if (p1Dead || p2Dead) {
      match.status = "complete";
      if (p1Dead && p2Dead)   match.winnerId = null;
      else if (p2Dead)        match.winnerId = match.player1Id;
      else                    match.winnerId = match.player2Id ?? null;
      match.rewardsGranted = false;
    }

    await match.save();

    if (match.status === "complete") {
      const claimed = await CombatMatch.findOneAndUpdate(
        { matchId: match.matchId, rewardsGranted: false },
        { $set: { rewardsGranted: true } },
        { new: false },
      );
      if (claimed) {
        await grantCombatRewards(match);
        await postMatchCleanup(match);
        match.rewardsGranted = true;
        await match.save();
      }
    }

    res.json({ match });
  } catch (err) {
    req.log.error({ err }, "arena action error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Post-match cleanup: deduct ammo, degrade weapons, grant keyShards ─────────
async function postMatchCleanup(match: any): Promise<void> {
  try {
    const p1Id = match.player1Id?.toString();
    const p2Id = match.isPlayer2AI ? null : match.player2Id?.toString();

    // Grant +1 keyShards to both players
    const userUpdates: Promise<any>[] = [];
    if (p1Id) userUpdates.push(User.findByIdAndUpdate(p1Id, { $inc: { keyShards: 1 } }));
    if (p2Id) userUpdates.push(User.findByIdAndUpdate(p2Id, { $inc: { keyShards: 1 } }));
    await Promise.all(userUpdates);

    // Deduct ammo and degrade weapons for real players
    async function cleanupPlayer(userId: string, loadoutSnapshot: any, roundsPrimary: number, roundsSecondary: number, playerIsP1: boolean) {
      const inv = await PlayerMiniGameInventory.findOne({ userId });
      if (!inv) return;

      // Deduct primary ammo
      const primaryWeaponId = loadoutSnapshot.primaryWeaponId ?? loadoutSnapshot.weapon;
      if (primaryWeaponId && roundsPrimary > 0) {
        const weaponDef = await MiniGameItem.findOne({ itemId: primaryWeaponId }).select("ammoCategory").lean();
        const ammoCategory = (weaponDef as any)?.ammoCategory;
        if (ammoCategory && (inv.ammo as any)[ammoCategory] !== undefined) {
          const current = (inv.ammo as any)[ammoCategory] ?? 0;
          (inv.ammo as any)[ammoCategory] = Math.max(0, current - roundsPrimary);
        }
      }

      // Deduct secondary ammo
      const secondaryWeaponId = loadoutSnapshot.secondaryWeaponId;
      if (secondaryWeaponId && roundsSecondary > 0) {
        const weaponDef = await MiniGameItem.findOne({ itemId: secondaryWeaponId }).select("ammoCategory").lean();
        const ammoCategory = (weaponDef as any)?.ammoCategory;
        if (ammoCategory && (inv.ammo as any)[ammoCategory] !== undefined) {
          const current = (inv.ammo as any)[ammoCategory] ?? 0;
          (inv.ammo as any)[ammoCategory] = Math.max(0, current - roundsSecondary);
        }
      }

      const destroyed: { itemId: string; category: "primary" | "secondary" | "armor" }[] = [];

      // Degrade primary weapon durability (spec 3.8: -5 per match)
      if (primaryWeaponId) {
        const pw = inv.primaryWeapons.find((w: { itemId: string; durability: number }) => w.itemId === primaryWeaponId);
        if (pw) {
          pw.durability = Math.max(0, pw.durability - 5);
          if (pw.durability === 0) destroyed.push({ itemId: primaryWeaponId, category: "primary" });
        }
      }

      // Degrade secondary weapon durability (spec 3.8: -3 per match)
      if (secondaryWeaponId) {
        const sw = inv.secondaryWeapons.find((w: { itemId: string; durability: number }) => w.itemId === secondaryWeaponId);
        if (sw) {
          sw.durability = Math.max(0, sw.durability - 3);
          if (sw.durability === 0) destroyed.push({ itemId: secondaryWeaponId, category: "secondary" });
        }
      }

      // Degrade body armor durability (spec 3.8: -4 per match)
      const bodyArmorId = loadoutSnapshot.bodyArmorId ?? loadoutSnapshot.armor;
      if (bodyArmorId) {
        const ba = inv.bodyArmors.find((w: { itemId: string; durability: number }) => w.itemId === bodyArmorId);
        if (ba) {
          ba.durability = Math.max(0, ba.durability - 4);
          if (ba.durability === 0) destroyed.push({ itemId: bodyArmorId, category: "armor" });
        }
      }

      // Remove destroyed items (0 durability) from inventory and clear loadout refs
      if (destroyed.length > 0) {
        const destroyedPrimary = destroyed.filter(d => d.category === "primary").map(d => d.itemId);
        const destroyedSecondary = destroyed.filter(d => d.category === "secondary").map(d => d.itemId);
        const destroyedArmor = destroyed.filter(d => d.category === "armor").map(d => d.itemId);
        if (destroyedPrimary.length) {
          inv.primaryWeapons = inv.primaryWeapons.filter((w: { itemId: string }) => !destroyedPrimary.includes(w.itemId)) as any;
        }
        if (destroyedSecondary.length) {
          inv.secondaryWeapons = inv.secondaryWeapons.filter((w: { itemId: string }) => !destroyedSecondary.includes(w.itemId)) as any;
        }
        if (destroyedArmor.length) {
          inv.bodyArmors = inv.bodyArmors.filter((w: { itemId: string }) => !destroyedArmor.includes(w.itemId)) as any;
        }

        const loadoutUnset: Record<string, string> = {};
        if (destroyedPrimary.length) loadoutUnset["primaryWeaponId"] = "";
        if (destroyedSecondary.length) loadoutUnset["secondaryWeaponId"] = "";
        if (destroyedArmor.length) loadoutUnset["bodyArmorId"] = "";
        const setFields: Record<string, null> = {};
        for (const key of Object.keys(loadoutUnset)) setFields[key] = null;
        if (Object.keys(setFields).length > 0) {
          await PlayerLoadout.updateOne({ userId }, { $set: setFields });
        }

        (match as any)[playerIsP1 ? "player1DestroyedItems" : "player2DestroyedItems"] = destroyed;
      }

      // Deduct consumables used this match (spec 3.7)
      const consumableItemId = loadoutSnapshot.consumableItemId ?? loadoutSnapshot.consumable1;
      const consumablesUsedCount: number = playerIsP1 ? (match.player1ConsumablesUsed?.length ?? 0) : (match.player2ConsumablesUsed?.length ?? 0);
      if (consumableItemId && consumablesUsedCount > 0) {
        const consEntry = inv.consumables.find((c: { itemId: string; quantity: number }) => c.itemId === consumableItemId);
        if (consEntry) {
          consEntry.quantity = Math.max(0, consEntry.quantity - consumablesUsedCount);
          if (consEntry.quantity === 0) {
            inv.consumables = inv.consumables.filter((c: { itemId: string }) => c.itemId !== consumableItemId) as any;
          }
        }
      }

      await inv.save();
    }

    if (p1Id) {
      await cleanupPlayer(
        p1Id, match.player1Loadout,
        match.player1RoundsFiredPrimary ?? 0,
        match.player1RoundsFiredSecondary ?? 0,
        true,
      );
    }
    if (p2Id) {
      await cleanupPlayer(
        p2Id, match.player2Loadout,
        match.player2RoundsFiredPrimary ?? 0,
        match.player2RoundsFiredSecondary ?? 0,
        false,
      );
    }
  } catch (err) {
    // Non-fatal
  }
}

// ── Turn timeout auto-resolver ────────────────────────────────────────────────
async function autoResolveTurn(matchId: string, expectedTurn: number): Promise<void> {
  const match = await CombatMatch.findOneAndUpdate(
    { matchId, status: "active", currentTurn: expectedTurn, currentTurnDeadline: { $lt: new Date() } },
    { $set: { currentTurnDeadline: new Date(Date.now() + 30_000) } },
    { returnDocument: 'after' },
  );
  if (!match) return;

  const p1Effects: ActiveEffect[] = ((match as any).player1ActiveEffects ?? []) as ActiveEffect[];
  const p2Effects: ActiveEffect[] = ((match as any).player2ActiveEffects ?? []) as ActiveEffect[];

  const p1Name = "Player";
  const p2Name = match.isPlayer2AI ? (match.aiName || "Opponent") : "Opponent";

  const efx = applyActiveEffects(
    match.player1HP, match.player2HP,
    match.player1Loadout.hp, match.player2Loadout.hp,
    p1Effects, p2Effects, p1Name, p2Name,
  );
  let p1HPAfter = efx.p1HP;
  let p2HPAfter = efx.p2HP;
  let p1ArmorHp = (match as any).player1CurrentArmorHp ?? match.player1Loadout.armorHp ?? 0;
  let p2ArmorHp = (match as any).player2CurrentArmorHp ?? match.player2Loadout.armorHp ?? 0;

  const isP1Turn = match.isPlayer2AI || match.currentTurn % 2 === 1;

  let player1Effect: string | null = null;
  let player2Effect: string | null = null;
  const narrativeParts: string[] = [...efx.narratives];

  if (isP1Turn && !efx.p1Stunned) {
    const l = match.player1Loadout;
    const r = fireWeapon(
      p1Name, p2Name, "Auto",
      (l as any).damageMin ?? 10, (l as any).damageMax ?? 20, (l as any).weaponAccuracy ?? 75,
      null, 0, (l as any).strengthBonus ?? 0,
      p2ArmorHp,
      (l as any).armorEffect ?? null, (l as any).armorEffectChance ?? 0,
    );
    p2HPAfter = Math.max(0, p2HPAfter - r.damage);
    p2ArmorHp = r.newArmorHp;
    if (r.damage > 0) player2Effect = "hit";
    narrativeParts.push(`[AUTO] ${r.narrative}`);
  } else if (!isP1Turn && !efx.p2Stunned) {
    const l = match.player2Loadout;
    const r = fireWeapon(
      p2Name, p1Name, "Auto",
      (l as any).damageMin ?? 10, (l as any).damageMax ?? 20, (l as any).weaponAccuracy ?? 75,
      null, 0, (l as any).strengthBonus ?? 0,
      p1ArmorHp,
      (l as any).armorEffect ?? null, (l as any).armorEffectChance ?? 0,
    );
    p1HPAfter = Math.max(0, p1HPAfter - r.damage);
    p1ArmorHp = r.newArmorHp;
    if (r.damage > 0) player1Effect = "hit";
    narrativeParts.push(`[AUTO] ${r.narrative}`);
  } else {
    narrativeParts.push(`${isP1Turn ? p1Name : p2Name} is stunned — auto-skipped`);
  }

  if (match.isPlayer2AI && !efx.p2Stunned) {
    const aiAction = aiPickAction({ ...match.toObject(), player1HP: p1HPAfter, player2HP: p2HPAfter }, true, match.player2ConsumablesUsed ?? []);
    if (aiAction !== "defend" && aiAction !== "use_consumable" && aiAction !== "use_item") {
      const l = match.player2Loadout;
      const aiR = fireWeapon(
        (match.aiName || "Opponent"), p1Name, "Auto",
        (l as any).damageMin ?? 10, (l as any).damageMax ?? 20, (l as any).weaponAccuracy ?? 75,
        null, 0, (l as any).strengthBonus ?? 0,
        p1ArmorHp,
        (match.player1Loadout as any).armorEffect ?? null, (match.player1Loadout as any).armorEffectChance ?? 0,
      );
      p1HPAfter = Math.max(0, p1HPAfter - aiR.damage);
      p1ArmorHp = aiR.newArmorHp;
      if (aiR.damage > 0) player1Effect = "hit";
      narrativeParts.push(aiR.narrative);
    } else if (aiAction === "defend") {
      narrativeParts.push(`${match.aiName} braces for impact`);
    }
  }

  (match as any).player1CurrentArmorHp = p1ArmorHp;
  (match as any).player2CurrentArmorHp = p2ArmorHp;

  match.turns.push({
    turnNumber:     match.currentTurn,
    player1Action:  "auto_attack" as any,
    player2Action:  "auto_attack" as any,
    player1HpAfter: p1HPAfter,
    player2HpAfter: p2HPAfter,
    player1Effect,
    player2Effect,
    narrative:      narrativeParts.join(" | "),
    resolvedAt:     new Date(),
  });

  match.player1HP = p1HPAfter;
  match.player2HP = p2HPAfter;
  match.currentTurn += 1;
  match.currentTurnDeadline = new Date(Date.now() + 60_000);
  (match as any).player1ActiveEffects = efx.p1Effects;
  (match as any).player2ActiveEffects = efx.p2Effects;

  const p1Dead = p1HPAfter <= 0;
  const p2Dead = p2HPAfter <= 0;

  if (p1Dead || p2Dead) {
    match.status = "complete";
    if (p1Dead && p2Dead)   match.winnerId = null;
    else if (p2Dead)        match.winnerId = match.player1Id;
    else                    match.winnerId = match.player2Id ?? null;
    match.rewardsGranted = false;
  }

  await match.save();

  if (match.status === "complete") {
    const claimed = await CombatMatch.findOneAndUpdate(
      { matchId: match.matchId, rewardsGranted: false },
      { $set: { rewardsGranted: true } },
      { new: false },
    );
    if (claimed) {
      await grantCombatRewards(match);
      await postMatchCleanup(match);
      await match.save();
    }
  }
}

setInterval(async () => {
  try {
    const timedOut = await CombatMatch.find({
      status: "active",
      currentTurnDeadline: { $lt: new Date() },
    }).select("matchId currentTurn").lean();
    await Promise.all(timedOut.map(m => autoResolveTurn(m.matchId, m.currentTurn)));
  } catch { /* worker errors are non-fatal */ }
}, 5_000);

async function grantCombatRewards(match: any) {
  const now = new Date();
  const isDraw = !match.winnerId;

  const FULL_CAP = 30;
  const HALF_CAP = 50;

  // Resolve opponent levels for reward formula
  const p1Level = match.player1Loadout?.hp != null
    ? (await User.findById(match.player1Id).select("level").lean() as any)?.level ?? 1
    : 1;
  const p2Level = match.isPlayer2AI
    ? Math.max(1, Math.floor(p1Level * (0.8 + Math.random() * 0.4)))
    : (await User.findById(match.player2Id).select("level").lean() as any)?.level ?? 1;

  async function grant(userId: string | null, isWinner: boolean, opponentLevel: number) {
    if (!userId) return;
    const u = await User.findById(userId);
    if (!u) return;
    const _arenaFlash = await getActiveFlashEvent();
    const _arena2x = _arenaFlash?.effect === "2x_arena_rewards";

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!u.miniGameResetAt || u.miniGameResetAt < today) {
      u.miniGameMatchesToday = 0;
      u.miniGameResetAt = new Date(today.getTime() + 86_400_000);
    }
    const matchesToday = u.miniGameMatchesToday ?? 0;
    const dcMult  = matchesToday >= HALF_CAP ? 0   : matchesToday >= FULL_CAP ? 0.5 : 1;
    const xpMult  = matchesToday >= HALF_CAP ? 0.05: matchesToday >= FULL_CAP ? 0.5 : 1;
    const fullRewards = matchesToday < FULL_CAP;
    u.miniGameMatchesToday = matchesToday + 1;

    let dcEarned = 0;
    let xpEarned = 0;
    let shardsEarned = 0;

    if (isDraw) {
      dcEarned = Math.floor(80 * dcMult);
      const baseXpDraw = 100;
      const finalXpDraw = Math.floor(baseXpDraw * (1 + (u.prestigeXpBoost ?? 0) / 100));
      xpEarned = Math.floor(finalXpDraw * xpMult);
      u.dc += dcEarned; u.weeklyDc = (u.weeklyDc ?? 0) + dcEarned; u.xp += xpEarned;
    } else if (isWinner) {
      const baseXp = 150 + Math.floor(opponentLevel * 2);
      const finalXp = Math.floor(baseXp * (1 + (u.prestigeXpBoost ?? 0) / 100));
      xpEarned = Math.floor(finalXp * xpMult);
      dcEarned = Math.floor((200 + Math.floor(opponentLevel * 3)) * dcMult);
      shardsEarned = fullRewards ? 1 : 0;
      u.dc += dcEarned;
      u.weeklyDc = (u.weeklyDc ?? 0) + dcEarned;
      u.xp += xpEarned;
      u.combatWinStreak = (u.combatWinStreak ?? 0) + 1;
      if (shardsEarned) {
        u.keyShards = (u.keyShards ?? 0) + 1;
        // Auto-convert shards to keys
        while ((u.keyShards ?? 0) >= 20) {
          u.keyShards -= 20;
          u.keys = (u.keys ?? 0) + 1;
        }
      }
      u.wins += 1;
    } else {
      const baseXp = 50 + Math.floor(opponentLevel * 0.5);
      const finalXp = Math.floor(baseXp * (1 + (u.prestigeXpBoost ?? 0) / 100));
      xpEarned = Math.floor(finalXp * xpMult);
      dcEarned = Math.floor(50 * dcMult);
      shardsEarned = fullRewards ? 1 : 0;
      u.dc += dcEarned;
      u.weeklyDc = (u.weeklyDc ?? 0) + dcEarned;
      u.xp += xpEarned;
      if (shardsEarned) {
        u.keyShards = (u.keyShards ?? 0) + 1;
        // Auto-convert shards to keys
        while ((u.keyShards ?? 0) >= 20) {
          u.keyShards -= 20;
          u.keys = (u.keys ?? 0) + 1;
        }
      }
      u.combatWinStreak = 0;
      u.losses += 1;
    }
    // Flash 2x_arena_rewards: add the same DC again before saving
    if (_arena2x && dcEarned > 0) {
      u.dc += dcEarned;
      u.weeklyDc = (u.weeklyDc ?? 0) + dcEarned;
      dcEarned *= 2;
    }
    u.totalFights += 1;
    if (isWinner) {
      const newStreak = u.combatWinStreak ?? 0;
      if (newStreak > ((u as any).maxCombatWinStreak ?? 0)) {
        (u as any).maxCombatWinStreak = newStreak;
      }
    }
    await u.save();

    // ── Win-streak milestone feed posts ──────────────────────────────────────
    if (isWinner) {
      const milestones = [5, 10, 20, 50];
      const streak = u.combatWinStreak ?? 0;
      if (milestones.includes(streak)) {
        const messages: Record<number, string> = {
          5:  `Wow, Hero @${u.username} has a 5 win streak in the Arena! :swordclash:`,
          10: `@${u.username} is unstoppable — 10 win streak in the Arena! The city takes notice. :neonskull:`,
          20: `Legends only: @${u.username} just hit a 20 win streak in the Arena. Nobody can touch them. :goldtrophy:`,
          50: `@${u.username} is a god. 50 win streak in the Arena. The city bows. :goldtrophy:`,
        };
        emitFeedEvent({
          type: "system",
          actor: "System",
          actorId: undefined,
          message: messages[streak],
          dc: 0,
          xp: 0,
        }).catch(() => {});
      }
    }

    if (isWinner) {
      const weekStart = getWeekStart();
      await MiniGameLeaderboard.findOneAndUpdate(
        { leaderboardType: "combat_wins", userId, weekStart },
        { $inc: { score: 1 }, $set: { username: u.username, avatar: u.avatar } },
        { upsert: true },
      );
      await MiniGameLeaderboard.findOneAndUpdate(
        { leaderboardType: "combat_streak", userId, weekStart },
        { $max: { score: u.combatWinStreak }, $set: { username: u.username, avatar: u.avatar } },
        { upsert: true },
      );
      // Tier 8 §8.1 — announce if either board's result pushed the player into the weekly top 3
      announceLeaderboardMilestone("combat_wins", weekStart, userId, u.username).catch(() => {});
      announceLeaderboardMilestone("combat_streak", weekStart, userId, u.username).catch(() => {});
    }

    fireMissionEvent(userId, "combat_play").catch(() => {});
    if (isWinner) fireMissionEvent(userId, "combat_win").catch(() => {});
    if (isWinner && dcEarned > 0) fireMissionEvent(userId, "dc_earned", dcEarned).catch(() => {});
    checkAchievements(userId).catch(() => {});
    // Event points — arena_win for winner, arena_loss for loser
    const arenaAction = isDraw ? "arena_draw" : isWinner ? "arena_win" : "arena_loss";
    awardEventPoints({ userId, username: u.username, action: arenaAction, io: (match as any)._io }).catch(() => {});

    const capNote = dcMult < 1 ? ` (${matchesToday >= HALF_CAP ? "XP only" : "50% cap"})` : "";
    const notifTitle = isDraw ? "Combat Draw" : isWinner ? "Combat Victory! 🏆" : "Combat Defeat";
    const notifBody  = isDraw
      ? `Draw — +${dcEarned} DC, +${xpEarned} XP${capNote}`
      : isWinner
        ? `Victory! +${dcEarned} DC, +${xpEarned} XP${shardsEarned ? ", +1 Key Shard" : ""}${capNote}`
        : `Defeat — +${dcEarned} DC, +${xpEarned} XP${shardsEarned ? ", +1 Key Shard" : ""}${capNote}`;
    await Notification.create({
      userId,
      type: "system",
      message: `${notifTitle}: ${notifBody}`,
      read: false,
      createdAt: now,
    });
  }

  const p1Won = match.winnerId?.toString() === match.player1Id?.toString();
  const p2Won = match.winnerId?.toString() === match.player2Id?.toString();

  await grant(match.player1Id?.toString() ?? null, p1Won, p2Level);
  if (!match.isPlayer2AI) {
    await grant(match.player2Id?.toString() ?? null, p2Won, p1Level);
  }
}

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── Valid taunts ───────────────────────────────────────────────────────────────
const VALID_TAUNTS: Record<string, string> = {
  t1: "You fight like a stock firmware.",
  t2: "Is that all your augments can do?",
  t3: "I've seen better aim from a blind drone.",
  t4: "Your armor is decorative at this point.",
  t5: "GG. Almost.",
  t6: "I can do this all day. Can you?",
  t7: "Run diagnostics. You're losing.",
  t8: "👁️",
};

// ── POST /api/arena/match/:id/taunt ───────────────────────────────────────────
router.post("/match/:id/taunt", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { tauntId } = req.body as { tauntId?: string };
    if (!tauntId || !VALID_TAUNTS[tauntId]) {
      res.status(400).json({ message: "Invalid tauntId" });
      return;
    }

    const match = await CombatMatch.findOne({ matchId: req.params["id"] });
    if (!match) {
      res.status(404).json({ message: "Match not found" });
      return;
    }

    if (!["active", "in_progress"].includes(match.status)) {
      res.status(400).json({ message: "Match is not active" });
      return;
    }

    const isP1 = match.player1Id?.toString() === req.userId;
    const isP2 = !match.isPlayer2AI && match.player2Id?.toString() === req.userId;
    if (!isP1 && !isP2) {
      res.status(403).json({ message: "You are not a participant in this match" });
      return;
    }

    // Rate limit: 1 taunt per round per player
    const currentRound = match.currentTurn;
    const taunts = (match as any).taunts ?? [];
    const alreadyTaunted = taunts.some(
      (t: { senderId: string; round: number }) =>
        t.senderId === req.userId && t.round === currentRound,
    );
    if (alreadyTaunted) {
      res.status(429).json({ message: "You already taunted this round" });
      return;
    }

    taunts.push({
      senderId: req.userId!,
      tauntId,
      round: currentRound,
      sentAt: new Date(),
    });
    (match as any).taunts = taunts;
    await match.save();

    res.json({ success: true, taunt: VALID_TAUNTS[tauntId] });
  } catch (err) {
    req.log.error({ err }, "arena taunt error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/arena/queue-pve — instant PvE fight vs event NPC ───────────────
// Available only during an active boss_raid event with pveNpcs configured.
// Combat resolves instantly server-side; result returned immediately.

router.post("/queue-pve", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { getActiveEvent } = await import("../lib/eventEngine");
    const EventProgress = (await import("../models/EventProgress")).default;
    const FeedEvent     = (await import("../models/FeedEvent")).default;
    const Notification  = (await import("../models/Notification")).default;

    const event = await getActiveEvent();
    if (!event || event.type !== "boss_raid") {
      return res.status(400).json({ message: "No active boss raid event" });
    }

    const pveNpcs = (event as any).pveNpcs as Array<{
      tier: string; name: string; eventPoints: number;
      stats: { hp: number; attack: number; defense: number };
      loot?: { dc?: number; itemId?: string; label?: string };
    }> | undefined;
    if (!pveNpcs?.length) {
      return res.status(400).json({ message: "No PvE NPCs configured for this event" });
    }

    const user = await User.findById(req.userId).select("username level prestige strength energy maxEnergy").lean() as any;
    if (!user) return res.status(404).json({ message: "User not found" });

    // Pick NPC whose HP is closest to player-level × 50 (auto-scales difficulty)
    const playerPower = user.level * 50;
    const npc = [...pveNpcs].sort((a, b) =>
      Math.abs(a.stats.hp - playerPower) - Math.abs(b.stats.hp - playerPower)
    )[0];

    // Compute player combat stats
    const playerMaxHp  = computeMaxHp(user.level, user.prestige ?? 0);
    const playerAtk    = Math.max(10, Math.floor((user.strength ?? 10) * 2 + user.level * 3));
    const playerDef    = Math.max(5,  Math.floor(user.level * 2));

    let playerHp = playerMaxHp;
    let npcHp    = npc.stats.hp;
    let rounds   = 0;
    const MAX_ROUNDS = 30;

    while (playerHp > 0 && npcHp > 0 && rounds < MAX_ROUNDS) {
      // Player strikes first
      const playerDmg = Math.max(1, playerAtk - npc.stats.defense + Math.floor(Math.random() * 15) - 5);
      npcHp -= playerDmg;
      if (npcHp <= 0) break;
      // NPC retaliates
      const npcDmg = Math.max(1, npc.stats.attack - playerDef + Math.floor(Math.random() * 15) - 5);
      playerHp -= npcDmg;
      rounds++;
    }

    const playerWon = playerHp > 0 && npcHp <= 0;
    const eventPoints = playerWon ? npc.eventPoints : Math.max(1, Math.floor(npc.eventPoints * 0.2));

    // Persist event progress
    const now = new Date();
    await EventProgress.findOneAndUpdate(
      { eventId: event._id, userId: req.userId },
      {
        $inc: { points: eventPoints },
        $set: { username: user.username, lastActionAt: now },
        $setOnInsert: { eventId: event._id, userId: req.userId },
      },
      { upsert: true }
    );

    // Feed post for boss / final tier wins
    if (playerWon && (npc.tier === "boss" || npc.tier === "final")) {
      FeedEvent.create({
        type: "system", actor: "System", actorId: null,
        message: `[EVENT] ${user.username} defeated the ${npc.name} in the Event Arena! ⚡`,
        dc: 0, xp: 0, actorLevel: 0,
      }).catch(() => {});
    }

    // Loot on win: small DC grant + notification
    let lootGranted: { dc?: number; label?: string } | null = null;
    if (playerWon && npc.loot && Math.random() < 0.3) {
      lootGranted = npc.loot;
      if (npc.loot.dc && npc.loot.dc > 0) {
        await User.findByIdAndUpdate(req.userId, { $inc: { dc: npc.loot.dc } });
      }
      await Notification.create({
        userId: req.userId, type: "achievement",
        message: `Loot drop from ${npc.name}: ${npc.loot.label ?? `+${npc.loot.dc ?? 0} DC`}!`,
        read: false,
      });
    }

    res.json({
      won:                playerWon,
      npcName:            npc.name,
      npcTier:            npc.tier,
      roundsFought:       rounds + 1,
      playerHpRemaining:  Math.max(0, playerHp),
      npcHpRemaining:     Math.max(0, npcHp),
      eventPointsEarned:  eventPoints,
      loot:               lootGranted,
    });
  } catch (err: any) {
    req.log.error({ err }, "pve fight error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
