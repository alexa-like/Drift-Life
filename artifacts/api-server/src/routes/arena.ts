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
setInterval(async () => {
  const now = Date.now();
  for (const [userId, entry] of combatQueue.entries()) {
    const age = now - entry.joinedAt.getTime();
    if (age < 5_000) continue;

    // After 15s widen range — try again
    if (age >= 15_000 && age < 30_000) {
      const wideRange = 0.25;
      const candidates = [...combatQueue.values()].filter(e =>
        e.userId !== userId &&
        Math.abs(e.score - entry.score) <= entry.score * wideRange,
      );
      if (candidates.length > 0) {
        const opp = candidates[0];
        combatQueue.delete(userId);
        combatQueue.delete(opp.userId);
        await tryMatch(entry).catch(() => {});
        continue;
      }
    }

    // After 30s fill with AI
    if (age >= 30_000) {
      combatQueue.delete(userId);
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
): { damage: number; narrative: string; effect: string | null } {
  const base = attackerLoadout.damage + Math.floor((Math.random() - 0.5) * 10);
  const hit  = Math.random() * 100 < (attackerLoadout.accuracy ?? 85);
  if (!hit) return { damage: 0, narrative: "Attack missed!", effect: null };
  const raw = Math.max(1, base - defenderLoadout.defense);
  return { damage: raw, narrative: `Hit for ${raw} damage`, effect: null };
}

function aiPickAction(match: any, aiIsP2: boolean): string {
  const myHP    = aiIsP2 ? match.player2HP : match.player1HP;
  const myLoadout: LoadoutSnapshot = aiIsP2 ? match.player2Loadout : match.player1Loadout;
  const pct = myHP / myLoadout.hp;
  if (pct < 0.35 && myLoadout.consumable1) return "use_item";
  const roll = Math.random();
  if (roll < 0.6) return "attack";
  if (roll < 0.8) return "defend";
  return "attack";
}

// ── POST /api/arena/match/:matchId/action ─────────────────────────────────────
router.post("/match/:matchId/action", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { action } = req.body as { action: "attack" | "defend" | "use_item" | "reload" | "special" };
    if (!["attack","defend","use_item","reload","special"].includes(action)) {
      res.status(400).json({ message: "Invalid action" }); return;
    }

    const match = await CombatMatch.findOne({ matchId: req.params["matchId"] });
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }
    if (match.status !== "active") { res.status(400).json({ message: "Match is not active" }); return; }

    const isP1 = match.player1Id?.toString() === req.userId;
    const isP2 = !match.isPlayer2AI && match.player2Id?.toString() === req.userId;
    if (!isP1 && !isP2) { res.status(403).json({ message: "Not your match" }); return; }

    // Apply player action
    let p1HPAfter = match.player1HP;
    let p2HPAfter = match.player2HP;
    let narrative = "";

    if (action === "defend") {
      narrative = isP1 ? "Player braces for impact" : "Opponent braces for impact";
    } else if (action === "use_item") {
      const healAmount = 30;
      if (isP1) { p1HPAfter = Math.min(match.player1Loadout.hp, p1HPAfter + healAmount); }
      else      { p2HPAfter = Math.min(match.player2Loadout.hp, p2HPAfter + healAmount); }
      narrative = `Used consumable — healed ${healAmount} HP`;
    } else {
      // attack / reload / special all do damage
      const defenseBonus = 0;
      if (isP1) {
        const res2 = calcDamage(match.player1Loadout, { ...match.player2Loadout, defense: match.player2Loadout.defense + defenseBonus });
        p2HPAfter = Math.max(0, p2HPAfter - res2.damage);
        narrative = res2.narrative;
      } else {
        const res1 = calcDamage(match.player2Loadout, { ...match.player1Loadout, defense: match.player1Loadout.defense + defenseBonus });
        p1HPAfter = Math.max(0, p1HPAfter - res1.damage);
        narrative = res1.narrative;
      }
    }

    // AI counter-action (if vs AI)
    let aiNarrative = "";
    if (match.isPlayer2AI) {
      const aiAction = aiPickAction({ ...match.toObject(), player1HP: p1HPAfter, player2HP: p2HPAfter }, true);
      if (aiAction === "use_item") {
        p2HPAfter = Math.min(match.player2Loadout.hp, p2HPAfter + 30);
        aiNarrative = `${match.aiName} used a consumable`;
      } else if (aiAction === "defend") {
        aiNarrative = `${match.aiName} braces`;
      } else {
        const aiRes = calcDamage(match.player2Loadout, match.player1Loadout);
        p1HPAfter = Math.max(0, p1HPAfter - aiRes.damage);
        aiNarrative = `${match.aiName}: ${aiRes.narrative}`;
      }
    }

    // Check win condition
    const fullNarrative = [narrative, aiNarrative].filter(Boolean).join(" | ");
    const turnRecord = {
      turnNumber: match.currentTurn,
      player1Action: isP1 ? action : ("auto_attack" as const),
      player2Action: match.isPlayer2AI ? ("auto_attack" as const) : ("auto_attack" as const),
      player1HpAfter: p1HPAfter,
      player2HpAfter: p2HPAfter,
      player1Effect:  null,
      player2Effect:  null,
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
        match.winnerId = match.player2Id;
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

  async function grant(userId: string | null, isWinner: boolean) {
    if (!userId) return;
    const u = await User.findById(userId);
    if (!u) return;

    if (isDraw) {
      u.dc += 80; u.xp += 100;
    } else if (isWinner) {
      u.dc += 150; u.xp += 200;
      // Win streak bonus
      u.combatWinStreak = (u.combatWinStreak ?? 0) + 1;
      const streakBonus = Math.min(u.combatWinStreak * 50, 300);
      u.dc += streakBonus;
      u.keyShards += 1;
      u.wins += 1;
    } else {
      u.dc += 40; u.xp += 60;
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
