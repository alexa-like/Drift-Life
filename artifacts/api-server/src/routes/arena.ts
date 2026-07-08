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
  weapon:      string | null;
  armor:       string | null;
  consumable1: string | null;
  consumable2: string | null;
  ammoType:    string | null;
  hp:          number;
  damage:      number;
  defense:     number;
  accuracy:    number;
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
      hp: 100, damage: 15, defense: 0, accuracy: 85 };
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

  return {
    weapon:      loadout.weapon,
    armor:       loadout.armor,
    consumable1: loadout.consumable1,
    consumable2: loadout.consumable2,
    ammoType:    loadout.ammoType,
    hp, damage, defense, accuracy,
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

  return {
    weapon:      weapon?.itemId ?? null,
    armor:       armor?.itemId  ?? null,
    consumable1: null,
    consumable2: null,
    ammoType:    null,
    hp, damage, defense, accuracy: 80 + Math.floor(Math.random() * 15),
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
    // Refund energy
    await User.updateOne({ _id: req.userId }, { $inc: { energy: ENERGY_COST } });
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

    // After 15s widen range — find a partner and directly pair them
    if (age >= 15_000 && age < 30_000) {
      const wideRange = 0.25;
      const opp = entries.find(([id, e]) =>
        id !== userId &&
        !matched.has(id) &&
        Math.abs(e.score - entry.score) <= entry.score * wideRange,
      );
      if (opp) {
        const [oppId, oppEntry] = opp;
        combatQueue.delete(userId);
        combatQueue.delete(oppId);
        matched.add(userId);
        matched.add(oppId);
        // Directly create match from pair — avoids re-searching deleted entries
        await matchPair(entry, oppEntry).catch(() => {});
        continue;
      }
    }

    // After 30s fill with AI
    if (age >= 30_000) {
      combatQueue.delete(userId);
      matched.add(userId);
      await fillWithAI(entry).catch(() => {});
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

// ── Damage formula ────────────────────────────────────────────────────────────
function calcDamage(
  attackerLoadout: LoadoutSnapshot,
  defenderLoadout: LoadoutSnapshot,
  attackerName: string,
  defenderName: string,
  weaponName: string | null,
  isDefending: boolean,
): { damage: number; narrative: string; isCrit: boolean; effect: string | null } {
  const hit = Math.random() * 100 < (attackerLoadout.accuracy ?? 85);
  if (!hit) return { damage: 0, narrative: `${attackerName} missed!`, isCrit: false, effect: null };

  const variance = Math.floor((Math.random() - 0.3) * 12);
  const base = Math.max(1, attackerLoadout.damage + variance);
  const defBonus = isDefending ? Math.floor(defenderLoadout.defense * 0.5) : 0;
  const raw = Math.max(1, base - defenderLoadout.defense - defBonus);
  const isCrit = Math.random() < 0.1; // 10% crit
  const finalDmg = isCrit ? Math.floor(raw * 1.5) : raw;

  const weapon = weaponName ?? "fists";
  let narrative = `${attackerName} hits ${defenderName} with ${weapon} for ${finalDmg} damage`;
  if (isCrit) narrative += " [CRITICAL!]";
  if (isDefending && defBonus > 0) narrative += ` (blocked ${defBonus})`;

  return { damage: finalDmg, narrative, isCrit, effect: null };
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
    const [p1User, p2Name] = await Promise.all([
      User.findById(match.player1Id).select("username").lean(),
      match.isPlayer2AI ? Promise.resolve(match.aiName ?? "AI") : User.findById(match.player2Id).select("username").lean().then(u => (u as any)?.username ?? "Opponent"),
    ]);
    const p1Name = (p1User as any)?.username ?? "Player";

    // Defend in the CURRENT turn: if the player's submitted action is "defend",
    // the immediate AI counterattack this same resolution cycle should be reduced.
    // Also track the previous turn's defend for PvP carry-over.
    const lastTurn = match.turns[match.turns.length - 1];
    // p1/p2 defending THIS turn (used for AI counterattack in same resolution)
    const p1DefendingThisTurn = action === "defend" && isP1;
    const p2DefendingThisTurn = action === "defend" && isP2;
    // Previous-turn defend (used for PvP: carry-over damage reduction)
    const p1WasDefending = p1DefendingThisTurn || (lastTurn?.player1Action === "defend");
    const p2WasDefending = p2DefendingThisTurn || (lastTurn?.player2Action === "defend");

    // Track consumables used
    const p1ConsUsed = match.player1ConsumablesUsed ?? [];
    const p2ConsUsed = match.player2ConsumablesUsed ?? [];

    let p1HPAfter = match.player1HP;
    let p2HPAfter = match.player2HP;
    let narrative = "";
    let player1Effect: string | null = null;
    let player2Effect: string | null = null;

    // ── Apply player action ────────────────────────────────────────────────────
    if (action === "defend") {
      narrative = `${isP1 ? p1Name : p2Name} braces for impact`;
    } else if (action === "use_item") {
      // Use first available consumable that hasn't been used
      const myLoadout = isP1 ? match.player1Loadout : match.player2Loadout;
      const myConsUsed = isP1 ? p1ConsUsed : p2ConsUsed;
      const consumable = [myLoadout.consumable1, myLoadout.consumable2].find(c => c && !myConsUsed.includes(c)) ?? null;
      if (!consumable) {
        res.status(400).json({ message: "No consumable available" }); return;
      }
      const healAmount = await resolveHealAmount(consumable);
      if (isP1) {
        p1HPAfter = Math.min(match.player1Loadout.hp, p1HPAfter + healAmount);
        match.player1ConsumablesUsed = [...p1ConsUsed, consumable];
        player1Effect = "heal";
      } else {
        p2HPAfter = Math.min(match.player2Loadout.hp, p2HPAfter + healAmount);
        match.player2ConsumablesUsed = [...p2ConsUsed, consumable];
        player2Effect = "heal";
      }
      narrative = `${isP1 ? p1Name : p2Name} used a med-kit — healed ${healAmount} HP`;
    } else {
      // attack / reload / special — all deal damage with narrative
      const attackerName = isP1 ? p1Name : (match.isPlayer2AI ? match.aiName ?? "AI" : p2Name);
      const defenderName = isP1 ? (match.isPlayer2AI ? match.aiName ?? "AI" : p2Name) : p1Name;
      const attackerLoadout = isP1 ? match.player1Loadout : match.player2Loadout;
      const defenderLoadout = isP1 ? match.player2Loadout : match.player1Loadout;
      const defenderWasDefending = isP1 ? p2WasDefending : p1WasDefending;

      // Fetch weapon name for narrative
      const weaponId = attackerLoadout.weapon;
      const weaponDef = weaponId ? await MiniGameItem.findOne({ itemId: weaponId }).select("name").lean() : null;
      const weaponName = (weaponDef as any)?.name ?? null;

      let specialMultiplier = 1;
      if (action === "special") specialMultiplier = 1.5;
      if (action === "reload")  specialMultiplier = 0.6;

      const result = calcDamage(
        { ...attackerLoadout, damage: Math.floor(attackerLoadout.damage * specialMultiplier) },
        defenderLoadout,
        attackerName ?? "?",
        defenderName ?? "?",
        weaponName,
        defenderWasDefending,
      );

      if (isP1) {
        p2HPAfter = Math.max(0, p2HPAfter - result.damage);
        if (result.damage > 0) player2Effect = result.isCrit ? "crit" : "hit";
      } else {
        p1HPAfter = Math.max(0, p1HPAfter - result.damage);
        if (result.damage > 0) player1Effect = result.isCrit ? "crit" : "hit";
      }
      narrative = result.narrative;
      if (action === "reload") narrative = `${attackerName} reloads and fires — ${result.narrative.toLowerCase()}`;
      if (action === "special") narrative = `${attackerName} unleashes a special attack — ${result.narrative.toLowerCase()}`;
    }

    // ── AI counter-action (if vs AI) ─────────────────────────────────────────
    let aiNarrative = "";
    let aiAction: string | null = null;
    if (match.isPlayer2AI) {
      aiAction = aiPickAction({ ...match.toObject(), player1HP: p1HPAfter, player2HP: p2HPAfter }, true, p2ConsUsed);

      if (aiAction === "use_item") {
        const aiConsumable = [match.player2Loadout.consumable1, match.player2Loadout.consumable2].find(c => c && !p2ConsUsed.includes(c)) ?? null;
        if (aiConsumable) {
          const healAmount = await resolveHealAmount(aiConsumable);
          p2HPAfter = Math.min(match.player2Loadout.hp, p2HPAfter + healAmount);
          match.player2ConsumablesUsed = [...p2ConsUsed, aiConsumable];
          player2Effect = "heal";
          aiNarrative = `${match.aiName} used a med-kit — healed ${healAmount} HP`;
        } else {
          aiAction = "attack"; // no consumable, fall through to attack
        }
      }

      if (aiAction === "defend") {
        aiNarrative = `${match.aiName} braces for impact`;
      } else if (aiAction === "attack" || aiAction == null) {
        const aiWeaponDef = match.player2Loadout.weapon
          ? await MiniGameItem.findOne({ itemId: match.player2Loadout.weapon }).select("name").lean()
          : null;
        const aiWeaponName = (aiWeaponDef as any)?.name ?? null;
        const aiResult = calcDamage(
          match.player2Loadout,
          match.player1Loadout,
          match.aiName ?? "AI",
          p1Name ?? "Player",
          aiWeaponName,
          p1WasDefending,
        );
        p1HPAfter = Math.max(0, p1HPAfter - aiResult.damage);
        if (aiResult.damage > 0) player1Effect = aiResult.isCrit ? "crit" : "hit";
        aiNarrative = aiResult.narrative;
      }
    }

    // ── Build turn record ─────────────────────────────────────────────────────
    const fullNarrative = [narrative, aiNarrative].filter(Boolean).join(" | ");
    const turnRecord = {
      turnNumber:     match.currentTurn,
      player1Action:  (isP1 ? action : (match.isPlayer2AI ? aiAction ?? "attack" : "auto_attack")) as any,
      player2Action:  (isP1 ? (match.isPlayer2AI ? aiAction ?? "attack" : "auto_attack") : action) as any,
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

    const p1Dead = p1HPAfter <= 0;
    const p2Dead = p2HPAfter <= 0;

    if (p1Dead || p2Dead) {
      match.status = "complete";
      if (p1Dead && p2Dead) {
        match.winnerId = null; // draw
      } else if (p2Dead) {
        match.winnerId = match.player1Id;
      } else {
        match.winnerId = match.player2Id ?? null;
      }
      match.rewardsGranted = false;
    }

    await match.save();

    // Grant rewards if complete
    if (match.status === "complete" && !match.rewardsGranted) {
      await grantCombatRewards(match);
      match.rewardsGranted = true;
      await match.save();
    }

    res.json({ match });
  } catch (err) {
    req.log.error({ err }, "arena action error");
    res.status(500).json({ message: "Internal server error" });
  }
});

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
    const mult = matchesToday >= HALF_CAP ? 0.05 : matchesToday >= FULL_CAP ? 0.5 : 1;
    u.miniGameMatchesToday = matchesToday + 1;

    if (isDraw) {
      u.dc += Math.floor(80 * mult); u.xp += Math.floor(100 * mult);
    } else if (isWinner) {
      const streakBonus = Math.min(((u.combatWinStreak ?? 0) + 1) * 50, 300);
      u.dc += Math.floor((150 + streakBonus) * mult);
      u.xp += Math.floor(200 * mult);
      u.combatWinStreak = (u.combatWinStreak ?? 0) + 1;
      if (mult >= 1) u.keyShards += 1; // key shard only on full-reward matches
      u.wins += 1;
    } else {
      u.dc += Math.floor(40 * mult); u.xp += Math.floor(60 * mult);
      u.combatWinStreak = 0;
      u.losses += 1;
    }
    u.totalFights += 1;
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

    // Notification
    const notifTitle = isDraw ? "Combat Draw" : isWinner ? "Combat Victory! 🏆" : "Combat Defeat";
    const notifBody  = isDraw
      ? `Draw vs ${match.isPlayer2AI ? match.aiName : "opponent"} — +80 DC, +100 XP`
      : isWinner ? `You won! +150 DC, +200 XP, +1 Key Shard`
      : `You lost — +40 DC, +60 XP`;
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
