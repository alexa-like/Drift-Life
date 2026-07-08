/**
 * Arena — Tier 4 combat queue + turn-based match engine.
 * POST /api/arena/queue/join
 * POST /api/arena/queue/leave
 * GET  /api/arena/match/:matchId
 * POST /api/arena/match/:matchId/action
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import User from "../models/User";
import CombatMatch from "../models/CombatMatch";
import PlayerLoadout from "../models/PlayerLoadout";
import PlayerMiniGameInventory from "../models/PlayerMiniGameInventory";
import MiniGameItem from "../models/MiniGameItem";
import MiniGameLeaderboard from "../models/MiniGameLeaderboard";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { fireMissionEvent } from "../lib/missionEvents";
import { checkAchievements } from "./achievements";

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
  weapon:            string | null;
  armor:             string | null;
  consumable1:       string | null;
  consumable2:       string | null;
  ammoType:          string | null;
  hp:                number;
  damage:            number;
  defense:           number;
  accuracy:          number;
  // Element / special effects snapshotted at match start (optional — defaults to no effect)
  weaponEffect?:      string | null;   // e.g. "burn", "shock", "bleed", "headshot", "double_fire"
  weaponEffectChance?: number;          // 0–100 percent
  armorEffect?:       string | null;   // e.g. "block", "dodge", "anti_crit", "retaliate"
  armorEffectChance?:  number;
  ammoArmorPierce?:   number;           // 0–1 fraction of defender defense ignored (AP ammo)
  ammoEffect?:        string | null;   // ammo-triggered DoT e.g. "burn" from incendiary
  ammoEffectChance?:  number;
}

const combatQueue = new Map<string, QueueEntry>();
const ENERGY_COST = 10;

// ── Score formula ─────────────────────────────────────────────────────────────
function skillScore(level: number, wins: number, totalFights: number, gearTier: number): number {
  const winRate = totalFights > 0 ? wins / totalFights : 0.5;
  return (level * 10) + (gearTier * 100) + (winRate * 50);
}

function tierToNumber(tier: string): number {
  return { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[tier] ?? 1;
}

// ── Resolve loadout stats ─────────────────────────────────────────────────────
async function resolveLoadoutStats(userId: string, level: number): Promise<LoadoutSnapshot> {
  const loadout = await PlayerLoadout.findOne({ userId }).lean();
  if (!loadout) {
    return { weapon: null, armor: null, consumable1: null, consumable2: null, ammoType: null,
      hp: 100, damage: 15, defense: 0, accuracy: 85,
      weaponEffect: null, weaponEffectChance: 0, armorEffect: null, armorEffectChance: 0,
      ammoArmorPierce: 0, ammoEffect: null, ammoEffectChance: 0 };
  }

  const ids = [loadout.weapon, loadout.armor, loadout.ammoType].filter(Boolean) as string[];
  const defs = ids.length ? await MiniGameItem.find({ itemId: { $in: ids } }).lean() : [];
  const defMap = Object.fromEntries(defs.map(d => [d.itemId, d]));

  const weapon = loadout.weapon ? defMap[loadout.weapon] : null;
  const armor  = loadout.armor  ? defMap[loadout.armor]  : null;
  const ammo   = loadout.ammoType ? defMap[loadout.ammoType] : null;

  const hp       = 100 + (armor?.stats.hp ?? 0) + Math.floor(level * 2);
  const damageMin= weapon?.stats.damageMin ?? 10;
  const damageMax= weapon?.stats.damageMax ?? 20;
  const damage   = Math.floor((damageMin + damageMax) / 2) * (ammo?.stats.damageMultiplier ?? 1);
  const defense  = armor?.stats.defense ?? 0;
  const accuracy = weapon?.stats.accuracy ?? 85;

  // Resolve element effects from weapon, armor, and ammo definitions
  const weaponEffect      = (weapon as any)?.stats?.specialEffect ?? null;
  const weaponEffectChance= (weapon as any)?.stats?.specialChance ?? 0;
  const armorEffect       = (armor as any)?.stats?.specialEffect  ?? null;
  const armorEffectChance = (armor as any)?.stats?.specialChance  ?? 0;
  const ammoEffectRaw     = (ammo as any)?.stats?.specialEffect   ?? null;
  const ammoEffectChance  = (ammo as any)?.stats?.specialChance   ?? 0;
  // pierce_armor ammo: extract fractional pierce (40% default for AP ammo)
  const ammoArmorPierce   = ammoEffectRaw === "pierce_armor" ? 0.4 : 0;
  const ammoEffect        = ammoEffectRaw === "pierce_armor" ? null : ammoEffectRaw;

  return {
    weapon:      loadout.weapon,
    armor:       loadout.armor,
    consumable1: loadout.consumable1,
    consumable2: loadout.consumable2,
    ammoType:    loadout.ammoType,
    hp, damage, defense, accuracy,
    weaponEffect, weaponEffectChance,
    armorEffect,  armorEffectChance,
    ammoArmorPierce, ammoEffect, ammoEffectChance,
  };
}

// ── AI loadout generator ──────────────────────────────────────────────────────
async function generateAILoadout(playerLevel: number): Promise<LoadoutSnapshot> {
  // Pick items roughly matching player tier
  const tierTarget = playerLevel >= 30 ? "legendary" : playerLevel >= 20 ? "epic" : playerLevel >= 10 ? "rare" : playerLevel >= 5 ? "uncommon" : "common";
  const weapons  = await MiniGameItem.find({ category: "weapon",  tier: tierTarget }).lean();
  const armors   = await MiniGameItem.find({ category: "armor",   tier: tierTarget }).lean();

  const weapon = weapons.length ? weapons[Math.floor(Math.random() * weapons.length)] : null;
  const armor  = armors.length  ? armors[Math.floor(Math.random() * armors.length)]   : null;

  const variance = 0.9 + Math.random() * 0.2; // ±10%
  const hp      = Math.floor((100 + (armor?.stats.hp ?? 0) + playerLevel * 2) * variance);
  const damageMin = weapon?.stats.damageMin ?? 10;
  const damageMax = weapon?.stats.damageMax ?? 20;
  const damage  = Math.floor(((damageMin + damageMax) / 2) * variance);
  const defense = Math.floor((armor?.stats.defense ?? 0) * variance);

  const weaponEffect       = (weapon as any)?.stats?.specialEffect ?? null;
  const weaponEffectChance = (weapon as any)?.stats?.specialChance  ?? 0;
  const armorEffect        = (armor as any)?.stats?.specialEffect   ?? null;
  const armorEffectChance  = (armor as any)?.stats?.specialChance   ?? 0;

  return {
    weapon:      weapon?.itemId ?? null,
    armor:       armor?.itemId  ?? null,
    consumable1: null,
    consumable2: null,
    ammoType:    null,
    hp, damage, defense, accuracy: 80 + Math.floor(Math.random() * 15),
    weaponEffect, weaponEffectChance,
    armorEffect,  armorEffectChance,
    ammoArmorPierce: 0, ammoEffect: null, ammoEffectChance: 0,
  };
}

// ── POST /api/arena/queue/join ────────────────────────────────────────────────
router.post("/queue/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("username level wins totalFights energy maxEnergy combatWinStreak");
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

    // Deduct energy
    if (user.energy < ENERGY_COST) {
      res.status(400).json({ message: `Not enough energy — need ${ENERGY_COST}` });
      return;
    }
    user.energy -= ENERGY_COST;
    await user.save();

    const loadout = await resolveLoadoutStats(req.userId!, user.level);
    const score = skillScore(user.level, user.wins, user.totalFights, tierToNumber(loadout.weapon ? "common" : "common"));

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
      res.json({ matchId, status: "matched" });
    } else {
      res.json({ status: "queued", position: combatQueue.size });
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
    // Refund energy — capped at maxEnergy using aggregation pipeline update
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
    status:       "active",
    currentTurn:  1,
    currentTurnDeadline: new Date(Date.now() + 15_000),
    energyCost:   ENERGY_COST,
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
    status:       "active",
    currentTurn:  1,
    currentTurnDeadline: new Date(Date.now() + 15_000),
    energyCost:   ENERGY_COST,
    rewardsGranted: false,
  });

  return match.matchId;
}

// ── Queue worker ──────────────────────────────────────────────────────────────
// Direct pair-match helper: creates match from two resolved entries (already removed from queue)
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
    status:          "active",
    currentTurn:     1,
    currentTurnDeadline: new Date(Date.now() + 15_000),
    energyCost:      ENERGY_COST,
    rewardsGranted:  false,
  });
  return match.matchId;
}

setInterval(async () => {
  const now = Date.now();
  // Snapshot current entries to avoid mutation during iteration
  const entries = [...combatQueue.entries()];
  const matched = new Set<string>(); // track players already paired this tick

  for (const [userId, entry] of entries) {
    if (matched.has(userId)) continue;

    const age = now - entry.joinedAt.getTime();
    if (age < 5_000) continue;

    // After 30s fill with AI — takes priority
    if (age >= 30_000) {
      combatQueue.delete(userId);
      matched.add(userId);
      await fillWithAI(entry).catch(() => {});
      continue;
    }

    // 5s–15s: narrow range (±10%), 15s–30s: wider range (±25%)
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
  burn:       { turns: 3, value: 10 },  // fire DoT
  bleed:      { turns: 3, value: 5  },  // bleed DoT
  toxic:      { turns: 4, value: 8  },  // poison DoT
  shock:      { turns: 1, value: 0  },  // stun: skip action
  stun:       { turns: 1, value: 0  },  // stun: skip action
  regen:      { turns: 2, value: 15 },  // heal per turn (nano medkit)
  regen_field:{ turns: 99,value: 20 },  // heal per turn for whole match
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
        // stun lasts 1 turn, do not keep it
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

// ── Damage formula ────────────────────────────────────────────────────────────
function calcDamage(
  attackerLoadout: LoadoutSnapshot,
  defenderLoadout: LoadoutSnapshot,
  attackerName: string,
  defenderName: string,
  weaponName: string | null,
  isDefending: boolean,
): { damage: number; narrative: string; isCrit: boolean; triggeredEffect: string | null; extraAttack: boolean; retaliateDmg: number } {

  // Resolve optional effect fields with safe defaults
  const defArmorEffect  = defenderLoadout.armorEffect  ?? null;
  const defArmorChance  = defenderLoadout.armorEffectChance  ?? 0;
  const atkWeaponEffect = attackerLoadout.weaponEffect ?? null;
  const atkWeaponChance = attackerLoadout.weaponEffectChance ?? 0;
  const atkAmmoEffect   = attackerLoadout.ammoEffect   ?? null;
  const atkAmmoChance   = attackerLoadout.ammoEffectChance   ?? 0;
  const atkArmoPierce   = attackerLoadout.ammoArmorPierce    ?? 0;

  // Dodge check (armor effect — checked before accuracy roll)
  if (defArmorEffect === "dodge" && Math.random() * 100 < defArmorChance) {
    return { damage: 0, narrative: `${defenderName} dodges the attack!`, isCrit: false, triggeredEffect: null, extraAttack: false, retaliateDmg: 0 };
  }

  const hit = Math.random() * 100 < (attackerLoadout.accuracy ?? 85);
  if (!hit) return { damage: 0, narrative: `${attackerName} missed!`, isCrit: false, triggeredEffect: null, extraAttack: false, retaliateDmg: 0 };

  // Full block (armor effect)
  if (defArmorEffect === "block" && Math.random() * 100 < defArmorChance) {
    return { damage: 0, narrative: `${defenderName} blocks the attack completely!`, isCrit: false, triggeredEffect: null, extraAttack: false, retaliateDmg: 0 };
  }

  // Armor pierce from ammo (AP ammo ignores atkArmoPierce fraction of defense)
  const effectiveDefense = Math.floor(defenderLoadout.defense * (1 - atkArmoPierce));
  const defBonus = isDefending ? Math.floor(effectiveDefense * 0.5) : 0;

  const variance = Math.floor((Math.random() - 0.3) * 12);
  const base = Math.max(1, attackerLoadout.damage + variance);
  const raw = Math.max(1, base - effectiveDefense - defBonus);

  // Anti-crit (armor effect)
  const naturalCrit = Math.random() < 0.1;
  const critNegated = naturalCrit && defArmorEffect === "anti_crit" && Math.random() * 100 < defArmorChance;
  const isCrit = naturalCrit && !critNegated;

  // Headshot bonus (weapon effect)
  let finalDmg = isCrit ? Math.floor(raw * 1.5) : raw;
  if (atkWeaponEffect === "headshot" && Math.random() * 100 < atkWeaponChance) {
    finalDmg = Math.floor(finalDmg * 1.5);
  }

  // Double fire (weapon effect): triggers a second hit (caller handles)
  const extraAttack = atkWeaponEffect === "double_fire" && Math.random() * 100 < atkWeaponChance;

  // Triggered DoT/stun from weapon or ammo
  let triggeredEffect: string | null = null;
  if (atkWeaponEffect && EFFECT_CONFIG[atkWeaponEffect] && Math.random() * 100 < atkWeaponChance) {
    triggeredEffect = atkWeaponEffect;
  }
  // Ammo effect (e.g. burn from incendiary ammo) — only if weapon didn't already trigger
  if (!triggeredEffect && atkAmmoEffect && EFFECT_CONFIG[atkAmmoEffect]) {
    if (Math.random() * 100 < atkAmmoChance) {
      triggeredEffect = atkAmmoEffect;
    }
  }

  // Retaliate (defender armor effect) — returns flat counter-damage
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

function aiPickAction(match: any, aiIsP2: boolean, aiConsumablesUsed: string[]): string {
  const myHP     = aiIsP2 ? match.player2HP : match.player1HP;
  const myMaxHP  = aiIsP2 ? match.player2Loadout.hp : match.player1Loadout.hp;
  const myLoadout: LoadoutSnapshot = aiIsP2 ? match.player2Loadout : match.player1Loadout;
  const pct = myHP / myMaxHP;

  const hasConsumable = (myLoadout.consumable1 && !aiConsumablesUsed.includes(myLoadout.consumable1 ?? "")) ||
                        (myLoadout.consumable2 && !aiConsumablesUsed.includes(myLoadout.consumable2 ?? ""));
  if (pct < 0.35 && hasConsumable) return "use_item";

  // Defend if below 50% HP or recent damage was significant
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
  if (roll < 0.65) return "attack";
  if (roll < 0.80) return "defend";
  return "attack";
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
    const { action, expectedTurn } = req.body as {
      action: "attack" | "defend" | "use_item" | "reload" | "special";
      expectedTurn?: number;
    };
    if (!["attack","defend","use_item","reload","special"].includes(action)) {
      res.status(400).json({ message: "Invalid action" }); return;
    }

    // Atomic guard: only accept action if match is still on the expected turn.
    // The $inc on currentTurn is deferred to save(), but we pre-validate here
    // to catch the common concurrent-double-submit race.
    const match = await CombatMatch.findOne({
      matchId: req.params["matchId"],
      status:  "active",
      ...(expectedTurn != null ? { currentTurn: expectedTurn } : {}),
    });
    if (!match) {
      // Re-fetch to distinguish "not found" from "stale turn"
      const exists = await CombatMatch.findOne({ matchId: req.params["matchId"] }).select("status currentTurn").lean();
      if (!exists) { res.status(404).json({ message: "Match not found" }); return; }
      if (exists.status !== "active") { res.status(400).json({ message: "Match is not active" }); return; }
      res.status(409).json({ message: "Turn already resolved — refresh match state", currentTurn: exists.currentTurn });
      return;
    }

    const isP1 = match.player1Id?.toString() === req.userId;
    const isP2 = !match.isPlayer2AI && match.player2Id?.toString() === req.userId;
    if (!isP1 && !isP2) { res.status(403).json({ message: "Not your match" }); return; }

    // PvP turn ownership: odd turns = P1, even turns = P2
    if (!match.isPlayer2AI) {
      const isP1Turn = match.currentTurn % 2 === 1;
      if (isP1Turn && !isP1) { res.status(400).json({ message: "Not your turn" }); return; }
      if (!isP1Turn && !isP2) { res.status(400).json({ message: "Not your turn" }); return; }
    }

    // Fetch player usernames for narrative
    const [p1User, p2NameResolved] = await Promise.all([
      User.findById(match.player1Id).select("username").lean(),
      match.isPlayer2AI ? Promise.resolve(match.aiName ?? "AI") : User.findById(match.player2Id).select("username").lean().then(u => (u as any)?.username ?? "Opponent"),
    ]);
    const p1Name = (p1User as any)?.username ?? "Player";
    const p2Name = p2NameResolved;

    // Defend tracking: carry over from previous turn for PvP
    const lastTurn = match.turns[match.turns.length - 1];
    const p1DefendingThisTurn = action === "defend" && isP1;
    const p2DefendingThisTurn = action === "defend" && isP2;
    const p1WasDefending = p1DefendingThisTurn || (lastTurn?.player1Action === "defend");
    const p2WasDefending = p2DefendingThisTurn || (lastTurn?.player2Action === "defend");

    const p1ConsUsed = match.player1ConsumablesUsed ?? [];
    const p2ConsUsed = match.player2ConsumablesUsed ?? [];

    let p1Effects: ActiveEffect[] = ((match as any).player1ActiveEffects ?? []) as ActiveEffect[];
    let p2Effects: ActiveEffect[] = ((match as any).player2ActiveEffects ?? []) as ActiveEffect[];

    // ── Apply start-of-turn status effects (DoT, regen, stun) ─────────────────
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

    // If this player is stunned, override their action to a no-op defend
    const myStunned = (isP1 && efxResult.p1Stunned) || (isP2 && efxResult.p2Stunned);
    const effectiveAction = myStunned ? "defend" : action;
    if (myStunned && action !== "defend") {
      // Still accept the request but treat as defend — client sees updated state
    }

    let narrative = "";
    let player1Effect: string | null = null;
    let player2Effect: string | null = null;

    // ── Early-exit: DoT may have already killed someone ────────────────────────
    // If a status effect (burn/bleed/toxic) reduced HP to 0 before this turn's
    // action runs, finalize the match now without processing any further attacks.
    const dotKilledP1 = p1HPAfter <= 0;
    const dotKilledP2 = p2HPAfter <= 0;
    if (dotKilledP1 || dotKilledP2) {
      const dotNarrative = efxNarratives.join(" | ") || "Status effect ended the match";
      const dotTurnRecord = {
        turnNumber:     match.currentTurn,
        player1Action:  "auto_attack" as any,
        player2Action:  "auto_attack" as any,
        player1HpAfter: p1HPAfter,
        player2HpAfter: p2HPAfter,
        player1Effect:  null,
        player2Effect:  null,
        narrative:      dotNarrative,
        resolvedAt:     new Date(),
      };
      match.turns.push(dotTurnRecord);
      match.player1HP = p1HPAfter;
      match.player2HP = p2HPAfter;
      match.currentTurn += 1;
      match.currentTurnDeadline = new Date(Date.now() + 15_000);
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

    // ── Apply player action ────────────────────────────────────────────────────
    if (effectiveAction === "defend") {
      narrative = myStunned
        ? `${isP1 ? p1Name : p2Name} is stunned and cannot act!`
        : `${isP1 ? p1Name : p2Name} braces for impact`;
    } else if (effectiveAction === "use_item") {
      const myLoadout = isP1 ? match.player1Loadout : match.player2Loadout;
      const myConsUsed = isP1 ? p1ConsUsed : p2ConsUsed;
      const consumable = [myLoadout.consumable1, myLoadout.consumable2].find(c => c && !myConsUsed.includes(c)) ?? null;
      if (!consumable) { res.status(400).json({ message: "No consumable available" }); return; }

      // Check for regen consumable (nano medkit, regen field kit)
      const consDef = await MiniGameItem.findOne({ itemId: consumable }).lean();
      const consEffect = (consDef as any)?.stats?.specialEffect ?? null;
      const healAmount = await resolveHealAmount(consumable);

      if (isP1) {
        p1HPAfter = Math.min(match.player1Loadout.hp, p1HPAfter + healAmount);
        match.player1ConsumablesUsed = [...p1ConsUsed, consumable];
        player1Effect = "heal";
        if (consEffect === "regen" || consEffect === "regen_field") {
          p1Effects = addEffect(p1Effects, consEffect);
        }
      } else {
        p2HPAfter = Math.min(match.player2Loadout.hp, p2HPAfter + healAmount);
        match.player2ConsumablesUsed = [...p2ConsUsed, consumable];
        player2Effect = "heal";
        if (consEffect === "regen" || consEffect === "regen_field") {
          p2Effects = addEffect(p2Effects, consEffect);
        }
      }
      narrative = `${isP1 ? p1Name : p2Name} used a med-kit — healed ${healAmount} HP`;
      // Fire consumable mission event (non-fatal, fire-and-forget)
      fireMissionEvent(String(req.userId), "consumable").catch(() => {});
    } else {
      // attack / reload / special
      const attackerName = isP1 ? p1Name : (match.isPlayer2AI ? match.aiName ?? "AI" : p2Name);
      const defenderName = isP1 ? (match.isPlayer2AI ? match.aiName ?? "AI" : p2Name) : p1Name;
      const attackerLoadout = isP1 ? match.player1Loadout : match.player2Loadout;
      const defenderLoadout = isP1 ? match.player2Loadout : match.player1Loadout;
      const defenderWasDefending = isP1 ? p2WasDefending : p1WasDefending;

      const weaponId  = attackerLoadout.weapon;
      const weaponDef = weaponId ? await MiniGameItem.findOne({ itemId: weaponId }).select("name").lean() : null;
      const weaponName = (weaponDef as any)?.name ?? null;

      let specialMultiplier = 1;
      if (effectiveAction === "special") specialMultiplier = 1.5;
      if (effectiveAction === "reload")  specialMultiplier = 0.6;

      const result = calcDamage(
        { ...attackerLoadout, damage: Math.floor(attackerLoadout.damage * specialMultiplier) },
        defenderLoadout, attackerName ?? "?", defenderName ?? "?", weaponName, defenderWasDefending,
      );

      if (isP1) {
        p2HPAfter = Math.max(0, p2HPAfter - result.damage);
        if (result.damage > 0) player2Effect = result.isCrit ? "crit" : "hit";
        // Apply retaliate damage back to attacker
        if (result.retaliateDmg > 0) p1HPAfter = Math.max(0, p1HPAfter - result.retaliateDmg);
        // Apply triggered DoT/stun to defender (p2)
        if (result.triggeredEffect) p2Effects = addEffect(p2Effects, result.triggeredEffect);
        // Double fire: second hit
        if (result.extraAttack) {
          const r2 = calcDamage(attackerLoadout, defenderLoadout, attackerName ?? "?", defenderName ?? "?", weaponName, defenderWasDefending);
          p2HPAfter = Math.max(0, p2HPAfter - r2.damage);
          narrative = result.narrative + ` | Second shot: ${r2.narrative}`;
        }
      } else {
        p1HPAfter = Math.max(0, p1HPAfter - result.damage);
        if (result.damage > 0) player1Effect = result.isCrit ? "crit" : "hit";
        if (result.retaliateDmg > 0) p2HPAfter = Math.max(0, p2HPAfter - result.retaliateDmg);
        if (result.triggeredEffect) p1Effects = addEffect(p1Effects, result.triggeredEffect);
        if (result.extraAttack) {
          const r2 = calcDamage(attackerLoadout, defenderLoadout, attackerName ?? "?", defenderName ?? "?", weaponName, defenderWasDefending);
          p1HPAfter = Math.max(0, p1HPAfter - r2.damage);
          narrative = result.narrative + ` | Second shot: ${r2.narrative}`;
        }
      }

      if (!result.extraAttack) narrative = result.narrative;
      if (effectiveAction === "reload")  narrative = `${attackerName} reloads and fires — ${narrative.toLowerCase()}`;
      if (effectiveAction === "special") narrative = `${attackerName} unleashes a special attack — ${narrative.toLowerCase()}`;
    }

    // ── AI counter-action (if vs AI) ─────────────────────────────────────────
    let aiNarrative = "";
    let aiAction: string | null = null;
    if (match.isPlayer2AI) {
      // AI is stunned if: (a) a start-of-turn stun was active, OR
      // (b) the player's attack JUST applied shock/stun this turn
      const aiJustStunned = !!(
        isP1 &&
        p2Effects.some(e => ["stun", "shock"].includes(e.effect) && e.turnsLeft >= EFFECT_CONFIG[e.effect]?.turns)
      );
      const aiStunned = efxResult.p2Stunned || aiJustStunned;
      aiAction = aiStunned ? "defend" : aiPickAction({ ...match.toObject(), player1HP: p1HPAfter, player2HP: p2HPAfter }, true, p2ConsUsed);

      if (!aiStunned && aiAction === "use_item") {
        const aiConsumable = [match.player2Loadout.consumable1, match.player2Loadout.consumable2].find(c => c && !p2ConsUsed.includes(c)) ?? null;
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
          aiAction = "attack";
        }
      }

      if (aiStunned) {
        aiNarrative = `${match.aiName} is stunned and cannot act!`;
      } else if (aiAction === "defend") {
        aiNarrative = `${match.aiName} braces for impact`;
      } else if (aiAction === "attack" || aiAction == null) {
        const aiWeaponDef = match.player2Loadout.weapon
          ? await MiniGameItem.findOne({ itemId: match.player2Loadout.weapon }).select("name").lean() : null;
        const aiWeaponName = (aiWeaponDef as any)?.name ?? null;
        const aiResult = calcDamage(
          match.player2Loadout, match.player1Loadout,
          match.aiName ?? "AI", p1Name ?? "Player",
          aiWeaponName, p1WasDefending,
        );
        p1HPAfter = Math.max(0, p1HPAfter - aiResult.damage);
        if (aiResult.damage > 0) player1Effect = aiResult.isCrit ? "crit" : "hit";
        if (aiResult.retaliateDmg > 0) p2HPAfter = Math.max(0, p2HPAfter - aiResult.retaliateDmg);
        if (aiResult.triggeredEffect) p1Effects = addEffect(p1Effects, aiResult.triggeredEffect);
        aiNarrative = aiResult.narrative;
      }
    }

    // ── Build turn record ─────────────────────────────────────────────────────
    const allNarratives = [...efxNarratives, narrative, aiNarrative].filter(Boolean);
    const fullNarrative = allNarratives.join(" | ");
    const turnRecord = {
      turnNumber:     match.currentTurn,
      player1Action:  (isP1 ? effectiveAction : (match.isPlayer2AI ? aiAction ?? "attack" : "auto_attack")) as any,
      player2Action:  (isP1 ? (match.isPlayer2AI ? aiAction ?? "attack" : "auto_attack") : effectiveAction) as any,
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
    match.currentTurnDeadline = new Date(Date.now() + 15_000);
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
        match.rewardsGranted = true;
      }
    }

    res.json({ match });
  } catch (err) {
    req.log.error({ err }, "arena action error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Turn timeout auto-resolver ────────────────────────────────────────────────
// Every 5 seconds find active matches whose deadline has passed and auto-resolve
// the timed-out player's turn as a basic attack, then apply the AI counter-attack
// (or advance PvP to the next player's turn).
async function autoResolveTurn(matchId: string, expectedTurn: number): Promise<void> {
  // Atomic claim: match BOTH the deadline expiry AND the expected turn number.
  // If a player action resolved the turn first (incrementing currentTurn), this
  // findOneAndUpdate will not match (currentTurn changed) and returns null — safe no-op.
  const match = await CombatMatch.findOneAndUpdate(
    { matchId, status: "active", currentTurn: expectedTurn, currentTurnDeadline: { $lt: new Date() } },
    { $set: { currentTurnDeadline: new Date(Date.now() + 30_000) } }, // extend deadline = "claimed"
    { new: true },
  );
  if (!match) return; // player already acted, or another worker tick claimed it

  const p1Effects: ActiveEffect[] = ((match as any).player1ActiveEffects ?? []) as ActiveEffect[];
  const p2Effects: ActiveEffect[] = ((match as any).player2ActiveEffects ?? []) as ActiveEffect[];

  const p1Name = "Player";
  const p2Name = match.isPlayer2AI ? (match.aiName ?? "AI") : "Opponent";

  // Apply start-of-turn status effects
  const efx = applyActiveEffects(
    match.player1HP, match.player2HP,
    match.player1Loadout.hp, match.player2Loadout.hp,
    p1Effects, p2Effects, p1Name, p2Name,
  );
  let p1HPAfter = efx.p1HP;
  let p2HPAfter = efx.p2HP;

  // Determine whose turn timed out
  // For AI matches: always P1's turn (AI responds immediately, never waits)
  // For PvP: odd turns = P1, even = P2
  const isP1Turn = match.isPlayer2AI || match.currentTurn % 2 === 1;

  let player1Effect: string | null = null;
  let player2Effect: string | null = null;
  const narrativeParts: string[] = [...efx.narratives];

  // Timed-out player: auto-attack (basic, no element effects triggered)
  if (isP1Turn && !efx.p1Stunned) {
    const r = calcDamage(match.player1Loadout, match.player2Loadout, p1Name, p2Name, null, false);
    p2HPAfter = Math.max(0, p2HPAfter - r.damage);
    if (r.damage > 0) player2Effect = r.isCrit ? "crit" : "hit";
    narrativeParts.push(`[AUTO] ${r.narrative}`);
  } else if (!isP1Turn && !efx.p2Stunned) {
    const r = calcDamage(match.player2Loadout, match.player1Loadout, p2Name, p1Name, null, false);
    p1HPAfter = Math.max(0, p1HPAfter - r.damage);
    if (r.damage > 0) player1Effect = r.isCrit ? "crit" : "hit";
    narrativeParts.push(`[AUTO] ${r.narrative}`);
  } else {
    narrativeParts.push(`${isP1Turn ? p1Name : p2Name} is stunned — auto-skipped`);
  }

  // AI counter-attack (if vs AI and P1 was the timed-out player)
  if (match.isPlayer2AI && !efx.p2Stunned) {
    const aiAction = aiPickAction({ ...match.toObject(), player1HP: p1HPAfter, player2HP: p2HPAfter }, true, match.player2ConsumablesUsed ?? []);
    if (aiAction !== "defend" && aiAction !== "use_item") {
      const aiR = calcDamage(match.player2Loadout, match.player1Loadout, match.aiName ?? "AI", p1Name, null, false);
      p1HPAfter = Math.max(0, p1HPAfter - aiR.damage);
      if (aiR.damage > 0) player1Effect = aiR.isCrit ? "crit" : "hit";
      narrativeParts.push(aiR.narrative);
    } else if (aiAction === "defend") {
      narrativeParts.push(`${match.aiName} braces for impact`);
    }
  }

  const turnRecord = {
    turnNumber:     match.currentTurn,
    player1Action:  (isP1Turn ? "auto_attack" : "auto_attack") as any,
    player2Action:  "auto_attack" as any,
    player1HpAfter: p1HPAfter,
    player2HpAfter: p2HPAfter,
    player1Effect,
    player2Effect,
    narrative:      narrativeParts.join(" | "),
    resolvedAt:     new Date(),
  };

  match.turns.push(turnRecord);
  match.player1HP = p1HPAfter;
  match.player2HP = p2HPAfter;
  match.currentTurn += 1;
  match.currentTurnDeadline = new Date(Date.now() + 15_000);
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
    if (claimed) await grantCombatRewards(match);
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

  // Daily reward cap multipliers
  const FULL_CAP = 30;
  const HALF_CAP = 50;

  async function grant(userId: string | null, isWinner: boolean) {
    if (!userId) return;
    const u = await User.findById(userId);
    if (!u) return;

    // Check / reset daily match counter
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!u.miniGameResetAt || u.miniGameResetAt < today) {
      u.miniGameMatchesToday = 0;
      u.miniGameResetAt = new Date(today.getTime() + 86_400_000);
    }
    const matchesToday = u.miniGameMatchesToday ?? 0;
    // Cap tiers:
    //   0–29  (first 30):  full DC + full XP + Key Shard for winner
    //   30–49 (matches 30–49): 50% DC + 50% XP, no Key Shard
    //   50+   (after 50): DC = 0, XP = 5% (tiny XP only — spec: "tiny XP only after 50")
    const dcMult  = matchesToday >= HALF_CAP ? 0   : matchesToday >= FULL_CAP ? 0.5 : 1;
    const xpMult  = matchesToday >= HALF_CAP ? 0.05: matchesToday >= FULL_CAP ? 0.5 : 1;
    const fullRewards = matchesToday < FULL_CAP; // Key Shards only for first 30 matches
    u.miniGameMatchesToday = matchesToday + 1;

    let dcEarned = 0;
    let xpEarned = 0;
    let shardsEarned = 0;

    if (isDraw) {
      dcEarned = Math.floor(80 * dcMult);
      xpEarned = Math.floor(100 * xpMult);
      u.dc += dcEarned; u.xp += xpEarned;
    } else if (isWinner) {
      const streakBonus = Math.min(((u.combatWinStreak ?? 0) + 1) * 50, 300);
      dcEarned     = Math.floor((150 + streakBonus) * dcMult);
      xpEarned     = Math.floor(200 * xpMult);
      shardsEarned = fullRewards ? 1 : 0; // Key Shard only within first 30 matches
      u.dc += dcEarned;
      u.xp += xpEarned;
      u.combatWinStreak = (u.combatWinStreak ?? 0) + 1;
      if (shardsEarned) u.keyShards += 1;
      u.wins += 1;
    } else {
      dcEarned = Math.floor(40 * dcMult);
      xpEarned = Math.floor(60 * xpMult);
      u.dc += dcEarned; u.xp += xpEarned;
      u.combatWinStreak = 0;
      u.losses += 1;
    }
    u.totalFights += 1;
    // Track max streak for achievements
    if (isWinner) {
      const newStreak = u.combatWinStreak ?? 0;
      if (newStreak > ((u as any).maxCombatWinStreak ?? 0)) {
        (u as any).maxCombatWinStreak = newStreak;
      }
    }
    await u.save();

    // Update mini-game leaderboard
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
    }

    // Fire mission events (non-fatal)
    fireMissionEvent(userId, "combat_play").catch(() => {});
    if (isWinner) fireMissionEvent(userId, "combat_win").catch(() => {});
    if (isWinner && dcEarned > 0) fireMissionEvent(userId, "dc_earned", dcEarned).catch(() => {});
    checkAchievements(userId).catch(() => {});

    // Notification — reflects actual earned amounts including streak bonus and daily cap
    const capNote = dcMult < 1 ? ` (${matchesToday >= HALF_CAP ? "XP only" : "50% cap"})` : "";
    const notifTitle = isDraw ? "Combat Draw" : isWinner ? "Combat Victory! 🏆" : "Combat Defeat";
    const notifBody  = isDraw
      ? `Draw — +${dcEarned} DC, +${xpEarned} XP${capNote}`
      : isWinner
        ? `Victory! +${dcEarned} DC, +${xpEarned} XP${shardsEarned ? ", +1 Key Shard" : ""}${capNote}`
        : `Defeat — +${dcEarned} DC, +${xpEarned} XP${capNote}`;
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

  await grant(match.player1Id?.toString() ?? null, p1Won);
  if (!match.isPlayer2AI) {
    await grant(match.player2Id?.toString() ?? null, p2Won);
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

export default router;
