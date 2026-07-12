/**
 * giveawayValuation.ts — §2.2
 *
 * Valuation and coverage functions for the giveaway system.
 *
 * IMPORTANT: DC never converts to UC (Appendix A).
 * The ONLY UC-adjacent conversion here is shortfall DC-equivalent → UC cost,
 * one direction only, and it produces a UC *cost*, never a DC payout.
 */

import mongoose from "mongoose";
import Item from "../models/Item";
import { IUser } from "../models/User";

// ── DC-per-NC exchange rate ────────────────────────────────────────────────────
//
// Derived from the cheapest NC pack defined in lib/subscription.ts (NC_PACKS):
//   Starter Pack: 500 NC for 100 Telegram Stars → 5 NC per Star (base rate).
//
// No explicit DC↔NC exchange exists in the live economy. We establish a
// conservative reference rate:
//   1 NC = 50 DC
//   → 500 NC (Starter Pack) ≈ 25,000 DC purchasing power
//   → This places a starter pack roughly at the cost of a cheap rare NPC item.
//
// This rate governs only the shortfall top-up cost calculation.
// If the economy balance changes, update this constant and re-verify all callers.
export const DC_PER_NC = 50;

// ── DC-per-key exchange rate ───────────────────────────────────────────────────
//
// No explicit DC-per-key rate exists in the economy (keys are purchased for NC,
// not DC: /api/store/keys grants 3 keys for 50 NC → 1 key ≈ 16.67 NC).
// Fallback rate: 1 key = 833 DC  (16.67 NC × 50 DC/NC, rounded up).
// Used only for pledge valuation and shortfall calculation, not for any trade.
export const DC_PER_KEY = 833;

// ── Pledge item shape for valuation ──────────────────────────────────────────

export interface PledgeItemInput {
  itemId: mongoose.Types.ObjectId | string;
  name: string;
  quantity: number;
  /** Use marketPrice when available; fall back to basePrice. */
  marketPrice?: number | null;
  basePrice?: number;
  iconUrl?: string | null;
}

// ── §2.2 computePledgeValueDc ─────────────────────────────────────────────────

/**
 * Total DC-equivalent value of a pledge.
 *
 * UC pledged directly is NOT folded into this total — it is tracked separately
 * (Appendix A: DC never converts to UC in any direction).
 *
 * Formula:
 *   pledgeValueDc = pledge.dc
 *                 + (pledge.keys × DC_PER_KEY)
 *                 + Σ items[i].quantity × (marketPrice ?? basePrice ?? 0)
 */
export function computePledgeValueDc(pledge: {
  dc: number;
  keys: number;
  items: PledgeItemInput[];
}): number {
  const keysValue = pledge.keys * DC_PER_KEY;
  const itemsValue = pledge.items.reduce((sum, item) => {
    const unitPrice = item.marketPrice ?? item.basePrice ?? 0;
    return sum + unitPrice * item.quantity;
  }, 0);
  return pledge.dc + keysValue + itemsValue;
}

// ── §2.2 computeHostCoverage ──────────────────────────────────────────────────

export interface ItemShortfall {
  itemId: mongoose.Types.ObjectId | string;
  name: string;
  /** How many units the host is short by. */
  missing: number;
  /** DC value per missing unit (for ucTopUp calculation). */
  unitDcValue: number;
}

export interface CoverageResult {
  /** DC the host is short by (pledge.dc − host.dc, clamped ≥ 0). */
  shortfallDc: number;
  /** NC the host is short by for the directly-pledged UC (pledge.uc − host.nc, ≥ 0). */
  shortfallUc: number;
  /** Keys the host is short by. */
  shortfallKeys: number;
  /** Per-item quantity shortfalls. */
  shortfallItems: ItemShortfall[];
  /**
   * Frame IDs the host does not own.
   * A non-empty list is a hard blocker — frame ownership cannot be covered by
   * paying UC. The creation route must reject with a specific error per frame.
   */
  /**
   * Total DC-equivalent value of all shortfalls that CAN be covered by UC
   * (dc + keys×DC_PER_KEY + missing item values).
   * Pass this to computeUcTopUpCost() to get how much NC the host must pay.
   */
  shortfallDcEquivalent: number;
  /** True only when every pledge line is fully covered. */
  isCovered: boolean;
}

/**
 * Compare every pledge line against what the host actually owns right now.
 *
 * Items are looked up by _id in the Item collection to get the real live quantity.
 * Items are looked up by _id in the Item collection to get the real live quantity.
 */
export async function computeHostCoverage(
  host: IUser,
  pledge: {
    dc: number;
    uc: number;
    keys: number;
    items: PledgeItemInput[];
  },
): Promise<CoverageResult> {
  // DC shortfall
  const shortfallDc = Math.max(0, pledge.dc - host.dc);

  // UC shortfall (direct pledge amount vs host.nc)
  const shortfallUc = Math.max(0, pledge.uc - host.nc);

  // Keys shortfall
  const shortfallKeys = Math.max(0, pledge.keys - host.keys);

  // Item shortfalls — query live inventory quantities
  const shortfallItems: ItemShortfall[] = [];
  for (const pledgedItem of pledge.items) {
    const ownedDoc = await Item.findOne({
      owner: host._id,
      _id: pledgedItem.itemId,
    })
      .select("quantity")
      .lean();
    const owned = ownedDoc?.quantity ?? 0;
    const missing = Math.max(0, pledgedItem.quantity - owned);
    if (missing > 0) {
      shortfallItems.push({
        itemId: pledgedItem.itemId,
        name: pledgedItem.name,
        missing,
        unitDcValue: pledgedItem.marketPrice ?? pledgedItem.basePrice ?? 0,
      });
    }
  }

  // DC-equivalent value of all coverable shortfalls
  const shortfallDcEquivalent =
    shortfallDc +
    shortfallKeys * DC_PER_KEY +
    shortfallItems.reduce(
      (sum, si) => sum + si.missing * si.unitDcValue,
      0,
    );

  const isCovered =
    shortfallDc === 0 &&
    shortfallUc === 0 &&
    shortfallKeys === 0 &&
    shortfallItems.length === 0;

  return {
    shortfallDc,
    shortfallUc,
    shortfallKeys,
    shortfallItems,
    shortfallFrames: [],
    shortfallDcEquivalent,
    isCovered,
  };
}

// ── §2.2 computeUcTopUpCost ───────────────────────────────────────────────────

/**
 * Convert a DC-equivalent shortfall into a UC (NC) top-up cost.
 *
 * Formula: ceil(shortfallDcValue / DC_PER_NC)
 *
 * DC_PER_NC = 50  (derived from Starter Pack: 500 NC @ 100 Stars; see above).
 *
 * This is the ONLY DC→UC-adjacent conversion in the giveaway system.
 * It produces a UC *cost* only — never a DC payout.
 * "DC never converts to UC, in any direction." (Appendix A)
 *
 * A host who also has a direct UC shortfall (shortfallUc from computeHostCoverage)
 * must add that on top: totalUcNeeded = computeUcTopUpCost(shortfallDcEquivalent) + shortfallUc
 */
export function computeUcTopUpCost(shortfallDcValue: number): number {
  if (shortfallDcValue <= 0) return 0;
  return Math.ceil(shortfallDcValue / DC_PER_NC);
}
