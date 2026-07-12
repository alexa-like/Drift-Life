/**
 * giveawayEligibility.ts — §2.1
 *
 * Reusable eligibility checks for giveaway pledge items and frames.
 * All checks are enforced server-side; frontend should mirror them for UX only.
 *
 * When an item/frame fails, the API response MUST include the specific `reason`
 * so the player knows exactly why it was rejected — never silently drop it.
 *
 * bypassForOwnerPanel: set to true only by the Owner-panel route (§7.1) to skip
 * all eligibility rules. Never set from the normal player creation route.
 */

import MiniGameItem from "../models/MiniGameItem";
import { IItem } from "../models/Item";

// ── Eligible normal-store item IDs ────────────────────────────────────────────
// Source of truth: NORMAL_STORE_POOLS in routes/npcStores.ts.
// If that constant changes, update this set to match.
const NORMAL_STORE_ITEM_IDS = new Set<string>([
  // iron_wolf
  "rusty-blade", "combat-knife", "shock-glove", "pistol",
  "tactical-shotgun", "neural-cutter", "katana",
  // steelshield
  "street-jacket", "neon-hoodie", "bulletproof-vest", "corp-suit", "synth-armor",
  // neon_motors
  "motorcycle", "sports-car", "luxury-car",
  // district_pharma
  "energy-drink", "med-patch", "stim-pack", "nerve-tonic", "first-aid-kit",
  "trauma-kit", "nano-repair", "service-token", "adrenaline-vial",
  "combat-stim", "nitro-can", "fuel-pack",
]);

// Rarity tiers that are NEVER eligible regardless of catalog presence.
const FORBIDDEN_RARITIES = new Set(["epic", "legendary", "mythic", "event"]);

// Arena item tiers eligible for giveaway pledging.
const ELIGIBLE_ARENA_TIERS = new Set(["common", "uncommon", "rare"]);

export interface EligibilityResult {
  eligible: boolean;
  /** Human-readable rejection reason; present only when eligible === false. */
  reason?: string;
}

/**
 * Determine whether a player-owned Item may be pledged in a giveaway.
 *
 * Returns false with a specific reason if:
 *   - item.equipped === true  → "unequip this item first"
 *   - item is Epic/Legendary/Mythic/Event → "not sold in NPC shops …"
 *   - item name/id not found in NORMAL_STORE_POOLS or eligible MiniGameItem
 *
 * The MiniGameItem check is async (DB query); must be awaited.
 */
export async function isItemGiveawayEligible(
  item: Pick<IItem, "equipped" | "rarity" | "name">,
  bypassForOwnerPanel = false,
): Promise<EligibilityResult> {
  if (bypassForOwnerPanel) return { eligible: true };

  // Equipped items must be unequipped first — never silently drop them.
  if (item.equipped) {
    return { eligible: false, reason: "unequip this item first" };
  }

  // Absolute guard: forbidden rarities can never be listed.
  if (FORBIDDEN_RARITIES.has(item.rarity)) {
    return {
      eligible: false,
      reason:
        "Epic, Legendary, Mythic, and Event items are not sold in NPC shops — they can only be auctioned or obtained from the Royale",
    };
  }

  // Convert display name to slug for NORMAL_STORE_POOLS lookup.
  // NPC-store items are created with name = itemId.replace(/-/g, " "),
  // so reversing that gives back the itemId slug.
  const slug = item.name.toLowerCase().replace(/\s+/g, "-");

  if (NORMAL_STORE_ITEM_IDS.has(slug)) {
    return { eligible: true };
  }

  // Fall back to MiniGameItem catalog check (arena items that ended up in
  // the Item collection via drops or other paths).
  const miniItem = await MiniGameItem.findOne({
    itemId: slug,
    tier: { $in: ["common", "uncommon", "rare"] as ("common" | "uncommon" | "rare")[] },
    isActive: true,
  })
    .select("itemId")
    .lean();

  if (miniItem) {
    return { eligible: true };
  }

  return {
    eligible: false,
    reason:
      "this item is not sold in NPC shops — only common, uncommon, and rare NPC-shop items may be listed; auction-only and Royale-only items cannot",
  };
}

