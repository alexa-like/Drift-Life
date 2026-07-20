# Neonoir — Audit Report vs. update_tiers.md

Consolidated findings from a 10-tier parallel codebase audit (one sub-agent per tier), comparing the actual implementation in `artifacts/api-server` and `artifacts/neonoir` against the spec in `update_tiers.md`. Read-only audit — no code was changed.

---

## ✅ Done

**Tier 1 — Core Cleanup & Infrastructure**
- PvP removed, CombatMatch repurposed for Arena; `defenseBonus` removed from MiniGameItem
- Weapon repurposing (`enhancement` slot) in market.ts
- Luxury Car fixed (-40% travel time, +12 charisma)
- Legendary Elixir timed buff (`all_stats_timed:10:4`) + `activeBuffs` cleanup in regen.ts
- User model: prestige, prestigeXpBoost, keyShards, activeBuffs, nc/dc/keys added; `maxHealth` is a virtual computed field
- Adrenaline/Nitro energy pools with independent 12-min regen ticks; "Stim Shot" renamed correctly
- Travel fields (currentLocation, travelingTo, travelArrivesAt) + arrival check logic

**Tier 2 — Arena Item Seed System**
- MiniGameItem model has all new category enums, weaponSlot, magazineSize, ammoCategory, armorHp, maxDurability
- Full weapon coverage: 6 categories × 5 tiers seeded
- All 30 ammo variants seeded correctly
- Body armor (5 tiers) seeded with correct armorHp/maxDurability
- Special effects (bleed, stun, armor_pierce, knockback, double_tap) defined
- loadout.ts validates ownership, durability, consumable quantity

**Tier 3 — Arena Combat**
- Match state tracking (ArmorHp, RoundsFired, ConsumablesUsed, ActiveEffects, StunNextTurn, KnockedBack) in CombatMatch
- Match rewards (`grantCombatRewards`) scale XP/DC/Key Shards correctly for winner/loser

**Tier 4 — Royale System**
- RoyaleItem model with royaleCategory, spinType, itemRef, dropWeight
- 22-pool seed logic across 11 categories with correct weights
- Spin endpoint validates cost (DC or NC+Key), atomic deduction, grants items across all types
- Key Shard grants (+1/match, +1/race) with 20→1 key auto-conversion
- Royale Hub (11-category grid) and Category Spin page (DC/Master tabs, cost display, animation) built

**Tier 5 — Market & Auction**
- NPC store config/model, FAQ system, restock logic (6hr expiry), 20% Rare-item roll all correct
- Auction model + bidding logic with atomic DC refund/deduct

**Tier 6 — Racing Condition**
- Condition field, performance penalty multiplier table, 0%-condition queue block, service endpoint (DC or token), garage UI with condition bars/status labels all implemented

**Tier 7 — HP Scaling**
- `computeMaxHp` implemented and used everywhere as a derived value (confirmed independently by Tiers 1, 7, 10 audits); `maxHealth` removed from stored schema

**Tier 8 — UI Polish**
- Arena Hub, NPC Store pages, and NavBar fully redesigned and wired to real data; ItemImage component is robust

**Tier 9 — Districts & Status**
- Status enum, hospitalizedUntil/jailedUntil/lastMuggedAt/currentLocation on User; auth middleware resolves status + danger rolls every request
- District crimes for all 6 non-home districts; hospital/jail state enforced across Gym/Jobs/Crimes/City
- StatusBanner with countdowns; NavBar visibility gating; DistrictPage renders district crimes/shops

**Tier 10 — Feed, Social, Economy**
- Notification model/route, weekly leaderboard fields + reset logic, login streak fields, CrimeLog model, durability split correctly between item template and player inventory

---

## ⚠️ Partially Done

**Tier 1**
- `attacksToday` legacy field still on User and returned by auth.ts; arena loadouts still reference old `defense`/`effectiveDefense` fields
- Could not confirm Kevlar Vest/Leather Coat/Combat Drug are fully purged from market.ts (grep inconclusive)
- Booster items (adrenaline_vial, combat_stim, nitro_can, fuel_pack) not found in NPC store — need to confirm seeded
- `/user/travel` endpoint not located as a distinct route (logic lives in regen.ts only)

**Tier 2**
- Consumable `maxStack` values are per-item (e.g. 10) instead of spec's universal 99; some effect naming (`clear_bleed`, `damage_stun`) diverges from the simplified spec vocabulary (`heal`, `damage`)
- No explicit migration/cleanup step removing old `category: "weapon"`/`"armor"` documents from the live DB (schema now excludes them, but stale docs may remain)

**Tier 3**
- Combat loop in `arena.ts` is **sequential turn-based** (`currentTurn % 2`), not the spec's simultaneous-resolution model — this is a structural deviation, not a small bug
- Damage formula uses `strength * 0.5` instead of spec's `floor(strength * 0.08)`
- `berserk` and `shield` special effects missing from `fireWeapon`
- `POST /queue/join` doesn't clamp consumable counts to actual inventory
- `postMatchCleanup` degrades weapon durability and ammo but **not armor**, and doesn't deduct consumables
- LoadoutPage lacks durability/ammo warnings and the 1-3 quantity picker for consumables

**Tier 4**
- Daily login reward doesn't appear to grant the spec's +3 keyShards
- Old royale system (`royaleType: general/shooting/racing`, old pricing, `RoyalePage.tsx`, `/items/:type` routes) still present alongside the new one — needs full removal
- Category Spin page lacks the grayed-out "MASTER ONLY"/"DC ONLY" visual treatment for out-of-pool items

**Tier 5**
- Player market batch listing uses legacy `Item.marketListed` flag instead of a dedicated `Listing` collection; missing 5% commission and `netPayout` fields
- Market frontend tabs filter by raw rarity/type instead of spec's grouped categories
- No bulk-select checkbox sidebar / payout summary in InventoryPage
- `closeExpiredAuctions` exists but has no recurring cron trigger wired into `index.ts`

**Tier 6**
- Condition degradation uses a hardcoded `hadCrash = false`, ignoring actual `p.crashCount` from race results — crash-based extra degradation never fires
- Degradation only updates car `condition`, not installed parts (spec requires unified degradation across all parts)
- Service endpoint resets car condition to 100 but does **not** restore installed parts to 100 as required
- No explicit UI disable of "Enter Race" button when condition is 0 (backend blocks it, but frontend doesn't gray it out)

**Tier 8**
- ItemImage integrated in Inventory/Loadout/Market/NpcStore pages but **not** in RoyaleCategoryPage (win list + result modal use text/emoji), ArenaCombatPage (weapon/consumable cards), MatchResultModal (gear display), or AuctionPage (listing cards)

**Tier 9**
- District-specific shop routes (`GET /district/:slug/shop`) not found — npcStores.ts only covers Downtown
- Travel level-lock returns HTTP 400 instead of spec's 403
- Frontend/backend route mismatches: StatusBanner calls `/api/user/hospital/pay-release` and `/api/user/jail/pay-bail`, but actual routes are `/api/hospital/release-early` and a differently-pathed bail handler in city.ts — **these are likely broken in production, not just cosmetic**
- Travel time formula uses `travelEnergyCost`, doesn't appear to factor in vehicle `travelTimeReduction` for arrival time

**Tier 10**
- System Feed model is `FeedEvent`, not spec's `SystemFeedPost`; missing `links` array and `pinned` field; TTL retention is 24h instead of spec's 500 posts/30 days
- Daily login rewards implemented inline in auth.ts instead of a dedicated lib; missing 30-day reset (uses modulo instead)
- Crime cooldowns exist but many crimes use ad-hoc durations rather than the spec's strict table
- InventoryPage missing bulk actions / quick-sell
- ProfilePage recent activity pulled from FeedEvent without correct public/private filtering; achievement badges not pinnable
- Faction system has bank deposits/withdrawals but no perks or territory/influence tracking

---

## ❌ Not Done

**Tier 1**
- Service Token not found anywhere in market.ts / shop seed

**Tier 2**
- (No hard "not done" items — old-category cleanup listed above is the only gap, categorized as partial since schema-level exclusion exists)

**Tier 3**
- Melee fallback exists but uses the wrong formula entirely (should be `random()*7 + 8 + strength*0.05`)
- Combat UI (silhouette animations, floating damage numbers, detailed "Gear Status" breakdown in result modal) not confirmed present in ArenaCombatPage/MatchResultModal

**Tier 5**
- No bot-generated auctions for Epic/Legendary items every 30-120 min — auctions are currently player-created only, meaning the auction house may sit empty
- No automated hourly cron for market listing expiry/return-to-player
- Batch-listed arena gear stores durability as text in a description string instead of a real numeric field
- No global "outbid" banner notification on the frontend

**Tier 6**
- Part restoration on service (parts stay degraded even after servicing the car)

**Tier 9**
- NPC store restock vs. Epic/Legendary exclusion rule unverified — restock generation logic incomplete in npcStores.ts
- Travel Hub "Map Card" 7-district layout not confirmed to match spec
- Apex Med Suite / Inhibitor Patch (instant hospital release / danger-roll prevention items) have no backing logic
- Revive-by-others / bail-by-others endpoints (`POST /player/:id/revive`, `POST /player/:id/bail`) missing entirely

**Tier 10**
- Custom Game Emojis: `GameEmoji` model, `/emojis` endpoint, and shortcode resolution entirely missing
- Black Market: listing model exists but seizure cron job and level-20 unlock gate missing
- Trading: `PlayerTrade` model exists but lacks counter-offer logic and atomic swap verification (spec wanted `TradeOffer` schema)
- Mentor System: entirely missing (no `mentorId`/`menteeIds` fields, no route)
- NPC random city encounters: field exists but no middleware/trigger pool implemented
- In-Arena Taunts: no `taunts` field on match model, no taunt endpoint
- Chat polish: no district auto-join, no message reporting, muting not integrated client-side
- Several new items from the Tier 10 item list (e.g. Signal Jammer, Neural Optimizer) missing from seed files

---

## Priority Notes
- **Highest-impact bugs to fix first:** the Tier 9 frontend/backend route mismatches for hospital release and jail bail (features are likely broken for users right now), and the Tier 3 combat loop being sequential instead of simultaneous (core gameplay diverges from design).
- **Biggest missing systems:** Tier 10's Mentor System, Custom Emojis, and Arena Taunts are unbuilt from scratch; Tier 5's auction house has no auto-population, so it may appear empty to players.
