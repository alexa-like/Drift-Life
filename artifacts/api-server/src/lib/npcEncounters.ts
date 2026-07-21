/**
 * NPC Encounters — Tier 9.2
 * Weighted random encounters that fire when a player initiates district travel.
 * Immediate-effect encounters are applied here and returned in the travel response.
 * Player-choice encounters are returned with options and an expiry so the frontend
 * can show a modal; the player resolves them via POST /api/districts/resolve-encounter.
 */
import User from "../models/User";

export type EncounterKind =
  | "mugger"
  | "mysterious_contact"
  | "police_checkpoint"
  | "black_market_trader"
  | "rival_gang"
  | "friendly_mentor"
  | "monster_minion"
  | "hero_contact";

export interface EncounterOption {
  id: string;
  label: string;
  description: string;
}

export interface EncounterResult {
  kind: EncounterKind;
  title: string;
  description: string;
  immediateEffects?: Record<string, unknown>;
  /** Present → player must call resolve-encounter. Absent → already resolved. */
  options?: EncounterOption[];
  expiresInMs?: number;
}

// Weighted pool — weights need not sum to 100
const BASE_POOL: Array<{ kind: EncounterKind; weight: number }> = [
  { kind: "mugger",              weight: 25 },
  { kind: "mysterious_contact",  weight: 15 },
  { kind: "police_checkpoint",   weight: 25 },
  { kind: "black_market_trader", weight: 10 },
  { kind: "rival_gang",          weight: 15 },
  { kind: "friendly_mentor",     weight: 10 },
];

function weightedPick(pool: Array<{ kind: EncounterKind; weight: number }>): EncounterKind {
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return item.kind;
  }
  return pool[pool.length - 1].kind;
}

interface TravelCtx {
  userId: string;
  level: number;
  strength: number;
  intelligence: number;
  dc: number;
  district: string;
  hasActiveBossEvent?: boolean;
}

/**
 * Roll an encounter for a player who just started travel.
 * @param encounterChance  Probability a travel triggers an encounter (default 0.15).
 * @returns Encounter data, or null if the roll missed.
 */
export async function rollEncounter(
  ctx: TravelCtx,
  encounterChance = 0.15,
): Promise<EncounterResult | null> {
  if (Math.random() > encounterChance) return null;

  const pool = ctx.hasActiveBossEvent
    ? [
        ...BASE_POOL,
        { kind: "monster_minion" as EncounterKind, weight: 20 },
        { kind: "hero_contact"   as EncounterKind, weight: 10 },
      ]
    : BASE_POOL;

  const kind = weightedPick(pool);

  switch (kind) {
    // ── Fully server-resolved (no player choice) ─────────────────────────────

    case "mysterious_contact": {
      const expiresAt = new Date(Date.now() + 30 * 60_000);
      await User.findByIdAndUpdate(ctx.userId, {
        $push: { activeBuffs: { buffType: "crime_payout_x2", value: 2, expiresAt } },
      });
      return {
        kind,
        title: "Mysterious Contact",
        description:
          "A hooded figure slips you a data chip — intel on tonight's score. Crime payouts doubled for 30 minutes.",
        immediateEffects: { buff: "crime_payout_x2", durationMinutes: 30 },
      };
    }

    case "friendly_mentor": {
      if (ctx.level >= 20) {
        return {
          kind,
          title: "Street Contact",
          description: "A seasoned runner nods at you. No words — just respect.",
          immediateEffects: {},
        };
      }
      const xpGain = 500;
      await User.findByIdAndUpdate(ctx.userId, { $inc: { xp: xpGain } });
      return {
        kind,
        title: "Friendly Mentor",
        description: `An old runner spots raw talent. They hand you ${xpGain} XP worth of hard-won knowledge.`,
        immediateEffects: { xpGain },
      };
    }

    case "rival_gang": {
      const heatGain = 5 + Math.floor(Math.random() * 10);
      await User.findByIdAndUpdate(ctx.userId, { $inc: { heat: heatGain } });
      return {
        kind,
        title: "Rival Gang Lookout",
        description: `A lookout clocked you moving through their turf. You're marked. Heat +${heatGain}.`,
        immediateEffects: { heatGain },
      };
    }

    case "monster_minion": {
      const won = Math.random() < Math.min(0.9, 0.30 + ctx.strength * 0.01);
      const eventPts = won ? 100 + Math.floor(Math.random() * 50) : 0;
      return {
        kind,
        title: won ? "Boss Minion Defeated" : "Boss Minion Ambush",
        description: won
          ? `A boss minion jumped you on the way. You dropped it clean. +${eventPts} event points.`
          : "A boss minion ambushed you — barely escaped. No points this time.",
        immediateEffects: { won, eventPoints: eventPts },
      };
    }

    case "hero_contact": {
      const bonusPts = 50 + Math.floor(Math.random() * 100);
      return {
        kind,
        title: "Hero Contact",
        description: `A shadowy operative hands you coordinates. +${bonusPts} event points.`,
        immediateEffects: { eventPoints: bonusPts },
      };
    }

    // ── Player-choice encounters (stored & resolved via separate endpoint) ────

    case "mugger":
      return {
        kind,
        title: "Street Mugger",
        description: "A desperate runner levels a weapon at you. Pay up or fight.",
        options: [
          { id: "pay",   label: "Pay Up",     description: "Lose 500 DC, keep moving." },
          { id: "fight", label: "Fight Back",  description: "Your strength vs their nerve." },
        ],
        expiresInMs: 5 * 60_000,
      };

    case "police_checkpoint":
      return {
        kind,
        title: "Police Checkpoint",
        description: "Corp-sec set up a checkpoint. Pay the bribe or risk a 10-minute detainment.",
        options: [
          { id: "bribe",  label: "Pay the Bribe", description: "200 DC — quiet and clean." },
          { id: "comply", label: "Comply",         description: "50% chance of jail." },
        ],
        expiresInMs: 5 * 60_000,
      };

    case "black_market_trader": {
      const marketItems = [
        { id: "synthetic_stimpack", name: "Synthetic Stimpack", basePrice: 1_200 },
        { id: "street_stim",        name: "Street Stim",        basePrice:   400 },
        { id: "euphoria_pill",      name: "Euphoria Pill",      basePrice:   800 },
        { id: "designer_nitro",     name: "Designer Nitro",     basePrice: 1_200 },
        { id: "combat_injector",    name: "Combat Injector",    basePrice: 2_000 },
      ];
      const offered = marketItems[Math.floor(Math.random() * marketItems.length)];
      const price = Math.floor(offered.basePrice * 0.70);
      return {
        kind,
        title: "Black Market Trader",
        description: `A cloaked merchant offers you a ${offered.name} for ${price.toLocaleString()} DC — 30% off street price.`,
        options: [
          { id: `buy:${offered.id}:${price}`, label: `Buy — ${price.toLocaleString()} DC`, description: `Get the ${offered.name}.` },
          { id: "skip",                        label: "Skip",                               description: "Leave it." },
        ],
        expiresInMs: 10 * 60_000,
        immediateEffects: { offer: { itemId: offered.id, itemName: offered.name, price } },
      };
    }

    default:
      return null;
  }
}

/**
 * Resolve a player-choice encounter.
 * Clears pendingEncounter on the User document.
 */
export async function resolveEncounter(
  userId: string,
  kind: EncounterKind,
  choiceId: string,
  snap: { strength: number; dc: number },
): Promise<{ outcome: string; dcChange: number }> {
  let dcChange = 0;
  let outcome = "";

  switch (kind) {
    case "mugger": {
      if (choiceId === "pay") {
        const cost = 500;
        const ok = await User.findOneAndUpdate(
          { _id: userId, dc: { $gte: cost } },
          { $inc: { dc: -cost } },
        );
        if (!ok) {
          await User.findByIdAndUpdate(userId, { $inc: { heat: 5 } });
          outcome = "Couldn't pay — mugger roughed you up. Heat +5.";
        } else {
          dcChange = -cost;
          outcome = "Paid 500 DC. The mugger walks off.";
        }
      } else {
        const won = Math.random() < Math.min(0.85, 0.30 + snap.strength * 0.015);
        if (won) {
          outcome = "You floored the mugger. Nothing lost.";
        } else {
          const lost = 500;
          const ok = await User.findOneAndUpdate(
            { _id: userId, dc: { $gte: lost } },
            { $inc: { dc: -lost } },
          );
          if (ok) dcChange = -lost;
          await User.findByIdAndUpdate(userId, { $inc: { heat: 5 } });
          outcome = `Got beaten. Lost 500 DC and heat +5.`;
        }
      }
      break;
    }

    case "police_checkpoint": {
      if (choiceId === "bribe") {
        const bribe = 200;
        const ok = await User.findOneAndUpdate(
          { _id: userId, dc: { $gte: bribe } },
          { $inc: { dc: -bribe } },
        );
        if (!ok) {
          const jailUntil = new Date(Date.now() + 10 * 60_000);
          await User.findByIdAndUpdate(userId, { $set: { jailUntil, status: "jailed" } });
          outcome = "Couldn't afford the bribe — detained 10 minutes.";
        } else {
          dcChange = -bribe;
          outcome = "Bribe paid. Corp-sec looks the other way.";
        }
      } else {
        if (Math.random() < 0.50) {
          const jailUntil = new Date(Date.now() + 10 * 60_000);
          await User.findByIdAndUpdate(userId, { $set: { jailUntil, status: "jailed" } });
          outcome = "Detained for routine questioning. Back in 10 minutes.";
        } else {
          outcome = "Clean record — they waved you through.";
        }
      }
      break;
    }

    case "black_market_trader": {
      if (choiceId === "skip") {
        outcome = "You walked past the trader.";
      } else if (choiceId.startsWith("buy:")) {
        const parts = choiceId.split(":");
        const price = parseInt(parts[2] ?? "0", 10);
        if (!price || price <= 0) { outcome = "Invalid offer."; break; }
        const ok = await User.findOneAndUpdate(
          { _id: userId, dc: { $gte: price } },
          { $inc: { dc: -price } },
        );
        if (!ok) {
          outcome = `Not enough DC (need ${price.toLocaleString()} DC).`;
        } else {
          dcChange = -price;
          outcome = `Purchased for ${price.toLocaleString()} DC. Deal done.`;
        }
      } else {
        outcome = "Unknown choice.";
      }
      break;
    }

    default:
      outcome = "Encounter already resolved.";
  }

  await User.findByIdAndUpdate(userId, { $set: { pendingEncounter: null } });
  return { outcome, dcChange };
}
