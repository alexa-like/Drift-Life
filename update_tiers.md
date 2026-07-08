# DriftLife — Full Feature Update Plan
## Agent Build Guide: Step-by-Step Tier System

---

## HOW YOU SHOULD WORK — READ THIS FIRST

You are building a large feature set for DriftLife, a cyberpunk browser game. The work is broken into **8 tiers**. You must:

1. **Complete one tier fully before moving to the next.** Do not skip ahead or start the next tier until the current tier is working and verified.
2. **Read the relevant model and route files before editing them.** Never guess at field names — check the actual schema first.
3. **Never break existing working features.** If a tier requires removing something, ensure the removal is clean — no dangling references, no dead imports.
4. **Test every endpoint you create or modify.** If you cannot start the server, fix the issue before continuing.
5. **Seed data belongs in a seed file or an inline seed constant** — do not hardcode item data inside route handlers.
6. **Never use placeholder data or mock responses.** Every endpoint must return real data from the database or computed logic.
7. **Be explicit on failure.** If something breaks, surface the error clearly rather than silently catching it.
8. **After finishing each tier**, write a brief summary of what you changed and restart the API server to confirm it starts cleanly.
9. **Follow the existing code style** — TypeScript, Mongoose, Express 5, same file structure as existing routes/models.
10. **Key rule on Epic/Legendary items**: These must NEVER be available in any bot/NPC store. Rare items appear in bot stores only occasionally (with low probability). Epic and Legendary are exclusively from: Auction system, Player-to-player market listings, Royale (Master Royale only).

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

---

## TIER 1 — CORE CLEANUP & INFRASTRUCTURE
**Goal: Remove all legacy junk, fix broken items, update core models**

### 1.1 — Delete Old PvP Combat Completely

Remove from backend:
- Any route file handling player-attacks-player (the old attack system, not arena). Check `routes/index.ts` for what's registered and trace it.
- The old `CombatMatch` model if it was used for old-style direct PvP (not arena matches). If `CombatMatch` is used by the Arena system, keep it but strip any old-combat-specific fields.
- Remove `defenseBonus` from the `MiniGameItem` model schema and any seed data that uses it.
- Remove `defense` as a combat stat from any arena combat calculation logic.

Remove from frontend:
- Any page or component that renders the old "attack a player" UI.
- Any button, link, or nav item pointing to old combat.
- Remove any dead route in the React router pointing to old combat pages.

### 1.2 — Remove Normal-Game Armor Items from Shop

In `artifacts/api-server/src/routes/market.ts`, delete these 5 items from the `SHOP_ITEMS` array entirely:
- Leather Coat
- Kevlar Vest
- Combat Rig
- Subdermal Plating
- Nanoweave Armor

Also delete: **Combat Drug** consumable from SHOP_ITEMS.

These items are gone. Players who own them in their `inventory` array on the User document keep them but they do nothing — that is acceptable for now (they can sell them on market). Do not run a migration to remove them from player inventories.

### 1.3 — Repurpose Weapon Items (Normal Game)

In `SHOP_ITEMS` in market.ts, for all items with `type: "weapon"`:
- Change the `slot` field from `"weapon"` to `"enhancement"`
- These items now grant their `strengthBonus` passively when equipped in the enhancement slot
- They are no longer combat weapons — they are stat gear
- Keep their names (Cyber Blade, Rail Pistol, etc.) for flavor

Update the Item model (`artifacts/api-server/src/models/Item.ts`) if the `slot` enum does not include `"enhancement"` — add it.

### 1.4 — Fix Luxury Car

In `SHOP_ITEMS`, find the Luxury Car item and update it:
- Keep existing travel energy reduction (whatever it currently is, reduce to -20% if not already)
- Add `charismaBonus: 12` to the item definition
- Update its description to reflect both benefits

### 1.5 — Fix Legendary Elixir

Find the Legendary Elixir item in `SHOP_ITEMS` and update:
- The `effect` should be: `{ type: "timed_all_stats", value: 10, durationHours: 4 }`
- Energy +50 and Nerve +20 remain instant on use
- The `all_stats` effect is NOT permanent — it's a 4-hour timed buff

In the item use handler (wherever consumables are applied to the user), implement the `timed_all_stats` logic:
- Add a field to the User model: `activeBuffs: [{ type: String, value: Number, expiresAt: Date }]`
- When Legendary Elixir is used, push `{ type: "all_stats", value: 10, expiresAt: now + 4 hours }` to `activeBuffs`
- On any stat read (strength, charisma, intelligence, streetCred), check `activeBuffs` for non-expired `all_stats` entries and add their value
- Expired buffs should be cleaned up lazily on stat read or on a periodic cron

### 1.6 — Update User Model for New Systems

Add the following fields to the User model if they do not already exist:
```
prestige: { type: Number, default: 0 }
prestigeXpBoost: { type: Number, default: 0 }   // percentage, e.g. 10 = 10%
keyShards: { type: Number, default: 0 }
activeBuffs: [{ type: String, value: Number, expiresAt: Date }]
```

Confirm `keys` and `nc` (Nova Credits) already exist on the User model. If not, add them with default 0.

### 1.7 — Verify Server Starts

After completing Tier 1:
- Run `pnpm --filter @workspace/api-server run dev` and confirm it starts without errors
- Check that the `/market/shop` endpoint no longer returns the deleted armor items or Combat Drug
- Check that weapon items in the shop now show `slot: "enhancement"`

---

## TIER 2 — ARENA WEAPON & ARMOR SEED SYSTEM
**Goal: Build out all arena items — real weapons, ammo, and body armor across all tiers**

### 2.1 — Update MiniGameItem Model

The current `MiniGameItem` model has `category: weapon | armor | consumable | ammo`. Update:

Replace `category` enum with:
```
category: {
  type: String,
  enum: [
    "pistol", "smg", "assault_rifle", "shotgun", "sniper_rifle", "lmg",  // weapon subcategories
    "body_armor",                                                           // replaces old "armor"
    "consumable",
    "pistol_rounds", "smg_rounds", "rifle_rounds", "shotgun_shells", "sniper_rounds", "lmg_rounds"  // ammo categories
  ]
}
```

Add new fields to MiniGameItem schema:
```
weaponSlot: { type: String, enum: ["primary", "secondary", "both"], default: null }
  // pistol → "secondary", smg → "secondary" or "primary", assault_rifle/shotgun/sniper_rifle/lmg → "primary"
  
magazineSize: { type: Number, default: null }  // rounds per magazine for weapons
ammoCategory: { type: String, default: null }  // which ammo type this weapon uses (e.g. "pistol_rounds")

armorHp: { type: Number, default: null }       // in-match HP for body armor
durability: { type: Number, default: 100 }     // cross-match durability (0 = destroyed)
maxDurability: { type: Number, default: 100 }  // reference for display

stackable: { type: Boolean, default: false }   // ammo and consumables are stackable
maxStack: { type: Number, default: 99 }
```

### 2.2 — Seed All Arena Weapons

Create or update the seed file for MiniGameItems. Seed all weapons across all tiers. Follow this structure:

**Pistols (Secondary slot):**
| Weapon | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Glock 17 | 12–18 dmg, 15 rds | 16–24 dmg, 17 rds | 22–32 dmg, 19 rds | 30–44 dmg, 21 rds | 42–60 dmg, 23 rds |
| Desert Eagle | 20–28 dmg, 7 rds | 26–36 dmg, 8 rds | 34–48 dmg, 9 rds | 46–64 dmg, 10 rds | 62–86 dmg, 11 rds |
| Beretta M9 | 11–17 dmg, 15 rds | 15–22 dmg, 17 rds | 20–30 dmg, 19 rds | 28–40 dmg, 21 rds | 38–56 dmg, 23 rds |
| USP-S | 13–19 dmg, 12 rds | 17–25 dmg, 13 rds | 23–34 dmg, 15 rds | 32–46 dmg, 17 rds | 44–62 dmg, 19 rds |

All pistols: `weaponSlot: "secondary"`, `ammoCategory: "pistol_rounds"`

**SMGs (Secondary or Primary):**
| Weapon | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| MP5 | 10–15 dmg, 30 rds | 13–19 dmg, 32 rds | 18–26 dmg, 35 rds | 25–36 dmg, 38 rds | 34–50 dmg, 40 rds |
| Uzi | 9–14 dmg, 32 rds | 12–18 dmg, 35 rds | 16–24 dmg, 38 rds | 23–34 dmg, 40 rds | 32–46 dmg, 42 rds |
| MAC-10 | 11–16 dmg, 30 rds | 14–21 dmg, 32 rds | 19–28 dmg, 35 rds | 26–38 dmg, 38 rds | 36–52 dmg, 40 rds |
| P90 | 10–15 dmg, 50 rds | 13–20 dmg, 50 rds | 18–27 dmg, 50 rds | 25–37 dmg, 50 rds | 35–51 dmg, 50 rds |

All SMGs: `weaponSlot: "secondary"`, `ammoCategory: "smg_rounds"`

**Assault Rifles (Primary):**
| Weapon | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| AK-47 | 18–25 dmg, 20 rds | 24–34 dmg, 25 rds | 32–46 dmg, 30 rds | 44–62 dmg, 35 rds | 58–82 dmg, 40 rds |
| M4A1 | 16–23 dmg, 30 rds | 22–32 dmg, 30 rds | 30–44 dmg, 30 rds | 42–60 dmg, 30 rds | 56–80 dmg, 30 rds |
| SCAR-H | 20–28 dmg, 20 rds | 26–38 dmg, 20 rds | 36–52 dmg, 20 rds | 48–68 dmg, 20 rds | 64–90 dmg, 20 rds |
| HK416 | 17–24 dmg, 30 rds | 23–33 dmg, 30 rds | 31–45 dmg, 30 rds | 43–61 dmg, 30 rds | 57–81 dmg, 30 rds |

All assault rifles: `weaponSlot: "primary"`, `ammoCategory: "rifle_rounds"`

**Shotguns (Primary):**
| Weapon | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Mossberg 500 | 30–45 dmg, 6 rds | 40–58 dmg, 7 rds | 54–76 dmg, 7 rds | 72–100 dmg, 8 rds | 95–135 dmg, 8 rds |
| SPAS-12 | 28–42 dmg, 8 rds | 38–55 dmg, 8 rds | 51–72 dmg, 8 rds | 68–96 dmg, 8 rds | 90–128 dmg, 8 rds |
| AA-12 | 22–34 dmg, 20 rds | 30–44 dmg, 20 rds | 40–58 dmg, 20 rds | 54–76 dmg, 20 rds | 72–102 dmg, 20 rds |
| Benelli M4 | 25–38 dmg, 7 rds | 34–50 dmg, 7 rds | 46–66 dmg, 8 rds | 62–88 dmg, 8 rds | 82–118 dmg, 8 rds |

All shotguns: `weaponSlot: "primary"`, `ammoCategory: "shotgun_shells"`

**Sniper Rifles (Primary):**
| Weapon | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Barrett M82 | 55–75 dmg, 5 rds | 72–98 dmg, 5 rds | 96–130 dmg, 5 rds | 126–170 dmg, 5 rds | 165–225 dmg, 5 rds |
| AWP | 60–80 dmg, 5 rds | 78–105 dmg, 5 rds | 105–142 dmg, 5 rds | 138–188 dmg, 5 rds | 180–246 dmg, 5 rds |
| Dragunov | 48–68 dmg, 10 rds | 63–90 dmg, 10 rds | 85–120 dmg, 10 rds | 112–158 dmg, 10 rds | 148–210 dmg, 10 rds |
| Intervention | 65–88 dmg, 5 rds | 85–115 dmg, 5 rds | 115–156 dmg, 5 rds | 152–206 dmg, 5 rds | 200–272 dmg, 5 rds |

All snipers: `weaponSlot: "primary"`, `ammoCategory: "sniper_rounds"`

**LMGs (Primary):**
| Weapon | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| M249 SAW | 14–20 dmg, 100 rds | 18–26 dmg, 100 rds | 25–36 dmg, 100 rds | 34–48 dmg, 100 rds | 45–65 dmg, 100 rds |
| RPK | 16–22 dmg, 75 rds | 21–30 dmg, 75 rds | 28–40 dmg, 75 rds | 38–54 dmg, 75 rds | 50–72 dmg, 75 rds |
| Minigun | 10–16 dmg, 200 rds | 13–20 dmg, 200 rds | 18–28 dmg, 200 rds | 24–38 dmg, 200 rds | 32–50 dmg, 200 rds |
| MG4 | 15–21 dmg, 100 rds | 20–29 dmg, 100 rds | 27–39 dmg, 100 rds | 37–52 dmg, 100 rds | 49–70 dmg, 100 rds |

All LMGs: `weaponSlot: "primary"`, `ammoCategory: "lmg_rounds"`

**Special effects for weapons (Rare/Epic/Legendary only):**
- Common and Uncommon: NO special effects. Plain stats only.
- Rare (selected): Some rare weapons get ONE special (not all). Examples:
  - AK-47 Custom (Rare AR): 15% bleed chance
  - AWP (Rare Sniper): 10% armor pierce (bypasses 25% of armor HP)
  - AA-12 (Rare Shotgun): 20% knockback (enemy loses next turn's action choice, forced to defensive only)
- Epic: All epic weapons have a special effect
- Legendary: All legendary weapons have a strong special effect

Define all special effects when building this tier. Common specials: bleed (DoT), stun (skip turn), armor_pierce (bypass % of armor), knockback (limit next action), double_tap (fires twice in one turn on lucky roll).

**Weapon Durability defaults:**
- Common: maxDurability 80 (breaks faster)
- Uncommon: maxDurability 120
- Rare: maxDurability 160
- Epic: maxDurability 220
- Legendary: maxDurability 300

### 2.3 — Seed Ammo Items

Create 6 ammo item entries (one per category), each with 5 tier variants:

| Ammo Type | Category | Tiers |
|---|---|---|
| Pistol Rounds | pistol_rounds | Common → Legendary (Common mag: 15 rds, Legendary: 23 rds) |
| SMG Rounds | smg_rounds | Common → Legendary |
| Rifle Rounds | rifle_rounds | Common → Legendary |
| Shotgun Shells | shotgun_shells | Common → Legendary |
| Sniper Rounds | sniper_rounds | Common → Legendary (small mags) |
| LMG Rounds | lmg_rounds | Common → Legendary (large mags) |

Higher tier ammo = larger mag + small damage multiplier bonus (e.g. Uncommon adds +5% to base weapon damage).

Ammo items: `stackable: true`, `maxStack: 99`

### 2.4 — Seed Body Armor Items

Create body armor items (`category: "body_armor"`) with 5 tiers:

| Tier | Name | In-Match HP (armorHp) | Max Durability |
|---|---|---|---|
| Common | Street Vest | 50 | 100 |
| Uncommon | Tactical Vest | 85 | 150 |
| Rare | Combat Plate | 130 | 200 |
| Epic | Ballistic Rig | 195 | 280 |
| Legendary | Exo-Armor | 275 | 400 |

Body armor:
- `weaponSlot: null` (it's not a weapon)
- `stackable: false`
- No special effects on Common/Uncommon
- Rare: 10% chance to reduce damage by 15% on any incoming hit (damage absorb chance)
- Epic: 20% absorb chance + blocks one stun per match
- Legendary: 30% absorb chance + blocks one stun + reflects 5% damage to attacker

### 2.5 — Update PlayerMiniGameInventory & PlayerLoadout

**PlayerMiniGameInventory** — update inventory arrays to reflect new categories:
```
primaryWeapon: [{ itemId: String, quantity: Number, durability: Number }]
secondaryWeapon: [{ itemId: String, quantity: Number, durability: Number }]
bodyArmor: [{ itemId: String, quantity: Number, durability: Number }]
consumables: [{ itemId: String, quantity: Number }]
ammo: { 
  pistol_rounds: Number,  // total rounds available (not magazines)
  smg_rounds: Number,
  rifle_rounds: Number,
  shotgun_shells: Number,
  sniper_rounds: Number,
  lmg_rounds: Number
}
```

**PlayerLoadout** — update to new slot system:
```
primaryWeaponId: String | null       // must be a primary-slot weapon
secondaryWeaponId: String | null     // must be a secondary-slot weapon
bodyArmorId: String | null           // body armor item
consumableItemId: String | null      // the ONE consumable type (3× same item)
consumableCount: Number              // how many of that consumable are equipped (max 3)
```

### 2.6 — Verify

- Run a quick DB seed check: confirm new items exist in the MiniGameItem collection
- Confirm the `/arena` loadout endpoints accept the new slot structure

---

## TIER 3 — ARENA COMBAT MECHANICS OVERHAUL
**Goal: Rewrite the combat loop to match the new design**

### 3.1 — Combat System Design

The arena combat system is **turn-based, simultaneous**:
- Both players submit their action for the current turn
- Once both have submitted, the turn resolves — both actions happen at the same time
- Neither player sees what the other picked until resolution
- Turn deadline: 60 seconds. If a player doesn't submit, they auto-fire their primary weapon (or melee if no ammo)

**Actions a player can take each turn:**
1. `fire_primary` — fire primary weapon (costs ammo from inventory permanently)
2. `fire_secondary` — fire secondary weapon (costs ammo from inventory permanently)
3. `use_consumable` — use one consumable from their loadout (if any remain)
4. `melee` — bare fist attack, flat 8–14 damage, no ammo, no special, always available

**Damage formula:**
```
baseDamage = random(weapon.damageMin, weapon.damageMax)
strengthBonus = floor(player.strength * 0.15)   // strength adds flat damage
hitRoll = random(0, 100)
accuracy = weapon.accuracy ?? 75
if hitRoll > accuracy → miss (0 damage)
else → damage = baseDamage + strengthBonus
```

**Armor absorption:**
```
if defender has body armor with armorHp > 0:
  damageToArmor = min(damage, armorHp)
  armorHp -= damageToArmor
  damageToPlayer = damage - damageToArmor
else:
  damageToPlayer = damage

defender.hp -= damageToPlayer
```

**Special effects** resolve after the base damage. Each special has its own handler (bleed applies DoT to next 2 turns, stun forces enemy's next action to `melee`, armor_pierce skips armor entirely, etc.).

### 3.2 — Loadout Validation Before Match

When a player joins the queue:
- Verify they have a `primaryWeaponId` set in their loadout
- Verify they have ammo for their primary weapon. If not: allow join but send warning response `{ warning: "no_ammo_primary" }`
- Verify secondary weapon has ammo if equipped. If not: warn `{ warning: "no_ammo_secondary" }`
- Verify consumable count matches their actual inventory (cannot equip 3 medkits if only 2 in inventory)
- Block joining if primary weapon durability is 0 (destroyed)

### 3.3 — Ammo Consumption

When a player fires a weapon during a match:
- Do NOT deduct ammo from the player's inventory during the match (it's tracked in the match state)
- Track `roundsFiredPrimary` and `roundsFiredSecondary` in the match state
- At match END, deduct from the player's actual inventory: `ammo[ammoCategory] -= roundsFired`
- If inventory doesn't have enough (edge case), clamp to 0 (don't go negative)

### 3.4 — Consumable Consumption

When a player uses a consumable during a match:
- Track `consumablesUsed` count in match state
- At match END, deduct from the player's actual inventory: `consumables[consumableItemId].quantity -= consumablesUsed`
- If player uses more than `consumableCount` in their loadout — block the action mid-match (return error)

### 3.5 — Durability Degradation

At match END (win or lose):
- Deduct durability from equipped primary weapon: `durability -= 5` (per match, flat for now)
- Deduct durability from equipped secondary weapon: `durability -= 3`
- Deduct durability from body armor: `durability -= 4`
- If any item hits 0 durability → set `durability = 0` and mark item as destroyed (remove from inventory)
- Return to the player a list of items that were destroyed this match in the API response

### 3.6 — Melee Fallback

If a player's turn fires `fire_primary` but they have no primary ammo left, auto-downgrade to `melee`.
If `fire_secondary` but no secondary ammo, auto-downgrade to `melee`.
Melee: `damage = random(8, 14) + floor(strength * 0.1)`, no ammo cost, never misses, no special.

### 3.7 — Match State Updates

Update the `CombatMatch` model to store:
```
player1CurrentArmorHp: Number
player2CurrentArmorHp: Number
player1RoundsFiredPrimary: Number
player1RoundsFiredSecondary: Number
player2RoundsFiredPrimary: Number
player2RoundsFiredSecondary: Number
player1ConsumablesUsed: Number
player2ConsumablesUsed: Number
```

### 3.8 — Frontend Arena Combat UI

Update the shooting arena combat page:

**Layout:**
```
[ENEMY SIDE]                          [PLAYER SIDE]
Big human silhouette (left)           Big human silhouette (right)
Above silhouette:
  ❤️ HP bar + number
  🛡️ Armor HP bar + number (if armor equipped)

Below both silhouettes:
  [PRIMARY WEAPON CARD]   [SECONDARY WEAPON CARD]
  weapon image            weapon image
  weapon name             weapon name
  Ammo: X rounds left     Ammo: X rounds left
  Click to fire           Click to fire

  [CONSUMABLE CARD] (if equipped)
  consumable image + name + count remaining
  Click to use

  [MELEE] button (always visible as last resort)
```

- Clicking a weapon card submits that action for the turn
- Once submitted, buttons gray out until the turn resolves
- Turn result animates: damage numbers float up, armor bar depletes visually before HP bar
- Show a log of the last 3 turns (both players' actions and damage dealt)

---

## TIER 4 — ROYALE SYSTEM OVERHAUL
**Goal: Replace single general royale with per-category dual-spin system**

### 4.1 — Remove General Royale

- Delete or archive all existing `RoyaleItem` seed data for the general royale
- The `/royale/spin` endpoint with `type: "general"` should return 404 or be removed
- Remove any frontend UI pointing to the old general royale

### 4.2 — New Royale Categories

The royale system now has 6 categories:
```
pistols | smgs | assault_rifles | shotguns | sniper_rifles | lmgs |
body_armor | consumables | ammo | race_cars | car_parts
```

Each category has:
- A **DC Spin** pool (Common, Uncommon, 1 Rare) — costs 500 DC
- A **Master Royale** pool (Rare, Epic, Legendary) — costs 20 NC + 1 Key

Update the `RoyaleItem` model:
```
royaleCategory: String  // one of the categories above
spinType: String        // "dc_spin" | "master_royale"
itemRef: String         // the MiniGameItem itemId this royale entry points to
dropWeight: Number      // higher = more common (use weights not percentages internally)
```

Calculate displayed probability as: `weight / totalWeightsInPool * 100` when serving to frontend.

### 4.3 — Seed Royale Pools

For each category and each spin type, seed `RoyaleItem` documents pointing to the MiniGameItem seeds from Tier 2. Example for `pistols / dc_spin`:
- All 4 pistols at Common tier: weight 40 each
- All 4 pistols at Uncommon tier: weight 25 each
- All 4 pistols at Rare tier: weight 10 each (DC Spin includes exactly 1 Rare per category)

For `pistols / master_royale`:
- All 4 pistols at Rare tier: weight 30 each
- All 4 pistols at Epic tier: weight 15 each
- All 4 pistols at Legendary tier: weight 5 each

Repeat this pattern for every category.

### 4.4 — Spin Logic

Backend `/royale/spin` endpoint now accepts:
```json
{ "category": "assault_rifles", "spinType": "dc_spin" }
```

- Validate player has enough DC (500) or NC+Key (20 NC + 1 Key) based on spinType
- Deduct cost atomically
- Pull all RoyaleItems for that category+spinType
- Weighted random selection → return the winning item
- Add the won item to `PlayerMiniGameInventory` (for weapons/armor/ammo) or appropriate inventory
- Return the winning item with full item details including imageUrl

### 4.5 — Key Shard System

In the User model, `keyShards` already added in Tier 1. Implement the conversion:
- When `keyShards >= 20`: automatically convert — `keyShards -= 20`, `keys += 1`
- Check this on every shard grant and on user login
- Sources of shards:
  - Daily login reward: +3 shards/day (add to existing daily login handler)
  - After any completed arena match (win or lose): +1 shard
  - Mission milestone completions: +5 shards
  - Achievement unlocks (selected achievements): +10 shards
- Sources of full keys:
  - 20 shards → auto-converts to 1 key
  - NC purchase (add to the `/store` route — e.g. 50 NC = 3 keys)
  - Milestone achievements grant 1–3 keys directly

### 4.6 — Royale Hub Frontend

Create a new page: `RoyaleHubPage.tsx`

Layout: a grid of category cards. Each card:
- Large image representing that weapon/item category (use `/assets/royale/{category}.png` — fallback to a generated SVG placeholder)
- Category name centered below the image
- Clicking the card navigates to `/royale/{category}`

Categories displayed:
```
Pistols | SMGs | Assault Rifles | Shotguns | Sniper Rifles | LMGs
Body Armor | Consumables | Ammo | Race Cars | Car Parts
```

### 4.7 — Category Spin Page Frontend

Create: `RoyaleCategoryPage.tsx` (route: `/royale/:category`)

Layout:
```
[Category name as heading]

[ DC SPIN ] [ MASTER ROYALE ]   ← tab/toggle switcher at the top

[Animated spinning wheel or slot reel — plays on spin, stops on result]

Cost displayed: "500 DC" or "20 NC + 1 Key"

[SPIN button]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS YOU CAN WIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Item image]  AK-47 Common      ████████░░░░  45.2%
[Item image]  AK-47 Mk.II       ████████░░░░  28.8%
[Item image]  AK-47 Custom Rare ███░░░░░░░░░  14.0%
[Item image]  AK-47 Cyber ★★    (Master only — shown grayed with lock icon)
[Item image]  AK-47 Phantom ★★★ (Master only — shown grayed with lock icon)
```

- Switching between DC Spin and Master Royale toggles the cost display and the probability list
- Items only in Master Royale show grayed out with a lock icon in the DC Spin view (creates desire to upgrade)
- The spin animation: when player clicks SPIN, a wheel/reel animation plays for 2–3 seconds then reveals the result
- Result is shown with a popup/modal: item image, item name, tier badge, "Added to your inventory"

---

## TIER 5 — MARKET & AUCTION OVERHAUL
**Goal: Full market redesign — NPC stores, bulk listing, commission, auction**

### 5.1 — NPC Stores

Replace the single generic shop with 6 named NPC stores. Each store is a separate entity with its own character:

| Store ID | Store Name | Keeper Name | Category |
|---|---|---|---|
| `iron_wolf` | Iron Wolf Armory | Marcus "Iron" Cole | Normal game weapons/enhancement items |
| `steelshield` | Steelshield Outfitters | Yuki Tanaka | Normal game clothing |
| `neon_motors` | Neon Motors | Rico "Speed" Vega | Normal game vehicles |
| `district_pharma` | District Pharma | Dr. Elena Reyes | Normal game consumables |
| `combat_zone` | Combat Zone Supply | "The Sergeant" | Arena gear (weapons, body armor, ammo — Common/Uncommon only, occasional Rare) |
| `chrome_garage` | Chrome Garage | Jay "Torque" | Race cars and car parts |

**CRITICAL RULE:** No NPC store ever lists Epic or Legendary items. Rare items appear occasionally (random, low probability). Common and Uncommon are always available.

Create a `NpcStore` model or handle stores as static config. Each store listing has:
```
storeId: String
itemRef: String           // item id
priceMin: Number          // random price rolls within this range
priceMax: Number
quantity: Number          // how many currently listed (bot supply)
lastRestockedAt: Date
expiresAt: Date           // listings expire and get replaced
```

Stores restock on a timer (every 6 hours). On restock: remove expired listings, generate new random item selections.

### 5.2 — NPC Store FAQ System

Each NPC store page on the frontend has:
- The store keeper's name and a character art image (use `/assets/npcs/{storeId}.png`)
- A few pre-written FAQ questions the player can click. Not a chat — just static Q&A:

Example for Iron Wolf Armory:
- "What weapons do you carry?" → "I stock enhancement gear from street-grade up to military-spec. Check the shelves."
- "Are your prices negotiable?" → "Prices are fixed. No haggling. Take it or leave it."
- "Where do I find rarer gear?" → "You won't find my best stuff here. Check the auction if you want the real heat."

Questions are displayed as clickable chips. Clicking one expands the answer inline below — no page navigation, no modal. Maximum 4–5 questions per store.

### 5.3 — Player Market — Bulk Listing

Create a new endpoint: `POST /market/listings/batch`
```json
{
  "listings": [
    { "itemId": "ak47_epic", "itemType": "arena", "price": 50000 },
    { "itemId": "tactical_vest_rare", "itemType": "arena", "price": 12000 }
  ]
}
```

- `itemType` is `"normal"` (from main inventory) or `"arena"` (from PlayerMiniGameInventory)
- For each listing: validate player owns the item, remove it from their inventory, create a `Listing` document
- Listing fields:
  ```
  sellerId, itemId, itemType, price, commission (price * 0.05),
  netPayout (price * 0.95), status ("active"), expiresAt (now + 48hr),
  listedAt
  ```
- Return: `{ listed: number, expectedPayout: totalNetPayoutIfAllSell }`

### 5.4 — Commission & Expiry

When a listing sells (`POST /market/listings/:id/buy`):
- Buyer pays full `price` (deduct from buyer's DC)
- Seller receives `price * 0.95` (net payout, game takes 5%)
- Item transfers to buyer's inventory (correct type: normal or arena)
- Listing status → `"sold"`

When a listing expires (cron job, check every hour):
- Find all listings where `expiresAt < now` and `status === "active"`
- Return each item to its seller's inventory
- Set status → `"expired"`

### 5.5 — Market Category Tabs

The market frontend page has category tabs:
```
Weapons | Clothing | Vehicles | Consumables | Materials | Arena Gear | Cars & Parts
```

Each tab filters listings by item category. The "Arena Gear" tab shows items from `PlayerMiniGameInventory` listings (weapons, body armor, ammo). "Cars & Parts" shows race car and car part listings.

### 5.6 — Auction System

The auction is a separate, self-contained system. Create:

**AuctionListing model:**
```
itemId: String
itemType: String         // "arena" | "normal"
currentBid: Number
currentBidderId: String | null
minimumBid: Number
expiresAt: Date
status: "active" | "sold" | "expired"
bids: [{ bidderId, amount, timestamp }]
```

**Bot-generated auctions:**
- A cron job runs every 30–120 minutes (random interval)
- It selects a random Epic or Legendary item from the MiniGameItem collection
- Creates an `AuctionListing` with:
  - `minimumBid`: reasonable starting price based on tier (Epic: 50,000 DC, Legendary: 200,000 DC)
  - `expiresAt`: now + random(30 minutes, 24 hours)
- Maximum 5 active auctions at a time

**Bidding:**
- `POST /auction/:id/bid` — player submits a bid
- Bid must exceed `currentBid` by at least 1% minimum increment
- Deduct bid from player's DC immediately (refund previous bidder if outbid)
- On expiry: if `currentBidderId` exists → transfer item, finalize sale. If no bids → expire, item re-enters pool.

**Frontend Auction page:**
- List of active auctions with item image, name, tier, current bid, time remaining countdown
- Bid input + button per auction
- "You've been outbid" notification if someone outbids the player

---

## TIER 6 — RACING CONDITION SYSTEM
**Goal: Add car condition/degradation system to racing**

### 6.1 — Car Condition Model

Add to the race car item schema (wherever cars are tracked in the racing system):
```
condition: { type: Number, default: 100, min: 0, max: 100 }  // percentage
```

### 6.2 — Condition Degradation

After every race (win or lose), degrade the car's condition:
- Normal race: condition -= random(2, 5)
- Race with a crash event: condition -= random(8, 15)
- Clamp at 0 minimum

### 6.3 — Performance Penalty by Condition

| Condition % | Speed Multiplier | Notes |
|---|---|---|
| 100–75% | 1.0 (full) | No penalty |
| 74–50% | 0.95 (-5%) | Mild wear |
| 49–25% | 0.88 (-12%) | Increased crash chance |
| 24–1% | 0.80 (-20%) | High breakdown risk |
| 0% | 0 (sidelined) | Cannot race until serviced |

Apply the condition multiplier to the car's speed stat before any race calculation.

### 6.4 — Service System

Add endpoint: `POST /race/cars/:carId/service`
- Costs: 2,000 DC for Common car, scaling up by tier (Legendary car service: 20,000 DC)
- Or: costs 1 "Service Token" item (a new consumable in the normal game shop)
- Restores condition to 100%
- Cannot service a car that is not at < 100% (return error)

### 6.5 — Frontend Display

In the Garage page, display each car's condition as a color-coded bar:
- Green (75–100%)
- Yellow (50–74%)
- Orange (25–49%)
- Red (1–24%)
- Gray + "SIDELINED" badge (0%)

Show a "Service Car" button on each car card if condition < 100%.

---

## TIER 7 — HP SCALING & PRESTIGE SYSTEM
**Goal: Fix player HP to scale meaningfully with level. Add prestige.**

### 7.1 — HP Formula

Player max HP is computed (not stored statically). Compute it whenever needed:

```typescript
function computeMaxHp(level: number, prestige: number): number {
  const baseHp = 100;
  const levelHp = level * 15;
  const quadraticHp = Math.floor(level * level * 0.2);
  const prestigeBonus = prestige * 200;
  return baseHp + levelHp + quadraticHp + prestigeBonus;
}
```

**Resulting HP by level (no prestige):**
- Level 1: ~115 HP
- Level 10: ~270 HP
- Level 20: ~480 HP
- Level 30: ~730 HP
- Level 50: ~1,350 HP
- Level 75: ~2,300 HP
- Level 100: ~3,600 HP

**With prestige:**
- Prestige 1, Level 1: ~315 HP (200 bonus)
- Prestige 5, Level 100: ~4,600 HP (1,000 bonus from 5 prestiges)

This function should be called wherever `maxHealth` is used. Do not store a static `maxHealth` — derive it from `level` and `prestige` always.

When a player levels up: recalculate their max HP. If current HP > new max HP (impossible unless debug), clamp. If current HP < max HP, do not auto-heal — just the cap increases.

### 7.2 — Prestige System

**Conditions to prestige:**
- Player must be at level 100
- Player must have completed at least 50 arena matches (optional gate — adjust if needed)

**Prestige action (`POST /user/prestige`):**
- Verify conditions
- `prestige += 1`
- `level = 1`
- `xp = 0`
- `xpToNext = [level 1 xp requirement]`
- `prestigeXpBoost += 10` (each prestige gives +10% permanent XP gain)
- Player keeps: DC, NC, keys, keyShards, items (all inventories), achievements, friends, guild membership
- Player loses: level (reset to 1), current HP resets to new level 1 max HP (recalculated with prestige bonus)

**Prestige rewards granted at time of prestige:**
- A special "Prestige P{N}" nameplate badge added to their badge collection
- A permanent animated profile frame unlock (the prestige frame tier matches prestige number — P1 frame, P2 frame, etc.)
- `prestigeXpBoost` applied to all future XP calculations

**XP boost application:**
```typescript
function applyXpGain(baseXp: number, prestigeXpBoost: number): number {
  return Math.floor(baseXp * (1 + prestigeXpBoost / 100));
}
```

**Frontend prestige display:**
- Profile page shows prestige badge (P1, P2, etc.) next to the username with a gold/animated glow
- Player list, chat, leaderboards — prestige badge shows inline next to name
- Level 100 players see a "PRESTIGE" button on their profile with a confirmation modal explaining what they lose and gain

---

## TIER 8 — UI POLISH & ARENA HUB
**Goal: Arena hub mode cards, royale hub cards, NPC store storefronts, item images everywhere**

### 8.1 — Arena Hub Page

The Arena hub page (`ArenaHubPage.tsx`) is redesigned as a mode-select screen:

```
[SHOOTING]                    [RACING]
┌─────────────────────┐       ┌─────────────────────┐
│                     │       │                     │
│  [Mode image]       │       │  [Mode image]       │
│  /assets/arena/     │       │  /assets/arena/     │
│  shooting.png       │       │  racing.png         │
│                     │       │                     │
└─────────────────────┘       └─────────────────────┘
      Shooting Arena                Racing Arena
```

Each card:
- Large image (use `/assets/arena/shooting.png` and `/assets/arena/racing.png`)
- Mode name centered below
- Hover: subtle glow effect (cyberpunk theme)
- Click: navigates to that mode's page

No other content on the hub page — pure mode select.

### 8.2 — Item Images Throughout

Ensure all item displays use the `ItemImage` component (already built in `src/components/ItemImage.tsx`):
- Arena inventory pages
- Royale reward reveal
- Loadout screen
- Market listings (both NPC store and player listings)
- Auction listings
- Match result screen (show what weapon you used, what was destroyed)

The `ItemImage` component loads PNG from `/assets/items/{itemId}.png`, falls back to SVG, falls back to generic icon. This pattern is already implemented — just make sure every new item display passes the correct `itemId` prop.

### 8.3 — NPC Store Storefronts

Each NPC store page has:
- Header: Store name in large cyberpunk font
- Sub-header: Keeper name and a short tagline
- Character art: `/assets/npcs/{storeId}.png` (full body or bust)
- FAQ chips: 4–5 clickable questions. Clicking expands answer inline.
- Item grid: items currently in stock, each with image, name, tier badge, price, "Buy" button
- "Out of Stock" placeholder if restock hasn't happened yet

### 8.4 — Remove Stale UI

- Remove any nav links or buttons pointing to deleted features (old combat, old general royale, old single-shop)
- Ensure the main NavBar or sidebar reflects all new routes: Royale Hub, Market (with tabs), Auction, Arena Hub

---

## APPENDIX A — ITEM RARITY RULES (ABSOLUTE)

| Source | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| NPC Bot Store | ✅ Always | ✅ Always | ✅ Sometimes (low chance) | ❌ Never | ❌ Never |
| Player Market | ✅ | ✅ | ✅ | ✅ | ✅ |
| DC Spin | ✅ | ✅ | ✅ (1 per category) | ❌ | ❌ |
| Master Royale | ❌ | ❌ | ✅ | ✅ | ✅ |
| Auction | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## APPENDIX B — HP QUICK REFERENCE

| Level | HP (No Prestige) | HP (Prestige 1) | HP (Prestige 5) |
|---|---|---|---|
| 1 | 115 | 315 | 1,115 |
| 10 | 270 | 470 | 1,270 |
| 25 | 600 | 800 | 1,600 |
| 50 | 1,350 | 1,550 | 2,350 |
| 75 | 2,300 | 2,500 | 3,300 |
| 100 | 3,600 | 3,800 | 4,600 |

---

## APPENDIX C — AMMO CATEGORY MAP

| Weapon Category | Ammo Category |
|---|---|
| Pistol | pistol_rounds |
| SMG | smg_rounds |
| Assault Rifle | rifle_rounds |
| Shotgun | shotgun_shells |
| Sniper Rifle | sniper_rounds |
| LMG | lmg_rounds |

---

## APPENDIX D — PRESTIGE XP BOOST TABLE

| Prestige | Permanent XP Boost |
|---|---|
| P0 (no prestige) | 0% |
| P1 | +10% |
| P2 | +20% |
| P3 | +30% |
| P4 | +40% |
| P5+ | +10% per prestige |

---

## APPENDIX E — ROYALE SPIN COSTS

| Spin Type | Cost |
|---|---|
| DC Spin | 500 DC |
| Master Royale | 20 NC + 1 Key |
| Key purchase (NC) | 50 NC = 3 Keys |

---

*End of update_tiers.md — Everything planned is captured here. Build tier by tier, complete each fully before starting the next.*
