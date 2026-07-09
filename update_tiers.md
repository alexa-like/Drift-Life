# DriftLife — Full Feature Update Plan
## Agent Build Guide: Step-by-Step Tier System

---

## HOW YOU SHOULD WORK — READ THIS FIRST

You are building a large feature set for DriftLife, a cyberpunk browser game. The work is broken into **8 tiers**. You must:

1. **Complete one tier fully before moving to the next.** Do not skip ahead or start the next tier until the current tier is working and verified.
2. **Read the relevant model and route files before editing them.** Never guess at field names — check the actual schema first.
3. **Never break existing working features.** If a tier requires removing something, ensure the removal is clean — no dangling references, no dead imports, no unused variables.
4. **Test every endpoint you create or modify.** Start the server and confirm it runs without errors after each tier.
5. **Seed data belongs in a seed file or an inline seed constant** — do not hardcode item data inside route handlers.
6. **Never use placeholder data or mock responses.** Every endpoint must return real data from the database or computed logic.
7. **Be explicit on failure.** Surface errors clearly — never silently catch and swallow them.
8. **After finishing each tier**, write a brief summary of what changed and restart the API server to confirm it starts cleanly.
9. **Follow the existing code style** — TypeScript, Mongoose, Express 5, same file structure as existing routes/models.
10. **Epic/Legendary item rule (ABSOLUTE):** These items must NEVER appear in any NPC/bot store. Rare items appear in NPC stores only occasionally (low probability). Epic and Legendary are only obtainable from: Auction system, Player-to-player market listings, and Master Royale spin.
11. **HP is always computed, never stored as a static field.** `maxHealth` must be removed from the User schema and derived at runtime using the `computeMaxHp(level, prestige)` function. Only `health` (current HP) is stored.
12. **Durability belongs to the player's copy of an item, not the item template.** The MiniGameItem template stores `maxDurability` as a reference. The player's inventory entry stores the current `durability` value that degrades per match.

---

## CODEBASE OVERVIEW

- **Backend**: `artifacts/api-server/src/` — Express 5, MongoDB/Mongoose, TypeScript
- **Frontend**: `artifacts/driftlife/src/` — React, Vite, TypeScript
- **Routes registered in**: `artifacts/api-server/src/routes/index.ts`
- **Models in**: `artifacts/api-server/src/models/`
- **Routes in**: `artifacts/api-server/src/routes/`
- **Frontend pages in**: `artifacts/driftlife/src/pages/`
- **Frontend components in**: `artifacts/driftlife/src/components/`
- Always pass `{ dbName: "driftlife" }` to mongoose.connect for DB isolation
- tsconfig needs `noImplicitReturns: false` to avoid TS7030 on Express handlers
- Use `/{*splat}` for Express 5 wildcard routes — bare `*` crashes on startup
- Roles: `player | admin | staff | owner`. `requireStaff` checks all three elevated roles.

---

## TIER 1 — CORE CLEANUP & INFRASTRUCTURE
**Goal: Remove all legacy junk, fix broken items, update core models. Everything downstream depends on this being clean.**

### 1.1 — Delete Old PvP Combat Completely

Permanently remove the old player-attacks-player system. This is not the arena — this is the direct city-based combat that was removed from the game design.

**Backend:**
- Find and delete any route file that handles the old direct PvP attack (check `routes/index.ts` for what's registered and trace it to the file)
- If `CombatMatch` is used only for old-style direct PvP, delete the model. If it is also used by the Arena system (shooting arena matches), keep it but strip any old-combat-specific fields from the schema
- Remove `defenseBonus` from the `MiniGameItem` model schema and any seed data that references it
- Remove `defense` as a combat stat from any arena combat calculation logic
- Remove any "attack" or "defend" action handlers from arena routes that were part of the old system

**Frontend:**
- Delete any page or component that renders the old "attack a player" or "defend" UI
- Remove any button, link, or NavBar entry pointing to old combat
- Remove any dead route in the React router pointing to old combat pages
- Do a search for "attack", "defend", "combat" across the frontend and remove only the old-system references — do not touch the arena system

### 1.2 — Remove Normal-Game Armor Items and Combat Drug

In `artifacts/api-server/src/routes/market.ts`, permanently delete these items from the `SHOP_ITEMS` array:
- Leather Coat
- Kevlar Vest
- Combat Rig
- Subdermal Plating
- Nanoweave Armor
- Combat Drug (consumable)

These items are gone from the shop. Players who currently own them in their inventory keep them (they can sell on the player market). Do not migrate existing player inventory — just remove from shop.

### 1.3 — Repurpose Normal-Game Weapon Items

In `SHOP_ITEMS` in market.ts, for all items with `type: "weapon"`:
- Change the `slot` field from `"weapon"` to `"enhancement"`
- These items now grant their `strengthBonus` passively when equipped in the enhancement slot
- They are no longer used for attacking — they are stat enhancement gear
- Keep all item names and flavor text unchanged

Update the Item model (`artifacts/api-server/src/models/Item.ts`) — add `"enhancement"` to the `slot` enum if it does not already exist.

### 1.4 — Fix Luxury Car

In `SHOP_ITEMS`, find the Luxury Car vehicle item and update it:
- Set travel energy reduction to `-20%` if not already
- Add `charismaBonus: 12` to the item stats
- Update description: something like "Ride in style. -20% travel energy cost and +12 Charisma — prestige on wheels."

### 1.5 — Fix Legendary Elixir

Find the Legendary Elixir consumable in `SHOP_ITEMS` and update its effect:
- Effect: `{ type: "timed_all_stats", value: 10, durationHours: 4 }`
- Energy +50 and Nerve +20 remain instant on use (these are not timed)
- The `all_stats: +10` effect is a 4-hour timed buff, not permanent

**Implement the timed buff system in the use handler:**
- Add to the User model: `activeBuffs: [{ buffType: String, value: Number, expiresAt: Date }]`
- When Legendary Elixir is used: push `{ buffType: "all_stats", value: 10, expiresAt: new Date(Date.now() + 4 * 3600 * 1000) }` to `activeBuffs`
- When reading any stat (strength, charisma, intelligence, streetCred): check `activeBuffs` for active (non-expired) `all_stats` entries and add their value to the returned stat
- On stat reads, also clean up expired buffs lazily: filter out entries where `expiresAt < now`

### 1.6 — Update User Model for All New Systems

Add these fields to the User model if they do not already exist. Do not overwrite existing fields — only add what's missing:

```typescript
prestige:          { type: Number, default: 0 }
prestigeXpBoost:   { type: Number, default: 0 }   // e.g. 10 means +10% XP
keyShards:         { type: Number, default: 0 }
activeBuffs:       [{ buffType: String, value: Number, expiresAt: Date }]
```

**CRITICAL — HP field changes:**
- Remove `maxHealth` from the User schema entirely. It will be computed at runtime using `computeMaxHp(level, prestige)` — see Tier 7 for the formula.
- Keep `health` (current HP) as a stored Number field.
- On every login response and any endpoint that returns user data: compute `maxHealth` dynamically and include it in the response payload. Do not store it.
- After removing `maxHealth` from the schema, on user login: clamp `health` to `computeMaxHp(user.level, user.prestige)` if it exceeds the new max.

Confirm these already exist (add with default 0 if missing): `keys`, `nc` (Nova Credits), `dc` (Drift Credits).

### 1.7 — Add Service Token to Normal Game Shop

Add a new consumable item to `SHOP_ITEMS`:
```
id: "service_token"
name: "Service Token"
type: "consumable"
rarity: "uncommon"
effect: { type: "car_service" }
basePrice: 5000
description: "A mechanic's chit. Restores your race car's condition to 100% instantly."
```

This item is used in Tier 6 for the car servicing system.

### 1.8 — Separate Energy Pools (Adrenaline + Nitro)

The game currently has one `energy` pool used for everything. This changes. Three separate pools now exist:

| Pool | Name | Used For | Regen Rate | Max |
|---|---|---|---|---|
| Energy | Energy ⚡ | Crimes, gym, jobs, city activities | 1 per 5 min | 10 |
| Fighting pool | Adrenaline 💉 | Entering shooting arena matches | 1 per 12 min | 5 |
| Racing pool | Nitro 🔥 | Entering races | 1 per 12 min | 5 |

**User model — add these fields (only if missing):**
```typescript
adrenaline:    { type: Number, default: 5 }
maxAdrenaline: { type: Number, default: 5 }
nitro:         { type: Number, default: 5 }
maxNitro:      { type: Number, default: 5 }
```

Energy/maxEnergy already exist — do not touch them.

**Regen system (`lib/regen.ts`):**
The existing regen handler already ticks `energy`. Extend it to also tick `adrenaline` and `nitro` independently:
```typescript
// In the regen tick function — run on schedule or on login
if (user.adrenaline < user.maxAdrenaline) {
  const minutesSinceLastTick = /* existing time calc */;
  const adrenalineGain = Math.floor(minutesSinceLastTick / 12);
  user.adrenaline = Math.min(user.maxAdrenaline, user.adrenaline + adrenalineGain);
}
if (user.nitro < user.maxNitro) {
  const nitroGain = Math.floor(minutesSinceLastTick / 12);
  user.nitro = Math.min(user.maxNitro, user.nitro + nitroGain);
}
```

**Arena queue cost change:**
In `POST /arena/queue/join` (Tier 3): costs **1 Adrenaline**, NOT regular Energy.
Check: `if (user.adrenaline < 1) return 400 "Not enough Adrenaline"`. Deduct atomically on join.

**Race queue cost change:**
Wherever race entry is handled: costs **1 Nitro**, NOT regular Energy.
Check: `if (user.nitro < 1) return 400 "Not enough Nitro"`. Deduct atomically on join.

**Rename conflict:** The arena in-match consumable previously called "Adrenaline Shot" (boosts accuracy during a fight) must be renamed to **"Stim Shot"** in the seed data and throughout the codebase. "Adrenaline" is now reserved for the queue resource. Update the itemId from `adrenaline_shot` to `stim_shot` and the name accordingly.

**New booster items — add to NPC store seed (Tier 5):**

| Item | itemId | Effect | Sold At | Price |
|---|---|---|---|---|
| Adrenaline Vial | `adrenaline_vial` | +2 Adrenaline (instant) | Combat Zone Supply | 800 DC |
| Combat Stim | `combat_stim` | +5 Adrenaline (instant, full refill) | Combat Zone Supply | 1,800 DC |
| Nitro Can | `nitro_can` | +2 Nitro (instant) | Chrome Garage | 800 DC |
| Fuel Pack | `fuel_pack` | +5 Nitro (instant, full refill) | Chrome Garage | 1,800 DC |

These are normal game consumable items (not arena consumables). They go in the player's regular inventory and are used from there, not from the arena loadout.

**Frontend — HUD/header display:**
Show all three bars wherever the player's resources are displayed:
```
⚡ Energy:     7/10  ████████░░
💉 Adrenaline: 3/5   ██████░░░░
🔥 Nitro:      5/5   ██████████
```
Also show each bar contextually: Adrenaline bar prominently on the Arena hub page, Nitro bar on the Racing hub page.

### 1.9 — Travel Time System (Replace Energy Cost with Time)

**Remove energy cost from travel entirely.** Players no longer spend Energy to travel between city districts/locations. Instead, travel takes real time, and the vehicle the player has equipped in their city vehicle slot determines how fast they arrive.

**Why this change:** Energy is now reserved for crimes, gym, and jobs. Travel was an energy sink that punished players for moving around. With cars visually determining travel speed, the vehicle system has real purpose beyond a passive stat bonus.

**How travel works now:**

1. Player clicks "Travel to [District/Location]"
2. If they are already traveling somewhere: show current destination + arrival time, block new travel until arrived
3. A `travelArrivesAt` timestamp is set on the User document
4. Player cannot perform location-specific actions (crimes in that district, certain jobs, etc.) until `travelArrivesAt` has passed
5. The frontend shows a countdown: "Arriving in 4m 32s..."
6. On arrival: automatic — no action needed. The player is now in the new location.

**Add to User model:**
```typescript
currentLocation:   { type: String, default: "downtown" }   // current district slug
travelingTo:       { type: String, default: null }          // destination slug, null if not traveling
travelArrivesAt:   { type: Date, default: null }            // null if not traveling
```

**Base travel time (no vehicle equipped):** 10 minutes between any two locations.

**Vehicle equipped reduces travel time.** The vehicle stat was previously "% travel energy reduction" — repurpose it as **"% travel time reduction"**. The mechanic is the same concept (better car = less cost), just the resource changes from energy to time.

**Travel time by vehicle rarity (city vehicles only — not race cars, which are arena-only):**

| Vehicle | Slot | Travel Time Reduction | 10 min → |
|---|---|---|---|
| No vehicle | — | 0% | 10 min |
| Common vehicle | enhancement/vehicle | −20% | 8 min |
| Uncommon vehicle | enhancement/vehicle | −35% | 6.5 min |
| Sports Car (Rare) | enhancement/vehicle | −60% | 4 min |
| Luxury Car (Rare) | enhancement/vehicle | −40% | 6 min |
| Epic vehicle | enhancement/vehicle | −70% | 3 min |
| Legendary vehicle | enhancement/vehicle | −80% | 2 min |

Note: Sports Car has faster travel than Luxury Car. Luxury Car gives +12 Charisma (prestige value) but is slower — this is the trade-off. Racing cars (Garage cars) are NOT used for city travel — they are arena-only items.

**Update Luxury Car and Sports Car item descriptions** to say "% travel time reduction" instead of "% travel energy cost reduction."

**Backend — travel endpoint:**
```typescript
// POST /user/travel
// Body: { destination: "westside" }

// Validate: not already traveling
if (user.travelingTo !== null && user.travelArrivesAt > new Date()) {
  return 400, "Already traveling — arrive at destination first"
}

// Get equipped vehicle
const equippedVehicle = getEquippedVehicle(user); // from inventory
const reductionPct = equippedVehicle?.travelTimeReduction ?? 0;  // 0–80

// Calculate travel time
const baseTravelMs = 10 * 60 * 1000;  // 10 minutes in ms
const travelMs = Math.floor(baseTravelMs * (1 - reductionPct / 100));

// Set travel state
user.travelingTo = destination;
user.travelArrivesAt = new Date(Date.now() + travelMs);
await user.save();

return { travelingTo: destination, arrivesAt: user.travelArrivesAt, travelTimeMs: travelMs }
```

**Backend — arrival check:**
On any action that requires a specific location, check:
```typescript
// Auto-complete travel if arrived
if (user.travelingTo && user.travelArrivesAt <= new Date()) {
  user.currentLocation = user.travelingTo;
  user.travelingTo = null;
  user.travelArrivesAt = null;
  await user.save();
}
// Then check location requirement
```

**Frontend travel display:**
- City map or location list shows player's current location
- Locations they are not at: show "TRAVEL (4m 0s)" button with estimated time
- If player is currently traveling: show a travel progress bar with countdown and destination
- On arrival: auto-update the UI and show "Arrived at [Location]!" notification
- Items that can reduce travel time (Nitro Can etc.) are NOT relevant here — Nitro is racing only. Travel time is purely determined by equipped vehicle. No consumable shortcut.

### 1.10 — Verify Server Starts Clean

- Run `pnpm --filter @workspace/api-server run dev` — confirm no errors
- Hit `/market/shop` — confirm deleted armor items and Combat Drug are gone
- Confirm weapon items show `slot: "enhancement"`
- Confirm User model no longer has a static `maxHealth` field

---

## TIER 2 — ARENA ITEM SEED SYSTEM
**Goal: Build out ALL arena items — weapons (all 6 categories, all 5 tiers), ammo, body armor, and consumables**

### 2.1 — Update MiniGameItem Model

Read the current `MiniGameItem` model before editing. Replace the `category` enum with:

```typescript
category: {
  type: String,
  enum: [
    // Weapon subcategories (replace old "weapon")
    "pistol", "smg", "assault_rifle", "shotgun", "sniper_rifle", "lmg",
    // Armor
    "body_armor",        // replaces old "armor"
    // Consumables (unchanged)
    "consumable",
    // Ammo subcategories (replace old "ammo")
    "pistol_rounds", "smg_rounds", "rifle_rounds",
    "shotgun_shells", "sniper_rounds", "lmg_rounds"
  ],
  required: true
}
```

Add new fields to the MiniGameItem schema (only add; do not remove existing fields that are still needed):

```typescript
// Weapon fields
weaponSlot:    { type: String, enum: ["primary", "secondary"], default: null }
magazineSize:  { type: Number, default: null }   // rounds per magazine
ammoCategory:  { type: String, default: null }   // e.g. "pistol_rounds"
accuracy:      { type: Number, default: 75 }     // 0–100, hit chance percentage

// Armor fields
armorHp:       { type: Number, default: null }   // in-match HP pool for body armor

// Shared durability fields (on item TEMPLATE — defines max only)
maxDurability: { type: Number, default: null }   // null for consumables/ammo

// Stackable items (ammo, consumables)
stackable:     { type: Boolean, default: false }
maxStack:      { type: Number, default: 99 }
```

**Durability distinction — READ CAREFULLY:**
- `MiniGameItem` (the template) stores only `maxDurability` — the starting maximum
- `PlayerMiniGameInventory` stores the player's current `durability` value per item copy
- When a player obtains a new item, set their copy's `durability = item.maxDurability`
- When durability reaches 0, the item is destroyed and removed from the player's inventory

### 2.2 — Seed All Arena Weapons

Create all weapon items in a seed file or seed constant. Each weapon entry has: `itemId` (slug), `name`, `category`, `tier`, `weaponSlot`, `ammoCategory`, `damageMin`, `damageMax`, `magazineSize`, `accuracy`, `maxDurability`, `specialEffect` (null for Common/Uncommon), `specialChance` (0 for Common/Uncommon).

**Accuracy by weapon category:**
| Category | Accuracy |
|---|---|
| Pistol | 82% |
| SMG | 72% |
| Assault Rifle | 78% |
| Shotgun | 68% |
| Sniper Rifle | 90% |
| LMG | 62% |

Accuracy is the same regardless of tier. Only damage and magazine size scale with tier.

**Pistols — `weaponSlot: "secondary"`, `ammoCategory: "pistol_rounds"`**

| itemId | Name | Tier | Dmg Min | Dmg Max | Mag | Special |
|---|---|---|---|---|---|---|
| glock17_common | Glock 17 | Common | 12 | 18 | 15 | None |
| glock17_uncommon | Glock 17 Mk.II | Uncommon | 16 | 24 | 17 | None |
| glock17_rare | Glock 17 Custom | Rare | 22 | 32 | 19 | None |
| glock17_epic | Glock 17 Cyber | Epic | 30 | 44 | 21 | 18% double_tap |
| glock17_legendary | Glock 17 Phantom | Legendary | 42 | 60 | 23 | 25% double_tap |
| deagle_common | Desert Eagle | Common | 20 | 28 | 7 | None |
| deagle_uncommon | Desert Eagle Mk.II | Uncommon | 26 | 36 | 8 | None |
| deagle_rare | Desert Eagle Custom | Rare | 34 | 48 | 9 | 12% stun |
| deagle_epic | Desert Eagle Cyber | Epic | 46 | 64 | 10 | 20% stun |
| deagle_legendary | Desert Eagle Phantom | Legendary | 62 | 86 | 11 | 28% stun + 10% bleed |
| beretta_common | Beretta M9 | Common | 11 | 17 | 15 | None |
| beretta_uncommon | Beretta M9 Mk.II | Uncommon | 15 | 22 | 17 | None |
| beretta_rare | Beretta M9 Custom | Rare | 20 | 30 | 19 | None |
| beretta_epic | Beretta M9 Cyber | Epic | 28 | 40 | 21 | 15% bleed |
| beretta_legendary | Beretta M9 Phantom | Legendary | 38 | 56 | 23 | 22% bleed (3 turns) |
| usps_common | USP-S | Common | 13 | 19 | 12 | None |
| usps_uncommon | USP-S Mk.II | Uncommon | 17 | 25 | 13 | None |
| usps_rare | USP-S Custom | Rare | 23 | 34 | 15 | None |
| usps_epic | USP-S Cyber | Epic | 32 | 46 | 17 | 20% armor_pierce |
| usps_legendary | USP-S Phantom | Legendary | 44 | 62 | 19 | 30% armor_pierce |

Pistol maxDurability by tier: Common 80, Uncommon 120, Rare 160, Epic 220, Legendary 300

---

**SMGs — `weaponSlot: "secondary"`, `ammoCategory: "smg_rounds"`**

| itemId | Name | Tier | Dmg Min | Dmg Max | Mag | Special |
|---|---|---|---|---|---|---|
| mp5_common | MP5 | Common | 10 | 15 | 30 | None |
| mp5_uncommon | MP5 Mk.II | Uncommon | 13 | 19 | 32 | None |
| mp5_rare | MP5 Custom | Rare | 18 | 26 | 35 | None |
| mp5_epic | MP5 Cyber | Epic | 25 | 36 | 38 | 22% double_tap |
| mp5_legendary | MP5 Phantom | Legendary | 34 | 50 | 40 | 30% double_tap |
| uzi_common | Uzi | Common | 9 | 14 | 32 | None |
| uzi_uncommon | Uzi Mk.II | Uncommon | 12 | 18 | 35 | None |
| uzi_rare | Uzi Custom | Rare | 16 | 24 | 38 | None |
| uzi_epic | Uzi Cyber | Epic | 23 | 34 | 40 | 18% bleed |
| uzi_legendary | Uzi Phantom | Legendary | 32 | 46 | 42 | 25% bleed + 15% stun |
| mac10_common | MAC-10 | Common | 11 | 16 | 30 | None |
| mac10_uncommon | MAC-10 Mk.II | Uncommon | 14 | 21 | 32 | None |
| mac10_rare | MAC-10 Custom | Rare | 19 | 28 | 35 | None |
| mac10_epic | MAC-10 Cyber | Epic | 26 | 38 | 38 | 20% knockback |
| mac10_legendary | MAC-10 Phantom | Legendary | 36 | 52 | 40 | 28% knockback + 12% stun |
| p90_common | P90 | Common | 10 | 15 | 50 | None |
| p90_uncommon | P90 Mk.II | Uncommon | 13 | 20 | 50 | None |
| p90_rare | P90 Custom | Rare | 18 | 27 | 50 | None |
| p90_epic | P90 Cyber | Epic | 25 | 37 | 50 | 16% bleed |
| p90_legendary | P90 Phantom | Legendary | 35 | 51 | 50 | 24% bleed + 18% double_tap |

SMG maxDurability by tier: Common 80, Uncommon 120, Rare 160, Epic 220, Legendary 300

---

**Assault Rifles — `weaponSlot: "primary"`, `ammoCategory: "rifle_rounds"`**

| itemId | Name | Tier | Dmg Min | Dmg Max | Mag | Special |
|---|---|---|---|---|---|---|
| ak47_common | AK-47 | Common | 18 | 25 | 20 | None |
| ak47_uncommon | AK-47 Mk.II | Uncommon | 24 | 34 | 25 | None |
| ak47_rare | AK-47 Custom | Rare | 32 | 46 | 30 | 15% bleed |
| ak47_epic | AK-47 Cyber | Epic | 44 | 62 | 35 | 22% bleed (2 turns DoT) |
| ak47_legendary | AK-47 Phantom | Legendary | 58 | 82 | 40 | 30% bleed + 12% stun |
| m4a1_common | M4A1 | Common | 16 | 23 | 30 | None |
| m4a1_uncommon | M4A1 Mk.II | Uncommon | 22 | 32 | 30 | None |
| m4a1_rare | M4A1 Custom | Rare | 30 | 44 | 30 | None |
| m4a1_epic | M4A1 Cyber | Epic | 42 | 60 | 30 | 20% armor_pierce |
| m4a1_legendary | M4A1 Phantom | Legendary | 56 | 80 | 30 | 28% armor_pierce + 15% double_tap |
| scarh_common | SCAR-H | Common | 20 | 28 | 20 | None |
| scarh_uncommon | SCAR-H Mk.II | Uncommon | 26 | 38 | 20 | None |
| scarh_rare | SCAR-H Custom | Rare | 36 | 52 | 20 | None |
| scarh_epic | SCAR-H Cyber | Epic | 48 | 68 | 20 | 25% knockback |
| scarh_legendary | SCAR-H Phantom | Legendary | 64 | 90 | 20 | 32% knockback + 18% bleed |
| hk416_common | HK416 | Common | 17 | 24 | 30 | None |
| hk416_uncommon | HK416 Mk.II | Uncommon | 23 | 33 | 30 | None |
| hk416_rare | HK416 Custom | Rare | 31 | 45 | 30 | None |
| hk416_epic | HK416 Cyber | Epic | 43 | 61 | 30 | 20% stun |
| hk416_legendary | HK416 Phantom | Legendary | 57 | 81 | 30 | 28% stun + 20% bleed |

AR maxDurability by tier: Common 90, Uncommon 130, Rare 175, Epic 240, Legendary 320

---

**Shotguns — `weaponSlot: "primary"`, `ammoCategory: "shotgun_shells"`**

| itemId | Name | Tier | Dmg Min | Dmg Max | Mag | Special |
|---|---|---|---|---|---|---|
| mossberg_common | Mossberg 500 | Common | 30 | 45 | 6 | None |
| mossberg_uncommon | Mossberg 500 Mk.II | Uncommon | 40 | 58 | 7 | None |
| mossberg_rare | Mossberg 500 Custom | Rare | 54 | 76 | 7 | None |
| mossberg_epic | Mossberg 500 Cyber | Epic | 72 | 100 | 8 | 30% knockback |
| mossberg_legendary | Mossberg 500 Phantom | Legendary | 95 | 135 | 8 | 38% knockback + 15% stun |
| spas12_common | SPAS-12 | Common | 28 | 42 | 8 | None |
| spas12_uncommon | SPAS-12 Mk.II | Uncommon | 38 | 55 | 8 | None |
| spas12_rare | SPAS-12 Custom | Rare | 51 | 72 | 8 | 20% knockback |
| spas12_epic | SPAS-12 Cyber | Epic | 68 | 96 | 8 | 28% knockback |
| spas12_legendary | SPAS-12 Phantom | Legendary | 90 | 128 | 8 | 35% knockback + 20% bleed |
| aa12_common | AA-12 | Common | 22 | 34 | 20 | None |
| aa12_uncommon | AA-12 Mk.II | Uncommon | 30 | 44 | 20 | None |
| aa12_rare | AA-12 Custom | Rare | 40 | 58 | 20 | 20% knockback |
| aa12_epic | AA-12 Cyber | Epic | 54 | 76 | 20 | 28% knockback + 12% bleed |
| aa12_legendary | AA-12 Phantom | Legendary | 72 | 102 | 20 | 35% knockback + 22% bleed |
| benelli_common | Benelli M4 | Common | 25 | 38 | 7 | None |
| benelli_uncommon | Benelli M4 Mk.II | Uncommon | 34 | 50 | 7 | None |
| benelli_rare | Benelli M4 Custom | Rare | 46 | 66 | 8 | None |
| benelli_epic | Benelli M4 Cyber | Epic | 62 | 88 | 8 | 25% stun |
| benelli_legendary | Benelli M4 Phantom | Legendary | 82 | 118 | 8 | 32% stun + 18% knockback |

Shotgun maxDurability by tier: Common 85, Uncommon 125, Rare 165, Epic 230, Legendary 310

---

**Sniper Rifles — `weaponSlot: "primary"`, `ammoCategory: "sniper_rounds"`**

| itemId | Name | Tier | Dmg Min | Dmg Max | Mag | Special |
|---|---|---|---|---|---|---|
| barrett_common | Barrett M82 | Common | 55 | 75 | 5 | None |
| barrett_uncommon | Barrett M82 Mk.II | Uncommon | 72 | 98 | 5 | None |
| barrett_rare | Barrett M82 Custom | Rare | 96 | 130 | 5 | None |
| barrett_epic | Barrett M82 Cyber | Epic | 126 | 170 | 5 | 25% armor_pierce |
| barrett_legendary | Barrett M82 Phantom | Legendary | 165 | 225 | 5 | 35% armor_pierce + 15% stun |
| awp_common | AWP | Common | 60 | 80 | 5 | None |
| awp_uncommon | AWP Mk.II | Uncommon | 78 | 105 | 5 | None |
| awp_rare | AWP Custom | Rare | 105 | 142 | 5 | 10% armor_pierce |
| awp_epic | AWP Cyber | Epic | 138 | 188 | 5 | 22% armor_pierce |
| awp_legendary | AWP Phantom | Legendary | 180 | 246 | 5 | 30% armor_pierce + 20% stun |
| dragunov_common | Dragunov | Common | 48 | 68 | 10 | None |
| dragunov_uncommon | Dragunov Mk.II | Uncommon | 63 | 90 | 10 | None |
| dragunov_rare | Dragunov Custom | Rare | 85 | 120 | 10 | None |
| dragunov_epic | Dragunov Cyber | Epic | 112 | 158 | 10 | 20% bleed (3 turns) |
| dragunov_legendary | Dragunov Phantom | Legendary | 148 | 210 | 10 | 28% bleed + 15% armor_pierce |
| intervention_common | Intervention | Common | 65 | 88 | 5 | None |
| intervention_uncommon | Intervention Mk.II | Uncommon | 85 | 115 | 5 | None |
| intervention_rare | Intervention Custom | Rare | 115 | 156 | 5 | None |
| intervention_epic | Intervention Cyber | Epic | 152 | 206 | 5 | 22% stun |
| intervention_legendary | Intervention Phantom | Legendary | 200 | 272 | 5 | 30% stun + 20% armor_pierce |

Sniper maxDurability by tier: Common 70, Uncommon 110, Rare 150, Epic 210, Legendary 290

---

**LMGs — `weaponSlot: "primary"`, `ammoCategory: "lmg_rounds"`**

| itemId | Name | Tier | Dmg Min | Dmg Max | Mag | Special |
|---|---|---|---|---|---|---|
| m249_common | M249 SAW | Common | 14 | 20 | 100 | None |
| m249_uncommon | M249 SAW Mk.II | Uncommon | 18 | 26 | 100 | None |
| m249_rare | M249 SAW Custom | Rare | 25 | 36 | 100 | None |
| m249_epic | M249 SAW Cyber | Epic | 34 | 48 | 100 | 18% bleed |
| m249_legendary | M249 SAW Phantom | Legendary | 45 | 65 | 100 | 25% bleed + 15% knockback |
| rpk_common | RPK | Common | 16 | 22 | 75 | None |
| rpk_uncommon | RPK Mk.II | Uncommon | 21 | 30 | 75 | None |
| rpk_rare | RPK Custom | Rare | 28 | 40 | 75 | None |
| rpk_epic | RPK Cyber | Epic | 38 | 54 | 75 | 20% knockback |
| rpk_legendary | RPK Phantom | Legendary | 50 | 72 | 75 | 28% knockback + 18% bleed |
| minigun_common | Minigun | Common | 10 | 16 | 200 | None |
| minigun_uncommon | Minigun Mk.II | Uncommon | 13 | 20 | 200 | None |
| minigun_rare | Minigun Custom | Rare | 18 | 28 | 200 | None |
| minigun_epic | Minigun Cyber | Epic | 24 | 38 | 200 | 22% stun |
| minigun_legendary | Minigun Phantom | Legendary | 32 | 50 | 200 | 30% stun + 15% bleed |
| mg4_common | MG4 | Common | 15 | 21 | 100 | None |
| mg4_uncommon | MG4 Mk.II | Uncommon | 20 | 29 | 100 | None |
| mg4_rare | MG4 Custom | Rare | 27 | 39 | 100 | None |
| mg4_epic | MG4 Cyber | Epic | 37 | 52 | 100 | 18% bleed |
| mg4_legendary | MG4 Phantom | Legendary | 49 | 70 | 100 | 26% bleed + 20% double_tap |

LMG maxDurability by tier: Common 100, Uncommon 150, Rare 200, Epic 270, Legendary 360

---

### 2.3 — Special Effects Reference Table

All special effects used in weapons and body armor:

| Effect | Trigger | Behavior |
|---|---|---|
| `bleed` | On hit, % chance | Target takes DoT damage for N turns. Bleed value = 8% of hit's damage, applied at the start of the target's next N turns. Cannot stack (refreshes duration if triggered again). |
| `stun` | On hit, % chance | Target's next turn action is forced to `melee` — they cannot fire a weapon or use a consumable that turn. Only one stun can be active at a time. |
| `armor_pierce` | On every hit from this weapon | This weapon's damage bypasses body armor HP entirely — goes straight to player HP. Body armor is still worn but not absorbing this weapon's shots. |
| `knockback` | On hit, % chance | Target loses their current turn's queued action (if simultaneous) or is forced to spend their next turn recovering (no attack). |
| `double_tap` | On hit, % chance | Weapon fires a second shot in the same turn. Second shot uses the same damage formula but cannot trigger double_tap again (no chain). |

### 2.4 — Seed Ammo Items

Ammo items represent physical magazines. When a player obtains an ammo item (from royale, market, or NPC store), the item is consumed and its `magazineSize` worth of rounds is added to the player's ammo pool for that category.

**Ammo is NOT held as individual inventory items.** It is stored as a total round count in `PlayerMiniGameInventory.ammo`. The ammo "item" in the shop/royale is just the mechanism for adding rounds to the pool.

Seed 6 ammo types × 5 tiers = 30 ammo items. Each has `magazineSize` (rounds it adds to pool) and a small `damageMultiplier` bonus for higher tiers:

| Category | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Pistol Rounds | 15 rds, 1.0× | 17 rds, 1.05× | 19 rds, 1.10× | 21 rds, 1.15× | 23 rds, 1.20× |
| SMG Rounds | 30 rds, 1.0× | 33 rds, 1.05× | 37 rds, 1.10× | 41 rds, 1.15× | 45 rds, 1.20× |
| Rifle Rounds | 25 rds, 1.0× | 28 rds, 1.05× | 32 rds, 1.10× | 36 rds, 1.15× | 40 rds, 1.20× |
| Shotgun Shells | 7 rds, 1.0× | 8 rds, 1.05× | 9 rds, 1.08× | 10 rds, 1.12× | 11 rds, 1.18× |
| Sniper Rounds | 5 rds, 1.0× | 5 rds, 1.05× | 6 rds, 1.10× | 7 rds, 1.15× | 8 rds, 1.22× |
| LMG Rounds | 100 rds, 1.0× | 100 rds, 1.04× | 120 rds, 1.08× | 150 rds, 1.12× | 200 rds, 1.18× |

The `damageMultiplier` from ammo is applied on top of the weapon's base damage roll during combat.

**Ammo item slugs follow the pattern:** `pistol_rounds_common`, `pistol_rounds_uncommon`, etc.

All ammo items: `stackable: true`, `maxStack: 99`, `maxDurability: null` (ammo has no durability)

### 2.5 — Seed Body Armor Items

Five body armor items (`category: "body_armor"`), one per tier. Each has `armorHp` (in-match HP pool) and `maxDurability` (cross-match durability). `stackable: false`.

| itemId | Name | Tier | armorHp | maxDurability | Special |
|---|---|---|---|---|---|
| street_vest | Street Vest | Common | 50 | 100 | None |
| tactical_vest | Tactical Vest | Uncommon | 85 | 150 | None |
| combat_plate | Combat Plate | Rare | 130 | 200 | 10% absorb chance (reduces incoming hit by 15%) |
| ballistic_rig | Ballistic Rig | Epic | 195 | 280 | 20% absorb chance + blocks one stun per match |
| exo_armor | Exo-Armor | Legendary | 275 | 400 | 30% absorb chance + blocks one stun + reflects 5% of incoming damage back to attacker |

Absorb chance triggers per hit. When triggered: `actualDamage = damage * 0.85`, applied to armor HP. The 15% reduction is lost (not redirected to player HP).

### 2.6 — Seed Arena Consumable Items

Arena consumables have `category: "consumable"`, `stackable: true`, `maxStack: 99`, `maxDurability: null`.

These are the items that fill the 3-consumable loadout slot. Each is permanently used when activated during a match.

| itemId | Name | Tier | Effect | Effect Value |
|---|---|---|---|---|
| small_medkit | Small Medkit | Common | `heal` | Restores 80 HP (cannot exceed max HP) |
| large_medkit | Large Medkit | Rare | `heal` | Restores 200 HP (cannot exceed max HP) |
| mega_medkit | Mega Medkit | Epic | `heal` | Restores 400 HP + removes bleed |
| smoke_grenade | Smoke Grenade | Common | `blind` | Enemy has 50% miss chance for 2 turns |
| frag_grenade | Frag Grenade | Uncommon | `damage` | Deals 50–80 direct damage (bypasses armor) |
| cyber_grenade | Cyber Grenade | Epic | `damage` | Deals 120–180 direct damage (bypasses armor) + applies stun |
| adrenaline_shot | Adrenaline Shot | Uncommon | `accuracy_boost` | +20% accuracy for 3 turns |
| stimpack | Stimpack | Rare | `damage_boost` | +15% damage for 3 turns |
| nano_shield | Nano Shield | Epic | `shield` | Grants 100 temporary armor HP for 2 turns (separate from equipped armor) |
| berserker_dose | Berserker Dose | Legendary | `berserk` | +30% damage, +30% accuracy, -20% incoming damage reduction, for 4 turns |

**Consumable equip rule (ENFORCED BOTH BACKEND AND FRONTEND):**
- Player equips exactly ONE consumable type in their loadout slot
- They choose a quantity: 1, 2, or 3 (cannot exceed what they own, max 3)
- All 3 uses must be of the same item type — mixed consumable types are not allowed
- The loadout UI shows only one consumable selector + a quantity picker (1–3)
- Backend validates: `consumableItemId` must exist in the player's consumable inventory with `quantity >= consumableCount`

### 2.7 — Update PlayerMiniGameInventory & PlayerLoadout

**PlayerMiniGameInventory** — update schema to reflect all new item categories:

```typescript
primaryWeapons:   [{ itemId: String, durability: Number }]
secondaryWeapons: [{ itemId: String, durability: Number }]
bodyArmors:       [{ itemId: String, durability: Number }]
consumables:      [{ itemId: String, quantity: Number }]
ammo: {
  pistol_rounds:    { type: Number, default: 0 },
  smg_rounds:       { type: Number, default: 0 },
  rifle_rounds:     { type: Number, default: 0 },
  shotgun_shells:   { type: Number, default: 0 },
  sniper_rounds:    { type: Number, default: 0 },
  lmg_rounds:       { type: Number, default: 0 }
}
```

Note: `ammo` stores total rounds (not individual magazine items). When any ammo item is acquired (bought, won, received), the round count for that category increases by the item's `magazineSize`. The item itself is not stored — it is converted to rounds immediately on receipt.

**PlayerLoadout** — update to new slot system:

```typescript
primaryWeaponId:   { type: String, default: null }  // itemId of a primary-slot weapon the player owns
secondaryWeaponId: { type: String, default: null }  // itemId of a secondary-slot weapon the player owns
bodyArmorId:       { type: String, default: null }  // itemId of a body armor the player owns
consumableItemId:  { type: String, default: null }  // itemId of the chosen consumable type
consumableCount:   { type: Number, default: 0 }     // 1, 2, or 3 — how many to bring into a match
```

**Backend validation on loadout save:**
- `primaryWeaponId` must reference an item in `playerMiniGameInventory.primaryWeapons` that the player owns with `durability > 0`
- `secondaryWeaponId` must reference an item in `playerMiniGameInventory.secondaryWeapons` with `durability > 0`
- `bodyArmorId` must reference an item in `playerMiniGameInventory.bodyArmors` (durability = 0 means it's destroyed, cannot equip)
- `consumableItemId` must reference an item in `playerMiniGameInventory.consumables` with `quantity >= consumableCount`
- `consumableCount` must be 0–3

### 2.8 — Verify

- Seed all items and confirm they appear in the MiniGameItem collection
- Confirm PlayerMiniGameInventory schema accepts the new structure
- Confirm PlayerLoadout schema accepts the new slot system
- Check that no old `category: "weapon"` or `category: "armor"` entries remain (old categories removed)

---

## TIER 3 — ARENA COMBAT MECHANICS OVERHAUL
**Goal: Full rewrite of the shooting arena combat loop**

### 3.1 — Loadout Management UI Page

Before building combat, ensure players can manage their loadout. Create or update the loadout page (`LoadoutPage.tsx` or check if one exists):

**Layout:**
```
ARENA LOADOUT

[PRIMARY WEAPON]           [SECONDARY WEAPON]
[Weapon image]             [Weapon image]
[Name + tier badge]        [Name + tier badge]
[Durability bar: 120/160]  [Durability bar: 80/120]
[Ammo: 60 rounds ready]    [Ammo: 34 rounds ready]
[Change] button            [Change] button

[BODY ARMOR]               [CONSUMABLES]
[Armor image]              [Consumable image]
[Name + tier badge]        [Name + tier]
[Durability: 80/200]       [Qty equipped: 3]
[armorHp: 130 per match]   [Change] button
[Change] button

[SAVE LOADOUT] button
```

Clicking "Change" for any slot opens a modal listing the player's owned items for that slot (filtered by type, sorted by tier descending). Player selects one. For consumables: shows item selector + quantity picker (1–3, max owned, max 3). Items with `durability = 0` shown as "DESTROYED — cannot equip."

If no armor is equipped, show a warning: "⚠️ No armor equipped — you will take full damage from round 1."

If primary weapon has no ammo in the pool: show warning ⚠️ "No ammo for primary weapon."

### 3.2 — Combat System Design

The arena combat is **turn-based and simultaneous:**
- Both players submit their action for the current turn in secret
- Once both have submitted (or the 60-second timer expires), the turn resolves — both actions are applied at the same time
- Neither player sees the other's choice until after resolution
- Turn deadline: 60 seconds. On timeout: auto-submit `fire_primary` for the inactive player. If no ammo, auto-submit `melee`.

**Actions available each turn:**
1. `fire_primary` — fire primary weapon (1 round deducted from ammo pool at match end)
2. `fire_secondary` — fire secondary weapon (1 round deducted from ammo pool at match end)
3. `use_consumable` — activate one use of equipped consumable (deducted permanently at match end)
4. `melee` — bare fist attack, always available, no ammo cost, no special effects

**Strength stat and damage:**
- The `strength` stat on the User model is typically 1–500+ (grows with level, gym, items)
- Flat damage bonus from strength: `floor(strength * 0.08)` added to every weapon hit
- Example: strength 50 → +4 flat damage per shot. Strength 200 → +16 flat damage.
- This keeps strength relevant at all levels without making it overpower weapon tier differences

**Damage formula (per shot):**
```typescript
function resolveDamage(attacker, weapon, ammoMultiplier) {
  const hitRoll = Math.random() * 100;
  if (hitRoll > weapon.accuracy) return { hit: false, damage: 0 };

  const base = Math.floor(Math.random() * (weapon.damageMax - weapon.damageMin + 1)) + weapon.damageMin;
  const strengthBonus = Math.floor(attacker.strength * 0.08);
  const damage = Math.floor((base + strengthBonus) * ammoMultiplier);

  return { hit: true, damage };
}
```

**Armor absorption (applied to every hit that deals damage):**
```typescript
function applyDamage(defender, rawDamage, armorPierce = false) {
  // Armor pierce bypasses armor entirely
  if (armorPierce) {
    defender.currentHp -= rawDamage;
    return { damageToArmor: 0, damageToHp: rawDamage };
  }

  // Check for armor absorb chance (Rare/Epic/Legendary armor special)
  if (defender.armorSpecial?.absorb && Math.random() * 100 < defender.armorAbsorbChance) {
    rawDamage = Math.floor(rawDamage * 0.85); // 15% absorbed
  }

  if (defender.currentArmorHp > 0) {
    const toArmor = Math.min(rawDamage, defender.currentArmorHp);
    defender.currentArmorHp -= toArmor;
    const toHp = rawDamage - toArmor;
    defender.currentHp -= toHp;
    return { damageToArmor: toArmor, damageToHp: toHp };
  } else {
    defender.currentHp -= rawDamage;
    return { damageToArmor: 0, damageToHp: rawDamage };
  }
}
```

**No body armor equipped:** If `bodyArmorId` is null in the loadout snapshot, `currentArmorHp` starts at 0 and all damage goes directly to player HP from turn 1.

### 3.3 — Special Effect Handlers

Implement all special effects as turn-resolution functions:

**`bleed` — Damage over Time:**
```
On trigger: store { effect: "bleed", dps: floor(hitDamage * 0.08), turnsRemaining: 2 } in defender.activeEffects
At start of each turn: apply bleed DPS directly to defender.currentHp (bypasses armor), decrement turnsRemaining
If bleed triggers again while active: refresh turnsRemaining to 2 (does not stack, does not add)
```

**`stun` — Force Melee:**
```
On trigger: set defender.stunNextTurn = true
On defender's next action submission: if stunNextTurn is true, override their action to "melee" and clear the flag
The stun overrides whatever action they submitted — they cannot fire or use consumables that turn
Notify the stunned player: "You were stunned — melee attack only this turn"
```

**`armor_pierce` — Bypass Armor:**
```
Set armorPierce = true in the damage application call
Damage goes directly to player HP regardless of armor HP remaining
Armor HP is not reduced by armor-piercing shots (armor is still "there" but not absorbing)
```

**`knockback` — Lost Turn Action:**
```
On trigger: set defender.knockedBack = true
On turn resolution: the defender's submitted action is cancelled — they deal 0 damage this turn
Clear knockedBack after the turn resolves
Notify the knocked-back player: "You were knocked back — your attack this turn was cancelled"
```

**`double_tap` — Second Shot:**
```
On trigger (after first shot resolves): fire a second shot from the same weapon in the same turn
Second shot uses the same damage formula, same accuracy roll
Second shot CANNOT trigger double_tap (no chain reaction)
Ammo: counts as 2 rounds fired (both shots tracked in roundsFiredPrimary/Secondary)
```

**`shield` (consumable effect):**
```
Adds temporary armorHp bonus: defender.currentArmorHp += shieldValue (e.g. 100)
This bonus is separate from equipped armor and lasts for 2 turns
After 2 turns: remove any remaining shield HP
```

**`heal` (consumable effect):**
```
defender.currentHp = Math.min(defender.currentHp + healAmount, defender.maxHp)
Removes bleed if effect is heal on a mega_medkit
```

**`berserk` (consumable effect):**
```
Store { effect: "berserk", turnsRemaining: 4 } in attacker.activeEffects
While berserk: +30% to all damage dealt, +30% accuracy (clamped to 100), -20% of incoming damage (attacker takes 20% less)
Applied multiplicatively each turn
```

### 3.4 — Loadout Validation Before Match Queue

When a player calls `POST /arena/queue/join`:
1. Fetch their `PlayerLoadout`
2. **Block** if no `primaryWeaponId` set → return error: `"You must equip a primary weapon to queue"`
3. **Block** if `primaryWeaponId` references an item with `durability = 0` → error: `"Your primary weapon is destroyed — get a replacement"`
4. **Warn** (allow join but include in response) if `ammo.{primaryWeapon.ammoCategory} === 0` → `{ warning: "no_ammo_primary", message: "⚠️ No ammo for primary weapon — you can only melee" }`
5. **Warn** if secondary weapon equipped but no ammo → `{ warning: "no_ammo_secondary" }`
6. **Warn** if no body armor equipped → `{ warning: "no_armor", message: "⚠️ No body armor — you will take full damage" }`
7. **Warn** if consumable count > actual inventory count → clamp `consumableCount` to what they own, warn player

### 3.5 — Match State Tracking

Update `CombatMatch` model to store all new fields:

```typescript
// Armor HP tracking (resets each match)
player1CurrentArmorHp:   Number   // starts at body armor's armorHp (or 0 if no armor)
player2CurrentArmorHp:   Number

// Ammo tracking (rounds fired this match, deducted from inventory at end)
player1RoundsFiredPrimary:   { type: Number, default: 0 }
player1RoundsFiredSecondary: { type: Number, default: 0 }
player2RoundsFiredPrimary:   { type: Number, default: 0 }
player2RoundsFiredSecondary: { type: Number, default: 0 }

// Consumable tracking
player1ConsumablesUsed: { type: Number, default: 0 }
player2ConsumablesUsed: { type: Number, default: 0 }

// Per-turn active effects
player1ActiveEffects: [{ effect: String, value: Number, turnsRemaining: Number }]
player2ActiveEffects: [{ effect: String, value: Number, turnsRemaining: Number }]

// Per-turn status flags
player1StunNextTurn:    { type: Boolean, default: false }
player2StunNextTurn:    { type: Boolean, default: false }
player1KnockedBack:     { type: Boolean, default: false }
player2KnockedBack:     { type: Boolean, default: false }
```

Store a snapshot of both loadouts at match start (so item changes mid-match have no effect). Include the ammo multiplier from the ammo tier in the snapshot.

### 3.6 — Ammo Consumption at Match End

At match end (when `status` flips to `"complete"`):
```typescript
// Deduct ammo
const primaryCategory = loadoutSnapshot.primaryWeapon?.ammoCategory;
if (primaryCategory) {
  playerInventory.ammo[primaryCategory] = Math.max(0,
    playerInventory.ammo[primaryCategory] - match.roundsFiredPrimary
  );
}
// Same for secondary
const secondaryCategory = loadoutSnapshot.secondaryWeapon?.ammoCategory;
if (secondaryCategory) {
  playerInventory.ammo[secondaryCategory] = Math.max(0,
    playerInventory.ammo[secondaryCategory] - match.roundsFiredSecondary
  );
}
```

### 3.7 — Consumable Consumption at Match End

```typescript
if (match.consumablesUsed > 0 && loadoutSnapshot.consumableItemId) {
  const consumable = playerInventory.consumables.find(c => c.itemId === loadoutSnapshot.consumableItemId);
  if (consumable) {
    consumable.quantity = Math.max(0, consumable.quantity - match.consumablesUsed);
    if (consumable.quantity === 0) {
      // Remove from array entirely
      playerInventory.consumables = playerInventory.consumables.filter(c => c.itemId !== loadoutSnapshot.consumableItemId);
    }
  }
}
```

### 3.8 — Durability Degradation at Match End

```typescript
// Degrade equipped weapons and armor
const degradePrimary = 5;     // durability lost per match for primary weapon
const degradeSecondary = 3;   // durability lost per match for secondary weapon
const degradeArmor = 4;       // durability lost per match for body armor

const destroyedItems = [];

function degradeItem(inventory, arrayName, itemId, amount) {
  const entry = inventory[arrayName].find(e => e.itemId === itemId);
  if (!entry) return;
  entry.durability = Math.max(0, entry.durability - amount);
  if (entry.durability === 0) {
    destroyedItems.push({ itemId, name: itemTemplate.name });
    inventory[arrayName] = inventory[arrayName].filter(e => e.itemId !== itemId);
  }
}
```

Return `destroyedItems` in the match result API response so the frontend can notify the player.

### 3.9 — Match Rewards

At match end, grant rewards to both players:

**Winner:**
- XP: `150 + floor(opponent.level * 2)` (scaled by opponent level)
- DC: `200 + floor(opponent.level * 3)`
- Key Shards: +1

**Loser:**
- XP: `50 + floor(opponent.level * 0.5)`
- DC: `50`
- Key Shards: +1 (always — participating matters)

Apply XP through the existing XP gain function (which includes `prestigeXpBoost`). Check for level up after XP is applied.

All rewards are included in the match result API response alongside `destroyedItems`.

### 3.10 — Melee Fallback

Melee is always available. When a player submits `fire_primary` or `fire_secondary` but has no rounds left in the ammo pool for that weapon:
- Auto-downgrade to `melee`
- Log the downgrade in the turn result: `"Out of ammo — melee attack"`

Melee damage formula:
```typescript
const meleeDamage = Math.floor(Math.random() * 7) + 8  // 8–14
  + Math.floor(attacker.strength * 0.05);
// Melee hits always — no accuracy roll
// Melee goes through armor normally (not armor pierce)
// Melee triggers no special effects
```

### 3.11 — Frontend Combat UI

Update the shooting arena combat page:

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  [ENEMY NAME + prestige badge]       [YOUR NAME + prestige badge]  │
│                                                                    │
│  ❤️ ████████████████░░░░  320/400    ❤️ ████████████████░░░░ 280/400│
│  🛡️ ██████████░░░░░░░░░░   80/130    🛡️ ██████████████████ 130/130 │
│                                                                    │
│  [Big human silhouette — enemy]    [Big human silhouette — you]    │
│                                                                    │
│                                                                    │
│  YOUR ACTIONS:                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  [weapon image]  │  │  [weapon image]  │  │ [consm image]   │  │
│  │  AK-47 Cyber     │  │  Glock 17 Epic   │  │ Small Medkit    │  │
│  │  Primary         │  │  Secondary       │  │ ×2 remaining    │  │
│  │  Ammo: 28 rds    │  │  Ammo: 15 rds    │  │                 │  │
│  │  [FIRE]          │  │  [FIRE]          │  │ [USE]           │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘  │
│                         [MELEE] button                             │
│                                                                    │
│  ─── TURN LOG ───────────────────────────────────────────────      │
│  Turn 3: You fired AK-47 → 48 dmg (22 to armor, 26 to HP)        │
│  Turn 3: Enemy fired Mossberg → 71 dmg (all to your HP — !)       │
│  Turn 2: You used Small Medkit → +80 HP                           │
└────────────────────────────────────────────────────────────────────┘
```

- Weapon/consumable cards are clickable — clicking submits that action
- Once submitted, all action buttons gray out with "Waiting for opponent..." label
- On turn resolution: animate damage numbers floating up, armor bar depletes before HP bar depletes
- Show last 5 turns in the turn log
- Active effects shown as icons on the silhouette (bleed = drip icon, stun = stars icon, berserk = flame icon)
- ⚠️ Warning icons on weapon cards if ammo is at 0

### 3.12 — Match Result Screen

When the match ends, show a full-screen result modal before returning to the hub:

```
┌─────────────────────────────────────────┐
│        ★ VICTORY ★   (or DEFEAT)        │
│                                         │
│  Opponent: [name]   Level [X]           │
│                                         │
│  REWARDS EARNED:                        │
│  +150 XP        +200 DC                 │
│  +1 Key Shard   (19/20 to next key)     │
│                                         │
│  MATCH STATS:                           │
│  Rounds fired (primary):  28            │
│  Rounds fired (secondary): 8            │
│  Consumables used: 1                    │
│                                         │
│  GEAR STATUS:                           │
│  AK-47 Cyber — Durability: 215/220      │
│  Glock 17 Epic — Durability: 77/80 ⚠️   │
│  Ballistic Rig — Durability: 196/200    │
│                                         │
│  ⚠️ DESTROYED THIS MATCH:               │
│  [item image] Glock 17 Epic — GONE      │
│                                         │
│  [CONTINUE]                             │
└─────────────────────────────────────────┘
```

Items destroyed this match are highlighted in red. If no items destroyed, that section is hidden.

---

## TIER 4 — ROYALE SYSTEM OVERHAUL
**Goal: Replace the general royale with a per-category dual-spin system**

### 4.1 — Remove General Royale

- Delete or archive all `RoyaleItem` seed data for the general royale (type `"general"`)
- The `/royale/spin` endpoint with `type: "general"` returns 404 or is removed
- Remove any frontend page or NavBar link pointing to the old general royale
- Remove old royale spin buttons from anywhere they appear in the UI

### 4.2 — New Royale Model Structure

Update the `RoyaleItem` model:

```typescript
royaleCategory: {
  type: String,
  enum: [
    "pistols", "smgs", "assault_rifles", "shotguns", "sniper_rifles", "lmgs",
    "body_armor", "consumables", "ammo", "race_cars", "car_parts"
  ],
  required: true
}
spinType:  { type: String, enum: ["dc_spin", "master_royale"], required: true }
itemRef:   { type: String, required: true }   // MiniGameItem itemId or race car itemId
dropWeight:{ type: Number, required: true }   // higher = more likely; not a percentage
```

Displayed probability = `(itemWeight / sumOfAllWeightsInThisPool) * 100`

**Spin type rules:**
- `dc_spin`: pool contains only Common, Uncommon, and a small selection of Rare items
- `master_royale`: pool contains only Rare, Epic, and Legendary items

### 4.3 — Seed Royale Pools

Seed `RoyaleItem` documents for all 11 categories × 2 spin types = 22 pools.

**Weight guide:**
- Common: weight 40 per item
- Uncommon: weight 25 per item
- Rare (in dc_spin): weight 8 per item
- Rare (in master_royale): weight 30 per item
- Epic: weight 15 per item
- Legendary: weight 5 per item

**Example — `pistols / dc_spin` pool:**
- 4 Common pistols × weight 40 = 160
- 4 Uncommon pistols × weight 25 = 100
- 4 Rare pistols × weight 8 = 32
- Total pool weight = 292

**Example — `pistols / master_royale` pool:**
- 4 Rare pistols × weight 30 = 120
- 4 Epic pistols × weight 15 = 60
- 4 Legendary pistols × weight 5 = 20
- Total pool weight = 200

Repeat for all 11 categories. For `race_cars` and `car_parts`, reference the race car items seeded in the racing system. Seed placeholder car items if racing system seed does not yet exist.

**Arena consumable royale pool:**
- Common: small_medkit, smoke_grenade (weight 40 each)
- Uncommon: large_medkit (in Master only — it's Rare), adrenaline_shot (weight 25)
- Rare: large_medkit, stimpack (weight 8 in dc_spin, 30 in master)
- Epic: mega_medkit, cyber_grenade, nano_shield (weight 15)
- Legendary: berserker_dose (weight 5)

### 4.4 — Spin Logic Backend

Update `POST /royale/spin` to accept:
```json
{ "category": "assault_rifles", "spinType": "dc_spin" }
```

Logic:
1. Validate `category` and `spinType`
2. Check cost: dc_spin = 500 DC, master_royale = 20 NC + 1 Key
3. Check player has enough (return 400 if not)
4. Deduct cost atomically (use `$inc` on DC/NC/keys)
5. Fetch all RoyaleItems for `{ royaleCategory: category, spinType }`
6. Weighted random selection
7. Fetch full item details from MiniGameItem
8. Grant item to player:
   - Weapons/body armor: add to appropriate `PlayerMiniGameInventory` array with `durability = item.maxDurability`
   - Ammo items: add `item.magazineSize` to `playerInventory.ammo[item.ammoCategory]`
   - Consumables: increment `playerInventory.consumables[itemId].quantity` by 1 (or add if not present)
9. Check key shard auto-conversion: if `keyShards >= 20` → `keyShards -= 20; keys += 1`
10. Return won item with full details, updated player currency balances

### 4.5 — Key Shard System

`keyShards` field is on the User model (added in Tier 1). Implement shard grants everywhere:

**Shard sources:**
- Daily login reward: +3 shards (add to existing daily login handler)
- After any completed shooting arena match (win OR lose): +1 shard (add to match reward handler — Tier 3.9)
- After any completed race (win OR lose): +1 shard (add to race completion handler)
- Mission milestone completions: +5 shards
- Selected achievement unlocks: +10 shards

**Auto-conversion:** After every shard grant, run:
```typescript
while (user.keyShards >= 20) {
  user.keyShards -= 20;
  user.keys += 1;
}
```

**Full key sources:**
- Auto-convert from shards (above)
- NC purchase: endpoint `POST /store/keys` — costs 50 NC for 3 keys
- Milestone achievements: grant 1–3 keys directly

### 4.6 — Royale Hub Frontend

Create `RoyaleHubPage.tsx`. Route: `/royale`

Display a responsive grid of 11 category cards:

```
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  [Image]   │  │  [Image]   │  │  [Image]   │  │  [Image]   │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
   Pistols          SMGs       Assault Rifles    Shotguns

┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  [Image]   │  │  [Image]   │  │  [Image]   │  │  [Image]   │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
 Sniper Rifles      LMGs        Body Armor      Consumables

┌────────────┐  ┌────────────┐  ┌────────────┐
│  [Image]   │  │  [Image]   │  │  [Image]   │
└────────────┘  └────────────┘  └────────────┘
     Ammo         Race Cars      Car Parts
```

Each card: `/assets/royale/{category}.png` image (SVG fallback if PNG missing), category name centered below, hover = cyberpunk glow effect, click = navigate to `/royale/{category}`.

### 4.7 — Category Spin Page Frontend

Create `RoyaleCategoryPage.tsx`. Route: `/royale/:category`

**Visual design — two distinct modes on one page:**

The page has a mode toggle at the top:
```
[ DC SPIN ]  |  [ ★ MASTER ROYALE ★ ]
```
- **DC SPIN** tab: standard blue cyberpunk theme, cost shows "500 DC"
- **MASTER ROYALE** tab: gold/premium animated theme, cost shows "20 NC + 1 Key" — the tab itself has a gold shimmer animation to signal premium

Switching the tab immediately changes: the cost display, the spin button style, and the items list (probabilities update to the master pool).

**Spin animation:**
- When player clicks SPIN, a slot reel animation plays for 2–3 seconds
- The reel shows item images scrolling past rapidly then slowing to a stop
- Stops on the won item with a flash effect
- Result modal slides in: large item image, tier badge (color-coded), item name, `"Added to your arena inventory!"` — dismiss to continue

**Items you can win list (below the spinner):**
```
ITEMS YOU CAN WIN  [DC SPIN / MASTER ROYALE based on toggle]
─────────────────────────────────────────────────────────────
[item PNG]  AK-47 Common          ████████░░░░░░  38.4%
[item PNG]  AK-47 Mk.II           ████████░░░░░░  24.0%
[item PNG]  AK-47 Custom ◆        ████░░░░░░░░░░   7.7%
[item PNG]  AK-47 Cyber ★★        🔒 MASTER ONLY  [grayed out]
[item PNG]  AK-47 Phantom ★★★     🔒 MASTER ONLY  [grayed out]
```

- In DC Spin view: Epic and Legendary items show grayed out with a lock icon and "MASTER ONLY" label — this drives desire to upgrade
- In Master Royale view: Common and Uncommon items show as "DC ONLY" grayed out
- Each item row: item PNG image (from `/assets/items/{itemId}.png`), name, tier icon, probability bar, percentage text
- Items sorted: Common → Uncommon → Rare → Epic → Legendary

---

## TIER 5 — MARKET & AUCTION OVERHAUL
**Goal: Replace single shop with NPC stores, add bulk player listing, commission, expiry, and auction**

### 5.1 — NPC Stores Design

Replace the single generic shop. There are 6 named NPC stores, each with a character and specific inventory category.

| Store ID | Store Name | Keeper | Category | Price Feel |
|---|---|---|---|---|
| `iron_wolf` | Iron Wolf Armory | Marcus "Iron" Cole | Normal game enhancement items (repurposed weapons) | Mid-range, gruff negotiator |
| `steelshield` | Steelshield Outfitters | Yuki Tanaka | Normal game clothing | Fashion-forward, premium feel |
| `neon_motors` | Neon Motors | Rico "Speed" Vega | Normal game vehicles | High-end showroom, expensive |
| `district_pharma` | District Pharma | Dr. Elena Reyes | Normal game consumables + Service Token | Clinical, precise |
| `combat_zone` | Combat Zone Supply | "The Sergeant" | Arena gear (Common/Uncommon weapons, armor, ammo; occasional Rare) | Military surplus, bulk deals |
| `chrome_garage` | Chrome Garage | Jay "Torque" | Race cars and car parts | Workshop vibe, mechanical |

**ABSOLUTE RULE: NPC stores NEVER list Epic or Legendary items. Rare items appear only occasionally (random chance each restock cycle).**

**Price ranges by store and tier:**

| Tier | Iron Wolf | Steelshield | Neon Motors | District Pharma | Combat Zone | Chrome Garage |
|---|---|---|---|---|---|---|
| Common | 800–1,200 DC | 600–1,000 DC | 3,000–5,000 DC | 300–600 DC | 500–900 DC | 4,000–8,000 DC |
| Uncommon | 2,000–3,500 DC | 1,800–3,000 DC | 8,000–14,000 DC | 900–1,800 DC | 1,500–2,800 DC | 12,000–20,000 DC |
| Rare | 6,000–10,000 DC | 5,000–9,000 DC | 25,000–40,000 DC | 3,000–6,000 DC | 5,000–9,000 DC | 35,000–60,000 DC |

Prices roll randomly within the range on each restock. Stores restock every 6 hours. On restock: clear expired listings, generate new random selection of items.

**NPC store as static config or model:**
Create a `NpcStoreListing` collection or handle as in-memory static config with a restock timestamp. Each listing:
```typescript
storeId: String
itemId: String          // references Item (for normal stores) or MiniGameItem (for Combat Zone/Chrome Garage)
itemType: String        // "normal" | "arena"
price: Number           // price rolled at restock time within the range
quantity: Number        // how many currently available (1–5 per item)
expiresAt: Date         // set to now + 6 hours at restock
```

For Rare items appearing in Combat Zone: on each restock cycle, roll a random number 0–100. If result < 20 (20% chance), include 1 Rare item randomly selected from the Rare arena weapons/armor pool.

### 5.2 — NPC Store FAQ System

Each NPC store frontend page includes the keeper and an inline FAQ. No real-time chat — just clickable question chips that expand answers inline.

**Iron Wolf Armory — Marcus "Iron" Cole:**
- "What do you sell?" → "Enhancement gear. Street-grade to military-spec. Slot it in and feel stronger."
- "These prices negotiable?" → "Fixed. Always. No haggling. Either you want it or you don't."
- "Got anything rarer?" → "Not here. If you want the heavy stuff, try the auction. Sergeant might have some too."
- "How often do you restock?" → "Every 6 hours. Come back if you missed something."
- "What does enhancement gear do?" → "Boosts your strength passively. More strength, more damage in the arena. Simple math."

**Steelshield Outfitters — Yuki Tanaka:**
- "What does clothing do?" → "Stat boosts. Charisma, intelligence, street cred — the right outfit opens doors."
- "Fashion or function?" → "Both. My pieces are designed, not just functional."
- "How do I equip it?" → "Inventory → clothing slot. Works passively once equipped."

**Neon Motors — Rico "Speed" Vega:**
- "Tell me about the cars." → "Street runners and luxury cruisers. Each cuts your travel energy cost. Luxury also bumps your charisma."
- "Which car should I get?" → "Depends. You want speed? Sports Car. You want presence? Luxury Car. Both hit different."
- "Can I race these cars?" → "Nah — racing uses the arena cars. These are city wheels only."

**District Pharma — Dr. Elena Reyes:**
- "What do you carry?" → "Consumables. Energy, nerve, health. And Service Tokens if your race car needs maintenance."
- "What's a Service Token?" → "Takes your race car from whatever condition it's in back to 100%. No questions asked."
- "Are these safe?" → "They're effective. I leave the safety questions to others."

**Combat Zone Supply — "The Sergeant":**
- "What's in stock?" → "Common and Uncommon arena gear. Weapons, body armor, ammo. Occasional Rare if you're lucky."
- "Where do I get Epic or Legendary?" → "Auction. Or find a player who's selling. I don't stock that tier."
- "How do I know what I need?" → "Get your loadout sorted. Primary weapon, secondary weapon, armor, ammo. That's your minimum."
- "Ammo — how does it work?" → "Buy a mag, it adds rounds to your pool. More mags, more rounds, more shots. Run dry in a match and you're on melee only."

**Chrome Garage — Jay "Torque":**
- "What do you have?" → "Cars and parts. Common to Rare. Good for getting started or upgrading what you already run."
- "What's condition?" → "How beat up your car is. Race it hard, it degrades. Service it to bring it back to 100%."
- "Can I sell my car here?" → "No — player market for that. I just sell."
- "Car parts vs car upgrades?" → "Parts tune your car's stats. Speed, handling, boost. Slot them in from the garage."

Questions are displayed as horizontal chip buttons. Clicking one expands the answer inline below the chip. Clicking again collapses it. Maximum 5 questions per store.

### 5.3 — Player Market — Bulk Listing

Players can list items from both their normal game inventory and their arena inventory.

**Backend: `POST /market/listings/batch`**

Request body:
```json
{
  "listings": [
    { "itemId": "ak47_epic", "itemType": "arena", "inventoryRef": "primaryWeapons", "price": 50000 },
    { "itemId": "tactical_vest", "itemType": "arena", "inventoryRef": "bodyArmors", "price": 12000 },
    { "itemId": "pistol_rounds_uncommon", "itemType": "arena_ammo", "ammoCategory": "pistol_rounds", "roundsToList": 100, "price": 2000 },
    { "itemId": "cyber_blade", "itemType": "normal", "price": 8000 }
  ]
}
```

For each listing:
1. Validate player owns the item and has it available
2. Remove item from player's inventory (or deduct ammo rounds for ammo listings)
3. For arena weapons/armor: include the current `durability` in the `Listing` document — buyer receives the item at this durability level
4. Create a `Listing` document

**Listing model:**
```typescript
sellerId:         String
itemId:           String
itemName:         String          // denormalized for display
itemType:         String          // "normal" | "arena" | "arena_ammo"
inventoryRef:     String          // which array: "primaryWeapons" | "bodyArmors" | "consumables" etc.
durability:       Number | null   // preserved for arena weapons/armor; null for normal items and ammo
price:            Number          // buyer pays this
commission:       Number          // price * 0.05 (5%)
netPayout:        Number          // price * 0.95 (seller receives this)
status:           { type: String, enum: ["active", "sold", "expired"], default: "active" }
expiresAt:        Date            // now + 48 hours
listedAt:         Date
```

Response: `{ listed: N, expectedPayout: totalIfAllSell }` where `totalIfAllSell = sum of all netPayouts`.

**Frontend bulk listing flow:**
1. Player opens "List Items" from their inventory or arena inventory page
2. Checkboxes appear on each item
3. Player checks items they want to list
4. A sidebar or panel appears: shows each selected item, a price input per item, and the net payout after 5% commission
5. Summary at bottom: "Listing 3 items — if all sell: you receive 58,100 DC (after 5% commission)"
6. [CONFIRM LISTING] button — submits all at once

### 5.4 — Commission and Expiry

**When a listing sells (`POST /market/listings/:id/buy`):**
1. Buyer's DC balance must be >= listing price (return 400 if not)
2. Deduct `price` DC from buyer atomically
3. Add `netPayout` DC to seller atomically (seller gets price * 0.95)
4. Transfer item to buyer's inventory:
   - `"arena"` items: add to buyer's `PlayerMiniGameInventory` with the preserved `durability`
   - `"normal"` items: add to buyer's User inventory
   - `"arena_ammo"` listings: add the listed rounds to buyer's ammo pool
5. Set `listing.status = "sold"`
6. Do NOT notify seller in real-time — they will see "sold" status when they check their listings

**When listings expire (cron job, check every hour):**
1. Find all `{ status: "active", expiresAt: { $lt: new Date() } }`
2. For each: return item to seller's inventory (same transfer logic in reverse)
3. Set `status = "expired"`

**Player's active listings page:** Players can view their current listings and cancel any active one early. Cancellation returns the item to inventory and sets status to "expired."

### 5.5 — Market Category Tabs

Market frontend page tabs:

```
[ Weapons ] [ Clothing ] [ Vehicles ] [ Consumables ] [ Materials ] [ Arena Gear ] [ Cars & Parts ]
```

- **Weapons**: listings where `itemType: "normal"` and item category is weapon/enhancement
- **Clothing**: normal game clothing items
- **Vehicles**: normal game vehicles
- **Consumables**: normal game consumables (and Service Tokens)
- **Materials**: normal game crafting materials
- **Arena Gear**: listings where `itemType: "arena"` — includes primary weapons, secondary weapons, body armor, ammo, and arena consumables. All arena gear categories combined in one tab.
- **Cars & Parts**: race cars and car parts

Each tab shows: item image (using `ItemImage` component), item name, tier badge, seller username, price in DC, durability bar (for arena weapons/armor), [BUY] button.

Listings sorted by: most recently listed first (default). Add sort options: price low-to-high, price high-to-low, tier.

### 5.6 — Auction System

The auction is fully bot-operated. Players cannot create auctions — they can only bid.

**AuctionListing model:**
```typescript
itemId:            String
itemName:          String          // denormalized
itemCategory:      String
itemTier:          String          // "epic" | "legendary"
currentBid:        { type: Number, default: 0 }
currentBidderId:   { type: String, default: null }
minimumBid:        Number          // starting floor price
bidIncrement:      Number          // minimum raise (1% of currentBid, floor 100 DC)
expiresAt:         Date
status:            { type: String, enum: ["active", "sold", "expired"], default: "active" }
bids:              [{ bidderId: String, amount: Number, timestamp: Date }]
```

**Bot-generated auctions (cron job every 30–120 minutes randomly):**
- Select a random Epic or Legendary item from the MiniGameItem collection
- Do not create duplicate auctions for the same item if one is already active
- Maximum 5 active auctions at any time — skip creation if at cap
- `minimumBid`: Epic items → 50,000 DC. Legendary items → 200,000 DC
- `expiresAt`: `now + random(30 minutes, 24 hours)`
- `bidIncrement`: max(100, floor(minimumBid * 0.01))

**Bidding (`POST /auction/:id/bid`):**
```json
{ "amount": 55000 }
```
1. Validate auction is active and not expired
2. Validate `amount >= currentBid + bidIncrement`
3. **Atomic operation:** Refund previous bidder their `currentBid` DC, deduct `amount` DC from new bidder, update `currentBid`, `currentBidderId`, push to `bids[]`
   - Use MongoDB transactions or a findOneAndUpdate + session for atomicity
   - If new bidder cannot afford `amount`: return 400, do not proceed
4. Return updated auction state

**Auction expiry (cron job, check every minute):**
1. Find all `{ status: "active", expiresAt: { $lt: now } }`
2. If `currentBidderId` exists: transfer item to buyer's `PlayerMiniGameInventory`, set status `"sold"`
3. If no bids: set status `"expired"` — item goes back into the bot pool for future auctions
4. Do not refund on expiry for the winning bidder — their DC was already deducted at bid time

**Frontend Auction Page (`/auction`):**
- Active auctions listed as cards
- Each card: item image, item name, tier badge (Epic = purple, Legendary = gold animated), current bid in DC, time remaining (countdown timer that updates live), "You are winning" / "You were outbid" status for the player
- Bid input field + [BID] button per card
- Bid input pre-fills with `currentBid + bidIncrement`
- "AUCTION ENDS IN: 2h 14m 32s" countdown per card
- If player was outbid since last page load: show ⚠️ "You were outbid on [item name]" banner at top

---

## TIER 6 — RACING CONDITION SYSTEM
**Goal: Car condition degrades per race, affects performance, can be serviced**

### 6.1 — Condition Field

Add a `condition` field to the player's race car inventory entry. This is stored per player's copy of the car (same pattern as weapon durability — the condition belongs to the player's car, not the car item template).

In whatever model tracks a player's owned race cars (check the racing system — likely a field on User or a separate model):
```typescript
condition: { type: Number, default: 100, min: 0, max: 100 }
```

### 6.2 — Condition Degradation After Each Race

At race completion (win or lose), degrade the player's car's condition:
```typescript
const degradation = raceHadCrash
  ? Math.floor(Math.random() * 8) + 8    // crash: 8–15 points
  : Math.floor(Math.random() * 4) + 2;   // normal: 2–5 points

car.condition = Math.max(0, car.condition - degradation);
```

Also degrade car parts (if installed) at the same rate — all parts on the car degrade by the same amount as the car itself (one unified condition system, not per-part).

Grant key shard after race completion (+1 shard — see Tier 4.5).

### 6.3 — Performance Penalty Table

| Condition % | Speed Multiplier | Extra Notes |
|---|---|---|
| 100–75% | 1.00 (full speed) | No visible warning |
| 74–50% | 0.95 (−5%) | "Showing wear" label on garage card |
| 49–25% | 0.88 (−12%) | "Needs service soon" label + increased crash chance |
| 24–1% | 0.80 (−20%) | "Critical condition" label + high crash chance |
| 0% | Cannot race | "SIDELINED" — blocked from entering race queue |

Apply multiplier to the car's effective speed stat before any race calculation.

### 6.4 — Service System

**Endpoint: `POST /race/cars/:carId/service`**

Two ways to service:
1. **Pay DC:** Cost by car tier:
   - Common: 2,000 DC
   - Uncommon: 5,000 DC
   - Rare: 10,000 DC
   - Epic: 18,000 DC
   - Legendary: 30,000 DC

2. **Use Service Token:** 1 Service Token item from normal game inventory (District Pharma shop). Deduct from inventory.

Service sets `car.condition = 100`. Also restores all installed car parts to `condition = 100`.

Return error if car is already at 100% ("Already in perfect condition").

### 6.5 — Garage Frontend Display

In the Garage page, for each car card:
- Show a color-coded condition bar below the car image
  - Green fill: 75–100%
  - Yellow fill: 50–74%
  - Orange fill: 25–49%
  - Red fill: 1–24%
  - Gray: 0% (SIDELINED)
- Show condition percentage as text: "Condition: 82%"
- Show status label: "Good" / "Showing Wear" / "Needs Service" / "Critical" / "SIDELINED"
- If condition < 100%: show "SERVICE CAR" button with cost (DC or Service Token)
- If car is at 0%: show "SIDELINED — Service Required" badge and disable "Enter Race" button

---

## TIER 7 — HP SCALING & PRESTIGE SYSTEM
**Goal: Meaningful HP scaling per level, prestige reset with rewards**

### 7.1 — HP Formula (Computed, Never Stored)

**Remove `maxHealth` from the User schema.** It is no longer a stored field. It is always computed at runtime.

Implement this function in a shared utility file (e.g. `lib/hp.ts`):

```typescript
export function computeMaxHp(level: number, prestige: number): number {
  const baseHp = 100;
  const levelHp = level * 15;
  const quadraticHp = Math.floor(level * level * 0.2);
  const prestigeBonus = prestige * 200;
  return baseHp + levelHp + quadraticHp + prestigeBonus;
}
```

**Resulting HP (no prestige):**
| Level | Max HP |
|---|---|
| 1 | 115 |
| 5 | 180 |
| 10 | 270 |
| 20 | 480 |
| 30 | 730 |
| 50 | 1,350 |
| 75 | 2,300 |
| 100 | 3,600 |

**With prestige bonus (+200 HP per prestige):**
| Level | P0 | P1 | P3 | P5 |
|---|---|---|---|---|
| 1 | 115 | 315 | 715 | 1,115 |
| 50 | 1,350 | 1,550 | 1,950 | 2,350 |
| 100 | 3,600 | 3,800 | 4,200 | 4,600 |

**Migration steps:**
1. Remove `maxHealth` from User schema
2. On every API response that includes user data: add `maxHealth: computeMaxHp(user.level, user.prestige)` to the response object dynamically (do not save it to DB)
3. On user login: `if (user.health > computeMaxHp(user.level, user.prestige)) user.health = computeMaxHp(user.level, user.prestige)` — clamp current health to new max
4. On level up: recalculate max HP — current `health` stays as-is (leveling up does not auto-heal), the cap simply increases

### 7.2 — Prestige System

**Requirements to prestige:**
- `user.level === 100`
- Player has completed at least 50 arena matches (`combatMatchesCompleted >= 50`)
- If requirements not met: return 400 with a message explaining what's needed

**`POST /user/prestige` — Prestige action:**
```typescript
// Validate requirements
// Then:
user.prestige += 1;
user.level = 1;
user.xp = 0;
user.xpToNext = [xp required for level 1 → 2];
user.prestigeXpBoost += 10;        // +10% XP gain per prestige, permanently
user.health = computeMaxHp(1, user.prestige);  // reset to new P{N} level-1 HP
// user.dc, user.nc, user.keys, user.keyShards — unchanged
// All inventories (normal, arena, garage) — unchanged
// Achievements, friends, guild — unchanged
```

**Prestige rewards granted immediately:**
1. Add `"prestige_badge_P{N}"` to the player's badge collection (where N = new prestige number)
2. Add `"prestige_frame_P{N}"` to the player's available profile frames (animated frame)
3. `prestigeXpBoost` is now applied to all future XP calculations

**XP boost application — update the XP gain function:**
```typescript
function applyXpGain(user: User, baseXp: number): number {
  return Math.floor(baseXp * (1 + user.prestigeXpBoost / 100));
}
```
Call this function wherever XP is granted (match rewards, crimes, jobs, missions, gym, etc.).

**Prestige display rules (apply everywhere the username appears):**
- Next to the username in: player profile, chat messages, leaderboards, friends list, arena match opponent display, market seller name, auction bidder list, guild member list
- Format: `[P{N}] Username` where `[P{N}]` is a colored badge (P1 = bronze, P2 = silver, P3 = gold, P4 = platinum, P5+ = animated rainbow)
- Implement as a shared `<PrestigeBadge prestige={user.prestige} />` component in the frontend
- If `prestige === 0`: show nothing (no badge)

**Frontend prestige entry point:**
- On the player's own profile page: if `level === 100`, show a "⚡ PRESTIGE" button with a glowing animation
- Clicking opens a confirmation modal:
  ```
  ┌─────────────────────────────────────────┐
  │  ⚡ PRESTIGE TO P{N+1}                  │
  │                                         │
  │  You will KEEP:                         │
  │  ✓ All DC, NC, Keys, Shards             │
  │  ✓ All items (weapons, armor, cars)     │
  │  ✓ Achievements and friends             │
  │  ✓ Guild membership                     │
  │                                         │
  │  You will RESET:                        │
  │  ✗ Level → back to 1                   │
  │  ✗ XP → back to 0                      │
  │  ✗ Current HP → reset to P{N+1} Lv1 HP │
  │                                         │
  │  You will GAIN:                         │
  │  ★ Prestige P{N+1} badge + frame        │
  │  ★ +10% permanent XP boost              │
  │  ★ +200 max HP at every level           │
  │                                         │
  │  [PRESTIGE]          [CANCEL]           │
  └─────────────────────────────────────────┘
  ```

---

## TIER 8 — UI POLISH, IMAGES, AND NAVIGATION
**Goal: Arena hub cards, item images everywhere, NPC store storefronts, clean navigation**

### 8.1 — Arena Hub Page

Redesign `ArenaHubPage.tsx` as a pure mode-select screen. No other content.

```
┌──────────────────────────┐     ┌──────────────────────────┐
│                          │     │                          │
│   /assets/arena/         │     │   /assets/arena/         │
│   shooting.png           │     │   racing.png             │
│                          │     │                          │
│   [Cyberpunk glow on     │     │   [Cyberpunk glow on     │
│    hover]                │     │    hover]                │
│                          │     │                          │
└──────────────────────────┘     └──────────────────────────┘
        Shooting Arena                   Racing Arena
```

Each card:
- Full image fills the card area
- Mode name centered below card in large cyberpunk font
- Hover: neon glow border effect (color-coded: shooting = red, racing = cyan)
- Click: navigate to that mode's entry page (shooting queue / race hub)

### 8.2 — Item Images Throughout

The `ItemImage` component at `src/components/ItemImage.tsx` is already built. It loads `/assets/items/{itemId}.png` with SVG fallback with generic icon fallback. Use it in EVERY new item display:

| Location | Component/Page |
|---|---|
| Arena inventory | All weapon, armor, ammo, consumable items |
| Royale category spin page | Items you can win list |
| Royale spin result modal | Won item display |
| Loadout management page | All 4 slots |
| Match combat UI | Weapon cards + consumable card |
| Match result screen | All gear shown in status section |
| Player market listings | Each listing card |
| NPC store pages | Each item in stock grid |
| Auction listing cards | Each auction item |
| Arena inventory sidebar/tab | Overview icons |

For cars specifically: use `/assets/cars/{carId}.png` (already implemented in `GaragePage.tsx` — use the same pattern).

### 8.3 — NPC Store Storefronts

Each NPC store is its own page at `/shop/{storeId}`. Example routes: `/shop/iron_wolf`, `/shop/combat_zone`.

**Page layout:**
```
┌────────────────────────────────────────────────────────────┐
│  [NPC character art — /assets/npcs/{storeId}.png]          │
│  IRON WOLF ARMORY                                          │
│  Marcus "Iron" Cole — "Enhancement gear, no bullshit."     │
│                                                            │
│  ┌ FAQ ────────────────────────────────────────────────┐   │
│  │ [What do you sell?] [These prices negotiable?] ...  │   │
│  │                                                     │   │
│  │ > What do you sell?                                 │   │
│  │   "Enhancement gear. Street-grade to military-spec."│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  IN STOCK                            Restocks in: 4h 12m   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │[item img]│ │[item img]│ │[item img]│ │[item img]│       │
│  │Cyber Bld │ │Rail Pstl │ │ ...      │ │ ...      │       │
│  │Uncommon  │ │Rare      │ │          │ │          │       │
│  │2,800 DC  │ │7,200 DC  │ │          │ │          │       │
│  │[BUY]     │ │[BUY]     │ │          │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                            │
│  OUT OF STOCK — Next restock in 4h 12m                     │
└────────────────────────────────────────────────────────────┘
```

- Restock countdown timer shown (time until next 6-hour restock cycle)
- "OUT OF STOCK" state shown if no items currently listed (just restocked empty)
- Buy button deducts DC, adds item to player inventory, decrements quantity in listing
- If quantity hits 0: show "SOLD OUT" on that item card until next restock

Create a landing page at `/shop` that shows all 6 store cards (similar to Royale hub — grid of store cards with NPC art thumbnail, store name, keeper name, category).

### 8.4 — Navigation Updates

Update the main NavBar/sidebar to reflect all new routes and remove stale ones:

**Remove:**
- Old general royale link
- Old single "Shop" link (replaced by `/shop` landing)
- Old PvP combat link (if any remains)

**Add or update:**
- Royale → `/royale` (hub)
- Shops → `/shop` (landing with all 6 stores)
- Market → `/market` (player listings, with category tabs)
- Auction → `/auction`
- Arena → `/arena` (hub with Shooting + Racing cards)
- Loadout → `/loadout` (arena loadout management)

---

## APPENDIX A — ITEM RARITY RULES (ABSOLUTE — NEVER BREAK THESE)

| Source | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| NPC Bot Store | ✅ Always | ✅ Always | ✅ Rare occasion (≤20% chance per restock) | ❌ NEVER | ❌ NEVER |
| Player Market | ✅ | ✅ | ✅ | ✅ | ✅ |
| DC Spin | ✅ | ✅ | ✅ (limited weight) | ❌ | ❌ |
| Master Royale | ❌ | ❌ | ✅ | ✅ | ✅ |
| Auction | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## APPENDIX B — HP QUICK REFERENCE TABLE

| Level | P0 | P1 | P2 | P3 | P5 |
|---|---|---|---|---|---|
| 1 | 115 | 315 | 515 | 715 | 1,115 |
| 10 | 270 | 470 | 670 | 870 | 1,270 |
| 25 | 600 | 800 | 1,000 | 1,200 | 1,600 |
| 50 | 1,350 | 1,550 | 1,750 | 1,950 | 2,350 |
| 75 | 2,300 | 2,500 | 2,700 | 2,900 | 3,300 |
| 100 | 3,600 | 3,800 | 4,000 | 4,200 | 4,600 |

---

## APPENDIX C — AMMO CATEGORY MAP

| Weapon Category | Slot | Ammo Category |
|---|---|---|
| Pistol | Secondary | pistol_rounds |
| SMG | Secondary | smg_rounds |
| Assault Rifle | Primary | rifle_rounds |
| Shotgun | Primary | shotgun_shells |
| Sniper Rifle | Primary | sniper_rounds |
| LMG | Primary | lmg_rounds |

**Ammo as rounds pool:** Ammo is NOT held as individual inventory items by the player. Buying or winning an ammo item immediately converts it: `playerInventory.ammo[category] += item.magazineSize`. The item is consumed on pickup.

---

## APPENDIX D — PRESTIGE SYSTEM REFERENCE

| Prestige | HP Bonus | XP Boost | Badge Color | Frame |
|---|---|---|---|---|
| P0 (none) | +0 | 0% | — | — |
| P1 | +200 | +10% | Bronze | P1 Animated Frame |
| P2 | +400 | +20% | Silver | P2 Animated Frame |
| P3 | +600 | +30% | Gold | P3 Animated Frame |
| P4 | +800 | +40% | Platinum | P4 Animated Frame |
| P5+ | +200/prestige | +10%/prestige | Animated Rainbow | P5+ Frame |

---

## APPENDIX E — ROYALE SPIN COSTS

| Spin Type | Cost |
|---|---|
| DC Spin | 500 DC |
| Master Royale | 20 NC + 1 Key |
| Key pack (NC purchase) | 50 NC = 3 Keys |

---

## APPENDIX F — MATCH REWARDS

| Outcome | XP | DC | Key Shards |
|---|---|---|---|
| Win | 150 + (opponent level × 2) | 200 + (opponent level × 3) | +1 |
| Lose | 50 + (opponent level × 0.5) | 50 | +1 |

XP is processed through `applyXpGain(user, baseXp)` which applies `prestigeXpBoost`. Level-up check runs after XP is applied.

---

## APPENDIX G — SPECIAL EFFECTS SUMMARY

| Effect | Trigger | Duration | Behavior |
|---|---|---|---|
| `bleed` | On hit, % chance | 2 turns DoT | 8% of hit damage per turn, bypasses armor, refreshes on re-trigger |
| `stun` | On hit, % chance | 1 turn | Target's next action forced to melee |
| `armor_pierce` | Every hit from this weapon | Per shot | Damage bypasses armor HP entirely |
| `knockback` | On hit, % chance | 1 turn | Target's current turn action cancelled |
| `double_tap` | On hit, % chance | Same turn | Second shot fires (same formula, no chain) |
| `absorb` (armor) | On every incoming hit, % chance | Per hit | 15% damage reduction on that hit |

---

## APPENDIX H — NPC STORE PRICE RANGES

| Tier | Iron Wolf | Steelshield | Neon Motors | District Pharma | Combat Zone | Chrome Garage |
|---|---|---|---|---|---|---|
| Common | 800–1,200 | 600–1,000 | 3,000–5,000 | 300–600 | 500–900 | 4,000–8,000 |
| Uncommon | 2,000–3,500 | 1,800–3,000 | 8,000–14,000 | 900–1,800 | 1,500–2,800 | 12,000–20,000 |
| Rare | 6,000–10,000 | 5,000–9,000 | 25,000–40,000 | 3,000–6,000 | 5,000–9,000 | 35,000–60,000 |

All prices are in DC. Prices roll randomly within range at each 6-hour restock cycle.

---

## APPENDIX I — CAR SERVICE COSTS

| Car Tier | DC Cost | Alternative |
|---|---|---|
| Common | 2,000 DC | 1× Service Token |
| Uncommon | 5,000 DC | 1× Service Token |
| Rare | 10,000 DC | 1× Service Token |
| Epic | 18,000 DC | 1× Service Token |
| Legendary | 30,000 DC | 1× Service Token |

Service Token is sold at District Pharma for 5,000 DC regardless of car tier.

---

---

## TIER 9 — DISTRICTS, PLAYER STATUS & NAVBAR GATING

**Goal: Make the city feel real. Traveling to a district has consequences, rewards, and risks. Player state drives what the NavBar shows and what actions are allowed. Hospitalization and jail are meaningful setbacks, not just flavor.**

---

### 9.1 — Player Status System

Every player has a `status` field that drives NavBar visibility and action gating across the entire game. This is the single source of truth for "what can this player do right now."

**Add to User model:**
```typescript
status: {
  type: String,
  enum: ["normal", "traveling", "abroad", "hospitalized", "jailed"],
  default: "normal"
}
// currentLocation and travelingTo/travelArrivesAt already added in Tier 1.9
hospitalizedUntil:  { type: Date, default: null }   // null = not hospitalized
jailedUntil:        { type: Date, default: null }    // null = not jailed
lastMuggedAt:       { type: Date, default: null }    // cooldown to prevent spam mugging
```

**Status resolution order (auto-check on every authenticated API request):**
```typescript
// Run in auth middleware AFTER verifying JWT, BEFORE route handler
const now = new Date();
let statusChanged = false;

// Auto-release hospital
if (user.status === "hospitalized" && user.hospitalizedUntil && user.hospitalizedUntil <= now) {
  user.status = "normal";
  user.hospitalizedUntil = null;
  statusChanged = true;
}

// Auto-release jail
if (user.status === "jailed" && user.jailedUntil && user.jailedUntil <= now) {
  user.status = "normal";
  user.jailedUntil = null;
  statusChanged = true;
}

// Auto-arrive from travel
if (user.status === "traveling" && user.travelArrivesAt && user.travelArrivesAt <= now) {
  user.status = "abroad";
  user.currentLocation = user.travelingTo;
  user.travelingTo = null;
  user.travelArrivesAt = null;
  statusChanged = true;
}

if (statusChanged) await user.save();
```

Every `/me` response includes `status`, `currentLocation`, `travelArrivesAt`, `hospitalizedUntil`, `jailedUntil` so the frontend always has fresh state.

---

### 9.2 — NavBar Visibility Matrix

The frontend reads `user.status` from the `/me` response and shows or hides NavBar entries accordingly. This is purely a frontend concern — the backend also enforces it with status checks on every endpoint.

| NavBar Item | normal | traveling ✈️ | abroad 🌍 | hospitalized 🏥 | jailed 🔒 |
|---|---|---|---|---|---|
| **City** (home district hub) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Gym** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Crimes** | ✅ | ❌ | ✅ (district crimes) | ❌ | ❌ |
| **Jobs** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Arena** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Racing** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Market** | ✅ | 👁️ view/buy only | ✅ (district shop) | 👁️ view/buy only | ❌ |
| **Auction** | ✅ | 👁️ view/bid only | 👁️ view/bid only | 👁️ view/bid only | ❌ |
| **Royale** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Faction** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Leaderboard** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Chat** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Messages** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Profile** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **District Hub** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Travel** | ✅ | ❌ (in flight) | ✅ (return home) | ❌ | ❌ |

**Implementation — frontend NavBar component:**
Read `user.status` from auth context. For each nav item, apply the matrix. Do not render hidden items at all (no greyed-out entries) — the player should not see what they can't use. Exception: show a small status banner at the top ("✈️ Traveling to The Docks — arrives in 4m 12s" / "🏥 Hospitalized — released in 18m" / "🔒 Jailed — released in 6m") so the player knows why their nav is limited and when it ends.

**Implementation — backend middleware:**
```typescript
// Helper used in every protected route handler
function requireStatus(user, ...allowedStatuses) {
  if (!allowedStatuses.includes(user.status)) {
    throw { status: 403, message: `Action unavailable while ${user.status}` };
  }
}

// Example usage
router.post("/crimes/commit", requireAuth, async (req, res) => {
  requireStatus(req.user, "normal", "abroad");
  // ...
});

router.post("/gym/train", requireAuth, async (req, res) => {
  requireStatus(req.user, "normal");
  // ...
});
```

---

### 9.3 — Districts

DriftLife is a single cyberpunk city divided into **7 districts**. Downtown is the home base — every player starts there and returns there after travel. The other 6 districts can be visited; each has a danger level, a minimum player level to enter, unique shops, and district-specific crime tables.

| # | District | Slug | Min Level | Danger | Flavor |
|---|---|---|---|---|---|
| 1 | **Downtown** | `downtown` | 1 | None (home) | The central hub. Neon towers, all basic services, always safe. |
| 2 | **Neon Strip** | `neon_strip` | 5 | Low | Entertainment district. Clubs, gambling dens, underground pharmacy. |
| 3 | **The Docks** | `docks` | 10 | Medium | Smugglers and import brokers. Things fall off ships here. |
| 4 | **The Slums** | `slums` | 15 | High | Poverty and desperation. Cheap goods, street crime, gang territory. |
| 5 | **Corporate Zone** | `corp_zone` | 20 | Medium | Glass towers and private security. Expensive, clean, dangerous in a different way. |
| 6 | **Industrial Sector** | `industrial` | 25 | High | Factories and workshops. Black market parts, dirty jobs. |
| 7 | **The Outskirts** | `outskirts` | 35 | Very High | City's edge. Lawless. Best loot, worst odds. |

**Danger level effects — mugging and hospitalization risk on arrival:**
When a player arrives (transitions from `traveling` → `abroad`), a danger roll fires once:

```typescript
// Run when status flips to "abroad" in middleware
const DISTRICT_DANGER = {
  neon_strip:  { mugChance: 0.05, hospitalChance: 0.02, mugLossPct: [0.05, 0.10] },
  docks:       { mugChance: 0.10, hospitalChance: 0.05, mugLossPct: [0.08, 0.15] },
  slums:       { mugChance: 0.20, hospitalChance: 0.10, mugLossPct: [0.10, 0.20] },
  corp_zone:   { mugChance: 0.08, hospitalChance: 0.06, mugLossPct: [0.10, 0.18] },
  industrial:  { mugChance: 0.18, hospitalChance: 0.12, mugLossPct: [0.12, 0.22] },
  outskirts:   { mugChance: 0.30, hospitalChance: 0.20, mugLossPct: [0.15, 0.30] },
};

// Mitigation: player's defenseBonus from equipped items reduces both chances
// Every 10 points of defenseBonus = -5% from each chance, capped at -50% reduction

// Roll mugging
if (Math.random() < effectiveMugChance) {
  const lossPct = mugLossPct[0] + Math.random() * (mugLossPct[1] - mugLossPct[0]);
  const cashLost = Math.floor(user.cash * lossPct);
  user.cash -= cashLost;
  // Emit event: "You arrived in [District] and were mugged for $X,XXX DC"
}

// Roll hospitalization (independent of mugging)
if (Math.random() < effectiveHospitalChance) {
  const durationMin = { neon_strip: 5, docks: 10, slums: 15, corp_zone: 12, industrial: 20, outskirts: 30 }[district];
  user.hospitalizedUntil = new Date(Date.now() + durationMin * 60 * 1000);
  user.status = "hospitalized";  // Override the "abroad" we just set
  user.currentLocation = district;  // Still arrived, just in hospital there
  // Emit event: "You were jumped on arrival in [District] and hospitalized for X minutes"
}
```

**Mugging cooldown:** `lastMuggedAt` — if mugged in the last 24h in any district, subsequent mugging chances are halved. Encourages players to plan trips and not spam-travel.

**Level lock:** If player is under the minimum level for a district, the travel endpoint returns 403: "You don't have the rep to survive [District] yet. Come back at level X."

---

### 9.4 — District Shops (What You Can Do While Abroad)

Each district has its own shop with items not available Downtown. This is the main reason to travel — exclusive goods. District shops restock every 8 hours (independent of Downtown NPC stores which restock every 6 hours).

**Neon Strip — Underground Pharmacy**
The strip runs 24/7. Doc Reyes sells from a booth behind the neon signs.

| Item | Price | Effect |
|---|---|---|
| Synthetic Adrenaline | 1,200 DC | +3 Adrenaline instantly |
| Black Market Stim | 2,500 DC | +5 Adrenaline (full refill) |
| Designer Nitro | 1,200 DC | +3 Nitro instantly |
| Euphoria Pill | 800 DC | +15% XP gain for next crime |
| Inhibitor Patch | 600 DC | Prevents hospitalization from next danger roll (1 use, on-player) |

**The Docks — Smuggler's Manifest (Sal the Broker)**
Rotating stock — not all items available every restock. Each restock picks 4 items from the pool below:

| Item | Base Price | Rarity | Notes |
|---|---|---|---|
| Dockside Pistol | 3,000 DC | Uncommon | Functional arena weapon (requires arena loadout to use) |
| Cargo Armor Plates | 4,500 DC | Uncommon | Arena body armor |
| Contraband Stim | 1,800 DC | Common | +3 Adrenaline |
| Imported Nitro Can | 1,800 DC | Common | +3 Nitro |
| Grey Market Parts | 2,000 DC | Uncommon | Car part for Garage repair |
| Dock Pass | 500 DC | Common | One-time item — reduces travel time to Docks by 80% on next trip |

**The Slums — Scrap Market (Reya's Stall)**
Cheap, low-quality. Volume goods.

| Item | Price | Effect |
|---|---|---|
| Street Stim | 400 DC | +1 Adrenaline |
| Scrap Nitro | 400 DC | +1 Nitro |
| Junkyard Part | 800 DC | Car part (low quality — restores 5% car condition only) |
| Dirty Energy Drink | 300 DC | +2 Energy (has 10% chance of hospitalizing for 3 min — labeled with warning) |
| Throwaway Phone | 1,000 DC | Untraceable — next crime failure has 30% less jail time |

**Corporate Zone — Apex Imports (Miriam Chen, Corp Buyer)**
Expensive. Premium items. Security checks — cannot access if carrying contraband (none flagged currently, but criminal record affects price: +5% per past crime this week, up to +25%).

| Item | Price | Effect |
|---|---|---|
| Apex Med Suite | 6,000 DC | Instantly leave hospital (full early release, DC-based) |
| Executive Stim | 4,000 DC | +5 Adrenaline + +5% XP for next 2 arena matches |
| Premium Nitro | 4,000 DC | +5 Nitro + +5% XP for next 2 races |
| Security Implant | 8,000 DC | Permanent −10% mug chance when equipped (uses enhancement slot) |
| Corp Data Chip | 3,000 DC | Consumable — grants 1 Corp espionage job attempt (special high-reward job, abroad only) |

**Industrial Sector — The Workshop (Vik Mends, Mechanic)**
Parts and weapons. He doesn't ask questions.

| Item | Price | Effect |
|---|---|---|
| Reinforced Barrel (Rare) | 12,000 DC | Arena weapon attachment (boosts damage) |
| Titanium Frame (Rare) | 14,000 DC | Arena body armor reinforcement |
| Industrial Fuel Cell | 2,500 DC | +5 Nitro + vehicle travel time −50% for next trip |
| Combat Injector | 2,000 DC | +4 Adrenaline |
| Salvage Kit | 3,000 DC | Repairs arena weapon/armor durability +20 points |

**The Outskirts — Black Veil (Anonymous, shifts every restock)**
The keeper changes. Payment in DC, no receipts, no names.

| Item | Price | Rarity | Notes |
|---|---|---|---|
| Ghost Pistol (Rare) | 18,000 DC | Rare | Top-tier arena pistol |
| Exo Chest Fragment (Rare) | 20,000 DC | Rare | High-tier arena armor |
| Overload Stim | 6,000 DC | Rare | +5 Adrenaline + stun immunity for first round of next match |
| Outskirts Nitro | 5,000 DC | Rare | +5 Nitro + −1 min from next travel |
| Void Key Shard ×5 | 8,000 DC | Rare | Bonus key shards — shortcut toward Master Royale |

**ABSOLUTE RULE:** No Epic or Legendary items appear in ANY district shop. Rare items appear only in The Docks (rotation), Industrial, and Outskirts. Never in Neon Strip or Slums. Corp Zone Rare items are services/consumables only.

---

### 9.5 — District Crimes

While abroad (`status === "abroad"`), the Crimes page shows **district crimes** instead of the home crime list. These are location-flavored variants with different risk/reward profiles scaled to the district danger level.

| District | Crime Name | Energy Cost | DC Reward | Jail Chance | Min Level |
|---|---|---|---|---|---|
| Neon Strip | Pickpocket Tourist | 1 | 300–600 | 5% | 5 |
| Neon Strip | Club Card Skim | 2 | 500–900 | 8% | 8 |
| The Docks | Cargo Diversion | 2 | 600–1,100 | 10% | 10 |
| The Docks | Broker Run | 3 | 900–1,600 | 12% | 12 |
| The Slums | Street Hustle | 1 | 200–400 | 8% | 15 |
| The Slums | Gang Collection | 3 | 800–1,400 | 18% | 18 |
| Corporate Zone | Corp Espionage | 4 | 2,000–3,500 | 15% | 20 |
| Corporate Zone | Insider Trade | 3 | 1,200–2,000 | 12% | 22 |
| Industrial | Chop Shop Run | 3 | 1,000–1,800 | 20% | 25 |
| Industrial | Arms Divert | 4 | 1,500–2,500 | 22% | 28 |
| Outskirts | Territory Raid | 4 | 2,000–3,500 | 25% | 35 |
| Outskirts | Syndicate Hit | 5 | 3,000–5,000 | 30% | 40 |

**Jail while abroad:** If a player is jailed during a district crime, they are jailed in that district. `currentLocation` stays set to the district. They cannot travel home until jail time expires. This adds real stakes — a bad roll in the Outskirts jails you far from home.

**District crimes use the same crime failure/success logic as home crimes.** The nerve/timing mechanic if present applies. The difference is just the crime table (name, cost, reward, jail chance) and the location requirement.

---

### 9.6 — Hospitalized State

When hospitalized, `user.status = "hospitalized"` and `user.hospitalizedUntil` is set.

**How you get hospitalized:**
1. Danger roll on district arrival (see 9.3)
2. Arena combat — if HP drops to 0 in an arena match, hospitalized for a duration based on damage taken
3. Dirty Energy Drink (Slums item) — 10% chance

**Hospital duration by source:**

| Source | Duration |
|---|---|
| Neon Strip danger roll | 5–10 min |
| Docks danger roll | 10–20 min |
| Slums danger roll | 15–30 min |
| Corp Zone danger roll | 12–25 min |
| Industrial danger roll | 20–40 min |
| Outskirts danger roll | 30–60 min |
| Arena combat KO (low damage) | 5–15 min |
| Arena combat KO (high damage) | 15–45 min |
| Dirty Energy Drink | 3–5 min |

**Early release options:**
- **Apex Med Suite** (Corp Zone item) — instant release, no timer
- **Pay DC to leave early** — costs `floor(minutesRemaining × 50)` DC. Button on Hospital page. Atomic — deducts DC and clears hospital status in single update.
- **Revive by another player** — other players can visit your profile and spend 200 DC to reduce your hospital time by 50%. They get +10 XP for doing it. Max 2 revives per hospital stay.

**What you can do while hospitalized:**
- ✅ Chat
- ✅ Messages
- ✅ View profile (your own and others)
- ✅ Leaderboard
- ✅ Market — view listings and buy (delivery when you're out)
- ✅ Auction — view and bid
- ✅ Pay to leave early (Hospital page always accessible)
- ❌ Everything else

**Hospital page** (always visible in status banner → click it):
Shows: "You were hospitalized in [District]. Released in X min Y sec." + two action buttons: "Pay [X DC] to Leave Now" and "Back to game" (which just dismisses the modal — they're still hospitalized).

---

### 9.7 — Jailed State

When jailed, `user.status = "jailed"` and `user.jailedUntil` is set.

**How you get jailed:**
1. Crime failure (home or district crimes)
2. Caught cheating in a race (anti-cheat system from Tier 5)

**Jail duration:**
- Home crimes: existing logic (based on crime tier)
- District crimes: same formula, but multiplied by district danger factor
  - Neon Strip: ×1.0 (same as home)
  - Docks: ×1.2
  - Slums: ×1.3
  - Corp Zone: ×1.1 (corporate security is efficient — processes you fast)
  - Industrial: ×1.4
  - Outskirts: ×1.6

**Early release options:**
- **Pay bail:** costs `floor(minutesRemaining × 80)` DC. Button on Jail page. Atomic update.
- **Bail by another player:** another player can pay your bail cost on your behalf (they pay DC from their wallet, you go free). Button on the jailed player's profile: "Post Bail (X DC)". Atomic.
- **Throwaway Phone item** (Slums shop): reduces all subsequent jail durations by 30% for this crime session only — must be in inventory BEFORE crime is committed.

**What you can do while jailed:**
- ✅ Chat
- ✅ Messages
- ✅ View profile
- ✅ Leaderboard
- ✅ Pay bail (Jail page)
- ❌ Everything else (including market — you're in a cell)

**Jail page** (always visible in status banner → click it):
Shows: "You are jailed in [District/Downtown]. Released in X min Y sec." + "Pay Bail [X DC]" button. No market access unlike hospital — you are in a cell, not a waiting room.

---

### 9.8 — Returning Home

While abroad (`status === "abroad"`), the Travel page shows a single option: **"Return to Downtown"**. Travel time home uses the same vehicle-based formula (Section 1.9) but always routes to `downtown`.

While traveling home, `status = "traveling"` again. NavBar restricts the same way. On arrival, status returns to `"normal"` and `currentLocation = "downtown"`.

**Note:** If the player was hospitalized in a foreign district and pays to leave early (or waits it out), they are then `abroad` in that district — they still need to choose to travel home. Being released from hospital does not teleport them home.

---

### 9.9 — Status Banner (Frontend, Always Visible)

A persistent banner appears at the top of the app (below the NavBar) whenever the player is NOT in `normal` status. It replaces the energy/adrenaline/nitro HUD for that slot but keeps the rest.

**Traveling:**
```
✈️  Traveling to [District Name]  —  Arrives in 4m 32s  [Cancel] (costs nothing, returns home, adds same travel time back)
```

**Abroad:**
```
🌍  You are in [District Name]  —  [Return to Downtown]
```

**Hospitalized:**
```
🏥  Hospitalized in [District Name]  —  Released in 18m 05s  [Pay 900 DC to leave now]
```

**Jailed:**
```
🔒  Jailed in [District Name]  —  Released in 6m 42s  [Pay Bail — 536 DC]
```

The timer counts down in real time (JS interval, re-fetches status from `/me` every 30s to auto-advance state). When the timer hits 0, the banner refreshes automatically and NavBar re-expands.

---

### 9.10 — Travel Hub Page (Frontend)

A dedicated **Travel page** replaces the old travel mechanic (if any existed). Accessible from NavBar when `status === "normal"` or `status === "abroad"`.

**Layout:**
- Hero: city skyline illustration with 7 district cards laid out like a map
- Each card shows:
  - District name + slug
  - Danger rating (colored badge: Safe / Low / Medium / High / Very High)
  - Min level requirement (greyed and locked if player is below it)
  - Estimated travel time based on current equipped vehicle
  - "TRAVEL" button (or "LOCKED — Level X Required")
  - Brief flavor description of what's there (one sentence)
- Below the card grid: player's current equipped vehicle name + "Travel Time Reduction: X%"

**Abroad state — same page, different view:**
When `status === "abroad"`, the Travel page shows the **Return Home** card only (one large card with the countdown estimate and a "Return to Downtown" button). District cards are hidden — cannot district-hop directly, must go home first.

**District Hub (while abroad):**
When `status === "abroad"`, a **District Hub** NavBar entry appears. This page shows:
- District name, banner, and lore text (3–4 sentences of cyberpunk flavor)
- The district shop with inventory and buy buttons
- The district crime list (buttons to commit each crime)
- A "Danger Level" reminder card showing current mug/hospital risk

---

### 9.11 — Implementation Checklist

**Backend:**
- [ ] Add `status`, `hospitalizedUntil`, `jailedUntil`, `lastMuggedAt` to User model
- [ ] Auth middleware: auto-resolve status on every request (see 9.1 logic)
- [ ] `POST /user/travel` — validate level, validate status is `normal` or `abroad`+`downtown`, set `traveling` state
- [ ] `GET /district/:slug/shop` — return district shop inventory, enforce `status === "abroad"` + `currentLocation === slug`
- [ ] `POST /district/:slug/shop/buy` — purchase item, enforce same location check
- [ ] `GET /district/:slug/crimes` — return district crime table
- [ ] `POST /district/:slug/crimes/commit` — commit crime, enforce location, handle jail/success
- [ ] Danger roll fires in middleware when `traveling` → `abroad` transition occurs
- [ ] `POST /hospital/leave` — pay DC, clear hospital status atomically
- [ ] `POST /jail/bail` — pay DC bail, clear jail status atomically
- [ ] `POST /player/:id/revive` — pay 200 DC, reduce target's hospital time by 50%
- [ ] `POST /player/:id/bail` — pay target's bail DC from own wallet, clear their jail

**Frontend:**
- [ ] Status banner component (always rendered, content switches by status)
- [ ] NavBar visibility logic reads `user.status` from auth context
- [ ] Travel Hub page with district cards
- [ ] District Hub page (renders when `status === "abroad"`)
- [ ] Hospital page (accessible via banner)
- [ ] Jail page (accessible via banner)
- [ ] Real-time countdown timer component (reusable — used in banner and both status pages)

---

---

## TIER 10 — SYSTEM FEED, NOTIFICATIONS, FACTIONS, SOCIAL & ECONOMY DEPTH

**Goal: Make the world feel alive. The System Feed broadcasts city-wide events automatically. Notifications tell players what matters to them personally. Factions have real purpose. Inventory, profiles, and leaderboards have real depth. New items and economy loops fill the gaps.**

---

### 10.1 — System Feed

The System Feed is a public, city-wide activity board. It is NOT a notification panel and NOT a social media wall. Players do not post to it. There are no player self-posts. The system posts automatically based on game events. Think of it as a cyberpunk news ticker for the city — the streets always know what's happening.

**Feed lives at:** `/feed` — accessible to all logged-in players regardless of status (even hospitalized/jailed). Always in the NavBar.

**Visual design:** Dark terminal-style card list. Each post has:
- A system avatar (city crest icon, not a player avatar)
- A tag badge showing which district the event originated from (or `🌐 CITYWIDE` for global events)
- The message with `@username` highlighted in neon color (clickable — links to that player's profile)
- A timestamp ("2 minutes ago", "yesterday", etc.)

**Posts are read-only.** Players cannot reply, react, like, or comment on feed posts. It is a broadcast channel, not a forum.

**Feed types and their triggers:**

#### District Events (auto-posted when they happen)
```
[THE DOCKS] @PlayerName arrived in The Docks and was mugged for 1,200 DC.
[THE SLUMS] @PlayerName was hospitalized in The Slums. Duration: 24 minutes.
[OUTSKIRTS] @PlayerName committed a Territory Raid in The Outskirts.
[CORP ZONE] @PlayerName was jailed in Corporate Zone. Time: 18 minutes.
[NEON STRIP] @PlayerName arrived safely in Neon Strip.
```
Only post arrivals for districts with danger level Medium or higher. Downtown arrivals are silent (too common, no drama).

#### Arena Events (auto-posted on win-streak milestones ONLY)
```
[⚔️ ARENA] Wow, Hero @PlayerName has a 5 win streak in the Arena! :swordclash:
[⚔️ ARENA] @PlayerName is unstoppable — 10 win streak in the Arena! The city takes notice. :neonskull:
[⚔️ ARENA] Legends only: @PlayerName just hit a 20 win streak in the Arena. Nobody can touch them. :goldtrophy:
```
Do NOT post individual match results, wins, losses, or item destruction — that is personal noise, not city news. Post ONLY win-streak milestones, at 5, 10, 20, 50 wins. Tone escalates with the milestone: 5 = fun/celebratory, 10 = dramatic, 20+ = incredulous about the dominance. Keep messages short, playful, and cyberpunk in voice — never dry stat dumps.

#### Race Events (auto-posted on win-streak milestones ONLY)
```
[🏁 RACING] Wow, Hero @PlayerName has a 5 win streak in Racing! :driftcar:
[🏁 RACING] @PlayerName is on fire — 10 win streak in Racing! :nitroflame:
[🏁 RACING] Absolute legend: @PlayerName just hit a 20 win streak in Racing. The streets are talking. :goldtrophy:
```
Do NOT post individual race wins, crashes, or car-condition events — personal, not city-worthy. Post ONLY win-streak milestones, at 5, 10, 20, 50 wins, with the same escalating playful tone as Arena.

#### Crime Events (auto-posted on notable crimes only)
```
[🔫 CRIMES] @PlayerName pulled off a Syndicate Hit in The Outskirts — earned 4,800 DC.
[🔫 CRIMES] @PlayerName was caught committing Corporate Espionage in Corp Zone.
```
Do NOT post every crime — only the highest-tier crimes per district (the top 2 crime types from the district crime table in 9.5). Home crimes: only post the highest-tier home crimes (e.g. "Bank Heist" tier). This keeps the feed signal-to-noise high.

#### Market & Auction Events (auto-posted when a NEW auction opens, not on completion)
```
[💰 AUCTION] New auction available — check it out at /auction :jackpot:
[💰 AUCTION] A Legendary Ghost Sniper just hit the block. Rare pulls like this don't last — /auction :cashspill:
[💰 MARKET] @PlayerName listed a Rare Reinforced Barrel on the market for 15,000 DC.
```
Post when a new Epic/Legendary auction is LISTED (creates urgency to check it out), not when it closes/sells — closing a sale is not exciting to a bystander, but a fresh rare listing is. Always include the `/auction` location link. Post regular market listings only for Rare+ items (no Common/Uncommon spam).

#### Feed & Chat Formatting Conventions (applies everywhere feed/chat text is rendered)

There are exactly two live-link formats in any system-generated or player-sent text:

- **`@username`** — a player mention. Always clickable, links to that player's profile. Rendered in the neon "mention" highlight color.
- **`/path`** — a location or page link (e.g. `/auction`, `/arena`, `/feed`, `/district/docks`). Always clickable, links to that in-app route. Rendered in a distinct "link" color, visually different from the `@` mention color, so players can tell "who" from "where" at a glance.

The feed/chat renderer must parse both patterns with a regex/tokenizer and turn each into a clickable element; everything else renders as plain text. This convention applies to system feed posts, notifications, and player chat messages alike — it must be implemented once in a shared renderer, not duplicated per surface.

#### Royale Events (auto-posted on big wins)
```
[🎰 ROYALE] @PlayerName pulled a Legendary Void Sniper from the Outskirts Master Royale!
[🎰 ROYALE] @PlayerName scored a Rare Exo-Armor from the Body Armor Master Royale.
```
Post only Epic and Legendary pulls. Common/Uncommon/Rare from DC Spin = silent.

#### Prestige Events (auto-posted immediately)
```
[🏆 PRESTIGE] @PlayerName reached Prestige 1! The city takes notice.
[🏆 PRESTIGE] @PlayerName reached Prestige 3! A legend walks among us.
```
Post every prestige milestone.

#### Weekly Leaderboard Post (auto-posted every Monday at 00:00 UTC)
```
[🌐 CITYWIDE — WEEKLY RECAP]

🏆 Top Earners (DC gained this week):
1. @PlayerName — 4,820,000 DC
2. @PlayerName2 — 3,110,000 DC
3. @PlayerName3 — 2,940,000 DC

⚔️ Top Arena Fighters:
1. @PlayerName — 47 wins (W/L: 47/12)
2. @PlayerName2 — 38 wins
3. @PlayerName3 — 34 wins

🏁 Top Racers:
1. @PlayerName — 29 wins
2. @PlayerName2 — 22 wins
3. @PlayerName3 — 19 wins

🔫 Top Criminals:
1. @PlayerName — 312 successful crimes
2. @PlayerName2 — 287 successful crimes
3. @PlayerName3 — 241 successful crimes

Congratulations to all. The city is watching.
```
This single weekly post tags all 12 top players with their `@username` (clickable to profile). It is pinned at the top of the feed for 24 hours after posting before falling into the normal chronological order.

#### Future: Game Update Posts (manual trigger, system-authored)
A special admin-only endpoint `POST /system/feed` allows the owner/admin to post a system announcement. These look identical to other system posts but have a `[📡 SYSTEM UPDATE]` badge. Content is free-text set in the request body. This is not automated yet — it is manually triggered by an admin when ready. The infrastructure must be in place from day one.

**Backend — System Feed model:**
```typescript
// SystemFeedPost schema
{
  category: String,          // "district" | "arena" | "race" | "crime" | "market" | "auction" | "royale" | "prestige" | "leaderboard" | "system"
  district: String,          // null for global posts
  message: String,           // rendered text with @username and /path placeholders, may include :emojiSlug: shortcodes
  mentionedUsers: [{ userId, username }],  // for @ linking
  links: [String],           // extracted /path links for the renderer, e.g. ["/auction"]
  pinned: Boolean,           // true only for weekly recap, 24hr
  createdAt: Date
}
```

**Backend — Feed API:**
- `GET /feed?page=1&limit=30` — paginated, newest first, pinned posts always at top
- `POST /system/feed` — owner/admin only, manual system announcement

**Feed post helper (internal, not an API):**
```typescript
// lib/systemFeed.ts
export async function postToFeed(category, message, mentionedUsers = [], district = null) {
  await SystemFeedPost.create({ category, district, message, mentionedUsers, pinned: false });
}
```
Call this helper from every relevant route handler at the moment the event occurs (arena/race win-streak milestone reached, notable crime resolution, new auction listed, royale Epic/Legendary pull, prestige reached, weekly recap cron). Arena/race handlers must NOT call this on every match — only when a streak counter crosses a milestone threshold.

**Custom Game Emojis:** feed messages and chat may reference emoji shortcodes like `:driftcar:` or `:goldtrospy:` — see 10.1a below for the full set and how the renderer resolves them.

**Feed retention:** Keep last 500 posts. A scheduled cleanup job deletes posts older than 30 days if total count > 500. Weekly recap posts are exempt from the 30-day rule — keep the last 8 weekly recaps (2 months).

---

### 10.1a — Custom Game Emojis

DriftLife ships its own animated emoji set, themed around the game's systems, for use in global chat, faction chat, and system feed posts. These are NOT static Unicode emoji — each one is a short looping animation (spinning wheels, flickering flames, pulsing glows) so the chat and feed feel alive.

**Each emoji has:**
- `slug` — unique ID used as the shortcode, e.g. `driftcar`
- `file` — animated asset (looping WebM/GIF/Lottie — pick one format and use it consistently across the set)
- `displayName` — human-readable label shown on hover/in the picker, e.g. "Drift Car"
- `shortcode` — the chat-typed form, always `:slug:`, e.g. `:driftcar:`

**Emoji set (initial 16, themed to existing game systems):**

| Slug | Shortcode | Display Name | Animation | Theme |
|---|---|---|---|---|
| `driftcar` | `:driftcar:` | Drift Car | Spinning wheels, drifting motion | Racing |
| `swordclash` | `:swordclash:` | Sword Clash | Two blades clashing with a spark flash | Arena |
| `stimshot` | `:stimshot:` | Stim Shot | Glowing syringe pulsing | Crimes/Buffs |
| `nitroflame` | `:nitroflame:` | Nitro Flame | Flickering blue-white nitro flame | Racing |
| `voltbolt` | `:voltbolt:` | Volt Bolt | Pulsing energy bolt arcing | Arena effects |
| `neonskull` | `:neonskull:` | Neon Skull | Glowing skull, slow pulse | Danger/Streaks |
| `goldtrophy` | `:goldtrophy:` | Gold Trophy | Shine sweep across a trophy | Achievements |
| `cashspill` | `:cashspill:` | Cash Spill | Money bag spilling bills | Market/Economy |
| `jackpot` | `:jackpot:` | Jackpot | Spinning slot machine reels | Royale/Auction |
| `smokepistol` | `:smokepistol:` | Smoke Pistol | Pistol firing with a smoke trail | Crimes/Arena |
| `barriershield` | `:barriershield:` | Barrier Shield | Energy shield rippling on impact | Arena effects |
| `neoncity` | `:neoncity:` | Neon City | Neon-lit skyline with flickering lights | Districts |
| `chainlock` | `:chainlock:` | Chain Lock | Chains rattling on a lock | Jail/Crimes |
| `medcross` | `:medcross:` | Med Cross | Hospital cross pulsing red | Hospital |
| `cybereye` | `:cybereye:` | Cyber Eye | Blinking cybernetic eye | Faction/Syndicate |
| `botscan` | `:botscan:` | Bot Scan | Scanning beam sweeping left-right | Security/NPC |

**Backend — GameEmoji model:**
```typescript
// GameEmoji schema
{
  slug: String,        // unique, e.g. "driftcar"
  displayName: String, // "Drift Car"
  file: String,         // asset path/URL
  theme: String,        // "racing" | "arena" | "market" | "districts" | "crimes" | "achievements" | "faction"
}
```
Seed all 16 at launch. `GET /emojis` returns the full catalog for the chat emoji picker.

**Rendering:** the same shared renderer that resolves `@username` mentions and `/path` links (see the Formatting Conventions above) also scans for `:slug:` shortcodes and swaps them for the animated asset. Unknown shortcodes render as plain text (no broken-image fallback). This renderer must be shared across chat, faction chat, and the system feed — not reimplemented per surface.

**Chat picker:** an emoji button in the chat input opens a grid of all 16 (grouped by theme), clicking one inserts its `:slug:` shortcode at the cursor.

---

### 10.2 — Player Notifications (Personal, Separate from Feed)

The Feed is public and broadcast. Notifications are private and personal. A player's notification panel shows only things that happened TO them or ABOUT them — not city-wide events.

**Notification bell icon in NavBar** — shows unread count badge (red dot when > 0).

**Notification types:**

| Event | Message |
|---|---|
| Item sold on market | "Your Rare Titanium Frame sold for 14,500 DC (after 5% commission: 13,775 DC)" |
| Outbid on auction | "@PlayerName outbid you on Ghost Pistol. Your 45,000 DC was refunded." |
| Auction won | "You won the Ghost Pistol auction for 52,000 DC." |
| Arena match found | "A match was found! Your opponent is ready." |
| Arena match result | "You defeated @PlayerName. +220 XP, +250 DC, +1 Key Shard." |
| Hospitalized (external) | "You were hospitalized in The Slums. Released in 22 minutes." |
| Mugged | "You were mugged arriving in The Docks. Lost 1,400 DC." |
| Bailed out | "@PlayerName paid your bail of 640 DC. You are free." |
| Revived | "@PlayerName revived you. Hospital time reduced by 50%." |
| Daily login reward | "Day 7 streak! You received 1,500 DC + 1 Street Medkit." |
| Prestige unlocked | "You can now prestige! Visit your profile to begin." |
| Item destroyed | "Your Common Street Vest was destroyed in a match." |

**Backend — Notification model:**
```typescript
{
  userId: ObjectId,
  type: String,
  message: String,
  read: Boolean,   // default false
  createdAt: Date
}
```

**Notification API:**
- `GET /notifications?limit=30` — returns unread first, then read, newest first
- `POST /notifications/read-all` — marks all as read
- `POST /notifications/:id/read` — marks one as read

**Notification helper (internal):**
```typescript
// lib/notify.ts
export async function notify(userId, type, message) {
  await Notification.create({ userId, type, message, read: false });
}
```
Call from relevant route handlers alongside `postToFeed`. They are separate concerns — an arena match result posts to the public feed AND sends a private notification to both players.

**Retention:** Keep last 100 notifications per player. Delete oldest when over limit.

---

### 10.3 — Daily Login Reward (Streak System)

**Add to User model:**
```typescript
loginStreak:     { type: Number, default: 0 }
lastLoginDate:   { type: Date, default: null }   // date only, not datetime
```

**Logic (runs on login or on first authenticated request of the day):**
```typescript
const today = new Date().toDateString();
const lastDate = user.lastLoginDate?.toDateString();

if (lastDate !== today) {
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  user.loginStreak = (lastDate === yesterday) ? user.loginStreak + 1 : 1;
  user.lastLoginDate = new Date();
  await grantLoginReward(user);
  await user.save();
}
```

**Reward table:**

| Streak Day | Reward |
|---|---|
| Day 1 | +3 Key Shards |
| Day 2 | +500 DC |
| Day 3 | +3 Key Shards + 1 Street Medkit |
| Day 4 | +800 DC |
| Day 5 | +3 Key Shards + 1 Adrenaline Vial |
| Day 6 | +1,000 DC + 1 Nitro Can |
| Day 7 | +1,500 DC + 1 Rare consumable (random: Stim Shot / Combat Stim / Fuel Pack) |
| Day 14 | +3,000 DC + 3 Key Shards |
| Day 30 | +1 Key (full, bypasses shards) + 5,000 DC |

After day 30, the cycle resets to Day 1 (streak counter keeps climbing but rewards loop from Day 1 again). Missing a day resets streak to 1.

**Frontend:** A login reward modal pops on the first load of the day showing what was granted, the streak number, and a preview of the next day's reward.

---

### 10.4 — Player Inventory Page (Full Spec)

A dedicated `/inventory` page accessible from NavBar and profile.

**Layout:**
- Filter tabs: All | City Items | Arena Weapons | Arena Armor | Arena Consumables | Ammo | Consumables | Cars
- Each item card shows:
  - Item name + rarity badge (color coded: grey/green/blue/purple/gold)
  - Item image (ItemImage component — PNG first, fallback to icon)
  - Durability bar (for arena items only — green → yellow → red → destroyed)
  - Current equip status badge ("EQUIPPED" if in active slot)
  - Quantity badge for stackable items (ammo, consumables)
- Action buttons on each card:
  - **Equip** (if equippable and slot available)
  - **Unequip** (if equipped)
  - **Quick Sell** (converts to 60% of base shop price instantly — no listing, no commission, instant DC. Confirmation modal with amount shown before confirm.)
  - **List on Market** (opens the market listing flow inline)
- Bulk actions: select multiple → Quick Sell All Selected

**Sorting:** By rarity (highest first by default), by name, by durability, by value.

**Arena items at 0 durability** show a "DESTROYED" badge and cannot be equipped or sold — they are display-only until the player manually clicks "Discard" to remove them from inventory.

---

### 10.5 — Crime Cooldowns & History

**Crime cooldown:** Each crime has an individual cooldown timer. After committing a crime, that crime is locked for a set duration shown as a countdown on the button.

| Crime Tier | Cooldown |
|---|---|
| Street-level (low reward) | 5 min |
| Mid-tier | 10 min |
| High-tier | 20 min |
| Top-tier (Syndicate Hit, Bank Job) | 45 min |

District crimes use the same tier-based cooldown as their equivalent home crime tier.

**Add to User model:**
```typescript
crimeCooldowns: {
  type: Map,
  of: Date,   // crimeId → cooldownExpiresAt
  default: {}
}
```

**Crime History panel** (on the Crimes page, below the crime list — collapsible):
Shows last 15 crime attempts in reverse chronological order:

```
✅ Syndicate Hit — +4,200 DC (+12 XP) — 3 min ago
❌ Territory Raid — CAUGHT — Jailed 14 min — 22 min ago
✅ Street Hustle — +310 DC (+3 XP) — 35 min ago
```

This data is computed from the existing crime log (if one exists) or a new `CrimeLog` model:
```typescript
{
  userId: ObjectId,
  crimeId: String,
  district: String,
  outcome: "success" | "jailed",
  dcEarned: Number,
  xpEarned: Number,
  jailDuration: Number,   // minutes, 0 on success
  createdAt: Date
}
```
Keep last 100 entries per player. Used for history display and potentially for crime stats on profiles.

---

### 10.6 — Chat System Polish

**District Channels:**
When a player is abroad (`status === "abroad"`), they are automatically joined to a `#district-[slug]` chat channel (e.g. `#district-docks`). They can still see and post to Global chat. When they return home, they leave the district channel.

Chat channel list (always visible as tabs on the Chat page):
- `#global` — always joined, never left
- `#faction-[slug]` — joined if player is in a faction
- `#district-[slug]` — joined only while abroad in that district

**Global chat toggle:** A mute button on the Global tab silences global chat notifications without leaving the channel. Channel tabs show unread dot when muted and new messages arrive.

**Chat message reporting:** Right-click (or long-press mobile) any message → "Report message". Sends the message ID and reporter's userId to a `ChatReport` model for staff review. No visible feedback beyond "Report submitted." Staff can view reports in admin panel.

**Chat muting:** Players can mute other players. Muted player's messages are hidden from the muting player's view only. Not a ban — the muted player is unaware. Stored as an array on the User model: `mutedUsers: [ObjectId]`.

---

### 10.7 — Player Profile Page — Full Depth

The profile page should tell the story of a player at a glance.

**Sections:**

**Header:**
- Username + prestige badge (animated if prestige ≥ 1)
- Active frame (from frame system)
- Faction name + rank badge
- Status indicator ("In Downtown" / "Traveling" / "Abroad in Docks" / "Hospitalized" / "Jailed")
- Up to 3 achievement badges displayed (player-selected from earned achievements)

**Stats block:**
- Level + XP bar to next level
- DC balance (shown only on own profile)
- Prestige level
- Total play time (calculated from account creation — rough estimate)

**Combat record:**
- Arena: W / L / Win Rate %
- Best win streak
- Arena matches played total

**Racing record:**
- Race wins / losses / Win Rate %
- Fastest race time (personal best)

**Crime record:**
- Total successful crimes
- Total times jailed
- Favorite crime (most committed)
- Crime success rate %

**District log (last 5 districts visited):**
```
The Outskirts — 2 hours ago
The Docks — yesterday
Neon Strip — 3 days ago
```

**Recent activity (last 8 public events — pulled from SystemFeed where mentionedUsers includes this player):**
```
⚔️ Defeated @OpponentName in the Arena — 1h ago
🏁 Won a race — 3h ago
🌍 Arrived in The Slums — 5h ago
🔫 Committed Territory Raid in Outskirts — 6h ago
```

**Achievements panel:** Scrollable list of earned achievements with icons. Locked achievements shown as greyed-out silhouettes with "???" name until earned.

---

### 10.8 — Leaderboard Categories

Replace the single leaderboard with tabbed categories. Each tab shows top 50 players.

| Tab | Metric | Resets |
|---|---|---|
| 💰 Wealth | Current DC balance | Never |
| 📈 Level | Current level | Never |
| ⚔️ Arena | All-time arena wins | Never |
| 🏁 Racing | All-time race wins | Never |
| 🔫 Crimes | All-time successful crimes | Never |
| 📅 Weekly DC | DC earned this week | Monday 00:00 UTC |
| 📅 Weekly Arena | Arena wins this week | Monday 00:00 UTC |
| 📅 Weekly Races | Race wins this week | Monday 00:00 UTC |
| 🏆 Prestige | Prestige level | Never |

Weekly leaderboards reset every Monday. Historical weekly winners are NOT stored (the weekly recap in the System Feed acts as the permanent record).

Player's own rank shown at the bottom of each leaderboard tab even if they are outside top 50: "You are ranked #412 in this category."

---

### 10.9 — NPC Random City Encounters

Once per login session (tracked by a session flag, not a DB field — just set on the auth token or in-memory per request), when the player performs any city action (crime, gym, job, travel), there is a small chance of a city encounter firing. Probability: **3% per action**, max **1 encounter per 2 hours** per player (use a `lastEncounterAt` Date field on User).

**Add to User model:**
```typescript
lastEncounterAt: { type: Date, default: null }
```

**Encounter pool (pick one at random when triggered):**

| Encounter | Effect | Message |
|---|---|---|
| Found a wallet | +150–400 DC | "You spotted a wallet in the gutter. Nobody's watching. You pocket 280 DC." |
| Stranger's gift | +1 random Common consumable | "A hooded figure presses a package into your hands and disappears into the crowd." |
| Syndicate shake | −200–500 DC OR 15min hospital if declined | "A syndicate enforcer steps in your path. 'Toll.' Pay 350 DC or walk into a wall." |
| Free energy | +2 Energy | "A vendor hands you a sample can. It tastes like battery acid. You feel great." |
| Adrenaline find | +1 Adrenaline | "You find an unmarked vial tucked under a bench. Your pulse quickens." |
| Nitro find | +1 Nitro | "A garage door hangs open. An unattended canister catches your eye." |
| Key Shard find | +1 Key Shard | "Something glints in the drain. A shard — circuit-etched, still warm." |
| Pickpocket attempt | −100–300 DC (50% chance, based on streetCredBonus) | "Something felt off. You check your pockets. Someone got there first." |
| Nothing | — | *(silent — no event)* |

Encounters post to the System Feed only for the most dramatic ones (Syndicate shake, if player chose to fight back and was hospitalized). Personal encounters (found wallet, gifts) are private notifications only — not in the public feed.

---

### 10.10 — Faction System (Full Depth)

Factions are referenced throughout but were never fully specced. This section completes them.

**Faction basics (what may already exist — confirm before editing):**
- Faction name, tag, description, owner
- Members with roles (Owner, Officer, Member)
- Faction chat channel

**What factions need that doesn't exist yet:**

**Faction Bank:**
```typescript
// Add to Faction model
bankBalance: { type: Number, default: 0 }
```
- Members can deposit DC into the faction bank
- Only Owner and Officers can withdraw
- Transactions logged: `FactionBankLog` model (who, amount, deposit/withdraw, timestamp)
- `POST /faction/bank/deposit` — deducts from player, adds to faction bank
- `POST /faction/bank/withdraw` — Officer+ only, adds to player, deducts from bank

**Faction Perks (passive bonuses to all members while active):**
Perks are purchased by the faction (from the faction bank) and apply globally to all members.

| Perk | Effect | Cost (faction bank) |
|---|---|---|
| Street Network | +5% crime success rate for all members | 50,000 DC |
| Combat Training | +5% arena XP for all members | 50,000 DC |
| Turf Logistics | −10% travel time for all members | 75,000 DC |
| Black Market Access | Members see 2 extra items in Docks rotation | 100,000 DC |
| Energy Racket | +1 max Energy for all members (permanent while perk active) | 150,000 DC |

Perks last 7 days. After expiry they must be repurchased. Perk state stored on the Faction model as `activePerks: [{ perkId, expiresAt }]`.

**Faction Territory (District Control):**
Each non-Downtown district can be "claimed" by a faction. Claiming gives the faction a weekly DC payout from that district's activity (a percentage of all crimes/market activity in that district flows into the faction bank).

Control mechanic: Factions "raid" a district by committing a top-tier crime there (e.g. Territory Raid or Syndicate Hit). Successful raids by faction members accumulate "influence points" in that district. At weekly reset, the faction with the most influence points in a district claims it.

Benefits of controlling a district:
- Members get −10% danger roll in that district
- 2% of all DC earned by any player in that district flows to the controlling faction bank (capped at 10,000 DC/week per district)
- Controlling faction name shown on that district card on the Travel Hub

**District control displayed on Travel Hub** — each district card shows "Controlled by: [Faction Tag]" or "Contested" if top 2 factions are within 10% influence of each other.

---

### 10.11 — In-Arena Taunts

During a live arena match (while waiting for the next turn or after round resolution), a player can send a taunt to their opponent. Taunts are preset — no free text.

**Taunt list (cyberpunk-themed):**

| ID | Taunt |
|---|---|
| `t1` | "You fight like a stock firmware." |
| `t2` | "Is that all your augments can do?" |
| `t3` | "I've seen better aim from a blind drone." |
| `t4` | "Your armor is decorative at this point." |
| `t5` | "GG. Almost." |
| `t6` | "I can do this all day. Can you?" |
| `t7` | "Run diagnostics. You're losing." |
| `t8` | "👁️" *(just the eye — maximum disrespect)* |

**Mechanic:** One taunt per round. Taunts have zero gameplay effect — purely cosmetic. They appear in the match chat/log panel between rounds. Opponent sees it in real time. Both players see a log of all taunts sent this match in the match result screen.

**Backend:** `POST /arena/match/:id/taunt` — body `{ tauntId }`. Validates taunt ID is in the allowed list. Stores on the match document: `taunts: [{ senderId, tauntId, round, sentAt }]`. Rate-limited to 1 per round per player.

---

### 10.12 — Trading System (Player-to-Player Direct Trade)

Players can offer a direct trade: items + DC offered in exchange for items + DC requested. No commission, anonymous sellers not supported (both parties must accept).

**Trade flow:**
1. Player A visits Player B's profile → "Offer Trade"
2. Trade offer modal: Player A selects items from their inventory + optional DC amount to send. Player A can also request specific items from Player B's known inventory (publicly visible item types, not full details).
3. Offer sent → Player B receives a notification: "@PlayerA wants to trade. View offer."
4. Player B opens the trade: sees what A is offering and what A is requesting. B can accept, decline, or counter (modifying the offer terms).
5. On acceptance: atomic swap — items and DC transfer simultaneously. If either party's inventory changed between offer and acceptance (item was sold/used), trade fails cleanly with an error to both parties.
6. Trade completed → both parties notified, SystemFeed post only if Rare+ items involved.

**Trade expiry:** Offers expire after 24 hours if not accepted/declined.

**Backend models:**
```typescript
// TradeOffer schema
{
  fromUserId: ObjectId,
  toUserId: ObjectId,
  offerItems: [{ inventoryItemId, quantity }],  // what A sends
  offerDc: Number,
  requestItems: [{ itemTemplateId, quantity }],  // what A wants (non-binding reference)
  requestDc: Number,
  status: "pending" | "accepted" | "declined" | "expired" | "countered",
  counterOffer: { ... },   // recursive structure for counter
  expiresAt: Date,
  createdAt: Date
}
```

**Endpoints:**
- `POST /trade/offer` — create offer
- `GET /trade/offers` — list incoming and outgoing offers
- `POST /trade/:id/accept` — atomic swap
- `POST /trade/:id/decline`
- `POST /trade/:id/counter` — modifies terms, status → "countered", notification to original sender

---

### 10.13 — Black Market (Hidden Market Tab)

A hidden market tab, unlocked at level 20+. Players do not see it in the NavBar until they reach level 20. After unlocking, it appears as "◼ Black Market" in a subtle style distinct from the main Market.

**Rules:**
- No 5% commission (seller keeps 100%)
- Seller is anonymous — listings show "Anonymous Seller" not the player's name
- 48hr expiry same as normal market
- Risk: each listing has a **5% chance per 6 hours of being "seized"** — the item is deleted and the seller receives nothing. This is the cost of anonymity. Shown clearly as a warning before listing.
- Buyer is also anonymous — seller never knows who bought it
- No Epic/Legendary rule still applies to listings (they can be listed here by players, but the system will not auto-promote them — they just exist)

**Seizure mechanic backend:**
```typescript
// Scheduled job every 6 hours
// For each active BlackMarketListing:
const seized = Math.random() < 0.05;
if (seized) {
  // Delete item from player's inventory (already "listed" so it's in escrow)
  await BlackMarketListing.findByIdAndDelete(listing._id);
  await notify(listing.sellerId, "black_market_seized", "A Black Market listing was seized by enforcers.");
  await postToFeed("market", "[◼ BLACK MARKET] Enforcers seized a listing. Someone is not having a good night.");
  // Note: feed post mentions no names (true anonymity)
}
```

**Why list here vs normal market?**
- No commission (saves 5% on high-value items — significant on 200k+ sales)
- Full anonymity (useful if selling to avoid faction enemies knowing your inventory)
- Risk: seizure chance

---

### 10.14 — Mentor System

Players level 1–15 can request a mentor. Players level 30+ can register as a mentor. Maximum 3 active mentees per mentor.

**Mentor matching:** Player opens profile → "Find a Mentor". System matches them with an available mentor (30+ level, <3 mentees, online in last 48h). If no match, player is queued and notified when one becomes available.

**Mentor incentive:** When a mentee levels up, the mentor receives **+5% of the XP the mentee earned** as a bonus on top of their own XP. This is passive — requires no action from the mentor.

**Mentee incentive:** First 10 levels while having a mentor grant +10% XP. Encourages new players to stay engaged.

**Mentor relationship ends when:** Mentee reaches level 20, or either party manually ends it from their profile.

**Backend:**
```typescript
// Add to User model
mentorId:  { type: ObjectId, ref: "User", default: null }
menteeIds: [{ type: ObjectId, ref: "User" }]   // max 3
isMentor:  { type: Boolean, default: false }    // opted in to mentor pool
```

**Endpoints:**
- `POST /mentor/register` — opt in to mentor pool
- `POST /mentor/request` — mentee requests a mentor (system assigns)
- `POST /mentor/end/:userId` — either party ends the relationship

---

### 10.15 — Achievement Badges as Profile Cosmetics

Each achievement, when earned, grants a **badge** that the player can display on their profile. Players can select up to **3 badges** to show publicly. These badges also appear as tiny icons next to the player's name in Global Chat.

**Badge display in chat:**
```
[🔫][⚔️][🏁] @PlayerName: gg wp
```
The 3 icons are the player's chosen badges. Other players can hover/tap to see the achievement name.

**Badge selection:** On the Achievements page, each earned achievement shows a "Pin to Profile" toggle. Only 3 can be pinned at once — pinning a 4th unpins the oldest.

**Add to User model:**
```typescript
pinnedBadges: [{ type: String, maxlength: 3 }]  // achievement IDs, max 3
```

Achievement badge icons are defined in the achievement seed data — each achievement has an `icon` field (emoji or PNG slug).

---

### 10.16 — New Items (Full List)

All items below must be added to their relevant seed files or shop inventory during implementation.

**City Enhancement Items (normal game, enhancement slot unless noted):**

| Item Name | itemId | Slot | Effect | Rarity | Source |
|---|---|---|---|---|---|
| Signal Jammer | `signal_jammer` | enhancement | −20% jail chance on all crimes | Uncommon | Combat Zone Supply NPC |
| Neural Optimizer | `neural_optimizer` | enhancement | +5% XP from all sources | Rare | Corp Zone abroad |
| Adrenaline Implant | `adrenaline_implant` | enhancement | +1 max Adrenaline permanently | Rare | Industrial abroad / Master Royale |
| Turbo Chip | `turbo_chip` | enhancement | +1 max Nitro permanently | Rare | Chrome Garage NPC / Master Royale |
| Burner Wallet | `burner_wallet` | enhancement | Mugging cap: max 5% cash lost regardless of district | Rare | Docks abroad (rotation) |
| District Pass | `district_pass_[slug]` | consumable | −80% travel time for next trip to specific district | Uncommon | Each district shop (their own pass) |
| Security Implant | `security_implant` | enhancement | −10% mug chance in all districts | Rare | Corp Zone abroad |
| Syndicate Medallion | `syndicate_medallion` | enhancement | −50% jail time for next crime anywhere | Rare | Outskirts abroad |
| Corp VIP Card | `corp_vip_card` | consumable | Removes crime record pricing penalty in Corp Zone (1 use) | Uncommon | Corp Zone abroad |
| Dockside Manifest | `dockside_manifest` | consumable | Reveals Sal's current stock before you travel (shown in travel card) | Uncommon | Docks abroad |

**Arena Items (missing from current seed):**

| Item Name | itemId | Type | Effect | Rarity |
|---|---|---|---|---|
| Riot Shield | `riot_shield` | secondary | Replaces secondary weapon slot. Blocks 30% of one hit per round. No ammo needed. | Uncommon |
| Flashbang | `flashbang` | arena consumable | Target misses their next attack turn completely | Rare |
| Armor Repair Kit | `armor_repair_kit` | arena consumable | Restore 20 armor HP mid-match | Uncommon |
| Hollow Point Rounds | `hollow_point_[category]` | ammo | +20% damage, −1 shot per magazine (available for all 6 ammo categories) | Uncommon |
| Street Medkit | `street_medkit` | arena consumable | +15 HP. Costs 1 Adrenaline from queue pool instead of taking a loadout slot. (Unique mechanic — not a loadout item, carried separately.) | Common |

**District-Exclusive Items (cross-reference with 9.4):**

| Item | District | Effect |
|---|---|---|
| Street Medkit | Slums | Listed above |
| Inhibitor Patch | Neon Strip | Prevents hospitalization from next danger roll (consumed on arrival) |
| Dock Pass | Docks | −80% travel time to Docks on next trip |
| Corp Data Chip | Corp Zone | Unlocks 1 attempt at Corp Espionage crime (abroad only, requires chip) |
| Industrial Fuel Cell | Industrial | +5 Nitro + vehicle travel time −50% for next trip |
| Salvage Kit | Industrial | Repairs arena weapon/armor durability +20 points |
| Void Key Shard ×5 | Outskirts | Bulk 5 shards — shortcut toward Master Royale key |
| Overload Stim | Outskirts | +5 Adrenaline + stun immunity for first round of next arena match |

---

### 10.17 — Implementation Checklist (Tier 10)

**System Feed:**
- [ ] `SystemFeedPost` model (includes `links` array for `/path` extraction)
- [ ] `GET /feed` endpoint (paginated, pinned first)
- [ ] `POST /system/feed` endpoint (admin/owner only)
- [ ] `lib/systemFeed.ts` helper (`postToFeed`)
- [ ] Win-streak counter check on arena/race match end — call `postToFeed` ONLY when streak crosses 5/10/20/50, never on every match
- [ ] Call `postToFeed` in: arena win-streak milestone, race win-streak milestone, high-tier crime, district arrival with outcome, NEW auction listed (not auction close), royale Epic/Legendary pull, prestige event
- [ ] Playful, tone-escalating copy for win-streak posts (5 = celebratory, 10 = dramatic, 20+ = incredulous)
- [ ] Weekly leaderboard cron job (Monday 00:00 UTC) builds and posts recap
- [ ] Shared feed/chat renderer: parses `@username` mentions, `/path` links, and `:emojiSlug:` shortcodes (distinct colors for mentions vs links)
- [ ] Feed page frontend (terminal-style, paginated, @ links, pinned recap at top)

**Custom Game Emojis:**
- [ ] `GameEmoji` model + seed all 16 (driftcar, swordclash, stimshot, nitroflame, voltbolt, neonskull, goldtrophy, cashspill, jackpot, smokepistol, barriershield, neoncity, chainlock, medcross, cybereye, botscan)
- [ ] `GET /emojis` catalog endpoint
- [ ] Animated emoji assets produced for all 16 slugs
- [ ] Shortcode resolution wired into the shared feed/chat renderer (unknown shortcodes render as plain text)
- [ ] Emoji picker button in chat input (grouped by theme)

**Notifications:**
- [ ] `Notification` model
- [ ] `lib/notify.ts` helper
- [ ] `GET /notifications` + `POST /notifications/read-all` endpoints
- [ ] Notification bell in NavBar with unread badge
- [ ] Notification panel dropdown/page

**Daily Login Reward:**
- [ ] `loginStreak`, `lastLoginDate` on User model
- [ ] Login reward check in auth middleware or `/me` handler
- [ ] `grantLoginReward` function with reward table
- [ ] Frontend login reward modal

**Inventory Page:**
- [ ] `/inventory` page with filter tabs, item cards, quick sell, list on market
- [ ] Bulk select + quick sell all selected
- [ ] Destroyed item display + discard action

**Crime Cooldowns:**
- [ ] `crimeCooldowns` Map on User model
- [ ] Crime commit handler sets cooldown per crime tier
- [ ] `CrimeLog` model
- [ ] Crime history panel on Crimes page

**Chat Polish:**
- [ ] District channel auto-join on abroad status
- [ ] Channel tabs on Chat page (global / faction / district)
- [ ] `ChatReport` model + right-click report action
- [ ] `mutedUsers` on User model + hide muted messages client-side

**Profile Page:**
- [ ] Combat record, racing record, crime record stats from logs
- [ ] District visit log (last 5, from travel events)
- [ ] Recent activity pulled from SystemFeed
- [ ] Achievement panel with locked silhouettes
- [ ] Pinned badges display + status indicator

**Leaderboards:**
- [ ] 9 leaderboard tabs
- [ ] Weekly metrics tracked on User model: `weeklyDcEarned`, `weeklyArenaWins`, `weeklyRaceWins` (reset Monday)
- [ ] Player's own rank shown below top 50

**NPC Encounters:**
- [ ] `lastEncounterAt` on User model
- [ ] Encounter roll in city action middleware
- [ ] Encounter pool + effect handlers
- [ ] Private notify for personal encounters; Feed post for dramatic ones

**Faction Depth:**
- [ ] `bankBalance` + `FactionBankLog` model
- [ ] Faction bank deposit/withdraw endpoints
- [ ] Faction perks model + purchase endpoint + application in relevant handlers
- [ ] Faction influence tracking per district
- [ ] District control displayed on Travel Hub

**Arena Taunts:**
- [ ] `taunts` array on match model
- [ ] `POST /arena/match/:id/taunt` endpoint (rate-limited per round)
- [ ] Taunt display in match panel and result screen

**Trading:**
- [ ] `TradeOffer` model
- [ ] Create / accept / decline / counter endpoints
- [ ] Atomic swap on accept
- [ ] Trade UI on player profile + notification flow

**Black Market:**
- [ ] `BlackMarketListing` model
- [ ] List / buy / seizure endpoints
- [ ] Seizure cron job (every 6 hours, 5% per listing)
- [ ] NavBar entry unlocked at level 20
- [ ] Anonymous listing UI

**Mentor System:**
- [ ] `mentorId`, `menteeIds`, `isMentor` on User model
- [ ] Register / request / end endpoints
- [ ] XP bonus applied in levelUp handler

**Achievement Badges:**
- [ ] `pinnedBadges` on User model
- [ ] Pin/unpin toggle on Achievements page
- [ ] Badge icons in chat messages (next to username)
- [ ] Badge display on profile header

**New Items:**
- [ ] All 10 city enhancement items added to seed / shop inventories
- [ ] All 5 arena items added to arena item seed
- [ ] All 8 district-exclusive items cross-checked against district shop specs in 9.4

---

*End of update_tiers.md — All 10 tiers fully specified with no gaps. Build tier by tier. Complete and verify each tier before starting the next.*
