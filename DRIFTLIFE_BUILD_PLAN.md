# DriftLife — Full Build Plan & Progress Tracker

> **For any agent picking this up:** Read this entire file before touching any code.
> Mark each item `[x]` as it is completed. Do not skip tiers. Build in order.
> Everything in this file was planned and approved by the project owner.

---

## How To Read This File

- `[ ]` = Not started
- `[~]` = In progress
- `[x]` = Done

Each **Tier** is a self-contained phase. Finish everything in a tier before moving to the next.
Each tier has subcategories. Each subcategory has tasks. Each task is one checkable item.

---

## Stack Reference

- **Frontend:** React + Vite (`artifacts/driftlife`)
- **Backend:** Express + Node.js (`artifacts/api-server`)
- **Database:** MongoDB + Mongoose
- **Auth:** Custom JWT + bcrypt + email OTP
- **Payments:** Telegram Stars (XTR) + in-game NC
- **Art style:** Sprite composites (pre-rendered PNG/WebP cards, sprite sheets for animation)
- **Animation:** Canvas 2D + CSS animations (NO real 3D, NO Three.js)

---

## Economy & Currency Rules (READ FIRST)

| Currency | Symbol | Earned From | Used For | Notes |
|---|---|---|---|---|
| Nova Credits | NC | Purchase (real money via Telegram Stars), subscriptions only | Premium NC spins, energy refills, exclusive cosmetics, gifting | NEVER drops from royale or missions |
| DriftCoin | DC | Match rewards, missions, achievements, selling/scrapping items | DC spins, basic shop, car tuning | Main free currency |
| Keys | Key | Leveling up, missions, achievements, General Royale drops | High-tier spins (guaranteed Rare+) | Hard to earn, don't make too easy |
| Key Shards | Shard | General Royale, daily missions | 10 shards = 1 Key | Soft path to keys |
| Energy | EN | Regenerates automatically, energy items | Play combat matches, play races | Max 200, regen 1 per 3 min |

### NC Rules (strict)
- **NC = Nova Credits** — this is the ONLY premium currency. There is no UC or UltraCredits.
- NC is ONLY earned by: buying with real money (Telegram Stars), or subscription daily rewards
- NC is NEVER a drop from any royale wheel
- NC is NEVER a mission or achievement reward (unless owner runs a special event)
- NC can be used to spin royale wheels (premium NC spin option)
- NC can be gifted to other players (10% fee applies)

### Energy Rules
- Max energy: 200 (can be increased permanently by items, cap at 300)
- Regeneration: +1 energy every 3 minutes (full regen in 10 hours from 0)
- Combat 1v1 costs: 10 energy
- Racing 2-player costs: 15 energy
- Racing 4-player costs: 25 energy
- Energy is NOT refunded if player disconnects or abandons
- Energy items: Small Drink (+10), Medium Drink (+25), Large Drink (+60), Mega Cell (+150), Ultimate Pack (+200)
- Energy Max booster items give permanent +5/+10/+20 to max cap

---

## What Gets REMOVED From The Current Game

> These systems must be deleted or disabled before or during Tier 1.

- [ ] All existing open-world PvP attacks between players
- [ ] All PvP-related routes, models, and frontend pages
- [ ] Merit currency (model, routes, frontend display)
- [ ] All existing combat/weapon/gear items from player inventories
- [ ] Gym stat system (strength, charisma, intelligence, street cred, defense) — gym UI restructured into Training Center
- [ ] Hospital usage from PvP (hospital stays only for crime failures)
- [ ] All existing daily missions and achievements that reference removed systems
- [ ] Any leaderboards tied to removed PvP systems

---

## Migration Jobs (run once on redeploy)

- [ ] **Merit → DC conversion job**
  - Convert every player's merit balance at rate: 1 Merit = 10 DC
  - Add DC to player account atomically
  - Send inbox notification per player: "Merit has been retired. Your X Merit were converted to Y DC."
  - Log conversion per player to audit collection

- [ ] **Old item removal + DC refund job**
  - Scan every player inventory for old combat/gear items
  - Convert each item to DC at fair rate (common = 50 DC, uncommon = 150 DC, rare = 500 DC, epic = 1500 DC, legendary = 5000 DC)
  - Add DC to player account atomically
  - Send inbox notification per player listing exactly which items were removed and how much DC they received
  - Log refund per player to audit collection

---

## TIER 1 — Foundation Cleanup & New Data Models

> Goal: Clean the codebase, remove old systems, add all new DB models needed for Tier 2+.
> Do not build any game UI yet. Just models, migrations, and cleanup.

### 1A — Remove Old Systems
- [x] Delete/disable all open-world PvP routes (GET /targets, POST /attack removed from combat.ts)
- [x] Removed Merit from Achievement catalog (meritReward → dcReward, first_merit achievement deleted)
- [x] Achievement grants now pay DC instead of merit
- [x] Removed merit stat case from getCurrentProgress()

### 1B — Run Migration Jobs
- [x] Build Merit → DC migration job (jobs/migration.ts — runMeritMigration)
- [x] Build old item → DC refund job (runItemRefundMigration — deletes items after processing)
- [x] Build equipment slots clear job (runEquipmentClearMigration)
- [x] Admin endpoints: POST /api/admin/migration/run|merit|items|equipment (requireOwner)

### 1C — Energy System Model
- [x] energy default 100 → 200, maxEnergy default 100 → 200
- [x] derivedMaxEnergy now returns min 200, max 300
- [x] Regen rate changed from 1/10min → 1/3min
- [x] Added keys, keyShards, combatWinStreak, miniGameMatchesToday, miniGameResetAt to User model
- [x] GET /api/energy/status route (returns energy, max, regen rate, msToFull)
- [x] deductEnergy() utility — atomic with race-safe findOneAndUpdate guard

### 1D — New Item Models

#### MiniGameItem model (weapons, armor, consumables)
Fields:
- `itemId` (string, unique slug e.g. `pistol_common`)
- `name` (string)
- `category` (enum: weapon | armor | consumable | ammo)
- `tier` (enum: common | uncommon | rare | epic | legendary)
- `stats` (object: damage, defense, hp, accuracy, etc.)
- `imageCard` (string, URL or asset path)
- `flavorText` (string)
- `stackable` (boolean)
- `maxStack` (number)

#### Car model
Fields:
- `carId` (string, unique slug e.g. `cyberjet_legendary`)
- `name` (string)
- `tier` (enum: common | uncommon | rare | epic | legendary)
- `baseStats` (object: topSpeed, acceleration, handling, nitro)
- `imageCard` (string)
- `flavorText` (string)

#### CarPart model
Fields:
- `partId` (string, unique slug)
- `name` (string)
- `partType` (enum: engine | tires | nitro | bodyKit | spoiler)
- `tier` (enum: common | uncommon | rare | epic | legendary)
- `statBoost` (object)
- `imageCard` (string)

#### PlayerMiniGameInventory model
Fields:
- `userId` (ref User)
- `weapons` (array of { itemId, quantity })
- `armor` (array of { itemId, quantity })
- `consumables` (array of { itemId, quantity })
- `ammo` (array of { itemId, quantity })

#### PlayerGarage model
Fields:
- `userId` (ref User)
- `cars` (array of { carId, equippedParts: { engine, tires, nitro, bodyKit, spoiler }, customization: { paint, underglow, decals, rims } })
- `parts` (array of { partId, quantity })
- `activeCar` (string, carId of currently selected car)

#### PlayerLoadout model (combat)
Fields:
- `userId` (ref User)
- `weapon` (itemId or null)
- `armor` (itemId or null)
- `consumable1` (itemId or null)
- `consumable2` (itemId or null)
- `ammoType` (itemId or null)
- `lastUpdated` (timestamp)

### 1E — Royale Models

#### RoyaleItem model (seed data)
Fields:
- `royaleType` (enum: general | shooting | racing)
- `itemType` (enum: currency | energy | key | shard | title | badge | background | spinToken | lootCrate | xpBoost | energyMaxBoost | weapon | armor | consumable | ammo | car | carPart)
- `tier` (enum: common | uncommon | rare | epic | legendary)
- `name` (string)
- `imageCard` (string)
- `reward` (object: what the player actually receives when they win this)
- `dropWeight` (number, higher = more common)

#### PlayerRoyaleLog model (audit)
Fields:
- `userId` (ref User)
- `royaleType` (string)
- `currency` (string: dc | uc | key)
- `spinsCount` (number: 1 or 10)
- `results` (array of itemIds won)
- `createdAt` (timestamp)

#### PlayerPityCounter model
Fields:
- `userId` (ref User)
- `royaleType` (string)
- `spinsSinceLastRare` (number)

### 1F — Match Models

#### CombatMatch model
Fields:
- `matchId` (string, uuid)
- `player1Id` (ref User)
- `player2Id` (ref User or null if AI)
- `isPlayer2AI` (boolean)
- `aiName` (string, human-like name if AI)
- `player1Loadout` (snapshot of loadout at match start)
- `player2Loadout` (snapshot of loadout or AI generated)
- `turns` (array of turn actions and results)
- `status` (enum: waiting | active | complete | abandoned)
- `winnerId` (ref User or null)
- `player1HP` (number)
- `player2HP` (number)
- `currentTurn` (number)
- `currentTurnDeadline` (timestamp)
- `energyCost` (number)
- `rewardsGranted` (boolean)
- `createdAt` (timestamp)

#### RaceMatch model
Fields:
- `matchId` (string, uuid)
- `mode` (enum: 2player | 4player)
- `players` (array of { userId, isAI, aiName, carSnapshot, finishTime, placement })
- `status` (enum: waiting | active | complete)
- `trackSeed` (number, random seed for obstacle generation)
- `energyCost` (number)
- `createdAt` (timestamp)

### 1G — Leaderboard Model
- `leaderboardType` (enum: combat_wins | combat_streak | race_wins | race_fastest)
- `userId` (ref User)
- `score` (number)
- `weekStart` (date, ISO Monday)
- `updatedAt` (timestamp)

### 1D–1G — New Models (all created)
- [x] MiniGameItem model (combat item catalog — 50 items seeded)
- [x] RaceCar model (15 cars seeded across 5 tiers)
- [x] CarPart model (25 parts seeded across 5 tiers)
- [x] PlayerMiniGameInventory model
- [x] PlayerGarage model
- [x] PlayerLoadout model
- [x] RoyaleItem model (150 items seeded: 50 per royale type)
- [x] PlayerRoyaleLog model
- [x] PlayerPityCounter model (tracks spinsSinceLastRare + spinsSinceLastEpic)
- [x] CombatMatch model (full turn state machine)
- [x] RaceMatch model (2player/4player, parallel architecture)
- [x] MiniGameLeaderboard model (5 leaderboard types, weekly)

### 1H — Seed Data
- [x] Seed all 50 General Royale items (seeds/royaleItems.ts — runs on startup)
- [x] Seed all 50 Shooting Royale items (same file)
- [x] Seed all 50 Racing Royale items (same file)
- [x] Seed 15 race cars + 25 car parts (seeds/raceCars.ts — runs on startup)
- [x] Seed 50 combat items across 5 tiers (seeds/miniGameItems.ts — runs on startup)

---

## TIER 2 — Royale System

> Goal: All three spinning wheels working end to end.

### 2A — Royale Engine (backend)
- [ ] `POST /api/royale/spin` — accepts { royaleType, currency, count: 1 | 10 }
  - Validate player has enough DC/NC/Key
  - Deduct cost atomically
  - Roll items using weighted drop table
  - Apply pity counter (15 spins without Rare+ → guarantee Rare+)
  - Grant items to player inventory / wallet
  - Log to PlayerRoyaleLog
  - Return array of won items
- [ ] Pity system logic (PlayerPityCounter updated on every spin)
- [ ] 10× spin gives guaranteed 1 Rare+ and costs 9× single spin price
- [ ] Drop rates enforced server-side:
  - Common: 60%
  - Uncommon: 25%
  - Rare: 10%
  - Epic: 4%
  - Legendary: 1%

### 2B — Royale Frontend

#### General Royale page
- [ ] Animated spin wheel (sprite composite, neon style)
- [ ] Shows current currency balances (DC / NC / Keys / Shards)
- [ ] Three spin buttons: Spin with DC | Spin with NC | Spin with Key
- [ ] 1× and 10× toggle
- [ ] Reveals won item with card animation (flip reveal, glow on Rare+)
- [ ] Inventory updates live after spin
- [ ] Pity counter display: "X spins since last Rare"

#### Shooting Royale page
- [ ] Same wheel UI but themed for combat
- [ ] Shows combat items (weapons, armor, consumables, ammo)
- [ ] Same currency and pity system

#### Racing Royale page
- [ ] Same wheel UI but themed for racing
- [ ] Shows cars and car parts
- [ ] Same currency and pity system

### 2C — Item Card Design
- [ ] Design item card template (tier border color, name, stats, flavor text, image placeholder)
  - Common: grey border
  - Uncommon: green border
  - Rare: blue border
  - Epic: purple border
  - Legendary: gold animated border
- [ ] Generate sprite composite card images for all 150 royale items
- [ ] Generate card images for all combat items
- [ ] Generate card images for all cars and car parts

---

## TIER 3 — Mini-Game Hub & Loadout System

> Goal: The lobby where players prepare before entering combat or racing.

### 3A — Mini-Game Hub Frontend
- [ ] New page/section: "Arena" (combat hub) and "Garage" (racing hub)
- [ ] These hubs are separate from the main game inventory
- [ ] Players cannot see main game items here, only mini-game items

### 3B — Combat Loadout
- [ ] Loadout screen: pick 1 weapon + 1 armor + 2 consumables + 1 ammo type
- [ ] Shows item cards with stats
- [ ] Loadout persists until player manually changes it
- [ ] `POST /api/loadout/combat` — save loadout
- [ ] `GET /api/loadout/combat` — get current loadout
- [ ] Empty loadout = use default bare hands (no weapon, no armor)

### 3C — Garage & Car Tuning
- [ ] Garage screen: shows all owned cars
- [ ] Select active car
- [ ] Tune car: equip engine, tires, nitro, body kit, spoiler (each slot shows owned parts)
- [ ] Customization: pick paint, underglow color, decals, rims
- [ ] Sell car button: confirmation modal → returns DC based on car tier
- [ ] Scrap car button: confirmation modal → returns CarPart items based on car tier
- [ ] Car stat preview: shows total speed/acceleration/handling/nitro after tuning
- [ ] `POST /api/garage/tune` — save car tuning
- [ ] `POST /api/garage/sell` — sell car
- [ ] `POST /api/garage/scrap` — scrap car for parts

---

## TIER 4 — Combat System

> Goal: Full 1v1 turn-based combat working end to end.

### 4A — Matchmaking Backend
- [ ] `POST /api/combat/queue/join` — join queue
  - Deduct 10 energy (reject if not enough)
  - Check for available opponent within skill range (±10% score)
  - If found, create CombatMatch and return matchId
  - If not found, add to queue
- [ ] `POST /api/combat/queue/leave` — leave queue (refund energy)
- [ ] Queue worker: every 5 seconds, check queue
  - Try to match players within skill range
  - After 15s widen range to ±25%
  - After 30s fill with AI (human name, scaled stats)
- [ ] Skill score formula: (player level × 10) + (average gear tier × 100) + (win rate × 50)
- [ ] AI name pool: 50+ realistic human-sounding names (e.g. "Razor_K", "Ghost_47")
- [ ] AI stats: scaled to player ±10%, target ~50% win rate
- [ ] AI action selection: weighted random, heals below 35% HP, defends after heavy attack

### 4B — Combat Engine Backend
- [ ] `GET /api/combat/match/:matchId` — get current match state
- [ ] `POST /api/combat/match/:matchId/action` — submit turn action
  - Actions: attack | defend | use_item | reload | special
  - Validate it's player's turn
  - Validate action is legal (has item, has ammo, etc.)
  - Apply action, calculate damage/effects
  - If vs AI, immediately calculate and apply AI action
  - Check win condition (HP ≤ 0)
  - Return new match state
- [ ] Turn timer: 15 seconds, auto-submit basic attack if timeout
- [ ] Damage formula: weapon damage + random variance - armor defense
- [ ] Element effects: fire = damage over time, shock = stun chance, toxic = poison, AP = ignore shield
- [ ] Win condition: first player to 0 HP loses
- [ ] Draw condition: if both reach 0 on same turn

#### Rewards on match end
- [ ] Winner: +150 DC, +200 XP, +1 Key Shard
- [ ] Win streak bonus: +50 DC per streak, max +300 DC bonus
- [ ] Loser: +40 DC, +60 XP
- [ ] Draw: both get +80 DC, +100 XP
- [ ] Daily reward cap: full rewards for first 30 matches, 50% after, tiny XP only after 50

### 4C — Combat Frontend (Arena)
- [ ] Queue screen: "Searching for opponent…" with animated spinner, cancel button
- [ ] Match found screen: shows opponent name (human or hidden AI name), loadout preview
- [ ] Combat arena view (Canvas 2D or CSS animated):
  - Side-view or slight isometric arena
  - Player character and opponent character with idle animation
  - On attack: character moves forward, muzzle flash or swing animation
  - On hit: target flashes red, floating damage number appears
  - On heal: green floating number
  - On death: collapse animation
  - Screen shake on critical hits
  - Health bars for both players, updating in real time
- [ ] Action panel: Attack | Defend | Use Item | Reload | Special (greyed if unavailable)
- [ ] Turn timer countdown (15 seconds, turns red at 5)
- [ ] Turn log: scrollable text log of what happened each turn ("Razor_K fires his Assault Rifle for 45 damage!")
- [ ] Post-match screen: Winner/Loser banner, rewards breakdown

---

## TIER 5 — Racing System

> Goal: Full parallel solo racing working end to end.

### 5A — Matchmaking Backend
- [ ] `POST /api/race/queue/join` — join queue
  - Accept mode: 2player | 4player
  - Deduct energy (15 for 2-player, 25 for 4-player)
  - Show queue as 1/2 or 1/4
  - Queue waits up to 30 seconds for real players
  - Fill remaining with AI if timeout
- [ ] `POST /api/race/queue/leave` — leave queue (refund energy)
- [ ] AI racer generation:
  - Human-like name from name pool
  - Car tier matched to player level
  - Pre-generate finish time server-side with realistic variance
  - AI sometimes misses gear shifts (random), sometimes crashes (random)

### 5B — Race Engine Backend
- [ ] `GET /api/race/match/:matchId` — get match state
- [ ] `POST /api/race/match/:matchId/shift` — submit gear shift action
  - Validate timing window (green zone hit or miss)
  - Calculate speed boost or miss penalty
  - Update player progress
  - Check if player reached finish line
- [ ] `POST /api/race/match/:matchId/nitro` — use nitro
  - Validate player has nitro remaining
  - Apply speed burst
- [ ] Server calculates final placement by comparing finish times
- [ ] Leaderboard endpoint returns live positions by % of track completed
- [ ] Anti-cheat: validate all inputs, reject impossible timing sequences

#### Rewards
- [ ] 1st place: +300 DC, +300 XP, +1 Key Shard, 10% chance Racing Royale spin token
- [ ] 2nd place: +150 DC, +180 XP
- [ ] 3rd place: +80 DC, +100 XP
- [ ] 4th place: +40 DC, +60 XP
- [ ] Same daily cap as combat

### 5C — Race Frontend (Garage + Race Screen)
- [ ] Queue screen: "1/2 players" or "1/4 players" counter, animated, cancel button
- [ ] Race screen (Canvas 2D):
  - **Pseudo-3D scrolling road** (horizon line, perspective road lines, buildings scaling)
  - Player's car visible with spinning wheel animation, body bobbing
  - Nitro triggers flame sprite behind car
  - Crash zone collision: car swerves, sparks fly, speed penalty
  - Road elements: other cars as obstacles, road markings, neon buildings parallax
  - Speed meter (analog gauge look)
  - Gear indicator (current gear number)
  - Gear shift panel: "-" button, gear box with green zone, "+" button
    - Needle sweeps across
    - Green zone = shift at the right moment for boost
    - Miss = no boost or small penalty
  - Nitro button (lights up when available)
  - Distance to finish progress bar
  - Live mini-leaderboard (names + % complete, updates per second)
- [ ] Finish screen: placement banner, rewards breakdown, car animation (winner does burnout)

---

## TIER 6 — Leaderboards, Missions & Achievements

> Goal: Progression systems that give players long-term goals.

### 6A — Leaderboards
- [ ] Weekly combat wins leaderboard
- [ ] Weekly combat win streak leaderboard
- [ ] Weekly race wins leaderboard
- [ ] Weekly fastest race time leaderboard (per mode: 2p and 4p separate)
- [ ] Reset every Monday at 00:00 UTC
- [ ] Top 3 reward on reset:
  - 1st: 5 Keys + 5,000 DC
  - 2nd: 3 Keys + 2,000 DC
  - 3rd: 1 Key + 1,000 DC
- [ ] Leaderboard page in frontend with weekly countdown timer

### 6B — Daily Missions (new set, replacing old)
Missions reset daily at 00:00 UTC. Give XP, DC, Key Shards.

Examples (all referencing new systems only):
- Win 2 combat matches
- Complete 3 races
- Use nitro 10 times in a race
- Open 1 royale spin
- Earn 500 DC from matches
- Finish a race in 1st place
- Use a consumable in combat
- Log in today
- Claim daily NC (subscription players)
- Complete 5 crime attempts

- [ ] Build new daily mission system (remove all old ones)
- [ ] Mission progress tracks automatically from game events
- [ ] Rewards delivered on mission completion, not at end of day

### 6C — Achievements (new set, replacing old)
One-time unlocks. Give Keys, DC, titles, badges.

Examples:
- Win your first combat match → 1 Key
- Win 10 combat matches → 3 Keys + Uncommon Title
- Win 50 combat matches → 5 Keys + Rare Badge
- Reach a 5 win streak → 2 Keys
- Finish 1st in a race → 1 Key
- Win 10 races → 3 Keys
- Open 10 royale spins → DC reward
- Reach level 10/25/50 → Keys
- Complete all daily missions in a day → Rare spin token
- Earn a Legendary item from royale → special badge

- [ ] Build new achievement system (remove all old ones)
- [ ] Achievements check automatically on relevant events
- [ ] Inbox notification on unlock

---

## TIER 7 — Training Center (Restructured Gym)

> Goal: Replace old stat gym with a mini-game skill training system.

### 7A — Training Center
- [ ] Rename Gym → Training Center
- [ ] Remove old stat training (strength, charisma, intelligence, etc.)
- [ ] Add new training types:
  - Combat Drills: costs energy, gives small permanent accuracy bonus
  - Racing Practice: costs energy, gives better gear-shift timing window
  - Endurance Training: costs energy, gives small energy regen speed boost
- [ ] Daily training limit (prevent grinding to max instantly)
- [ ] Training Center page in frontend with new UI

---

## TIER 8 — Polish, Notifications & Admin

> Goal: Game feels complete and manageable.

### 8A — Inbox Notifications
- [ ] Migration notifications (merit → DC, item refunds) already in Tier 1
- [ ] Leaderboard reward notifications
- [ ] Achievement unlock notifications
- [ ] Match result summary notifications
- [ ] All notifications use existing inbox system

### 8B — Admin Panel Updates
- [ ] View migration job logs
- [ ] View royale spin logs per player
- [ ] View combat match history
- [ ] View race match history
- [ ] Manually grant DC/NC/Keys to player
- [ ] Run special events (toggle NC sources temporarily)
- [ ] Adjust royale drop rates without code deploy

### 8C — General Polish
- [ ] Energy display always visible in header (with regen timer)
- [ ] Currency display always visible in header: DC | NC | Keys | Shards
- [ ] Item card animations: hover lift effect, tier glow pulse
- [ ] Sound effects toggle (optional, off by default)
- [ ] Match history page: last 20 combat matches and races
- [ ] Profile page shows: combat wins, races won, fastest race time, current loadout car

---

## Item Reference — All 50 General Royale Items

### Common (10)
1. +50 DC
2. +100 XP
3. 2 Key Shards
4. Small Energy Drink (+10 energy)
5. Common Title
6. Basic Avatar Background
7. Energy Regen Boost (10 min)
8. 1 Spin Token
9. Small DC Booster (2× DC next match)
10. Common Loot Crate

### Uncommon (10)
1. +150 DC
2. +300 XP
3. 5 Key Shards
4. Medium Energy Drink (+25 energy)
5. Uncommon Title
6. Avatar Background
7. Energy Regen Boost (30 min)
8. 2 Spin Tokens
9. Uncommon Loot Crate
10. 1 Key

### Rare (10)
1. +500 DC
2. +1,000 XP
3. 1 Key
4. Large Energy Drink (+60 energy)
5. Rare Title
6. Premium Avatar Background
7. Energy Max +5 (permanent)
8. 3 Spin Tokens
9. Rare Loot Crate
10. 8 Key Shards

### Epic (10)
1. +1,500 DC
2. +3,000 XP
3. 3 Keys
4. Mega Energy Cell (+150 energy)
5. Epic Title
6. Animated Avatar Background
7. Energy Max +10 (permanent)
8. Golden Spin Token
9. Epic Loot Crate
10. 15 Key Shards

### Legendary (10)
1. +5,000 DC
2. +10,000 XP
3. 10 Keys
4. Ultimate Energy Pack (+200 energy)
5. Legendary Title
6. Exclusive Animated Avatar Background
7. Energy Max +20 (permanent)
8. Mythic Key (guaranteed Legendary next spin)
9. Legendary Loot Crate
10. 30 Key Shards

---

## Item Reference — All 50 Shooting Royale Items

### Common (10)
1. Pistol
2. Knife
3. Baseball Bat
4. Light Vest
5. Bandage (consumable)
6. Smoke Grenade
7. Standard Ammo
8. Tactical Gloves
9. Beanie Helmet
10. Flashlight

### Uncommon (10)
1. SMG
2. Combat Knife
3. Medium Vest
4. Medkit
5. Frag Grenade
6. Hollow Point Ammo
7. Tactical Boots
8. Ear Protection
9. Combat Mask
10. Suppressor

### Rare (10)
1. Assault Rifle
2. Shotgun
3. Heavy Vest
4. Advanced Medkit
5. Stun Grenade
6. Armor Piercing Ammo
7. Night Vision Goggles
8. Combat Helmet
9. Quick Mag
10. Scope

### Epic (10)
1. Sniper Rifle
2. Energy SMG
3. Riot Shield
4. Nano Medkit
5. EMP Grenade
6. Incendiary Ammo
7. Exoskeleton Gloves
8. Smart Visor
9. Extended Barrel
10. Recon Drone

### Legendary (10)
1. Plasma Rifle
2. Legendary Katana
3. Titan Armor
4. Regen Field Kit
5. Black Hole Grenade
6. Quantum Ammo
7. Predator Mask
8. Hologram Decoy
9. Omega Pistol
10. Wingsuit

---

## Item Reference — All 50 Racing Royale Items

### Common (10)
1. Rustbucket (car)
2. Scooter (car)
3. City Bike (car)
4. Standard Engine (part)
5. Basic Tires (part)
6. Road Paint (cosmetic)
7. Basic Spoiler (part)
8. Standard Brakes (part)
9. Vintage Horn (cosmetic)
10. Oil Can (consumable, repair)

### Uncommon (10)
1. Hatchback (car)
2. Muscle Car (car)
3. Sport Bike (car)
4. V6 Engine (part)
5. Racing Tires (part)
6. Neon Trim (cosmetic)
7. Small Spoiler (part)
8. Disc Brakes (part)
9. Turbo Horn (cosmetic)
10. Repair Kit (consumable)

### Rare (10)
1. Sports Car (car)
2. Drift Coupe (car)
3. Racing Motorcycle (car)
4. V8 Engine (part)
5. Slick Tires (part)
6. Underglow Kit (cosmetic)
7. Racing Spoiler (part)
8. Ceramic Brakes (part)
9. Nitro Tank (part)
10. Advanced Repair Kit (consumable)

### Epic (10)
1. Supercar (car)
2. Hyperbike (car)
3. Electric Engine (part)
4. Performance Tires (part)
5. Animated Decals (cosmetic)
6. Carbon Spoiler (part)
7. Racing Brakes (part)
8. Double Nitro (part)
9. Auto-Tune Chip (part)
10. Supercharger (part)

### Legendary (10)
1. Cyberjet (car)
2. Neon Beast (car)
3. Hovercar (car)
4. Fusion Engine (part)
5. Holographic Tires (part)
6. Aero Wings (cosmetic)
7. Quantum Brakes (part)
8. Infinite Nitro (part)
9. AI Copilot Chip (part)
10. Time Warp Module (part — temporary speed burst special)

---

## Combat Stats Reference

| Weapon | Tier | Base Damage | Special |
|---|---|---|---|
| Pistol | Common | 15–25 | None |
| Knife | Common | 10–20 | Bleed chance 10% |
| Baseball Bat | Common | 12–22 | None |
| SMG | Uncommon | 20–35 | Fires twice chance 20% |
| Combat Knife | Uncommon | 18–28 | Bleed 20% |
| Assault Rifle | Rare | 35–55 | None |
| Shotgun | Rare | 40–70 | -20% accuracy |
| Sniper Rifle | Epic | 60–100 | Headshot chance 25% |
| Energy SMG | Epic | 30–50 | Shock chance 30% |
| Plasma Rifle | Legendary | 80–130 | Burns target |
| Legendary Katana | Legendary | 70–120 | Ignore 50% armor |
| Omega Pistol | Legendary | 90–140 | Pierces shields |

---

## Racing Stats Reference

| Car | Tier | Top Speed | Acceleration | Handling | Nitro |
|---|---|---|---|---|---|
| Rustbucket | Common | 40 | 30 | 30 | 20 |
| Scooter | Common | 35 | 45 | 50 | 15 |
| Hatchback | Uncommon | 55 | 45 | 55 | 30 |
| Muscle Car | Uncommon | 65 | 60 | 40 | 40 |
| Sports Car | Rare | 75 | 70 | 65 | 50 |
| Drift Coupe | Rare | 70 | 65 | 80 | 55 |
| Supercar | Epic | 88 | 82 | 75 | 65 |
| Hyperbike | Epic | 92 | 88 | 70 | 60 |
| Cyberjet | Legendary | 100 | 95 | 90 | 85 |
| Neon Beast | Legendary | 98 | 92 | 95 | 80 |
| Hovercar | Legendary | 95 | 90 | 100 | 90 |

---

## Royale Spin Pricing (to be confirmed by owner before Tier 2)

| Royale | DC Spin | NC Spin | Key Spin |
|---|---|---|---|
| General | 300 DC | 20 NC | 1 Key |
| Shooting | 500 DC | 30 NC | 1 Key |
| Racing | 500 DC | 30 NC | 1 Key |

10× spin = 9× cost (one free spin), guaranteed 1 Rare+.

---

## Pity System

- Every royale type tracks spins per player separately
- After 15 spins without a Rare+: next spin guaranteed Rare+
- After 50 spins without an Epic+: next spin guaranteed Epic+
- Pity counter resets when a qualifying tier is won
- Pity is tracked server-side in PlayerPityCounter model

---

## Hospital & Jail Rules (final)

- Hospital: triggered ONLY by crime failure (injury)
- Jail: triggered ONLY by crime failure (caught)
- NO hospital or jail from combat mini-game
- Players can reduce time with NC, items, or just wait
- Hospital and jail block the player from doing crimes but NOT from playing mini-games

---

## Architecture Notes For The Next Agent

### Matchmaking
- Queue stored in Redis (if available) or in-memory Map on the server
- Queue worker runs every 5 seconds via setInterval at server startup
- Match expiry: if player does not connect to match within 60 seconds, match cancelled and energy refunded

### Real-time Updates
- Combat and racing use polling (`GET /api/combat/match/:id` every 2 seconds)
- Or use existing Socket.io if already in the project
- Do NOT add new WebSocket server just for this

### Anti-cheat
- All game-changing logic runs server-side
- Client sends only player intentions (action, timing hit/miss)
- Server validates and calculates outcomes
- Reject any requests with impossible timing (faster than human possible)

### AI
- AI decisions run server-side instantly after player action
- AI names pulled from a hardcoded pool of 50+ realistic names
- AI stats generated from: player level ±10% variance
- AI race times generated at match start, revealed progressively during race

### Images
- Item card images: 200×280px WebP, lazy loaded
- Sprite sheets: horizontal strip, frame size 128×128px
- All images served from `/assets/` static folder or CDN
- Use consistent naming: `{type}_{tier}_{slug}.webp` e.g. `car_legendary_cyberjet.webp`

---

## Build Order Summary

| Tier | Name | Status |
|---|---|---|
| Tier 1 | Foundation Cleanup & Data Models | [ ] |
| Tier 2 | Royale System | [ ] |
| Tier 3 | Mini-Game Hub & Loadout System | [ ] |
| Tier 4 | Combat System | [ ] |
| Tier 5 | Racing System | [ ] |
| Tier 6 | Leaderboards, Missions & Achievements | [ ] |
| Tier 7 | Training Center (Restructured Gym) | [ ] |
| Tier 8 | Polish, Notifications & Admin | [ ] |

---

*Last updated by planning agent. All decisions above were confirmed by the project owner.*
*Do not change the plan without owner confirmation. Mark items done as you build them.*
