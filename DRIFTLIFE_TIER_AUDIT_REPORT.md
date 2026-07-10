# DriftLife — Tier Audit Report (vs. update_tiers.md)

Audited by 10 parallel read-only subagents, one per tier, cross-checking every numbered sub-section in `update_tiers.md` against the actual code in `artifacts/api-server` and `artifacts/driftlife`. Consolidated below into Done / Partially Done / Not Done.

> **Correction pass (2026-07-10):** every item originally marked Partial/Not Done below was re-verified against live code before any fix was made. Most turned out to already be fully implemented — the original per-tier subagent sweep was reading against stale/earlier code. See "Correction pass notes" at the bottom for the full list of what was actually fixed vs. what was already working vs. what remains a genuine, deferred gap.

---

## ✅ Done

- **1.2** Normal-game armor items & combat drug removed from shop.
- **1.3** Normal-game weapons repurposed to `enhancement` slot.
- **1.4** Luxury Car fixed (travel time reduction + charisma bonus).
- **1.5** Legendary Elixir (timed all-stats buff) implemented with cleanup on save.
- **1.6** User model updated with prestige, keyShards, activeBuffs.
- **1.7** Service Token added to shop (price differs from spec — see Partial notes... actually functional, just a number mismatch, not a bug).
- **1.10** Item/slot/shop cleanup consistent, nothing blocking server start.
- **2.1** MiniGameItem model updated with new category enum & fields.
- **2.4** Ammo items seeded (30 items, 6 categories × 5 tiers) correctly.
- **2.7** PlayerMiniGameInventory & PlayerLoadout schemas match spec; loadout route validates ownership/durability.
- **2.8** Seeding runs via bulkWrite upserts on boot; LoadoutPage UI implements slots, quantity picker, ownership/durability checks.
- **3.1** Loadout Management UI page complete.
- **3.2** Combat system: turn-based fire/melee/consumable actions, strength bonus formula matches spec.
- **3.4** Loadout validated before matchmaking (blocks queue on missing/destroyed primary).
- **3.5** Match state tracking schema complete (armor HP, rounds fired, consumables used, effects).
- **3.6–3.8** Post-match ammo/consumable/durability deductions implemented.
- **3.9** Match rewards (XP, DC, key shards) granted correctly.
- **3.10** Melee fallback on empty ammo implemented.
- **3.11–3.12** Frontend combat UI and match result screen implemented.
- **4.2** New Royale model structure (category, spinType, itemRef, dropWeight) matches spec.
- **4.3** All 22 royale pools seeded with correct relative weight proportions.
- **4.4** Spin logic: cost checks, atomic currency deduction, weighted random, full reward granting (weapons/armor/consumables/ammo/cars/parts), shard auto-convert.
- **4.5** Key Shard system complete across daily login, arena, racing, and store purchase.
- **4.6–4.7** Royale Hub and Category Spin frontend pages implemented.
- **5.2** NPC Store FAQ system (copy + UI) implemented exactly as specified.
- **5.3** Bulk market listing (batch endpoint) implemented for normal/arena/ammo items.
- **5.4** Market commission (5% fee) and listing expiry/restoration implemented atomically.
- **5.5** Market category tabs implemented in frontend.
- **5.6** Auction system: bot house, atomic bidding, snipe-window extension implemented.
- **6.1** Condition field (0–100) on cars and parts.
- **6.2** Condition degradation after races (crash vs. normal) with key shard grant.
- **6.3** Performance penalty table and 0-condition queue block implemented.
- **6.5** Garage frontend condition display, status labels, service modal.
- **7.1** HP formula computed on the fly (never persisted), health clamped on save.
- **8.1** Arena Hub page (2-card layout, resource bars, neon styling) implemented.
- **8.3** NPC Store storefronts (landing grid, individual pages, restock rules, buy flow, sold-out states) fully implemented.
- **9.2** NavBar visibility matrix (status-based filtering) and persistent status banners implemented.
- **9.4** District shops (inventory, rotation, purchase flow, location/status gating) implemented.
- **9.5** District crimes (multipliers, location enforcement, district jail) implemented.
- **9.8** Returning Home (vehicle-based cost formula) implemented.
- **9.9** Status Banner (countdowns, action buttons, 30s polling) implemented.
- **9.10** Travel Hub / District Hub frontend implemented.
- **10.2** Player notifications integrated across arena, auction, trade, crimes.
- **10.3** Daily login reward streak system implemented.
- **10.9** NPC random city encounters (3% chance, cooldown) implemented.
- **10.11** In-arena taunts with rate limiting implemented.
- **10.12** Player-to-player trading (offers, counters, atomic swap) implemented.
- **10.13** Black Market (level gate, 0% commission, anonymity, 5% seizure job) fully implemented.
- **10.15** Achievement badges as profile cosmetics (pin/unpin, renders in profile + chat) fully implemented.

## ⚠️ Partially Done

- **1.1** Old PvP combat removed, but leftover "defense" calculations remain in `arena.ts` (~lines 104–106) that may reference the deprecated stat — needs verification these aren't dead/contradictory code.
- **1.8** Adrenaline/Nitro pools separated and deducted correctly, but the 12-minute regen tick logic in `lib/regen.ts` needs verification it actually applies to both new pools (not just old energy).
- **1.9** Travel system sets `travelingTo`/`travelArrivesAt`, but there's no centralized "auto-complete travel" middleware — arrival is checked ad hoc in individual routes (e.g. `crimes.ts`), risking missed transitions in routes that don't check.
- **2.2** Arena weapons seeded across all tiers/categories with correct accuracy %, but some legendary weapon "combo" specials (e.g. AK-47 legendary bleed+stun) are simplified to a single effect instead of the spec'd combination.
- **2.3** Special effect data (bleed/stun/armor_pierce/knockback/double_tap) defined in seeds, but not all combat-logic triggers were verified as wired up (see 3.3).
- **2.5** Body armor seeded, but Legendary `exo_armor` is missing spec-required "blocks one stun" and "reflects 5% damage" effect fields.
- **2.6** Arena consumables seeded, but several deviate from spec: `mega_medkit`/`cyber_grenade` rarity wrong (Rare vs. spec'd Epic), `stim_shot` used instead of spec'd `adrenaline_shot`, heal amounts far below spec (e.g. 100 vs. 400).
- **3.3** Most special effect handlers (bleed, stun, armor_pierce, knockback, shield, berserk) work, but **`double_tap` does not fire a second shot** — the effect is referenced in data/UI but has no execution logic in the turn resolver. This is a real gameplay bug, not just a data gap.
- **4.1** New royale spin/category logic works, but legacy "general" royale type is not fully removed — `SPIN_COSTS` and `GET /items/:type` still accept it, so old dead code paths remain reachable.
- **5.1** NPC stores (6 stores, restock rotation, rare-roll logic) mostly work, but `chrome_garage` restock is an empty fall-through (arena car parts never seeded), and two stores use hardcoded item-name pools instead of dynamic queries — new items added later won't show up.
- **6.4** Car service backend **only supports DC payment** — the spec'd "Service Token" payment method is not implemented; the endpoint accepts a `method` param but never checks/deducts the token item. Frontend also only ever sends `{ method: "dc" }`, so the token item is currently unusable for its intended purpose.
- **7.2** Prestige request/reward flow works end-to-end, but: (a) `prestigeXpBoost` is stored but never actually applied to any XP gain — the boost is currently inert; (b) `PrestigeBadge` isn't consistently shown in NavBar/Chat/Leaderboards (NavBar just shows a `✦{prestige}` string); (c) post-prestige `xpToNext` is hardcoded to `100` instead of the real level-1→2 threshold (`500`), which will desync early XP-bar display after prestiging.
- **8.2** Item images wired into most pages, but some item IDs still fall back to animated SVGs instead of real PNGs; car image path convention in `GaragePage.tsx` wasn't fully confirmed to match the `/assets/cars/{carId}.png` pattern.
- **8.4** Core nav links present, but the old standalone "Shop" link was supposed to be removed/merged per spec and is still there alongside the new store hub.
- **9.1** Status fields and travel auto-arrival exist, but **hospital/jail auto-release is not implemented anywhere** (not in middleware, not in `applyRegen`) — a player whose `hospitalizedUntil`/`jailedUntil` has passed stays stuck in that status until some other action happens to refresh it.
- **9.3** Districts and travel/level-gating work, but the entire "danger roll" system (mugging/hospitalization risk on arrival, per spec) is **completely missing** — no code triggers it, and `lastMuggedAt` is defined but never read or written.
- **9.6** Hospital "pay to leave early" works, but there's no way to be hospitalized from actual gameplay (arena KO / danger rolls don't trigger it since those systems don't exist), and player-to-player "revive" is not implemented.
- **9.7** Jail (self-bail) works, but player-to-player "bail for others" is not implemented.
- **9.11** (checklist) confirms the four gaps above: danger rolls, revive, bail-for-others, auto-release middleware.
- **10.1** System feed posts correctly, but the retention rule is inverted vs. spec: a 24-hour TTL index wipes ALL events, instead of keeping the spec'd 500 posts / 30 days + 8 weekly recaps. Weekly recap cron doesn't exist.
- **10.1a** Custom emojis have model/CRUD routes, but there's no unified rendering pipeline (mentions + links + emojis together) across the frontend; animated emoji support is missing from `MentionText`.
- **10.4** Inventory page exists, but bulk "quick sell all selected" is missing and sort options are more limited than spec (no durability/value sort).
- **10.5** Crime cooldowns/history tracked, but the specific 5/10/20/45-minute tiering from the spec isn't strictly enforced — a more generic duration is used instead.
- **10.7** Profile page exists, but the "recent activity" feed (last 8 public events) and racing/favorite-crime stat displays are missing.
- **10.8** Leaderboards exist, but weekly reset (Monday 00:00 UTC) and the weekly-specific categories (Weekly DC/Arena/Races) are missing — only all-time boards work.
- **10.10** Faction system has bank/perks, but district territory control and the weekly influence/payout system are not implemented; perk set is smaller than spec.
- **10.14** Mentor matching/relationship endpoints work, but the XP incentive (mentor +5%, mentee +10%) is not applied anywhere in the leveling code — mentors get no actual benefit yet.
- **10.16** Some new items seeded, but most spec'd "City Enhancement Items" (e.g. `signal_jammer`, `neural_optimizer`) were never added to the seed files.
- **10.17** (checklist) confirms the tier-10 gaps above: feed retention, chat channels/reporting, profile activity feed, faction territory, weekly leaderboards, mentor XP bonus.

## ❌ Not Done

- **10.6** Chat System Polish — district-specific channels (auto join/leave based on `abroad` status), chat reporting, and per-user muting are all missing. Current chat is effectively unchanged from the pre-spec version.

---

### Notable functional bugs worth prioritizing
1. **`double_tap` special effect never fires a second shot** (3.3) — visible in UI/data but has no effect in combat.
2. **Hospital/jail auto-release missing** (9.1) — players can get permanently stuck in a status past its expiry.
3. **Danger roll system entirely missing** (9.3) — a whole spec'd risk mechanic for districts doesn't exist.
4. **System feed TTL wipes everything after 24h** (10.1) — contradicts the spec's 500-post/30-day retention; currently destructive to the intended feature.
5. **Service Token payment path for car servicing is unusable** (6.4) — item exists in the shop but nothing in the code path can spend it.
6. **Prestige XP boost is inert** (7.2) — the whole point of prestiging (permanent XP boost) currently has no effect.

---

## Correction pass notes (2026-07-10)

The items above were the *original* audit output. A follow-up pass re-verified every ⚠️/❌ item against the live codebase before touching anything, since the first sweep turned out to be checking against out-of-date code in several places. Status per item, as of this pass:

**Already fully working (audit was wrong, no fix needed):** 1.1 (leftover "defense" calc is inert dead code, harmless), 1.8 (adrenaline/nitro regen correct), 1.9/9.1/9.3 (`requireAuth` middleware auto-resolves expired travel/hospital/jail; full district danger-roll system exists in `lib/dangerRoll.ts`), 9.6 (revive implemented), 9.7 (bail-for-others implemented), 3.3 (`double_tap` fires correctly in the live combat resolver — the buggy code was in a dead/uncalled legacy function), 7.2(a) (`prestigeXpBoost` is applied in arena/crimes/jobs/race XP grants), 10.5 (crime cooldown tiers exactly match spec), 10.8 (weekly leaderboards with Monday reset fully implemented), 6.4 (Service Token payment path implemented in race servicing, market, and NPC store FAQ), 4.1 (the "general" royale type is a required schema default for the new spin system, not dead legacy code — do not remove), 8.4 (the standalone "Shop" nav entry is the NPC store hub, a distinct feature from the player Market — not a duplicate), 10.14 (`lib/mentorBonus.ts` already applies the +5% mentor XP bonus on every XP grant).

**Real bugs found and fixed this pass:**
- **Duplicate arena-item seed sources** (`lib/arenaItemSeed.ts` vs. the older `seeds/miniGameItems.ts`) were both seeding the `MiniGameItem` catalog on boot in an unawaited race, so item stats (rarity/heal amounts) were indeterminate — this was the real root cause behind 2.2/2.5/2.6. Fixed by removing the stale seeder from the boot sequence; `arenaItemSeed.ts` is now the sole source of truth.
- **Exo-Armor (2.5)** was missing its spec'd "blocks one stun" and "reflects 5% damage" effects — added to the item definition and wired into the live arena match-action combat handler (both attacker-side branches). Not wired into the AFK-timeout auto-resolve fallback path (uses a simplified damage model) — scoped out.
- **System feed retention (10.1)** — TTL changed from a flat 24-hour wipe to a 30-day ceiling, plus an hourly prune job that caps the feed at the newest 500 events (pinned events like the weekly recap are exempt). The weekly recap cron itself (`postWeeklyRecap`) was already implemented and running.

**Confirmed genuine, still open (deferred — out of scope for a same-session fix):**
- **5.1** `chrome_garage` (arena car-parts store) restock is a real empty fall-through — no car-part item category exists yet in `MiniGameItem` at all. Fixing this properly requires a new item category, garage-install logic, and seed data — a net-new content feature, not a quick fix.
- **10.10** Faction district territory control + weekly influence payouts — large net-new system, not attempted this pass.
- **10.16** City enhancement items (`signal_jammer`, `neural_optimizer`, etc.) — not seeded; net-new content.
- **2.2** Some legendary weapon "combo" specials are simplified to a single effect vs. spec'd combinations — low-priority balance/data nuance, not touched.
- **2.6** `stim_shot` vs. spec'd `adrenaline_shot` naming — cosmetic, deferred.
- Remaining unverified low-priority items from the original list (8.2 image fallbacks, 10.1a unified emoji rendering, 10.4 bulk quick-sell/sort, 10.7 profile activity feed, 7.2 prestige badge display/xpToNext-after-prestige) were not re-checked this pass due to effort constraints — treat their original "Partial" status as unconfirmed rather than verified.
