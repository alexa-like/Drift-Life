# DRIFTLIFE — Complete Game Design & Rebuild Master Prompt
### New Vanta · 2047 · Persistent Multiplayer Text-Based Open World RPG

---

## OVERVIEW & VISION

DRIFTLIFE is a persistent, multiplayer, browser-based text RPG set in **New Vanta** — a sprawling neon dystopia in the year 2047. Players choose a faction, build a criminal or corporate empire, fight rivals, trade on a player-driven economy, talk to AI-powered NPCs with persistent memory, craft items, own properties, run skill trees, and climb leaderboards in a city that never stops moving.

The game lives entirely in the browser. No downloads. No client installs. Everything is dark-themed, cyberpunk-aesthetic UI panels. The world is fully shared — every player action affects every other player in real time through live socket connections.

**Core gameplay loop:**
Daily Login Reward → Jobs (earn base DC) → Crimes (amplify DC with risk) → Combat NPCs or PvP → Market (trade items with players) → Property (passive income) → Crafting (turn materials into gear) → Skill Trees (specialize your build) → Guilds (faction dominance)

---

## THE WORLD: NEW VANTA

New Vanta is divided into **7 persistent districts**. The player is always "located" in one district at a time. Changing districts costs Energy and moves the player to that zone's real-time chat, available jobs, crimes, NPCs, and combat encounters.

### Districts

| District | Faction | Danger | Primary Activity |
|---|---|---|---|
| **Downtown Core** | The Suits | ⚠️×5 | Corporate jobs, high-level PvP, elite crimes |
| **The Boulevard** | Neutral | ⚠️×3 | Social hub, clubs, mid-tier jobs |
| **Industrial East** | The Street | ⚠️×4 | Dock work, gang crimes, Street NPCs |
| **Port District** | The Street | ⚠️×4 | Smuggling, black market, cargo jobs |
| **Tech Quarter** | The Grid | ⚠️×2 | Hacking jobs, data crimes, Grid NPCs |
| **Residential North** | Neutral | ⚠️×1 | Starter jobs, low-risk crimes, safe zone |
| **The Outskirts** | Uncontrolled | ⚠️×5 | Rarest loot, boss NPCs, extreme crime rewards |

Each district shows:
- **Live player count** currently in that zone
- **Controlling faction** (color-coded)
- **Danger level** meter
- **Available jobs badge** (how many jobs are accessible here)
- **Zone Chat** — real-time chat room for all players currently in that district
- **NPC encounters** specific to that zone

**Travelling between districts:**
- Costs Energy based on distance and danger level of the destination
- Player's `currentDistrict` field updates immediately
- Player automatically joins the new district's socket room and leaves the old one
- Cannot commit crimes or do jobs until travel resolves

**Faction Territory Control:**
The faction with the highest cumulative activity (XP earned, crimes completed, combat wins) in a district controls it. Control shifts weekly. Controlling faction members get a passive bonus in that district (e.g., +5% job DC, +5% crime success rate).

---

## THREE FACTIONS

Chosen once during onboarding. Affects job bonuses, crime bonuses, NPC dialogue tone, and territory.

### 🏢 The Suits — Corporate Empire
Power through wealth and manipulation. Suits specialize in high-paying corporate jobs, trading, social manipulation, and data crimes. Stat affinity: **Charisma** and **Intelligence**.

Bonuses:
- +10% DC from jobs
- +5% to Scam and Espionage crime success
- Discount at Downtown Core market stalls

### 🔥 The Street — Underground Syndicate
Power through reputation and raw force. Street players dominate physical combat, run protection rackets, and control the black market. Stat affinity: **Strength** and **Street Cred**.

Bonuses:
- +10% DC from PvP wins
- +5% to Robbery and Heist crime success
- Extra XP from combat NPCs

### 💻 The Grid — Digital Collective
Power through information and precision. Grid players hack systems, manipulate markets, and extract data. Stat affinity: **Intelligence** and **Energy efficiency**.

Bonuses:
- -10% Energy cost on all jobs
- +5% to Data Breach and Scam success
- Access to exclusive Grid market listings

---

## PLAYER DATA MODEL — EVERY FIELD

Every player account stores the following:

### Identity & Auth
- `email` — login credential, verified via OTP
- `username` — display name (3–20 chars, unique)
- `tag` — unique identifier like `Username#1234` (auto-generated)
- `passwordHash` — bcrypt hash
- `verified` — boolean; unverified players can browse but not play
- `verifyOtp` / `verifyOtpExpires` — email verification one-time codes
- `resetToken` / `resetTokenExpires` — password reset tokens
- `role` — `player` | `staff` | `owner`
- `banned` — boolean; `bannedReason` — string
- `mutedUntil` — Date; player cannot chat until this timestamp
- `lastLoginAt` — tracks login streaks for Daily Rewards

### Progression
- `level` — 1 to 100
- `xp` — current XP amount
- `xpToNext` — XP required to reach next level
- `prestige` — prestige rank (post-level-100 system)
- `skillPoints` — unspent stat points (1 awarded every 5 levels from level 10)
- `unlockedSkills` — array of skill node IDs from skill trees
- `skillTree` — primary tree chosen (`hustler` | `fighter` | `ghost` | `connector`)
- `secondarySkill` — secondary tree (unlocks at level 50)
- `seasonXp` — XP earned in the current season (separate from main XP)
- `craftingXp` — XP from crafting, advances crafting mastery level

### Currencies
- `dc` — Drift Coins (primary earned currency, in wallet)
- `nc` — Nova Credits (premium currency)
- `bankBalance` — DC stored safely in the bank (protected from PvP theft)

### Core Stats
- `strength` — combat power; affects PvP/PvE damage rolls
- `charisma` — affects trading prices, some crime success rates
- `intelligence` — affects crime success rates, hacking, data theft
- `streetCred` — reputation; unlocks higher-tier crimes and faction missions
- `nerve` — crime resource; max 50; regenerates 1 per 5 minutes
- `energy` — job/travel resource; max 100; regenerates 1 per 3 minutes
- `maxEnergy` / `maxNerve` — base max values (can be raised by skill nodes)
- `health` / `maxHealth` — combat health pool; max 100
- `energyRegenAt` / `nerveRegenAt` — timestamps for regen tracking

### Combat & Criminality
- `faction` — `suits` | `street` | `grid`
- `wantedLevel` — 0 to 5 stars; decays passively over 30 minutes of inactivity
- `wantedDecayAt` — timestamp for when next decay tick occurs
- `hospitalized` — boolean
- `hospitalReleaseAt` — when the player is freed
- `lastAttackAt` — timestamp of last PvP attack
- `attacksToday` — number of PvP attacks made today
- `attackResetAt` — when daily PvP counter resets
- `attackCooldowns` — array of `{targetId, until}` — per-target 60-min cooldown

### Social & Customization
- `following` — array of user refs (who the player follows)
- `mutedUsers` — array of user IDs (hidden from chat)
- `blockedUsers` — array of user IDs (blocked from DMs)
- `titles` — array of earned title strings
- `equippedTitle` — currently displayed title beneath username
- `avatar` — seed index for procedural SVG avatar (1–20)
- `avatarUrl` — custom AI-generated avatar image URL (must be from Pollinations AI)
- `bio` — freeform profile description
- `currentDistrict` — which of the 7 districts the player is in
- `frameIds` — array of owned frame IDs
- `equippedFrame` — ID of currently equipped frame

### Misc Systems
- `vipTier` / `vipExpiresAt` — future VIP subscription fields
- `battlePassPremium` — boolean; whether player bought the season's premium pass
- `referralCode` — unique code to share; referrer earns 500 DC + 200 XP per signup
- `referredBy` — who referred this player
- `referralCount` — total successful referrals
- `telegramId` / `telegramNotifications` — linked Telegram account for push alerts
- `devMode` — boolean; shows Owner Dev Toolbar when true

---

## PLAYER STATS & RESOURCES

### Core Stats (Permanent, grows through Skill Points + item bonuses)
- **Strength** — Every point increases PvP and PvE combat roll. Weapons add to this.
- **Charisma** — Every point gives slight discount on market purchases, improves Scam/Espionage success. Clothing adds to this.
- **Intelligence** — Every point improves Data Breach, Scam, Corporate Spy crime success. Some weapons add to this.
- **Street Cred** — Reputation metric. Required minimum for high-tier crimes. Clothing (Faction Outfit) adds to this.

### Resources (Regenerating)
- **Energy** (max 100): Required for all jobs and travel. Regens 1 per 3 minutes. Can be restored with Energy Drinks, Street Food, and other consumables.
- **Nerve** (max 50): Required for all crimes. Regens 1 per 5 minutes. Restored by Painkillers, Stimulant Packs.
- **Health** (max 100): Used in combat. Depleted by losses. Restored by medical items. Fully refills after hospitalization ends.

### Currencies
- **DC (Drift Coins)** — Earned through jobs, crimes, combat, trading, property income. Spent on items, market listings, guild creation, hospital discharge, property.
- **NC (Nova Credits)** — Earned through gameplay milestones, daily rewards (rare), Daily Day-30 reward, Telegram Stars payments. Spent on premium frames, instant crafting, premium Battle Pass, name changes.
- **Bank Balance** — DC transferred to the bank is safe from PvP theft. Max bank is uncapped. Withdraw costs nothing.

---

## LEVELING & PROGRESSION

### XP Requirements (approximate per level range)
| Levels | XP Per Level |
|---|---|
| 1–9 | 500–2,000 |
| 10–24 | 3,000–8,000 |
| 25–49 | 10,000–25,000 |
| 50–74 | 30,000–60,000 |
| 75–99 | 75,000–150,000 |
| 100 | MAX — Prestige system begins |

### Level Milestones
- **Level 5:** Can join a Guild
- **Level 8:** Break-In crime unlocked
- **Level 10:** PvP combat unlocked. Skill Points begin (1 point every 5 levels). Primary Skill Tree selection.
- **Level 15:** Can create a Guild. Vehicle Theft crime unlocked.
- **Level 20:** Smuggling Run crime unlocked.
- **Level 25:** Heist (Solo) crime unlocked. Auction House access.
- **Level 50:** Secondary Skill Tree unlocked.
- **Level 100:** Prestige system.

### Level-Up Process (Auto-handled by server on every job/crime/combat)
1. Add XP to `user.xp`
2. Check if `user.xp >= user.xpToNext`
3. If yes: increment `user.level`, reset `user.xp`, calculate new `user.xpToNext`
4. Every 5 levels from level 10: award +1 `skillPoints`
5. Broadcast a level-up post to the feed automatically

---

## DAILY REWARDS

Players get a reward every day they log in. Streak resets if they miss 2 consecutive days.

| Day | Reward |
|---|---|
| Day 1 | 100 DC |
| Day 2 | 150 DC |
| Day 3 | 200 DC |
| Day 4 | 250 DC |
| Day 5 | 300 DC |
| Day 6 | 400 DC |
| Day 7 | 500 DC + 1 Common Item |
| Day 14 | 1,000 DC + 1 Uncommon Item |
| Day 21 | 1,500 DC + 1 Rare Item |
| Day 30 | 2,000 DC + 1 Epic Item |

**UI:** 7-day calendar strip showing past claims (green checkmarks), today's reward (glowing), and future days (locked). A "Claim" button triggers an animation and sound. Modal dismisses after claiming.

---

## JOBS SYSTEM

Low-risk, energy-consuming activities. The reliable income floor for all players.

### How Jobs Work
1. Player opens the Jobs panel (in district or from nav)
2. System shows all available jobs filtered by: player's `currentDistrict`, player `level >= job.minLevel`, and job cooldown (each job has a per-player cooldown)
3. Player clicks a job — it resolves **immediately** (no wait timer)
4. Energy and Nerve are deducted
5. DC (randomized in range) and XP are awarded
6. A "completed shift" post is auto-created in the social feed
7. "Hustler" skill tree node "Hustle Boost" adds +10% DC to all job payouts

### Full Job List

| Job | District | Min Level | Energy | Nerve | DC Range | Cooldown |
|---|---|---|---|---|---|---|
| Delivery Driver | Any | 1 | 2 | 0 | 100–250 | 30 min |
| Security Guard | Residential North | 1 | 3 | 1 | 150–350 | 60 min |
| Club Promoter | The Boulevard | 5 | 1 | 2 | 300–600 | 45 min |
| Street Dealer | Industrial East | 8 | 2 | 3 | 400–800 | 60 min |
| Corporate Spy | Downtown Core | 15 | 3 | 5 | 800–2,000 | 120 min |
| Bounty Hunter | The Outskirts | 20 | 4 | 5 | 1,000–3,000 | 180 min |
| Bartender | The Boulevard | 1 | 2 | 0 | 150–300 | 30 min |
| Dock Worker | Industrial East | 5 | 3 | 1 | 250–500 | 45 min |
| Smuggler | Port District | 10 | 3 | 2 | 500–1,200 | 60 min |
| Data Courier | Tech Quarter | 5 | 2 | 1 | 300–700 | 45 min |
| Hacker-for-Hire | Tech Quarter | 15 | 3 | 3 | 700–1,800 | 90 min |
| Arms Runner | The Outskirts | 25 | 4 | 4 | 1,500–4,000 | 180 min |
| Street Performer | The Boulevard | 1 | 1 | 0 | 50–200 | 20 min |
| Building Super | Residential North | 1 | 2 | 0 | 120–280 | 40 min |
| Freight Driver | Industrial East | 10 | 3 | 1 | 350–750 | 60 min |
| Black Market Broker | Port District | 20 | 3 | 4 | 900–2,500 | 120 min |
| Financial Analyst | Downtown Core | 25 | 4 | 3 | 1,200–3,000 | 150 min |
| Scavenger | The Outskirts | 1 | 3 | 0 | 200–600 | 90 min |

---

## MINI-GAME SYSTEM (Interactive Jobs/Crimes)

When performing a job or crime, a **mini-game** can trigger as an optional interactive challenge. Completing it boosts the DC reward. There are 4 mini-game types, randomly assigned.

### Mini-Game Types

**1. Typing Rush**
- A random word from a `WORDS` array appears on screen
- Player must type it correctly within 25 seconds
- More words = higher score = higher reward multiplier
- UI: Large central word display, live typed text below, circular SVG countdown timer

**2. Pattern Match (Simon-style)**
- A sequence of 4–8 grid squares lights up
- Player must click them in the correct order from memory
- UI: 3×3 grid, colored highlights, sequence shown once then player clicks from memory

**3. Timing Clicker**
- A bar slides back and forth horizontally
- A green "sweet zone" exists in the center
- Player clicks when the bar is in the green zone
- Multiple rounds; accuracy determines multiplier
- UI: Sliding bar with colour zones (red–yellow–green), "Click!" prompt

**4. Rhythm Tap**
- Notes fall down the screen at fixed intervals
- Player taps when notes hit the bottom target zone
- UI: Vertical lane, falling circles, target zone at bottom, hit/miss visual feedback

### Mini-Game Shared UI Elements
- Circular SVG timer showing 25 seconds countdown
- Live score counter in the corner
- "Forfeit" button (abandons mini-game, still gets base reward)
- Final reward summary overlay after game ends: "Base: 800 DC + Bonus: 320 DC = 1,120 DC"

---

## CRIME SYSTEM

High-risk, nerve-consuming activities. Significantly higher DC than jobs, but with real consequences.

### Crime Resolution Logic
```
successChance = baseSuccess + (Intelligence - 5) * 0.01 + streetCredBonus + factionBonus + skillBonus
Roll random 0.0 to 1.0 — if roll < successChance → SUCCESS
```

### Full Crime List

| Crime | Min Level | Nerve | Base Success | DC Reward | Wanted+ | Hospital Risk |
|---|---|---|---|---|---|---|
| Pickpocket | 5 | 2 | 65% | 50–300 DC | +1 | 10% |
| Break-In | 8 | 4 | 50% | 200–800 DC | +2 | 20% |
| Vehicle Theft | 10 | 5 | 40% | 400–1,500 DC | +2 | 15% |
| Scam Operation | 15 | 3 | 55% | 500–2,000 DC | +1 | 5% |
| Smuggling Run | 20 | 6 | 45% | 800–3,000 DC | +3 | 30% |
| Heist (Solo) | 25 | 8 | 30% | 2,000–8,000 DC | +4 | 40% |
| Data Breach | 20 | 5 | 50% | 1,000–4,000 DC | +2 | 10% |
| Corporate Espionage | 30 | 7 | 35% | 3,000–10,000 DC | +3 | 25% |
| Assassination Contract | 40 | 10 | 25% | 10,000–30,000 DC | +5 | 50% |
| Vault Crack | 50 | 12 | 20% | 20,000–80,000 DC | +5 | 60% |

### Wanted Level System
- **0 Stars:** Clean. No penalties.
- **1–2 Stars:** Minor heat. Small DC penalty on next failure.
- **3 Stars:** NPCs in certain districts become hostile toward the player.
- **4 Stars:** Aggressive combat NPCs spawn against the player. Some jobs become unavailable.
- **5 Stars:** Maximum heat. Ralston NPC appears with bribe option. Some districts lock player out.

**Wanted Decay:**
- Passively decays over time (tracked by `wantedDecayAt` timestamp)
- Can instantly clear via bribing Ralston NPC (cost = `wantedLevel² × 1,000 DC`)
- "Ghost" skill tree node "Clean Hands" reduces Wanted gained per crime

**On Critical Failure (VantaLog):**
- 3+ PvP attacks on same player in 24 hours → auto-flagged in `VantaLog` for staff review
- High-risk crime failures (Heist, Vault Crack) are also logged for anti-cheat review

### Hospitalization
When hospitalized:
- Cannot commit crimes, do jobs, fight, or travel
- CAN: chat, browse market, manage inventory, collect property income, craft
- Released automatically when `hospitalReleaseAt` timestamp passes
- Early discharge: costs 50 DC per remaining minute via `POST /hospital/discharge`
- Duration examples: minor crime fail = 20 min, heist fail = 2 hours, PvP loss = 20–30 min

---

## COMBAT SYSTEM

### PvE — NPC Combat
Players fight Street NPCs in their current district. Each NPC has level, HP, strength, DC reward, XP reward, and item drop chance.

**Resolution formula:**
```
Player attack = (strength × 1.5) + random(0–30) + weapon bonus
NPC defense = NPC strength + random(0–20)
If player attack > NPC defense → WIN
If NPC defense > player attack → LOSE (take HP damage, possible hospital)
```

**Full NPC Roster:**

| NPC | District | Level | HP | DC Reward | XP | Drop |
|---|---|---|---|---|---|---|
| Street Punk | Residential North | 5 | 30 | 500–1,000 | 50 | Common |
| Gang Member | The Boulevard | 15 | 60 | 1,000–3,000 | 100 | Common |
| Street Thug | Industrial East | 10 | 50 | 1,000–3,000 | 100 | Common/Uncommon |
| Dock Enforcer | Port District | 25 | 80 | 3,000–8,000 | 200 | Uncommon |
| Security Guard | Downtown Core | 33 | 150 | 5,000–12,000 | 300 | Uncommon/Rare |
| Shadow Operative | Tech Quarter | 45 | 200 | 10,000–25,000 | 500 | Rare |
| Syndicate Boss | The Outskirts | 70 | 350 | 30,000–80,000 | 1,500 | Epic |
| Faction Boss | Downtown Core | 90 | 500 | 50,000–150,000 | 3,000 | Epic/Legendary |
| Rogue AI Unit | The Outskirts | 95 | 600 | 80,000–200,000 | 5,000 | Legendary |

### PvP — Player Combat (Unlocks at Level 10)

**Requirements to attack:**
- Both players must be in the same district
- Target must be within 25 levels of attacker
- Attacker must have full enough health to initiate
- Per-target 60-minute cooldown
- Max 15 PvP attacks per player per day

**Resolution:**
```
Attacker roll = (strength + random 0–10) + weapon bonus
Defender roll = (strength + random 0–10) + weapon/defense bonus
Higher roll wins
```

**Outcomes:**
- **Attacker wins:** Steals 10% of target's **wallet DC** (NOT bank balance). Cap at 500,000 DC. Earns XP.
- **Attacker loses:** Loses 15% HP. Possible hospitalization if health drops to 0.
- **Both sides:** Receive a real-time socket notification with the combat narrative log

**Anti-Harassment:**
- 3+ attacks on same player in 24 hours auto-flags to `VantaLog` for staff review

---

## INVENTORY & ITEMS

### Item Rarity Tiers

| Rarity | Color Code | Rarity | Power Level |
|---|---|---|---|
| Common | `#9CA3AF` Grey | ~60% drops | Base |
| Uncommon | `#4ADE80` Green | ~25% drops | +30% |
| Rare | `#60A5FA` Blue | ~10% drops | +100% |
| Epic | `#C084FC` Purple | ~4% drops | +300% |
| Legendary | `#FBBF24` Gold | ~1% drops | +1000% |
| Mythic | `#00FF41` Matrix Green | Achievement/Event only | Max |
| Event | `#F97316` Orange | Event period only | Variable |

### Item Categories

---

#### CONSUMABLES — Single use. Applied from inventory instantly.

| Item | Rarity | Base Price | Effect on Use |
|---|---|---|---|
| Street Food | Common | 250 DC | +5 Energy |
| Energy Drink | Common | 500 DC | +10 Energy |
| Bandage | Common | 300 DC | -10 min hospital time |
| Painkillers | Common | 400 DC | +5 Nerve |
| First Aid Kit | Common | 1,000 DC | -20 min hospital time |
| Protein Bar | Uncommon | 2,000 DC | +15 Energy, +5 Strength (temp) |
| Adrenaline Shot | Uncommon | 5,000 DC | +20 Energy |
| Stimulant Pack | Uncommon | 8,000 DC | +15 Energy, +10 Nerve |
| Medical Kit | Rare | 25,000 DC | -50 min hospital time |
| Super Stimulant | Rare | 30,000 DC | +30 Energy, +15 Nerve |
| Nano Repair | Epic | 250,000 DC | -100 min hospital time, +50 Energy |
| Combat Drug | Epic | 300,000 DC | +20 Strength (lasts 1 hour) |
| Legendary Elixir | Legendary | 5,000,000 DC | +10 to all stats, +50 Energy, +20 Nerve |
| Phoenix Down | Legendary | 8,000,000 DC | Instantly removes hospitalization |
| Event Cake | Event | Event only | +50 Energy, +50 Nerve |

**Hospital item logic:** First Aid Kits reduce remaining hospital time by 50%; Medical Kit reduces by a flat 50 minutes; Nano Repair removes up to 100 minutes; Phoenix Down cancels it entirely.

---

#### WEAPONS — Equip one at a time. Stat bonus applies while equipped.

| Item | Rarity | Base Price | Effect |
|---|---|---|---|
| Brass Knuckles | Common | 1,000 DC | +2 Strength |
| Baseball Bat | Common | 800 DC | +3 Strength |
| Combat Knife | Common | 1,200 DC | +2 Strength, +1 Street Cred |
| Pistol | Uncommon | 15,000 DC | +5 Strength |
| Tactical Shotgun | Uncommon | 22,000 DC | +6 Strength |
| Katana | Rare | 80,000 DC | +8 Strength |
| Sniper Rifle | Rare | 95,000 DC | +7 Strength, +3 Intelligence |
| Plasma Pistol | Epic | 800,000 DC | +15 Strength, +5 Intelligence |
| Railgun | Epic | 2,000,000 DC | +20 Strength, +10 Intelligence |
| Plasma Cannon | Legendary | 25,000,000 DC | +30 Strength, +15 Intelligence |

---

#### CLOTHING — Equip one at a time. Stat bonus applies while equipped.

| Item | Rarity | Base Price | Effect |
|---|---|---|---|
| Basic Tee | Common | 250 DC | +1 Charisma |
| Hoodie | Common | 500 DC | +1 Charisma |
| Street Jacket | Common | 750 DC | +1 Charisma, +1 Street Cred |
| Designer Jacket | Uncommon | 5,000 DC | +3 Charisma |
| Leather Jacket | Uncommon | 8,000 DC | +2 Charisma, +1 Street Cred |
| Grid Outfit | Uncommon | 12,000 DC | +3 Intelligence, +2 Charisma |
| Tactical Vest | Rare | 40,000 DC | +3 Strength, +2 Charisma |
| Tailored Suit | Rare | 50,000 DC | +5 Charisma |
| Nano Suit | Epic | 1,200,000 DC | +5 Intelligence, +5 Strength |
| Faction Outfit | Epic | 800,000 DC | +8 Charisma, +5 Strength, +5 Street Cred |
| CEO Tuxedo | Legendary | 20,000,000 DC | +20 Charisma, +15 Intelligence |
| Director's Suit | Legendary | 8,000,000 DC | +15 Charisma, +10 Intelligence |

---

#### VEHICLES — Equip one at a time. Reduces energy cost of travel.

| Item | Rarity | Base Price | Effect |
|---|---|---|---|
| Bicycle | Common | 500 DC | -5% travel energy |
| Motorcycle | Uncommon | 5,000 DC | -15% travel energy |
| Sports Car | Rare | 100,000 DC | -35% travel energy, +5 Charisma |
| Luxury Car | Rare | 150,000 DC | -30% travel energy, +8 Charisma |
| Hoverbike | Epic | 1,500,000 DC | -45% travel energy, +5 Intelligence |
| Armored Limo | Legendary | 15,000,000 DC | -30% travel energy, +15 Charisma, +5 Strength |

---

#### MATERIALS — Used in crafting. Tradeable on market. Not equippable.

| Item | Rarity | Base Price |
|---|---|---|
| Scrap Metal | Common | 100 DC |
| Fabric | Common | 100 DC |
| Chemicals | Common | 150 DC |
| Electronics | Common | 200 DC |
| Leather | Common | 120 DC |
| Wood | Common | 80 DC |
| Rare Metal | Rare | 2,000 DC |
| Nano Materials | Epic | 25,000 DC |
| Legendary Core | Legendary | 500,000 DC |

---

#### BADGES — Earned through achievements. Displayed on profile. Some grant permanent stat bonuses.

| Badge | Rarity | Earned By | Bonus |
|---|---|---|---|
| Newbie | Common | First login / onboarding complete | None |
| Crime Lord | Uncommon | Complete 10 crimes | None |
| Rich Kid | Rare | Accumulate 1,000,000 DC | None |
| Centurion | Legendary | Reach Level 100 | None |
| Ultimate Badge | Legendary | Max all core stats | +5 to all stats permanently |

---

#### CHARACTER CARDS — Collectible lore items. Tradeable. Not equippable. Display on profile.

| Card | Rarity | Price | Subject |
|---|---|---|---|
| Director Webb Card | Epic | 50,000 DC | CEO of the dominant Suits corporation |
| Mama Nova Card | Epic | 50,000 DC | Street matriarch who controls three districts |
| Ghost Card | Epic | 50,000 DC | The Grid's legendary anonymous hacker |
| Chief Ralston Card | Rare | 20,000 DC | Head of New Vanta's corrupt police force |
| Cleo Card | Rare | 20,000 DC | Boulevard's most famous club owner |
| Marco Card | Rare | 20,000 DC | Port District's smuggling kingpin |
| City Legend Card | Legendary | 5,000,000 DC | Mythical — the first citizen of New Vanta |

---

### Item Actions
- **Equip** (weapons, clothing, vehicles): Swaps into equipped slot. Stats update immediately. Previous equipped item unequips automatically.
- **Use** (consumables): Single-use. Effect applies immediately. Item quantity decrements by 1.
- **Salvage**: Destroys item for **15% of base price** in DC. Cannot be undone.
- **Sell on Market**: Lists the item in the player market at a player-chosen price.
- **Trade**: Send directly to another player (see Trade system).

---

## CRAFTING SYSTEM

Players combine **Materials** from inventory to create items. Crafting takes real time (or can be skipped with NC).

### Crafting Mastery Levels
Crafting XP accumulates separately from main XP. Mastery levels unlock better recipes and improve success rates.

| Mastery Level | Title | Recipes Unlocked | Bonus |
|---|---|---|---|
| 1 | Scavenger | Basic consumables | None |
| 2 | Tinkerer | Uncommon gear | +5% success |
| 3 | Artisan | Rare gear | +10% success |
| 4 | Engineer | Epic gear | +15% success |
| 5 | Legendary Smith | All recipes | +20% success, -10% time |

### Crafting Recipes

| Output | Inputs | Craft Time | Crafting XP |
|---|---|---|---|
| Energy Pack (×3) | 3× Street Food + 1× Chemicals | 60 sec | 10 XP |
| Tactical Vest | 5× Scrap Metal + 3× Fabric | 300 sec | 50 XP |
| Nano Suit | 5× Nano Materials + 2× Rare Metal + 5× Electronics | 3,600 sec | 500 XP |

**Instant Craft:** Spend NC to skip the remaining craft timer entirely. Cost scales with remaining time.

**How crafting works:**
1. Player opens Crafting panel
2. Browse recipes filtered by their mastery level
3. Select recipe — UI shows all required ingredients (green = have it, red = missing)
4. Click "Craft" — if all ingredients present, they are consumed and a timer starts
5. When timer expires, output item is added to inventory automatically
6. "Craft Instant" button appears if player has NC — pays NC proportional to remaining time

---

## SKILL TREES

Players choose a **Primary Skill Tree** at Level 10 and a **Secondary Skill Tree** at Level 50. Skill Points are spent to unlock nodes within the tree.

### 🤑 The Hustler — Economy / Business Focus
Ideal for: Trading players, job grinders, market players.

| Node | Cost | Effect |
|---|---|---|
| Fast Hands | 1 point | -10% job cooldowns |
| Market Shark | 2 points | -3% market buy fees |
| Business Empire | 3 points | +10% property passive income |
| DC Magnet | 3 points | +10% all job DC rewards |
| The Mogul | 5 points | Unlock premium market stall (no listing fee for 7 days per month) |

### ⚔️ The Fighter — Combat / PvP Focus
Ideal for: PvP attackers, NPC grinders, combat players.

| Node | Cost | Effect |
|---|---|---|
| Iron Fist | 1 point | +3 Strength in combat rolls |
| Thick Skin | 2 points | -20% hospitalization time |
| Street Brawler | 3 points | +5% PvP damage |
| Relentless | 3 points | +2 daily PvP attacks (cap raised to 17) |
| The Undisputed | 5 points | 15% chance to avoid hospitalization on PvP loss |

### 👻 The Ghost — Crime / Stealth Focus
Ideal for: Crime grinders, players who avoid PvP, high-risk operations.

| Node | Cost | Effect |
|---|---|---|
| Light Feet | 1 point | -20% wanted level gained from crimes |
| Inside Man | 2 points | +5% success on Break-In and Vehicle Theft |
| Clean Hands | 3 points | Wanted Level decays 50% faster |
| Shadow | 3 points | +8% success on Heist and Corporate Espionage |
| The Phantom | 5 points | Once per day: crime failure does not trigger hospitalization |

### 🤝 The Connector — Social / Guild Focus
Ideal for: Guild leaders, social players, feed-dominant players.

| Node | Cost | Effect |
|---|---|---|
| Silver Tongue | 1 point | +5% Charisma in all stat checks |
| Network | 2 points | Guild treasury donations count double for guild XP |
| Reputation | 3 points | +5 Street Cred permanent |
| City Voice | 3 points | Player posts get priority placement in the feed |
| The Mayor | 5 points | Can set a "district bounty" — 5,000 DC reward for any player who defeats a named target |

---

## FRAMES SYSTEM

Frames are decorative borders displayed around a player's avatar in:
- Global chat bubbles (as `FrameRectBubble`)
- District zone chat
- Leaderboard rows (as `LbFrameRow`)
- Profile page
- Player Inspect Modal

Frames have 5 rarity tiers with increasing visual complexity. Higher rarities have animated borders.

### Animation Tiers
| Rarity | Animation Type | Visual Description |
|---|---|---|
| Common | Static Border | Solid color ring, no movement |
| Uncommon | Slow Shimmer Sweep | Gentle gradient slides around the ring slowly |
| Rare | Gentle Pulse Glow | Border brightness pulses in and out like a heartbeat |
| Epic | Rotating Gradient Sweep | Full-color gradient rotates continuously around the ring |
| Legendary | Electric Flicker Spark | Sparks and lightning flicker around the border edges |
| Mythic | Matrix Ripple | Falling code characters, cascading color ripple effect |

### Display Components
- **`PlayerFrame`** — Full-featured component with 5 sizes (xs/sm/md/lg/xl) and 7 rarity overlays:
  - `EpicArc` overlay: rotating neon arc
  - `UltimateRing` overlay: rainbow conic-gradient spinning ring
  - `ParticleOrbit` overlay: rotating particle emitters for `particleTrail` frames
  - `GlitchOverlay` overlay: vibrating RGB offset effect for `glitchShake` frames
- **`AvatarWithFrame`** — Helper component for standard avatar+frame displays
- **`FrameRectBubble`** — Chat message container with frame as border style
- **`LbFrameRow`** — Leaderboard row component with frame styling

### Full Frame Catalog

#### COMMON — Static Border, Free (0 NC)
| Frame ID | Display Name | Glow Color |
|---|---|---|
| neonPulse | Neon Pulse | `#6B7280` |
| ironBorder | Iron Border | `#78716C` |
| copperRing | Copper Ring | `#B45309` |
| stonewall | Stonewall | `#57534E` |
| asphalt | Asphalt | `#44403C` |
| coldSteel | Cold Steel | `#475569` |
| graphene | Graphene | `#1E293B` |
| sandDune | Sand Dune | `#92400E` |
| rustBelt | Rust Belt | `#9A3412` |
| voidRim | Void Rim | `#0F172A` |
| ghostFrame | Ghost Frame | `#E2E8F0` |
| concrete | Concrete | `#94A3B8` |
| basicBlue | Basic Blue | `#2563EB` |

#### COMMON — Static Border, Paid
| Frame ID | Display Name | NC Cost | Glow Color |
|---|---|---|---|
| silverEdge | Silver Edge | 50 NC | `#9CA3AF` |
| plainGold | Plain Gold | 50 NC | `#CA8A04` |

#### UNCOMMON — Slow Shimmer Sweep, Free (0 NC)
| Frame ID | Display Name | Glow Color |
|---|---|---|
| gradientShift | Gradient Shift | `#10B981` |
| oceanBreeze | Ocean Breeze | `#0EA5E9` |
| midnightWave | Midnight Wave | `#1D4ED8` |
| forestEdge | Forest Edge | `#166534` |
| iceBlue | Ice Blue | `#BAE6FD` |
| springMint | Spring Mint | `#34D399` |
| vintageCopper | Vintage Copper | `#C2410C` |

#### UNCOMMON — Slow Shimmer Sweep, Paid
| Frame ID | Display Name | NC Cost | Glow Color |
|---|---|---|---|
| mossGlow | Moss Glow | 75 NC | `#16A34A` |
| roseGold | Rose Gold | 75 NC | `#FB7185` |
| amberGlow | Amber Glow | 75 NC | `#D97706` |
| lavenderMist | Lavender Mist | 75 NC | `#A78BFA` |
| citrusBurst | Citrus Burst | 75 NC | `#F97316` |
| crimsonEdge | Crimson Edge | 75 NC | `#DC2626` |
| desertSun | Desert Sun | 75 NC | `#FCD34D` |
| duskPurple | Dusk Purple | 75 NC | `#7C3AED` |

#### RARE — Gentle Pulse Glow, Free (0 NC)
| Frame ID | Display Name | Glow Color |
|---|---|---|
| rippleRing | Ripple Ring | `#38BDF8` |
| glitchShake | Glitch Shake | `#22D3EE` |
| frostbite | Frostbite | `#7DD3FC` |
| bloodMoon | Blood Moon | `#B91C1C` |
| shadowPulse | Shadow Pulse | `#6D28D9` |
| cosmicDust | Cosmic Dust | `#818CF8` |
| stormCloud | Storm Cloud | `#64748B` |

#### RARE — Gentle Pulse Glow, Paid
| Frame ID | Display Name | NC Cost | Glow Color |
|---|---|---|---|
| cyberGlow | Cyber Glow | 150 NC | `#00E5FF` |
| plasmaRing | Plasma Ring | 150 NC | `#E879F9` |
| solarFlare | Solar Flare | 150 NC | `#FB923C` |
| acidGreen | Acid Green | 150 NC | `#4ADE80` |
| ultraviolet | Ultraviolet | 150 NC | `#818CF8` |
| crystalline | Crystalline | 150 NC | `#93C5FD` |
| venomDrip | Venom Drip | 150 NC | `#65A30D` |
| vortexEdge | Vortex Edge | 150 NC | `#9333EA` |

#### EPIC — Rotating Gradient Sweep, Free (0 NC)
| Frame ID | Display Name | Glow Color |
|---|---|---|
| scanLine | Scan Line | `#8B5CF6` |
| particleTrail | Particle Trail | `#6366F1` |
| auroraGlow | Aurora Glow | `#34D399` |
| nebularing | Nebula Ring | `#C084FC` |
| voidGate | Void Gate | `#4C1D95` |
| darkMatter | Dark Matter | `#1E1B4B` |
| glitchMatrix | Glitch Matrix | `#00FF41` |
| stormBreaker | Storm Breaker | `#94A3B8` |
| celestialArc | Celestial Arc | `#BAE6FD` |
| abyssalRing | Abyssal Ring | `#312E81` |

#### EPIC — Rotating Gradient Sweep, Paid
| Frame ID | Display Name | NC Cost | Glow Color |
|---|---|---|---|
| hologramFlicker | Hologram Flicker | 500 NC | `#A78BFA` |
| cosmicRing | Cosmic Ring | 500 NC | `#6366F1` |
| novaBlast | Nova Blast | 500 NC | `#FDE68A` |
| bioHazard | Bio Hazard | 500 NC | `#84CC16` |
| fireRing | Fire Ring | 500 NC | `#EF4444` |
| quantumField | Quantum Field | 500 NC | `#0EA5E9` |
| solarWind | Solar Wind | 500 NC | `#FCD34D` |
| neonNights | Neon Nights | 500 NC | `#F472B6` |
| dragonScale | Dragon Scale | 500 NC | `#DC2626` |
| frostedGlass | Frosted Glass | 500 NC | `#E0F2FE` |

#### LEGENDARY — Electric Flicker Spark, Free (0 NC — Earned through gameplay)
| Frame ID | Display Name | Glow Color |
|---|---|---|
| electricArc | Electric Arc | `#F59E0B` |
| dataStream | Data Stream | `#06B6D4` |
| factionCrest | Faction Crest | `#F59E0B` |
| thunderStrike | Thunder Strike | `#FDE68A` |
| volcanicAsh | Volcanic Ash | `#78350F` |
| darkLord | Dark Lord | `#7C3AED` |
| meteorShower | Meteor Shower | `#F97316` |
| nightKing | Night King | `#93C5FD` |
| streetLegend | Street Legend | `#EF4444` |
| gridMaster | Grid Master | `#00E5FF` |
| voidWalker | Void Walker | `#4C1D95` |

#### LEGENDARY — Electric Flicker Spark, Paid
| Frame ID | Display Name | NC Cost | Glow Color |
|---|---|---|---|
| cyberSpark | Cyber Spark | 1,000 NC | `#22D3EE` |
| godRay | God Ray | 1,000 NC | `#FBBF24` |
| plasmaBolt | Plasma Bolt | 1,000 NC | `#D946EF` |
| ironClad | Iron Clad | 1,000 NC | `#CBD5E1` |

#### MYTHIC — Matrix Ripple (Achievement/Event Only)
| Frame ID | Display Name | Glow Color |
|---|---|---|
| matrixRain | Matrix Rain | `#00FF41` |
| spectral | Spectral | `#F0F9FF` |
| voidCore | Void Core | `#7C3AED` |
| hackerElite | Hacker Elite | `#00FF41` |
| shadowLord | Shadow Lord | `#1E1B4B` |
| cosmicHorror | Cosmic Horror | `#6B21A8` |
| theAbyss | The Abyss | `#0C0A09` |
| deathCode | Death Code | `#EF4444` |

**Purchasing Frames:**
- Open the Frames Store from profile or settings
- Browse by rarity tier tab
- Preview the animation before buying
- Paid frames deduct NC on purchase and immediately appear in `frameIds`
- Free frames that require achievement are granted automatically when condition is met

**Equipping Frames:**
- Open inventory or profile frame section
- Click any owned frame → "Equip" → it becomes the `equippedFrame`
- Change is instant and reflects in chat bubbles and profile immediately

---

## AVATAR SYSTEM

Every player has a **procedurally generated SVG avatar** that is unique to their account seed. Avatars are animated (subtle opacity pulse) and built from layered components.

### Avatar Components (All SVG, no image files)
- **Background Shape:** Circle, Diamond, Hexagon, Square
- **Background Color:** 12 cyberpunk palette colors
- **Eye Style:** Rectangles, slashes, scanner lines, dots
- **Mouth Style:** Flat line, smirk, grill
- **Hair Style:** Spikes, mohawk, long, bun, fade, dreads
- **Accessories:** Glasses, bandana, face mask, visor, none
- **Face Shape:** Defined by SVG path geometry
- **Skin Tone:** 6 options

**Generation:** A `hashStr(username)` function creates a numeric hash. Bit-shifting extracts indices into each component array. The same username always produces the same avatar. No randomness after account creation.

### Custom Avatar
Players can set a `avatarUrl` — a custom AI-generated image. The game provides a **"Generate Avatar"** button that:
1. Prompts the player for a description of their character
2. Builds a cyberpunk-themed prompt based on their faction and description
3. Generates an image via Pollinations AI (free, no API key)
4. Saves the URL to their profile

Only Pollinations AI URLs are accepted (domain whitelist enforced server-side).

### NPC Avatars
NPCs have specially crafted `generateNPCAvatarSVG` that produces more robotic/cybernetic appearances with faction-coded colors. Director Webb = cold blue/grey; Mama Nova = warm orange/red; Ghost = green matrix tones.

---

## TITLES SYSTEM

Titles display beneath the player's username in chat and on profile. Players earn titles through achievements and can switch freely between any earned titles.

| Title | Rarity | How Earned | Bonus |
|---|---|---|---|
| New in Town | Common | Default, given on signup | None |
| Street Rat | Uncommon | Complete 50 crimes | +1 Street Cred |
| City Legend | Legendary | Reach Prestige Rank 5 | +5% to all stats |
| [More unlocked through gameplay achievements] | | | |

The `equippedTitle` field determines which displays. Players can equip any title from their `titles` array via profile settings.

---

## MARKET & ECONOMY

### Player Market (Fixed Price)
Any player can list any tradeable item for any DC price. Listings last 48 hours.

**Listing:** Select item from inventory → choose price → item is locked in listing
**Buying:** Browse market → filter by type/rarity/price → click Buy → DC deducted, item appears in buyer's inventory
**Fee:** 5% of sale price taken as a currency sink. Seller receives 95%.
**Cancelling:** Seller can cancel an active listing; item returns to inventory.
**Filters:** Category (All, Weapons, Clothing, Vehicles, Consumables, Materials, Badges, Cards), Rarity (All tiers), Price (min/max slider), Sort (Price ↑↓, Newest, Rarity)

### Auction House
Time-limited bidding on high-value items.

**Creating an auction:**
- Set starting bid
- Optionally set reserve price (auction fails if final bid doesn't meet it)
- Optionally set Buy Now price (ends auction instantly if a player pays it)
- Choose duration: 1 hour, 6 hours, 12 hours, or 24 hours

**Bidding:**
- Each bid must be at least 5% higher than the current bid
- Previous highest bidder is refunded their DC immediately when outbid
- Players receive a real-time notification when outbid

**Resolution:**
- When timer expires, highest bidder wins and DC is transferred
- If reserve price is not met, item returns to seller and all DC is refunded
- 10% auction fee on final sale price

### Black Market (Port District — Exclusive)
A special unlisted market for items with `blackMarket` flag. Sellers are anonymous. No listing fee. Higher-risk trades with no buyer protection. Accessible only while in Port District.

### Direct Player Trade (Trade System)
Two players can initiate a face-to-face trade:
1. Player A sends a trade request to Player B
2. Both players add items and/or DC to their side of the offer
3. Both players click "Ready"
4. Both players click "Confirm"
5. On double confirmation, the trade executes atomically (both sides swap simultaneously)
6. Either player can cancel before double confirmation

### Economy Principles
- **Jobs provide the floor** — every player always has a way to earn DC
- **Crimes multiply income** — at real risk cost
- **Market connects players** — DC flows player-to-player, not player-to-system
- **5% market fee + 10% auction fee** — currency sinks that prevent inflation
- **Bank protects savings** — players don't lose banked DC to PvP
- **Legendary items are genuinely rare** — real wealth gap exists and is visible
- **NC earnable in-game** — premium cosmetics accessible without paying

---

## PROPERTY SYSTEM

Players own real estate in New Vanta that generates **passive hourly income** collected manually.

### How It Works
1. Browse available properties in the Properties panel (filtered by district)
2. Purchase with DC — minimum level may be required
3. Property appears in the player's "My Properties" list
4. Income accumulates in a per-property vault hourly
5. Player taps "Collect" to transfer vault balance to wallet
6. Vault max hold = 24 hours of income (stops accumulating if not collected)
7. Sell back at 70% of purchase price

### Full Property Catalog

| Property | Type | Cost | Income/hr | Vault Cap | District |
|---|---|---|---|---|---|
| Small Apartment | Apartment | 50,000 DC | 100 DC | 2,400 DC | Any |
| City Apartment | Apartment | 150,000 DC | 300 DC | 7,200 DC | Residential North |
| Loft | Apartment | 500,000 DC | 1,000 DC | 24,000 DC | The Boulevard |
| Penthouse | Apartment | 2,000,000 DC | 4,000 DC | 96,000 DC | Downtown Core |
| Small Shop | Shop | 100,000 DC | 200 DC | 4,800 DC | Any |
| Warehouse | Warehouse | 750,000 DC | 1,500 DC | 36,000 DC | Industrial East / Port |
| Nightclub | Nightclub | 5,000,000 DC | 10,000 DC | 240,000 DC | The Boulevard |
| Casino | Casino | 10,000,000 DC | 20,000 DC | 480,000 DC | Downtown Core |

**Property rules:**
- One property of each tier per player (no 3 penthouses)
- Penthouse and Casino require Level 50+
- Nightclub requires Level 40+
- Income is passive — players don't have to be online
- Properties display in the player's profile as status symbols

---

## GUILDS (CREWS)

### Creating a Guild
- Costs 5,000 DC + requires Level 15
- Creator becomes Leader automatically
- Choose: Guild name, 3-letter tag, description, faction alignment

### Joining a Guild
- Browse guild list (search by name, filter by faction)
- Leaders/Officers send invitations; invited players appear in `recruits`
- Accept invitation to become a Member

### Guild Hierarchy
- **Leader** — Full control: treasury, promotions, kicks, upgrades, all guild settings
- **Officer** — Can invite, kick Members and Recruits, post in Guild Chat
- **Member** — Can donate, post in Guild Chat
- **Recruit** — Limited access; cannot donate; waiting period before full Member

### Guild Features
- **Guild Treasury** — Shared DC pool. Members donate voluntarily. Only Leader can spend it.
- **Guild Upgrades** — Treasury funds unlock buffs for all members (e.g., +5% job income, +10 max Energy)
- **Guild Chat** — Private real-time chat room (socket room `guild:ID`)
- **Donation History** — Full log of who donated what and when
- **Guild Leaderboard** — Weekly ranking of guilds by combined score (DC, crimes, combat wins)
- **Max Members:** 25 (upgradeable using NC from treasury)

### Leaving / Disbanding
- Leaving has a 24-hour cooldown before joining another guild
- Leader must transfer leadership or disband; disbanding returns 50% of treasury to Leader

---

## SOCIAL FEED

The game's social hub. A scrollable, real-time feed of activity.

### Post Types
- **Adventure posts** — Auto-generated when a player does something notable (crime success, PvP win, level up, property purchase). System writes a narrative post on their behalf.
- **Manual posts** — Player writes their own update (max 280 chars).
- **Herald posts** — Official game news and event announcements.
- **System posts** — Patch notes summaries, server announcements.
- **Vanta posts** — Lore/world-building posts from New Vanta "news sources."

### Post Interactions
- **Reactions:** 👍 Like, 😂 Laugh, 😱 Shock, 🫡 Respect — update in real time for all viewers
- **Comments** — Any player can reply to any post
- **@Mentions** — Tag another player in a post or comment; they receive a notification

### Feed Filters
- All Activity (default)
- Faction Only
- Guild Only
- Following Only

---

## NPC SYSTEM (AI-POWERED)

Key characters in New Vanta respond to player messages using AI (Groq / Llama 3). Each NPC has a personality, a memory of previous conversations, and a bond score.

### How NPC Conversations Work
1. Player travels to the NPC's district
2. Opens the NPC encounter panel
3. Types a message → sent to `POST /npc/talk`
4. Server retrieves the last 50 messages from `NpcMemory` model for this player+NPC pair
5. Groq LLM called with: NPC system prompt + conversation history + new message
6. Response returned and saved to NpcMemory
7. `bondScore` increments per conversation (tracks relationship depth)

### Full NPC Roster

| NPC | District | Type | Attackable | Personality |
|---|---|---|---|---|
| **Director Webb** | Downtown Core | Story (Suits) | No | Cold, brilliant, measured. Speaks in corporate metaphors. Never wastes words. |
| **Mama Nova** | Industrial East | Story (Street) | No | Warm like a grandmother, terrifying like a boss. Calls everyone "baby." |
| **Ghost** | Tech Quarter | Story (Grid) | No | Cryptic, text-only comms. Talks in riddles and code references. |
| **Marco** | Port District | Shop (Neutral) | No | Gruff, no-nonsense, black market operator. Pure business. |
| **Cleo** | The Boulevard | Shop (Neutral) | No | Charming, gossip-rich, knows everyone. Arms dealer with a smile. |
| **Chief Ralston** | Residential North | Bribe Target | No | Corrupt, authoritative, always wants DC. Lowers Wanted Level for payment. |
| **Street Thug** | Industrial East | Combat NPC | Yes | No dialogue — just fights. Level 10, 50 HP. |
| **Security Guard** | Downtown Core | Combat NPC | Yes | No dialogue. Level 33, 150 HP. |
| **Faction Boss** | Downtown Core | Combat NPC | Yes | No dialogue. Level 90, 500 HP. |

### NPC Memory Fields
- `npcId` — which NPC
- `userId` — which player
- `bondScore` — relationship depth number (increases per chat)
- `memories` — array of `{role: "user"|"assistant", content: string, at: Date}` — last 50 messages

Higher `bondScore` unlocks deeper NPC responses and occasional bonus hints or rewards.

---

## REAL-TIME FEATURES (SOCKET.IO)

All real-time features run through a persistent WebSocket connection established on login.

### Client → Server Events

| Event | Payload | Action |
|---|---|---|
| `auth` | `{ userId }` | Authenticates socket, joins private room `user:{userId}` |
| `join_district` | `{ districtId }` | Joins district room `district:{districtId}` |
| `leave_district` | `{ districtId }` | Leaves district room |
| `join_global` | — | Joins global chat room |
| `join_guild` | `{ guildId }` | Joins guild chat room `guild:{guildId}` |
| `leave_guild` | `{ guildId }` | Leaves guild room |
| `chat_message` | `{ districtId, content }` | Sends message to district room |
| `global_message` | `{ content, equippedFrame, equippedFrameRarity }` | Broadcasts to global room (frame data required for bubble styling) |
| `guild_message` | `{ guildId, content }` | Sends to guild room |
| `dm_sent` | `{ recipientId }` | Notifies recipient of new DM |
| `notify_attack` | `{ targetId, result }` | Sends PvP result to both players |

### Server → Client Events

| Event | Payload | When Triggered |
|---|---|---|
| `chat_message` | Message object | Relays district chat to all in zone |
| `global_message` | Message + frame data | Relays global chat message |
| `guild_message` | Message object | Relays guild chat message |
| `new_dm` | `{ senderId }` | Notifies recipient of incoming DM |
| `attack_notification` | Combat result object | Notifies target they were attacked |
| `chat_error` | Error string | Rate limit or permission violation |

### Chat Rate Limiting
- Max 10 messages per 60 seconds per player
- Same message 3 times in a row → temporary mute
- Violations return `chat_error` event

### Global Chat Message Format
Every global message includes `equippedFrame` and `equippedFrameRarity` fields from the player's profile. These are used client-side to render the correct `FrameRectBubble` animation around the sender's avatar.

---

## BANK SYSTEM

A secure wallet that protects DC from PvP theft.

- **Deposit:** `POST /bank/deposit` — moves DC from wallet to bank. No fee.
- **Withdraw:** `POST /bank/withdraw` — moves DC from bank to wallet. No fee.
- **PvP theft** only takes from wallet `dc` field, never from `bankBalance`
- Bank is always accessible regardless of district, hospitalization status, or Wanted Level
- UI shows wallet balance and bank balance side by side with Deposit/Withdraw buttons

---

## LEADERBOARDS

### Global Leaderboards (Never Reset)
- **Wealthiest** — ranked by total DC (wallet + bank)
- **Level** — ranked by player level (then XP as tiebreak)

### Periodic Leaderboards
- **Most Dangerous** — ranked by PvP wins (resets weekly)
- **Crime Lord** — ranked by total crimes completed (resets monthly / per season)
- **Guild Rankings** — combined guild score: DC contributed + crimes + combat wins (resets weekly)
- **Faction Power** — total faction influence across all 7 districts (resets weekly)
- **Season Wealth** — DC earned during current season (resets per season)

### Leaderboard UI
- Top 3 players get special styled rows (Gold, Silver, Bronze)
- Each row shows: rank, player avatar with equipped frame, username, faction badge, equipped title, and the stat being ranked
- Clicking a player opens `PlayerInspectModal`
- Season leaderboard shows countdown to season end

---

## SEASONS & BATTLE PASS

### Seasons
Seasons are ~60-day themed chapters. Each season has:
- A **number** and **theme name** (e.g., Season 1: "Cold Concrete")
- A **narrative arc** — lore story playing out through events and Herald posts
- A **faction alignment** — the season leans into one faction's story
- A **Season Leaderboard** tracking season-specific performance
- **Exclusive items** — only obtainable during that season; never return after it ends

At season end:
- Top players on season leaderboards receive exclusive frames, titles, and NC rewards
- Snapshots of final leaderboard rankings are stored permanently

### Battle Pass
Each season has a **50-tier Battle Pass**.

**Free Track:** All players progress and earn basic DC, items, and common frames
**Premium Track (500 NC):** Unlocks exclusive animated frames, rare/epic items, titles, and bonus DC at every tier

**Tier Progression:**
- Tiers advance by earning **Season XP** (different from main XP)
- Jobs, crimes, and combat all grant Season XP alongside regular XP
- No tier skipping — progression is played, not bought

---

## EVENTS SYSTEM

World Events are global occurrences created by the owner. They modify the game world while active.

### Event Data Model Fields
- `name`, `emoji` — display identity
- `type` — category of event
- `status` — `draft` | `active` | `ended`
- `startAt` / `endAt` — schedule
- `primaryColor` / `accentColor` — theme colors applied to the UI during the event
- `backgroundGradient` — changes the global page gradient
- `particleEffect` — visual effect applied globally (`snow`, `embers`, `matrix`, `confetti`)
- `mapWeather` — text description shown on the map
- `dcMultiplier` — DC reward multiplier (e.g., 2.0 = double DC)
- `xpMultiplier` — XP reward multiplier
- `crimeSuccessBoost` — flat % added to all crime success rates
- `marketFeeReduction` — reduces market % fee
- `dropRateBoost` — increases item drop chance from combat
- `announcements` — config for login popup text, herald headline, and auto social post

### Event Types

| Type | Effect |
|---|---|
| Double XP | `xpMultiplier: 2.0` — all XP doubled for 48 hours |
| Crime Spree | `crimeSuccessBoost: +10%` for 24 hours |
| Market Frenzy | `marketFeeReduction: 100%` — no fees for 12 hours |
| Faction War | 72 hours where territory control is weighted 3× — winners get faction bonuses for a week |
| Boss Raid | Elite NPC spawns in The Outskirts; first to defeat it wins legendary loot |
| Holiday Events | Seasonal — grants event-exclusive items (e.g., Event Cake) |

Active events display a visual banner in the UI and modify combat/crime/job result screens to reflect the bonus.

---

## MESSAGES (DIRECT MESSAGES)

Player-to-player DMs. Content is encrypted at rest using AES-256-CBC.

**DM Flow:**
1. Player A opens Player B's profile → clicks "Message"
2. Conversation opens — previous messages shown (populated from Message model)
3. Player A types → sends → message encrypted with IV and saved
4. Socket event `dm_sent` notifies Player B instantly
5. Player B sees notification badge on nav; opens message to read
6. `read` flag updates on open; unread count decrements

**Security:** Content is stored as `encryptedContent` + `iv`. Only the application decrypts it on retrieval with the master key. No plaintext is stored.

**Blocking:** Blocked users cannot send DMs. Muted users can still DM but their messages are filtered from view.

---

## NOTIFICATIONS

Players receive in-app and optional Telegram notifications:

| Trigger | Notification |
|---|---|
| PvP attack received | Real-time overlay + notification tray entry |
| New DM received | Notification badge + real-time toast |
| Outbid on auction | Notification tray entry + DC refunded |
| Auction won | Notification tray entry + item in inventory |
| Property vault full | Daily reminder: "Your property is at max — collect!" |
| Hospital release | "You've been released." |
| Guild invitation | Notification tray entry |
| Level up | Toast overlay on action screen |
| New patch notes | Badge on Herald nav item |
| Energy/Nerve full | Passive check — shown as status indicator, no alert |

**Notification Tray:** Bell icon in header with unread count badge. Opens a dropdown list of recent notifications. Clicking a notification navigates to the relevant page.

---

## TELEGRAM BOT

Players can link their account to a Telegram bot for out-of-game push notifications.

**Linking:** Player goes to Settings → enters Telegram username → game sends a link code → player sends `/link CODE` to the bot → accounts are associated (`telegramId` saved).

**Telegram Commands:**
- `/link CODE` — Links Telegram to game account
- `/buy` — Initiates an NC purchase via Telegram Stars payment invoice

**Bot sends messages for:**
- "You've been attacked! @username lost a fight to @rival. Log in."
- "Your property vault is full. Collect your income."
- "Event starting: Double XP Weekend begins now."
- "You won the auction for [item name]."

**NC Purchase via Telegram Stars:**
Players can buy Nova Credits by sending Telegram Stars through the bot. The bot creates a payment invoice; on payment, NC is credited to the player's account automatically.

---

## AUTHENTICATION

### Signup Flow
1. User provides email, username, password, chosen faction
2. Server creates account, generates unique tag (`Username#NNNN`), referral code
3. OTP email sent to verify address
4. User enters OTP — account becomes `verified`
5. **Referral bonus:** If a referral code was used: referrer gets 500 DC + 200 XP; new user gets 750 DC
6. Onboarding screen shown (faction selection confirmation, tutorial)

### Login
1. Email + password → bcrypt compare
2. Returns: Access Token (15 min JWT), Refresh Token (30 day JWT), user summary object
3. Both tokens stored in client-side localStorage
4. `lastLoginAt` updated → triggers Daily Reward check on first API call

### Token Refresh
- Access token sent as `Authorization: Bearer <token>` header on every API call
- On 401 → client automatically hits `POST /auth/refresh` with refresh token
- New token pair issued; client continues the request

### Password Reset
1. `POST /forgot-password` → sends email with 32-byte hex reset link
2. Player clicks link → opens reset form
3. `POST /reset-password` with token + new password → password updated, tokens invalidated

---

## UI PAGES & PANELS

### Global Layout Shell
- **Sticky Header:** DriftLife logo (home link), animated XP progress bar, DC balance (rolling number animation), NC balance (rolling number animation), Settings icon, Notification bell (with badge count), Owner panel icon (staff-only)
- **Player Status Strip:** Player tag, faction emoji icon, prestige level badge, Hospitalized status indicator (red), currently equipped title
- **Top Nav Bar:** Horizontally scrollable carousel of 29+ navigation links with custom SVG icons and labels:
  Map, Inventory, Combat, Crime, Market, Guild, Profile, Social, Herald, Leaderboard, Properties, Crafting, Skills, Frames, Titles, Daily Reward, Bank, Trade, NPC, Settings, Owner Panel (staff only), and more

### Page Descriptions

---

**🏠 Feed (Home — `/`)**
Social hub. Top: post composer with text input and submit button. Below: infinite-scroll feed of posts sorted by newest. Each post shows: author avatar+frame, username, title, faction badge, post content, reactions with live counts, comment thread (collapsible), timestamp. New posts appear at the top in real time without a full reload.

---

**🗺️ Map (`/map`)**
Interactive district view. Each of the 7 districts is a clickable panel showing: controlling faction (color-coded), danger level bars, live player count, jobs available count. Clicking a district expands it to show: Zone Chat (real-time), available jobs, available crimes, NPCs in that zone, and a "Travel Here" button with energy cost. If already in that district, shows "You are here."

---

**⚔️ Combat (`/combat`)**
Two tabs:
- **NPCs** — Cards for each NPC in current district. Card shows: NPC avatar, name, level, HP, Strength stat, DC reward range, XP reward, item drop chance. "Fight" button resolves combat immediately and shows a narrative result dialog.
- **PvP** — List of players currently in the same district who are eligible targets (within 25 levels). Shows player avatar, name, level, faction. "Attack" button; shows cooldown timer if on cooldown. Combat result dialog shows both sides' roll and the narrative outcome.

Also: Combat Leaderboard tab showing top PvP winners.

---

**🎭 Crime (`/crime`)**
Crime cards for each available crime (filtered by level and current district). Each card shows: crime name, flavor text, nerve cost, success probability (calculated live using current player stats), DC reward range, risk level, failure consequences. "Commit Crime" button. Result shown as a styled success/failure overlay with narrative text and rewards/penalties listed.

---

**🎒 Inventory (`/inventory`)**
Tabbed grid: All, Consumables, Weapons, Clothing, Vehicles, Materials, Badges, Cards. Each item shows: item icon (rarity-colored), name, quantity (for stackables), "Equipped" badge if equipped. Clicking an item opens an item detail sheet:
- Item image/icon, name, rarity badge, description
- Stat bonuses listed
- Action buttons: Use (consumables) / Equip+Unequip (gear) / Salvage / List on Market / Trade

Also includes: "Salvage All Commons" bulk action.

---

**🏪 Market (`/market`)**
Two tabs:
- **Market** — Filter/sort bar. Listings grid. Each listing: seller avatar+frame, item name, rarity, quantity, price, Buy button.
- **Auction** — Active auctions. Each card: item name, rarity, current bid, time remaining, "Bid" and "Buy Now" buttons.

Third tab: **My Listings** — the player's active listings with Cancel option.

---

**🏗️ Crafting (`/crafting`)**
Top: Crafting Mastery level progress bar and level badge. Below: recipe cards filtered by mastery. Each recipe: output item name + quantity, ingredient list (with player's current stock shown in green/red), craft time, XP reward. "Craft" button. Active crafts show timer countdown and "Instant Craft (X NC)" button.

---

**🌳 Skills (`/skills`)**
Skill tree selection (if Level 10+). Shows primary tree (chosen once) and secondary tree (Level 50+). Each tree displayed as a branching node graph. Nodes show: name, description, effect, point cost. Currently purchased nodes are highlighted. "Purchase Node" button if player has enough skill points.

---

**👥 Guild (`/guild`)**
If in a guild:
- Guild name, tag, faction badge, description
- Treasury balance and donate input
- Member list with roles (Leader/Officer/Member/Recruit)
- Guild Upgrades panel
- Guild Chat (real-time)
- Upgrade button (Leader only)

If not in a guild:
- Guild browser with search and faction filter
- "Create Guild" form (costs 5,000 DC, requires Level 15)

---

**🏠 Properties (`/properties`)**
Left: Player's owned properties list. Each shows income rate, vault balance, "Collect" button, sell option.
Right: Property market — browse available properties by district and type. "Purchase" button shows price and level requirement.

---

**📊 Leaderboard (`/leaderboard`)**
Tab switcher: Wealth, Level, PvP, Crime, Guild, Faction, Season. Each leaderboard shows top 100 players with avatar+frame, rank styling (gold/silver/bronze for top 3), username, faction, title, and the ranked metric. Clicking any row opens `PlayerInspectModal`.

---

**👤 Profile (`/profile` or `/profile/:tag`)**
Own profile:
- Avatar (with equipped frame), username, tag, title, faction badge, prestige badge
- Bio (editable inline)
- Core stats: Strength, Charisma, Intelligence, Street Cred (with visual stat bars)
- Resources: Energy, Nerve, Health (with regen timers)
- DC and NC balance
- Equipped items (weapon, clothing, vehicle)
- Owned frames display strip
- Earned badges display
- Recent activity log
- Follow list / follower count

Other player's profile (via tag):
- Same display but read-only
- Additional buttons: Attack (if eligible), Message, Trade, Follow/Unfollow

---

**🪞 Frames Store (`/frames`)**
Browse all frames by rarity tab. Each frame shows: animated preview, name, rarity badge, NC cost or "Free"/"Achievement." "Equip" if already owned. "Purchase" if affordable. "Locked" with achievement hint if achievement-gated. Clicking opens a full-size animated preview modal.

---

**🏷️ Titles (`/titles`)**
List of all earned titles. Currently equipped title highlighted. Click any title → "Equip" button updates `equippedTitle`.

---

**📜 Herald (`/herald`)**
Scrollable list of patch notes and world announcements. Each entry: version tag, date, title, content sections (NEW / FIX / BALANCE tags on each change), dev note. Unread entries have a glowing blue left border. Owner's `devNote` field shows as a personal message at the bottom.

---

**💬 Social / DMs (`/social`)**
Left: conversation list (other players, sorted by most recent). Shows unread count badge per conversation. Right: message thread. Input at bottom. Real-time updates via socket.

---

**⚙️ Settings (`/settings`)**
- Change bio
- Set custom avatar (generate with AI or enter Pollinations URL)
- Change username (costs 5,000 DC)
- Change password
- Email notification preferences
- Telegram account link/unlink
- Toggle notification types (on/off per notification category)
- Delete account (requires password confirmation)

---

**🛠️ Owner Panel (`/owner` — Staff/Owner Only)**
Protected by `requireOwner` or `requireStaff` middleware.

Sections:
- **Dashboard** — Live player count, total DC in economy, recent crimes, recent fights
- **Players** — Search any player by username/tag. View full data. Actions: Adjust DC, Adjust NC, Set Level, Set Stats, Ban (with reason), Unban, Mute (with duration), Gift Item
- **Items** — Browse full item catalog. Edit any item's name, description, rarity, price, stats. Add new items. Set event version overrides (temporary price/rarity for events).
- **Economy** — DC sinks vs sources dashboard, inflation metrics, market volume
- **Events** — Create, schedule, activate, and end World Events. Set all event parameters.
- **Patch Notes** — Rich text editor. Publish immediately or schedule. Set severity tag (Major/Minor/Balance). Toggle Telegram notification on publish.
- **Secrets** — AES-256 encrypted API key storage. View key names, set/update values (written encrypted to DB), delete. Keys: Groq API, Together AI, Cloudinary, Gmail SMTP, Telegram Bot Token.
- **Moderation / VantaLog** — View auto-flagged events (3+ attacks on same target, high-risk crime anomalies). Review notes, mark as reviewed, take action.

---

## DEV TOOLBAR (Owner/Dev Mode)

A floating debug panel visible to players with `devMode: true`. Fixed to bottom-right corner. Toggle open/close.

**Actions:**
- **+DC** — Input field + button; adds specified DC amount directly to wallet
- **Lvl Up** — Sets player level to a chosen value (1–100); recalculates XP, skill points
- **⚡ Fill** — Instantly fills Energy and Nerve to max
- **🏥 Heal** — Clears hospitalization, restores full health
- **🚨 Clear** — Removes all Wanted Level stars

---

## PLAYER INSPECT MODAL

A full-screen overlay triggered by clicking any player avatar, username, or leaderboard row.

Shows:
- Large avatar with equipped frame (full animation)
- Username, tag, faction badge, prestige badge, equipped title
- Level and XP bar
- Core stats grid: Strength, Charisma, Intelligence, Street Cred
- Bio
- Equipped frame info panel (frame name, rarity, animation description)
- Owned badge display (up to 6 shown)

Action buttons (if not own profile):
- Attack (if eligible)
- Message
- Trade
- Follow/Unfollow

---

## EMBLEM BADGE SYSTEM

`EmblemBadge` component renders achievement badges as dynamic SVGs.

Each badge is categorized:
- **Combat** — Earned through fighting
- **Social** — Earned through feed activity and following
- **Faction** — Faction-specific achievements
- **Economy** — Wealth and market milestones
- **Crime** — Crime completion milestones

Badges have rarity-based glow and animation. The `EmblemRow` sub-component displays up to 3 badges in a horizontal row (used in profile cards and leaderboard rows).

---

## TONE, WRITING STYLE & DESIGN

### Narrative Voice
Every auto-generated post, crime result, and combat log is written in a consistent voice:
- **Gritty and cinematic** — The game narrates events matter-of-factly; it doesn't editorialize
- **Player is competent** — Failures happen because the world is hard, not because the player is bad. "The security system flagged your biometrics" not "You failed"
- **Dark humor** — Pickpocket result: *"You lifted a wallet. It had a loyalty card and 42 DC. New Vanta is as disappointing as always."*
- **City feels alive** — Posts, NPC dialogue, and herald text all reference real district names, faction tensions, and current events

### UI Design Philosophy
- **Dark-first, always** — No light mode. Background: `#0a0a0f`. Surface: `#111118`. Border: `#1e1e2e`.
- **Monospace for stats** — Numbers, DCs, stats use monospace font for terminal aesthetic
- **Neon accents** — Primary: `#00d4ff` (cyan). Warning: `#ff6b35` (orange). Danger: `#ff2d55` (red). Success: `#39d353` (green). NC: `#a855f7` (purple). DC: `#f59e0b` (gold).
- **Text:** Primary `#e2e8f0`. Secondary `#64748b`.
- **Minimal animations** — Smooth route transitions. Subtle hover states. No particle explosions except on frame animations.
- **Dense but readable** — Every panel shows maximum useful information. Hierarchy is clear through size, color, and spacing.
- **Mobile-first** — All UI works on small screens. Bottom nav on mobile. Swipeable carousels. Touch-friendly tap targets.
- **Rolling Number** — Currency values (DC, NC) animate with a rolling digit counter whenever they change, reinforcing feedback
- **XP Bar** — Always visible in header, showing progress to next level

---

## COMPLETE GAME LOOP SUMMARY

```
NEW PLAYER:
Signup → Email verify → Faction choice → Arrive in Residential North (safe zone)
↓
Daily Reward claimed → Work basic jobs (Delivery Driver, Security Guard) → Earn DC
↓
Level 5: Can join a Guild. Level 8: First crime unlocked (Pickpocket).
↓
Level 10: PvP unlocked. Choose Skill Tree. Start spending Skill Points.
↓
Grind jobs + crimes → Accumulate DC → Buy items from market → Equip for stat boosts
↓
Fight NPCs → Earn XP faster + item drops → Sell drops on market
↓
Level 15: Create or lead a Guild. Level 20: Smuggling unlocked.
↓
Buy first property → Passive income starts → Bank DC to protect it
↓
PvP: attack rivals, steal DC → Build Street Cred → Unlock elite crimes
↓
Level 25: Heist unlocked. Auction House access.
↓
Crafting: farm materials → craft rare items → list on market for profit
↓
Level 50: Secondary Skill Tree. Double down on specialization.
↓
Seasons: earn Season XP → advance Battle Pass tiers → earn exclusive cosmetics
↓
Level 100: Prestige. Start over with cosmetic bonuses and prestige badge.
↓
Guild Wars: coordinate with crew → dominate district control → earn faction bonuses
```

---

*DRIFTLIFE — New Vanta never sleeps. Neither do the players who run it.*
