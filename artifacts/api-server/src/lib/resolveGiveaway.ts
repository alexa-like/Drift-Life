/**
 * lib/resolveGiveaway.ts — §5.2 shared resolution logic
 *
 * Called by BOTH:
 *  - Tier 4's cap-reached trigger (§4.4), when entrantCount reaches maxEntrants
 *  - Tier 5's background worker (§5.1), when liveExpiresAt has passed
 *
 * Both callers MUST route through this single function — there is exactly one
 * distribution code path in the whole system.
 *
 * Race safety: the first write inside the transaction is an atomic
 * findOneAndUpdate filtered on status === "live". This is the optimistic
 * claim — whichever caller (cap-reached vs. timer-expiry) gets here first wins;
 * the other finds status no longer "live" and no-ops. No giveaway can ever be
 * double-processed even if both triggers fire in the same instant.
 */

import mongoose from "mongoose";
import Giveaway, { IGiveaway } from "../models/Giveaway";
import GiveawayEntry from "../models/GiveawayEntry";
import User from "../models/User";
import Item from "../models/Item";
import Notification from "../models/Notification";
import FeedEvent from "../models/FeedEvent";

/** Fisher-Yates shuffle — randomizes winner order before round-robin distribution. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Split `total` indivisible units across `n` recipients round-robin style:
 * recipient i gets base + (1 extra if i < remainder). This is mathematically
 * identical to handing out one unit at a time to an ordered list until
 * exhausted (§5.2's literal description), but O(1) instead of O(total) —
 * important since `total` can be tens of thousands of DC.
 */
function splitEvenly(total: number, n: number): number[] {
  if (n === 0) return [];
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

interface WinnerAccumulator {
  userId: mongoose.Types.ObjectId;
  dc: number;
  uc: number;
  keys: number;
  items: Map<string, { itemId: mongoose.Types.ObjectId; name: string; quantity: number }>;
  frames: string[];
}

function newAccumulator(userId: mongoose.Types.ObjectId): WinnerAccumulator {
  return { userId, dc: 0, uc: 0, keys: 0, items: new Map(), frames: [] };
}

/**
 * Grant an item to a user's inventory: merge into an existing non-equipped,
 * non-market-listed stack of the same name+rarity if one exists, else create
 * a fresh Item doc copying metadata from the source item. Falls back to bare
 * defaults if the source item was since deleted — a giveaway payout must
 * never silently vanish just because the original stack is gone.
 */
async function grantItem(
  userId: mongoose.Types.ObjectId,
  sourceItemId: mongoose.Types.ObjectId,
  name: string,
  quantity: number,
  session: mongoose.ClientSession,
): Promise<void> {
  if (quantity <= 0) return;
  const source = await Item.findById(sourceItemId).session(session).lean();

  const merged = await Item.findOneAndUpdate(
    {
      owner: userId,
      name: source?.name ?? name,
      rarity: source?.rarity ?? "common",
      equipped: false,
      marketListed: false,
    },
    { $inc: { quantity } },
    { session },
  );
  if (merged) return;

  await Item.create(
    [{
      owner: userId,
      name: source?.name ?? name,
      type: source?.type ?? "misc",
      rarity: source?.rarity ?? "common",
      strengthBonus: source?.strengthBonus ?? 0,
      charismaBonus: source?.charismaBonus ?? 0,
      intelligenceBonus: source?.intelligenceBonus ?? 0,
      streetCredBonus: source?.streetCredBonus ?? 0,
      travelTimeReduction: source?.travelTimeReduction ?? 0,
      effect: source?.effect ?? null,
      description: source?.description ?? "Won from a giveaway.",
      basePrice: source?.basePrice ?? 0,
      iconUrl: source?.iconUrl ?? null,
      quantity,
    }],
    { session },
  );
}

/** Apply one winner's accumulated share to their User doc + inventory. */
async function applyWinnerShare(w: WinnerAccumulator, session: mongoose.ClientSession): Promise<void> {
  const inc: Record<string, number> = {};
  if (w.dc)   inc.dc = w.dc;
  if (w.uc)   inc.nc = w.uc;
  if (w.keys) inc.keys = w.keys;
  if (Object.keys(inc).length > 0) {
    await User.findByIdAndUpdate(w.userId, { $inc: inc }, { session });
  }
  if (w.frames.length > 0) {
    await User.findByIdAndUpdate(w.userId, { $addToSet: { ownedChatFrames: { $each: w.frames } } }, { session });
  }
  for (const item of w.items.values()) {
    await grantItem(w.userId, item.itemId, item.name, item.quantity, session);
  }
}

/**
 * Refund the full pledge back to the host — used on zero-entrant giveaways.
 * Real players only; owner-hosted pools with zero entrants simply dissolve
 * (see resolveGiveaway) since nothing was ever deducted from a real balance.
 */
async function refundToHost(giveaway: IGiveaway, session: mongoose.ClientSession): Promise<void> {
  const { pledge, host } = giveaway;
  const inc: Record<string, number> = {};
  if (pledge.dc)   inc.dc = pledge.dc;
  if (pledge.uc)   inc.nc = pledge.uc;
  if (pledge.keys) inc.keys = pledge.keys;
  if (Object.keys(inc).length > 0) {
    await User.findByIdAndUpdate(host, { $inc: inc }, { session });
  }
  if (pledge.frames.length > 0) {
    await User.findByIdAndUpdate(host, { $addToSet: { ownedChatFrames: { $each: [...pledge.frames] } } }, { session });
  }
  for (const pi of pledge.items) {
    await grantItem(host, pi.itemId, pi.name, pi.quantity, session);
  }
}

interface WinnerOut {
  userId: mongoose.Types.ObjectId;
  dc: number;
  uc: number;
  keys: number;
  items: Array<{ itemId: mongoose.Types.ObjectId; quantity: number }>;
  frames: string[];
}

/**
 * Resolve a single giveaway: refund (zero entrants), full transfer (one
 * entrant), or shuffled round-robin distribution (multiple entrants).
 * Safe to call redundantly — the atomic claim ensures only the first caller
 * ever proceeds past it; a second concurrent/duplicate call is a silent no-op.
 */
export async function resolveGiveaway(giveawayId: string | mongoose.Types.ObjectId): Promise<void> {
  const giveaway = await Giveaway.findById(giveawayId);
  if (!giveaway || giveaway.status !== "live") return; // already resolved, refunded, or still a draft

  const entries = await GiveawayEntry.find({ giveawayId: giveaway._id }).select("userId").lean();
  const entrantIds = entries.map((e) => e.userId as mongoose.Types.ObjectId);
  const n = entrantIds.length;

  const session = await mongoose.startSession();
  let claimed = false;
  let finalStatus: "ended" | "refunded" = "ended";
  let winnersOut: WinnerOut[] = [];

  try {
    await session.withTransaction(async () => {
      // ── Atomic claim (optimistic lock) — the ONLY guard against double-processing.
      const targetStatus: "ended" | "refunded" = n === 0 ? "refunded" : "ended";
      const win = await Giveaway.findOneAndUpdate(
        { _id: giveaway._id, status: "live" },
        { status: targetStatus, resolvedAt: new Date() },
        { session },
      );
      if (!win) return; // someone else claimed it this instant — abort silently

      claimed = true;
      finalStatus = targetStatus;

      if (n === 0) {
        if (!giveaway.isOwnerHosted) {
          await refundToHost(giveaway, session);
        }
        return;
      }

      if (n === 1) {
        const w = newAccumulator(entrantIds[0]);
        w.dc = giveaway.pledge.dc;
        w.uc = giveaway.pledge.uc;
        w.keys = giveaway.pledge.keys;
        for (const pi of giveaway.pledge.items) {
          w.items.set(String(pi.itemId), { itemId: pi.itemId, name: pi.name, quantity: pi.quantity });
        }
        w.frames = [...giveaway.pledge.frames];
        await applyWinnerShare(w, session);
        winnersOut = [{
          userId: w.userId, dc: w.dc, uc: w.uc, keys: w.keys,
          items: [...w.items.values()].map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
          frames: w.frames,
        }];
        return;
      }

      // ── Multiple entrants: shuffle, then distribute round-robin ──────────
      const order = shuffle(entrantIds).map((id) => String(id));
      const winners = new Map<string, WinnerAccumulator>(
        order.map((uid) => [uid, newAccumulator(new mongoose.Types.ObjectId(uid))]),
      );

      const dcShares  = splitEvenly(giveaway.pledge.dc, n);
      const ucShares  = splitEvenly(giveaway.pledge.uc, n);
      const keyShares = splitEvenly(giveaway.pledge.keys, n);
      order.forEach((uid, i) => {
        const w = winners.get(uid)!;
        w.dc   += dcShares[i];
        w.uc   += ucShares[i];
        w.keys += keyShares[i];
      });

      // Items: round-robin one quantity-unit at a time, cursor continues across item types
      let cursor = 0;
      for (const pi of giveaway.pledge.items) {
        for (let unit = 0; unit < pi.quantity; unit++) {
          const uid = order[cursor % n];
          cursor++;
          const w = winners.get(uid)!;
          const key = String(pi.itemId);
          const existing = w.items.get(key);
          if (existing) existing.quantity += 1;
          else w.items.set(key, { itemId: pi.itemId, name: pi.name, quantity: 1 });
        }
      }

      // Frames: one indivisible unit each, round-robin (same cursor convention as items)
      for (const frameId of giveaway.pledge.frames) {
        const uid = order[cursor % n];
        cursor++;
        winners.get(uid)!.frames.push(frameId);
      }

      // ── Verify no currency/items were created or destroyed (§5.2) ────────
      const list = [...winners.values()];
      const totalDc     = list.reduce((s, w) => s + w.dc, 0);
      const totalUc     = list.reduce((s, w) => s + w.uc, 0);
      const totalKeys   = list.reduce((s, w) => s + w.keys, 0);
      const totalFrames = list.reduce((s, w) => s + w.frames.length, 0);
      const totalItemUnits = list.reduce(
        (s, w) => s + [...w.items.values()].reduce((s2, i) => s2 + i.quantity, 0), 0,
      );
      const pledgeItemUnits = giveaway.pledge.items.reduce((s, pi) => s + pi.quantity, 0);
      if (
        totalDc !== giveaway.pledge.dc ||
        totalUc !== giveaway.pledge.uc ||
        totalKeys !== giveaway.pledge.keys ||
        totalFrames !== giveaway.pledge.frames.length ||
        totalItemUnits !== pledgeItemUnits
      ) {
        throw new Error(
          `resolveGiveaway distribution mismatch for ${giveaway._id}: ` +
          `dc ${totalDc}/${giveaway.pledge.dc}, uc ${totalUc}/${giveaway.pledge.uc}, ` +
          `keys ${totalKeys}/${giveaway.pledge.keys}, frames ${totalFrames}/${giveaway.pledge.frames.length}, ` +
          `items ${totalItemUnits}/${pledgeItemUnits}`,
        );
      }

      for (const w of list) {
        await applyWinnerShare(w, session);
      }
      winnersOut = list.map((w) => ({
        userId: w.userId, dc: w.dc, uc: w.uc, keys: w.keys,
        items: [...w.items.values()].map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
        frames: w.frames,
      }));
    });
  } finally {
    await session.endSession();
  }

  if (!claimed) return; // lost the race — another caller resolved this giveaway

  await Giveaway.findByIdAndUpdate(giveaway._id, { winners: winnersOut });

  // Notifications + Feed card run after commit — non-fatal if they fail,
  // since the actual asset transfer already succeeded and is durable.
  await notifyAndPost(giveaway, finalStatus, winnersOut).catch((err) => {
    console.error(`[giveaway:${giveaway._id}] post-resolution notify/feed failed:`, err);
  });
}

async function notifyAndPost(
  giveaway: IGiveaway,
  finalStatus: "ended" | "refunded",
  winners: WinnerOut[],
): Promise<void> {
  if (finalStatus === "refunded") {
    if (!giveaway.isOwnerHosted) {
      await Notification.create({
        userId: giveaway.host,
        type:   "system",
        message: "Your giveaway got no entrants and has been refunded in full.",
      });
    } else {
      // §5.3 — owner-hosted pools dissolve silently; nothing to notify a real user about.
      console.info(`[giveaway:${giveaway._id}] owner-hosted pool dissolved — zero entrants`);
    }
    return;
  }

  // finalStatus === "ended"
  await Promise.all(winners.map((w) =>
    Notification.create({
      userId: w.userId,
      type:   "system",
      message: winners.length === 1
        ? "You won a giveaway! Check your inventory/balance for your reward."
        : "You won a share of a giveaway! Check your inventory/balance for your reward.",
    }),
  ));

  if (!giveaway.isOwnerHosted) {
    await Notification.create({
      userId: giveaway.host,
      type:   "system",
      message: `Your giveaway has concluded — ${winners.length} winner(s) received your pledge.`,
    });
  }

  // Feed card at conclusion — Approach B (§3.5): the FeedEvent is created only now,
  // never while the giveaway was live.
  const hostLabel = giveaway.isOwnerHosted
    ? "System"
    : giveaway.isAnonymous
      ? "??? Anonymous Benefactor"
      : "A host";
  const feedEvent = await FeedEvent.create({
    type:    "giveaway",
    actor:   hostLabel,
    actorId: giveaway.isAnonymous || giveaway.isOwnerHosted ? null : giveaway.host,
    target:  null,
    message: `${hostLabel}'s giveaway has concluded — ${winners.length} winner${winners.length === 1 ? "" : "s"}!`,
    dc: 0,
    xp: 0,
  });
  await Giveaway.findByIdAndUpdate(giveaway._id, { feedEventId: feedEvent._id });
}
