# DriftLife — Full Tier Audit Report
Consolidated findings from 10 parallel sub-agent audits, one per tier in `update_tiers.md`. Each item below is backed by an actual codebase check (not the plan's claims).

---

## ✅ DONE

**Tier 1 — Core Cleanup & Infrastructure**
- User model fields: `prestige`, `prestigeXpBoost`, `keyShards`, `activeBuffs`, `keys`, `nc`, `dc`, `adrenaline`/`maxAdrenaline`, `nitro`/`maxNitro`, `currentLocation`, `travelingTo`, `travelArrivesAt`
- Independent regen for energy/nerve/adrenaline/nitro (`User.ts` `applyRegen`)
- Arena queue costs 1 Adrenaline, race queue costs Nitro
- Service Token added to shop; Luxury Car fixed (travel reduction + charisma + description)
- All weapon items repurposed to `slot: "enhancement"`; `Item` model enum updated
- `maxHealth` removed from schema, replaced with a computed virtual
- Travel time system (`POST /user/travel`, vehicle-based reduction, auto-arrival)
- Armor/Combat Drug items removed from shop
- "Adrenaline Shot" renamed to "Stim Shot"

**Tier 2 — Arena Item Seed System**
- `MiniGameItem` model: category enum and new fields (weaponSlot, magazineSize, ammoCategory, accuracy, armorHp, maxDurability, stackable, maxStack) all correct
- `PlayerMiniGameInventory` / `PlayerLoadout` schemas correctly structured
- Durability distinction (template maxDurability vs. per-copy durability) correctly implemented, including in Royale grant logic
- All weapon seeds (pistols, SMGs, ARs, shotguns, snipers, LMGs) present with correct accuracy/tier scaling
- All 30 ammo items and all 5 body armor tiers seeded correctly

**Tier 3 — Arena Combat Mechanics**
- Loadout management UI with slots, durability bars, ammo summary
- Loadout validation on queue join (blocks missing/broken primary weapon)
- Turn resolution engine (`fire_primary`, `fire_secondary`, `use_consumable`, `melee`), strength bonus applied
- Armor absorption and armor-HP tracking separate from player HP
- Per-match durability degradation, ammo consumption, consumable consumption
- Match reward grants (XP, DC, key shards, scaled by level/win)
- Frontend combat UI (HP/armor bars, turn log, floating damage numbers)

**Tier 4 — Royale System Overhaul**
- `RoyaleItem` model with `royaleCategory`, `spinType`, `itemRef`, `dropWeight`
- All 22 pools (11 categories × 2 spin types) seeded with correct relative weighting
- Weighted random spin logic, correct item granting to weapons/armor/ammo/consumables/race cars/parts
- Key shard grants wired into login streak, arena, race, missions; auto-conversion to keys (20→1)
- `RoyaleHubPage` (11 category cards) and `RoyaleCategoryPage` (DC Spin/Master Royale toggle, spin animation, win-probability list) both built

**Tier 5 — Market & Auction Overhaul**
- All 6 NPC stores implemented with correct keepers/categories, 6-hour restock cycle, price ranges
- Epic/Legendary items hard-blocked from NPC stores (`FORBIDDEN_TIERS` guard)
- NPC store FAQ system (clickable question chips) on frontend
- Auction system: `AuctionListing` model, bot-generated auctions (cron, 30–120 min, cap 5), bidding endpoint with outbid refunds, expiry cron (runs every minute)
- Market category tabs (Weapons/Clothing/Vehicles/Consumables/Materials/Arena Gear/Cars & Parts)

**Tier 6 — Racing Condition System**
- Fully done end-to-end: condition field on player's car/parts, correct degradation ranges (crash vs. normal), unified part degradation, key shard grant on race completion, performance penalty table exactly matching spec, sidelined-at-0 blocking queue join, service endpoint (DC cost by tier + Service Token path), garage UI with color-coded condition bar and labels

**Tier 7 — HP Scaling & Prestige**
- `computeMaxHp` formula matches spec exactly and is a virtual (never stored)
- Health clamped to max on save
- Prestige endpoint: correct requirements (level 100 + 50 combat matches), correct resets, prestige badges/frames granted
- `prestigeXpBoost` applied correctly in Crimes, Jobs, and Arena reward math
- `PrestigeBadge` frontend component with correct tier coloring

**Tier 8 — UI Polish, Images, Navigation**
- `ItemImage` component wired into NPC store, Market, Loadout, Inventory, and Auction pages
- Arena Hub redesigned as two-card mode select
- NPC storefront pages fully built (art fallback, FAQ, stock grid, restock timer, buy flow)
- Shop landing page with all 6 stores

**Tier 9 — Districts, Player Status & NavBar Gating**
- Status fields + auto-resolution middleware (hospitalized/jailed/traveling)
- NavBar visibility matrix correctly gates pages by status
- `StatusBanner` component with live countdowns and correct action buttons per status
- All 7 districts defined with danger rolls, shops (including exclusive items), and crime tables matching spec exactly
- Early-release/bail/revive endpoints all implemented atomically
- Return-home endpoint with vehicle-based travel time

**Tier 10 — System Feed, Notifications, Factions, Social & Economy**
- `FeedEvent` model, `postToSystemFeed` helper, `GET /feed`, feed triggers wired for prestige, royale epic/legendary pulls, notable crimes
- `GameEmoji` model with all 16 slugs + `GET /emojis`
- Full notification system (model, helper, endpoints, bell + panel)
- Daily login reward system (streak tracking, reward table, modal)
- Leaderboards: all 9 tabs, weekly reset (Monday), player's-own-rank display
- NPC encounters (3% roll, 2h cooldown, effect pool)
- Mentor system (register/request/end, XP bonus applied)
- Achievement badge pinning + display in chat/profile
- Black market listing/seizure cron
- Faction bank + perks infrastructure

---

## ⚠️ PARTIALLY DONE
*(what's missing/broken, concretely)*

**Tier 1**
- **Legendary Elixir buff**: pushes 4 separate stat buffs instead of the single `{buffType: "all_stats", value: 10}` entry the spec calls for — the dedicated `all_stats` handling code in `User.ts` is dead code, unreachable from this item.
- **Expired buff cleanup**: `getEffectiveStats` filters expired buffs for reads only; it never actually removes them from the stored array/DB — buffs pile up forever.
- **Old PvP combat**: `CombatMatch` model still contains legacy fields; a legacy `calcDamage` function remains in `arena.ts`; frontend still has "Attack" buttons in `PlayerInspectModal.tsx` and references in `OwnerPage.tsx`.
- **Weapon "passive" stat application**: enhancement slot stats are still manually added/subtracted on equip/unequip (`inventory.ts`) rather than computed dynamically in `getEffectiveStats` as intended.

**Tier 2**
- Several arena consumables (smoke_grenade, adrenaline_shot etc.) mostly match spec but there's a stray duplicate item (`stim_shot` with `berserk` effect) not present in the spec's table — needs reconciling against the canonical list.
- Body armor "blocks one stun" / "reflects 5% damage" special effects for higher tiers are not present in seed metadata (only a generic `absorb` chance is seeded) — unclear if hardcoded elsewhere in combat engine; needs verification.

**Tier 3**
- **Special effects don't fully match spec**: bleed doesn't stack/refresh correctly (overwrites instead of stacking); shield never expires after 2 turns (only depletes via damage); berserk's damage/accuracy bonuses (+30%) and damage reduction (−20%) are configured but not applied anywhere in `fireWeapon`/`applyDamage`.
- **Result screen "destroyed items"** relies on full inventory state rather than a delta of what broke this specific match — always may show stale/incorrect destroyed-item info.
- **Heal specials**: `mega_medkit`'s "removes bleed" behavior isn't mapped from item ID to the generic `clear_bleed` flag.
- **Ammo tier multipliers**: loadout snapshot has no `ammoMultiplier` field — all shots use base weapon damage regardless of which ammo tier is equipped, meaning higher-tier ammo purchases currently do nothing in combat.

**Tier 4**
- **Legacy general royale not removed**: `/royale` route in `App.tsx` still points at the old `RoyalePage.tsx`, not the new `RoyaleHubPage`/`RoyaleCategoryPage` — the new pages exist but aren't wired into routing, so players never see them.
- Backend `/royale/spin` still has legacy "general"/"shooting"/"racing" fallback branches that should be removed per spec.
- "MASTER ONLY" / "DC ONLY" grayed-out cross-pool item display is missing from `RoyaleCategoryPage`.
- Milestone/achievement key shard grants (5/10 shards) not clearly found — needs explicit implementation.

**Tier 5**
- **Bulk listing** doesn't preserve arena item durability as a proper numeric field — it's embedded in a description string rather than structured data.
- **Purchase flow isn't atomic**: DC deduction and credit happen as separate `findOneAndUpdate`/`Promise.all` calls, not inside a MongoDB transaction — a mid-failure could lose or duplicate DC.
- **Commission/netPayout** are computed on the fly rather than stored as fields on the listing.
- **Auction bidding** uses optimistic concurrency instead of a formal transaction for refund+deduct+update — functionally okay but not to spec.
- **Frontend bulk-listing UI** (checkbox multi-select + payout-preview sidebar) doesn't exist — `MarketPage.tsx` only supports buying, not the described listing flow.
- Auction "you're winning/outbid" UI is a basic flag, not the persistent banner the spec describes.
- Chrome Garage restock is effectively a stub — arena car parts haven't been seeded, so its listings are empty.

**Tier 7**
- Prestige UI is incomplete: `PrestigeBadge` component exists but is barely used anywhere else (NavBar shows raw `✦{prestige}` text instead); there is no "⚡ PRESTIGE" button/confirmation modal on the Profile page — the backend endpoint has no way to be triggered from the UI.
- `prestigeXpBoost` is applied in Crimes/Jobs/Arena but missing from Racing and Missions reward calculations.

**Tier 8**
- Several referenced image assets don't exist on disk (`/assets/arena/shooting.png`, `/assets/arena/racing.png`, `/assets/npcs/{storeId}.png`) — pages fall back to emoji, which works but isn't the intended visual polish.
- `RoyaleItemCard.tsx` doesn't use the shared `ItemImage` component — falls back to programmatic SVG/external art instead of real item PNGs.
- NavBar still has both a legacy `store` link and the new `shop` link (old one should have been removed).

**Tier 9**
- Actual route naming/shape deviates from spec in places (e.g. `/api/districts/:id/travel` instead of `POST /user/travel` as body), functionally fine but inconsistent with the plan.
- Danger-roll mitigation from equipped defense/armor items is not implemented — only the mugging cooldown reduces risk.
- Corporate Zone's "can't access with contraband" / "criminal record raises prices" logic is entirely missing.
- District-specific item effects (e.g. Throwaway Phone's 30% jail-time reduction) aren't wired into the crime-resolution formula.
- Travel Hub page is a simple list, not the card/map layout with hero art the spec calls for; Hospital page is a full page rather than the described banner-triggered modal.

**Tier 10**
- Win-streak feed posts (arena/race milestones at 5/10/20/50) are **not implemented at all** in `arena.ts`/`race.ts` — the milestone-check logic simply doesn't exist yet.
- New-auction-listed feed posts aren't triggered — auction creation logs internally but never calls `postToSystemFeed`.
- District chat auto-join/leave on abroad status relies on client-side filtering only, not enforced server-side.
- Emoji shortcodes resolve to static Unicode emoji instead of the specified animated WebM/GIF/Lottie assets — the "alive" chat feel described in the spec isn't there.
- Inventory page has per-item quick sell/list but no bulk-select-and-sell-all as specced.
- Trading has a model and basic routes but no real profile-embedded trade UI or full notification flow.

---

## ❌ NOT DONE

**Tier 1**
- Login/`/me` response does not clamp existing over-limit `health` values to the new computed max — only new *regen gains* are capped, so a player already above cap from before the change stays there indefinitely.

**Tier 3**
- **Durability-based item destruction is not implemented**: when durability hits 0, the code zeroes it out but never removes the weapon/armor from the player's inventory or adds it to a "destroyed items" list — broken items just sit in inventory at 0 durability forever, contradicting the entire "items get destroyed" design goal of this tier.

**Tier 4**
- `POST /store/keys` (buy 3 keys for 50 NC) does not exist anywhere in the codebase.
- Legacy royale frontend page is still the one actually wired to `/royale` — the new hub/category pages built for this tier are effectively unreachable by players.

**Tier 5**
- **No dedicated hourly expiry cron job** for player market listings (48-hour expiry with return-to-seller) — there's only an ad hoc "silent expiry" check embedded in the listings GET route, not the described scheduled job.

**Tier 9**
- **District Hub page does not exist** — the spec's unified page (lore + shop + crimes + danger reminder, shown when abroad) is not built; functionality is fragmented across separate existing pages instead.

**Tier 10**
- **Weekly leaderboard recap cron/post is not implemented** — no job builds or posts the `[🌐 CITYWIDE — WEEKLY RECAP]` message every Monday, despite leaderboard data itself being tracked correctly.
- **Arena Taunts feature is entirely missing** — no `taunts` field on the match model, no `POST /arena/match/:id/taunt` endpoint, no UI for it.

---

## Summary
The build is substantially complete — most backend data models, seeds, and core game loops (arena combat, racing, royale, market, districts, social systems) exist and largely work. The most consequential gaps are:
1. **Item destruction on 0 durability never actually happens** (Tier 3) — a core economy mechanic is silently broken.
2. **The new Royale UI is built but not wired into routing** — players still see the old page (Tier 4).
3. **No weekly recap or arena/race win-streak feed posts** — the "living world" feel of Tier 10 is missing its most visible piece.
4. **No transactional atomicity on DC transfers** in market purchases and auction bids (Tier 5) — a real risk for currency duplication/loss bugs under concurrent load.
5. **Prestige has no frontend entry point** — a fully-built backend feature nobody can trigger from the UI (Tier 7).

I'd recommend tackling items 1, 2, and 5 first since they're quick, high-impact fixes (a few hours each), followed by the atomicity fixes in Tier 5 before this goes anywhere near real players with real currency.
