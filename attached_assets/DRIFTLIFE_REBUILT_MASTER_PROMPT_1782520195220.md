# DRIFTLIFE — Rebuilt Master Prompt
### New Vanta · 2047 · Persistent Multiplayer Text-Based Browser RPG

---

## SECTION 0 — HOW TO READ THIS PROMPT

This document is the complete specification for DriftLife. Build it exactly as described. Do not invent systems not listed here. Do not skip systems that are listed.

**Priority order:** If anything is unclear, resolve it by asking — do not guess and ship broken behavior.

**Phased build:** Systems are tagged `[PHASE 1]` or `[PHASE 2]`. Build ALL Phase 1 systems first and ensure they are fully working before touching Phase 2. Phase 2 systems should have placeholder routes that return `{ message: "coming soon" }` in Phase 1.

---

## SECTION 1 — TECH STACK

### Full Stack Declaration

| Layer | Technology |
|---|---|
| Runtime | Node.js (latest LTS) |
| Backend | Express.js |
| Frontend | React (Vite) |
| Database | MongoDB via Mongoose |
| Auth | JWT (access token: 15 min, refresh token: 30 days) |
| Real-time | Socket.io |
| AI (NPCs) | Groq API — model: `llama-3.3-70b-versatile` |
| Avatar AI | Pollinations AI (free, no API key) |
| Emails | Nodemailer via Gmail SMTP |
| Payments | Telegram Stars (via Telegram Bot API) |

### Architecture

This is a **single web service**. Express serves the React build from `/client/dist`. All API routes are prefixed `/api`. Socket.io runs on the same Express server.

```
/
├── server/
│   ├── index.js          ← Express + Socket.io entry point
│   ├── routes/           ← All API route files
│   ├── models/           ← All Mongoose models
│   ├── middleware/        ← Auth, rate limiting, error handling
│   ├── services/          ← Groq, email, game logic helpers
│   └── seed.js            ← Database seeder (runs on first boot)
├── client/
│   ├── src/
│   │   ├── pages/         ← One file per route/page
│   │   ├── components/    ← Reusable UI components
│   │   ├── context/       ← Auth context, Socket context
│   │   └── hooks/         ← Custom React hooks
│   └── dist/              ← React build output (served by Express)
├── .env
└── package.json
```

### Environment Variables (.env)

```
MONGODB_URI=
JWT_SECRET=
JWT_REFRESH_SECRET=
GROQ_API_KEY=
GMAIL_USER=
GMAIL_PASS=
TELEGRAM_BOT_TOKEN=
ENCRYPTION_KEY=       ← 32-byte hex string for AES-256 message encryption
PORT=3000
NODE_ENV=production
```

### Deployment Target

Deploy as a **single Render.com web service**. Start command: `npm start`. Build command: `npm run build` (which runs `vite build` in /client). The Express server must serve the React build for all non-API routes.

Port binding: use `process.env.PORT || 3000`.

---

## SECTION 2 — DATABASE SEEDING

On server startup, run `seed.js` to check if the database is already seeded. If `Item.countDocuments() === 0`, insert all items, jobs, crimes, frames, NPCs, and properties defined in this document. Never re-seed if data already exists.

Seed must include:
- All items from the Item Catalog (Section 8)
- All jobs from the Jobs table (Section 5)
- All crimes from the Crime table (Section 6)
- All frames from the Frames Catalog (Section 12)
- All NPCs from the NPC Roster (Section 15)
- All properties from the Property Catalog (Section 13)

---

## SECTION 3 — OVERVIEW & VISION

DriftLife is a persistent, multiplayer, browser-based text RPG set in **New Vanta** — a sprawling neon dystopia in the year 2047. Players choose a faction, build a criminal or corporate identity, fight rivals, trade on a player-driven economy, talk to AI-powered NPCs with persistent memory, craft items, own properties, spend skill points, and climb leaderboards in a city that never stops moving.

The game lives entirely in the browser. No downloads. Dark-themed cyberpunk UI panels throughout. The world is fully shared — every player action affects every other player through live socket connections.

**Core gameplay loop:**
Daily Login Reward → Jobs (earn DC) → Crimes (amplify DC with risk) → Combat NPCs or PvP → Market (trade items) → Property (passive income) → Crafting (turn materials into gear) → Skill Trees (specialise your build) → Guilds (faction dominance)

---

## SECTION 4 — THE WORLD: NEW VANTA

New Vanta is divided into **7 persistent districts**. The player is always "located" in one district at a time. Changing districts costs Energy and moves the player to that zone's real-time chat, available jobs, crimes, NPCs, and combat encounters.

### Districts

| District | Faction | Danger | Travel Energy Cost | Primary Activity |
|---|---|---|---|---|
| Residential North | Neutral | ⚠️×1 | 3 | Starter jobs, low-risk crimes, safe zone |
| Tech Quarter | The Grid | ⚠️×2 | 5 | Hacking jobs, data crimes, Grid NPCs |
| The Boulevard | Neutral | ⚠️×3 | 8 | Social hub, clubs, mid-tier jobs |
| Industrial East | The Street | ⚠️×4 | 8 | Dock work, gang crimes, Street NPCs |
| Port District | The Street | ⚠️×4 | 8 | Smuggling, black market, cargo jobs |
| Downtown Core | The Suits | ⚠️×5 | 12 | Corporate jobs, high-level PvP, elite crimes |
| The Outskirts | Uncontrolled | ⚠️×5 | 12 | Rarest loot, boss NPCs, extreme rewards |

Travel energy cost = the destination district's cost. Players cannot commit crimes or do jobs until travel resolves. Travel is instant in-game but deducts the Energy immediately.

Each district shows:
- Live player count currently in that zone
- Controlling faction (colour-coded)
- Danger level meter
- Available jobs badge
- Zone Chat — real-time chat for all players currently in that district
- NPC encounters specific to that zone

### Faction Territory Control
The faction with the highest cumulative activity (XP earned, crimes completed, combat wins) in a district controls it. Control shifts weekly. Controlling faction members get a passive bonus in that district (+5% job DC, +5% crime success rate).

---

## SECTION 5 — THREE FACTIONS

Chosen once during onboarding. Cannot be changed. Affects job bonuses, crime bonuses, NPC dialogue tone, and territory.

### 🏢 The Suits — Corporate Empire
Power through wealth and manipulation. Suits specialise in high-paying corporate jobs, trading, and data crimes. Stat affinity: **Charisma** and **Intelligence**.
- +10% DC from jobs
- +5% to Scam and Espionage crime success
- Discount at Downtown Core market stalls

### 🔥 The Street — Underground Syndicate
Power through reputation and raw force. Street players dominate physical combat, run protection rackets, and control the black market. Stat affinity: **Strength** and **Street Cred**.
- +10% DC from PvP wins
- +5% to Robbery and Heist crime success
- Extra XP from combat NPCs

### 💻 The Grid — Digital Collective
Power through information and precision. Grid players hack systems, manipulate markets, and extract data. Stat affinity: **Intelligence** and **Energy efficiency**.
- -10% Energy cost on all jobs
- +5% to Data Breach and Scam success
- Access to exclusive Grid market listings

---

## SECTION 6 — PLAYER DATA MODEL

### Identity & Auth
- `email` — login credential, verified via OTP
- `username` — display name (3–20 chars, unique)
- `tag` — unique identifier like `Username#1234` (auto-generated on signup)
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
- `unlockedSkills` — array of skill node IDs
- `skillTree` — primary tree: `hustler` | `fighter` | `ghost` | `connector`
- `secondarySkill` — secondary tree (unlocks at level 50)
- `seasonXp` — XP earned in current season
- `craftingXp` — XP from crafting

### Currencies
- `dc` — Drift Coins (wallet, vulnerable to PvP theft)
- `nc` — Nova Credits (premium only; earned via Telegram Stars payments)
- `bankBalance` — DC stored safely in bank (never stolen)

### Core Stats
- `strength` — PvP/PvE combat power
- `charisma` — trade prices, crime success rates
- `intelligence` — crime success rates, hacking, data theft
- `streetCred` — unlocks higher-tier crimes and faction missions
- `nerve` — crime resource; max 50; regens 1 per 5 minutes
- `energy` — job/travel resource; max 100; regens 1 per 3 minutes
- `maxEnergy` / `maxNerve` — base max values (raised by skill nodes)
- `health` / `maxHealth` — combat health pool; max 100
- `energyRegenAt` / `nerveRegenAt` — timestamps for regen tracking

### Combat & Criminality
- `faction` — `suits` | `street` | `grid`
- `wantedLevel` — 0 to 5 stars; decays passively over 30 minutes
- `wantedDecayAt` — timestamp for next decay tick
- `hospitalized` — boolean
- `hospitalReleaseAt` — timestamp when player is freed
- `lastAttackAt` — timestamp of last PvP attack
- `attacksToday` — number of PvP attacks made today (max 15)
- `attackResetAt` — when daily PvP counter resets (midnight UTC)
- `attackCooldowns` — array of `{targetId, until}` — per-target 60-min cooldown

### Social & Customisation
- `following` — array of user refs
- `mutedUsers` — array of user IDs (hidden from chat)
- `blockedUsers` — array of user IDs (blocked from DMs)
- `titles` — array of earned title strings
- `equippedTitle` — currently displayed title
- `avatar` — seed index for procedural SVG avatar (1–20)
- `avatarUrl` — custom Pollinations AI image URL (domain-whitelisted server-side)
- `bio` — freeform profile description (max 300 chars)
- `currentDistrict` — which of the 7 districts the player is in
- `frameIds` — array of owned frame IDs
- `equippedFrame` — ID of currently equipped frame
- `equippedFrameRarity` — rarity of equipped frame (for chat bubble rendering)

### Misc Systems
- `referralCode` — unique code; referrer earns 500 DC + 200 XP per signup
- `referredBy` — who referred this player
- `referralCount` — total successful referrals
- `telegramId` / `telegramNotifications` — linked Telegram account
- `devMode` — boolean; shows Owner Dev Toolbar when true
- `battlePassPremium` — boolean; whether player bought the season's premium pass

---

## SECTION 7 — STATS & RESOURCES

### Core Stats (Permanent)
- **Strength** — Every point increases PvP and PvE combat roll. Weapons add to this.
- **Charisma** — Gives slight discount on market purchases, improves Scam/Espionage success. Clothing adds to this.
- **Intelligence** — Improves Data Breach, Scam, Corporate Spy success. Some weapons add to this.
- **Street Cred** — Required minimum for high-tier crimes. Faction Outfit adds to this.

### Resources (Regenerating)
- **Energy** (max 100): Required for all jobs and travel. Regens 1 per 3 minutes.
- **Nerve** (max 50): Required for all crimes. Regens 1 per 5 minutes.
- **Health** (max 100): Used in combat. Fully refills after hospitalization ends.

### Regen System
Do not poll for regen. Calculate current value on-demand:
```js
// Example for energy
const now = Date.now();
const minutesPassed = (now - user.energyRegenAt) / 60000;
const regenAmount = Math.floor(minutesPassed * (1/3)); // 1 per 3 min
user.energy = Math.min(user.maxEnergy, user.energy + regenAmount);
if (regenAmount > 0) user.energyRegenAt = now;
```
Run this calculation at the start of any API call that reads or deducts Energy or Nerve.

---

## SECTION 8 — LEVELING & PROGRESSION

### XP Requirements

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
- **Level 10:** PvP combat unlocked. Skill Points begin (1 per 5 levels). Primary Skill Tree selection.
- **Level 15:** Can create a Guild. Vehicle Theft crime unlocked.
- **Level 20:** Smuggling Run crime unlocked.
- **Level 25:** Heist (Solo) crime unlocked. Auction House access.
- **Level 50:** Secondary Skill Tree unlocked.
- **Level 100:** Prestige system.

### Level-Up Logic (Auto-run on every XP award)
1. Add XP to `user.xp`
2. Check if `user.xp >= user.xpToNext`
3. If yes: increment `user.level`, reset `user.xp = 0`, recalculate `user.xpToNext`
4. Every 5 levels from level 10: award +1 `skillPoints`
5. Broadcast a level-up post to the social feed automatically

---

## SECTION 9 — DAILY REWARDS

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

**NC:** NC is a premium currency only. It cannot be earned in-game. It is purchased exclusively via Telegram Stars through the Telegram Bot.

**UI:** 7-day calendar strip showing past claims (green checkmarks), today's reward (glowing border), and future days (locked/dimmed). "Claim" button triggers animation and reward modal.

---

## SECTION 10 — JOBS SYSTEM `[PHASE 1]`

### How Jobs Work
1. Player opens Jobs panel (from Map district view or nav)
2. System shows all available jobs filtered by: player's `currentDistrict`, `player.level >= job.minLevel`, and per-job cooldown
3. Player clicks a job — it resolves **immediately** (no wait timer)
4. Energy deducted; DC (randomised in range) and XP awarded
5. A "completed shift" post is auto-created in the social feed
6. "Hustler" skill tree node "DC Magnet" adds +10% DC to all job payouts

### Full Job List

| Job | District | Min Level | Energy | DC Range | Cooldown |
|---|---|---|---|---|---|
| Delivery Driver | Any | 1 | 2 | 100–250 | 30 min |
| Street Performer | The Boulevard | 1 | 1 | 50–200 | 20 min |
| Building Super | Residential North | 1 | 2 | 120–280 | 40 min |
| Bartender | The Boulevard | 1 | 2 | 150–300 | 30 min |
| Security Guard | Residential North | 1 | 3 | 150–350 | 60 min |
| Club Promoter | The Boulevard | 5 | 1 | 300–600 | 45 min |
| Dock Worker | Industrial East | 5 | 3 | 250–500 | 45 min |
| Data Courier | Tech Quarter | 5 | 2 | 300–700 | 45 min |
| Street Dealer | Industrial East | 8 | 2 | 400–800 | 60 min |
| Smuggler | Port District | 10 | 3 | 500–1,200 | 60 min |
| Freight Driver | Industrial East | 10 | 3 | 350–750 | 60 min |
| Corporate Spy | Downtown Core | 15 | 3 | 800–2,000 | 120 min |
| Hacker-for-Hire | Tech Quarter | 15 | 3 | 700–1,800 | 90 min |
| Black Market Broker | Port District | 20 | 3 | 900–2,500 | 120 min |
| Bounty Hunter | The Outskirts | 20 | 4 | 1,000–3,000 | 180 min |
| Financial Analyst | Downtown Core | 25 | 4 | 1,200–3,000 | 150 min |
| Arms Runner | The Outskirts | 25 | 4 | 1,500–4,000 | 180 min |
| Scavenger | The Outskirts | 1 | 3 | 200–600 | 90 min |

---

## SECTION 11 — MINI-GAME SYSTEM `[PHASE 1]`

When performing a job, a mini-game **may randomly trigger** (30% chance). Completing it adds a bonus DC multiplier. All 4 types are built in Phase 1.

### Shared UI Elements (All Mini-Games)
- Circular SVG countdown timer (25 seconds)
- Live score counter in corner
- "Forfeit" button (abandons mini-game, player still gets base reward)
- Final reward overlay after game ends: `"Base: 800 DC + Bonus: 320 DC = 1,120 DC"`

---

### Mini-Game 1: Typing Rush
A random word appears on screen. Player types it correctly within 25 seconds. Multiple rounds — more correct words = higher multiplier.
- UI: Large central word, live typed text below, circular countdown timer
- Multiplier: 1 correct word = 1.1×, 3 = 1.3×, 5+ = 1.5×

### Mini-Game 2: Pattern Match (Simon-style)
A sequence of 4–8 grid squares lights up. Player must click them in correct order from memory.
- UI: 3×3 grid, coloured highlights shown once, then player clicks
- Multiplier: 4 correct = 1.2×, 6 correct = 1.4×, 8 correct = 1.6×

### Mini-Game 3: Timing Clicker
A bar slides horizontally. Green "sweet zone" in the center. Player clicks when bar is in the zone. Multiple rounds; accuracy determines multiplier.
- UI: Sliding bar with red–yellow–green zones, "Click!" prompt
- Multiplier: 1 hit = 1.1×, 3 hits = 1.3×, 5 hits = 1.5×

### Mini-Game 4: Rhythm Tap
Notes fall down the screen at fixed intervals. Player taps when notes hit the target zone.
- UI: Vertical lane, falling circles, target zone at bottom, hit/miss visual feedback
- Multiplier: based on hit accuracy percentage (50% hit = 1.1×, 80% = 1.3×, 100% = 1.5×)

---

## SECTION 12 — CRIME SYSTEM `[PHASE 1]`

### Crime Resolution Logic
```js
successChance = baseSuccess
  + (intelligence - 5) * 0.01
  + streetCredBonus
  + factionBonus        // +0.05 for matching faction/crime type
  + skillBonus          // from Ghost tree nodes

roll = Math.random()  // 0.0 to 1.0
if (roll < successChance) → SUCCESS
else → FAILURE
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
- **3 Stars:** NPCs in certain districts become hostile.
- **4 Stars:** Aggressive combat NPCs spawn against the player. Some jobs unavailable.
- **5 Stars:** Maximum heat. Chief Ralston NPC appears with bribe option. Some districts lock player out.

**Wanted Decay:** Decays 1 star per 30 minutes of inactivity (tracked via `wantedDecayAt`). Can instantly clear by bribing Ralston (cost = `wantedLevel² × 1,000 DC`).

### Hospitalization
On hospital risk trigger: generate `Math.random()`. If below the crime's hospital risk %, player is hospitalized.

**Hospital durations:**
- Minor crime fail (Pickpocket, Scam): 20 minutes
- Mid crime fail (Break-In, Vehicle Theft, Data Breach): 45 minutes
- High crime fail (Smuggling, Heist, Corporate Espionage): 2 hours
- Extreme crime fail (Assassination, Vault Crack): 4 hours
- PvP loss: 20–30 minutes

**While hospitalized:** Cannot commit crimes, do jobs, fight, or travel. CAN: chat, browse market, manage inventory, collect property income.

**Hospital item discharge rules:**
- Bandage: -10 minutes flat
- First Aid Kit: -20 minutes flat
- Medical Kit: -50 minutes flat
- Nano Repair: -60% of remaining time
- Phoenix Down: removes hospitalization entirely

**Early paid discharge:** 50 DC per remaining minute via `POST /api/hospital/discharge`

---

## SECTION 13 — COMBAT SYSTEM `[PHASE 1]`

### PvE — NPC Combat
```js
playerAttack = (strength * 1.5) + randomInt(0, 30) + weaponBonus
npcDefense = npcStrength + randomInt(0, 20)
if (playerAttack > npcDefense) → WIN
else → LOSE (take HP damage)
```

**Full NPC Roster:**

| NPC | District | Level | HP | DC Reward | XP | Drop |
|---|---|---|---|---|---|---|
| Street Punk | Residential North | 5 | 30 | 500–1,000 | 50 | Common |
| Street Thug | Industrial East | 10 | 50 | 1,000–3,000 | 100 | Common/Uncommon |
| Gang Member | The Boulevard | 15 | 60 | 1,000–3,000 | 100 | Common |
| Dock Enforcer | Port District | 25 | 80 | 3,000–8,000 | 200 | Uncommon |
| Security Guard | Downtown Core | 33 | 150 | 5,000–12,000 | 300 | Uncommon/Rare |
| Shadow Operative | Tech Quarter | 45 | 200 | 10,000–25,000 | 500 | Rare |
| Syndicate Boss | The Outskirts | 70 | 350 | 30,000–80,000 | 1,500 | Epic |
| Faction Boss | Downtown Core | 90 | 500 | 50,000–150,000 | 3,000 | Epic/Legendary |
| Rogue AI Unit | The Outskirts | 95 | 600 | 80,000–200,000 | 5,000 | Legendary |

### PvP — Player Combat (Unlocks at Level 10)

**Requirements:**
- Both players in same district
- Target within 25 levels of attacker
- Per-target 60-minute cooldown
- Max 15 PvP attacks per player per day

**Resolution:**
```js
attackerRoll = (attacker.strength + randomInt(0, 10)) + weaponBonus
defenderRoll = (defender.strength + randomInt(0, 10)) + weaponBonus
// Higher roll wins
```

**Outcomes:**
- **Attacker wins:** Steals 10% of target's wallet DC (never bank). Cap: 500,000 DC. Earns XP.
- **Attacker loses:** Loses 15% HP. Possible hospitalization if health hits 0.
- Both sides receive real-time socket notification with narrative combat log.

**Anti-Harassment:** 3+ attacks on same player in 24 hours auto-flags to VantaLog for staff review.

---

## SECTION 14 — ITEM CATALOG `[PHASE 1]`

### Item Rarity Tiers

| Rarity | Colour | Drop Rate |
|---|---|---|
| Common | `#9CA3AF` Grey | ~60% |
| Uncommon | `#4ADE80` Green | ~25% |
| Rare | `#60A5FA` Blue | ~10% |
| Epic | `#C084FC` Purple | ~4% |
| Legendary | `#FBBF24` Gold | ~1% |
| Mythic | `#00FF41` Matrix Green | Achievement/Event only |
| Event | `#F97316` Orange | Event period only |

### CONSUMABLES

| Item | Rarity | Base Price | Effect on Use |
|---|---|---|---|
| Street Food | Common | 250 DC | +5 Energy |
| Energy Drink | Common | 500 DC | +10 Energy |
| Bandage | Common | 300 DC | -10 min hospital time |
| Painkillers | Common | 400 DC | +5 Nerve |
| First Aid Kit | Common | 1,000 DC | -20 min hospital time |
| Protein Bar | Uncommon | 2,000 DC | +15 Energy, +5 Strength (1 hour) |
| Adrenaline Shot | Uncommon | 5,000 DC | +20 Energy |
| Stimulant Pack | Uncommon | 8,000 DC | +15 Energy, +10 Nerve |
| Medical Kit | Rare | 25,000 DC | -50 min hospital time |
| Super Stimulant | Rare | 30,000 DC | +30 Energy, +15 Nerve |
| Nano Repair | Epic | 250,000 DC | -60% remaining hospital time, +50 Energy |
| Combat Drug | Epic | 300,000 DC | +20 Strength (1 hour) |
| Legendary Elixir | Legendary | 5,000,000 DC | +10 to all stats, +50 Energy, +20 Nerve |
| Phoenix Down | Legendary | 8,000,000 DC | Instantly removes hospitalization |
| Event Cake | Event | Event only | +50 Energy, +50 Nerve |

### WEAPONS (Equip one at a time)

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

### CLOTHING (Equip one at a time)

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
| Director's Suit | Legendary | 8,000,000 DC | +15 Charisma, +10 Intelligence |
| CEO Tuxedo | Legendary | 20,000,000 DC | +20 Charisma, +15 Intelligence |

### VEHICLES (Equip one at a time — reduces travel Energy cost)

| Item | Rarity | Base Price | Effect |
|---|---|---|---|
| Bicycle | Common | 500 DC | -5% travel energy |
| Motorcycle | Uncommon | 5,000 DC | -15% travel energy |
| Sports Car | Rare | 100,000 DC | -35% travel energy, +5 Charisma |
| Luxury Car | Rare | 150,000 DC | -30% travel energy, +8 Charisma |
| Hoverbike | Epic | 1,500,000 DC | -45% travel energy, +5 Intelligence |
| Armored Limo | Legendary | 15,000,000 DC | -30% travel energy, +15 Charisma, +5 Strength |

### MATERIALS (Used in Crafting — tradeable, not equippable)

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

### BADGES (Earned through achievements — display on profile)

| Badge | Rarity | Earned By |
|---|---|---|
| Newbie | Common | First login complete |
| Crime Lord | Uncommon | Complete 10 crimes |
| Rich Kid | Rare | Accumulate 1,000,000 DC |
| Centurion | Legendary | Reach Level 100 |
| Ultimate Badge | Legendary | Max all core stats (+5 all stats permanently) |

### CHARACTER CARDS (Collectible lore items — tradeable, display on profile)

| Card | Rarity | Price |
|---|---|---|
| Director Webb Card | Epic | 50,000 DC |
| Mama Nova Card | Epic | 50,000 DC |
| Ghost Card | Epic | 50,000 DC |
| Chief Ralston Card | Rare | 20,000 DC |
| Cleo Card | Rare | 20,000 DC |
| Marco Card | Rare | 20,000 DC |
| City Legend Card | Legendary | 5,000,000 DC |

### Item Actions
- **Equip** (weapons, clothing, vehicles): Swaps into equipped slot. Stats update immediately.
- **Use** (consumables): Effect applies immediately. Quantity decrements.
- **Salvage:** Destroys item for 15% of base price in DC. Cannot be undone. Confirmation required.
- **Sell on Market:** Lists item at player-chosen price.
- **Trade:** Sends directly to another player.

---

## SECTION 15 — CRAFTING SYSTEM `[PHASE 2]`

Players combine Materials to create items. Crafting takes real time (skippable with NC).

### Crafting Mastery Levels

| Mastery Level | Title | Bonus |
|---|---|---|
| 1 | Scavenger | None |
| 2 | Tinkerer | +5% success |
| 3 | Artisan | +10% success |
| 4 | Engineer | +15% success |
| 5 | Legendary Smith | +20% success, -10% time |

### Crafting Recipes

| Output | Inputs | Craft Time | Crafting XP |
|---|---|---|---|
| Energy Pack ×3 | 3× Street Food + 1× Chemicals | 60 sec | 10 XP |
| Bandage ×3 | 2× Fabric + 1× Chemicals | 120 sec | 15 XP |
| Painkillers ×2 | 3× Chemicals | 90 sec | 12 XP |
| Combat Knife | 3× Scrap Metal + 1× Leather | 180 sec | 25 XP |
| Pistol | 5× Scrap Metal + 3× Electronics | 600 sec | 60 XP |
| Street Jacket | 4× Fabric + 2× Leather | 240 sec | 30 XP |
| Tactical Vest | 5× Scrap Metal + 3× Fabric | 300 sec | 50 XP |
| First Aid Kit | 3× Fabric + 2× Chemicals | 180 sec | 20 XP |
| Stimulant Pack | 4× Chemicals + 2× Electronics | 360 sec | 45 XP |
| Nano Suit | 5× Nano Materials + 2× Rare Metal + 5× Electronics | 3,600 sec | 500 XP |

---

## SECTION 16 — SKILL TREES `[PHASE 2]`

Primary Skill Tree chosen at Level 10. Secondary at Level 50.

### 🤑 The Hustler — Economy Focus
| Node | Cost | Effect |
|---|---|---|
| Fast Hands | 1 | -10% job cooldowns |
| Market Shark | 2 | -3% market buy fees |
| Business Empire | 3 | +10% property passive income |
| DC Magnet | 3 | +10% all job DC rewards |
| The Mogul | 5 | Unlock premium market stall (no listing fee 7 days/month) |

### ⚔️ The Fighter — Combat Focus
| Node | Cost | Effect |
|---|---|---|
| Iron Fist | 1 | +3 Strength in combat rolls |
| Thick Skin | 2 | -20% hospitalization time |
| Street Brawler | 3 | +5% PvP damage |
| Relentless | 3 | +2 daily PvP attacks (cap to 17) |
| The Undisputed | 5 | 15% chance to avoid hospitalization on PvP loss |

### 👻 The Ghost — Crime/Stealth Focus
| Node | Cost | Effect |
|---|---|---|
| Light Feet | 1 | -20% wanted level gained from crimes |
| Inside Man | 2 | +5% success on Break-In and Vehicle Theft |
| Clean Hands | 3 | Wanted Level decays 50% faster |
| Shadow | 3 | +8% success on Heist and Corporate Espionage |
| The Phantom | 5 | Once per day: crime failure does not trigger hospitalization |

### 🤝 The Connector — Social/Guild Focus
| Node | Cost | Effect |
|---|---|---|
| Silver Tongue | 1 | +5% Charisma in all stat checks |
| Network | 2 | Guild treasury donations count double for guild XP |
| Reputation | 3 | +5 Street Cred permanent |
| City Voice | 3 | Player posts get priority placement in the feed |
| The Mayor | 5 | Can set a "district bounty" — 5,000 DC reward for any player who defeats a named target |

---

## SECTION 17 — FRAMES SYSTEM `[PHASE 1]`

Frames are decorative animated borders shown around a player's avatar in chat bubbles, leaderboard rows, and profile.

### Rarity Animation Tiers
| Rarity | Animation |
|---|---|
| Common | Static Border — solid colour ring |
| Uncommon | Slow Shimmer Sweep — gradient slides slowly around ring |
| Rare | Gentle Pulse Glow — border brightness pulses like a heartbeat |
| Epic | Rotating Gradient Sweep — full-colour gradient rotates continuously |
| Legendary | Electric Flicker Spark — sparks and lightning flicker around edges |
| Mythic | Matrix Ripple — falling code characters, cascading colour ripple |

### Display Components
- **`PlayerFrame`** — Full component with sizes xs/sm/md/lg/xl
- **`AvatarWithFrame`** — Standard avatar+frame helper
- **`FrameRectBubble`** — Chat message container with frame as border
- **`LbFrameRow`** — Leaderboard row with frame styling

### Frame Catalog

#### COMMON — Static Border, Free
| Frame ID | Display Name | Glow Colour |
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
| Frame ID | Display Name | NC Cost | Glow Colour |
|---|---|---|---|
| silverEdge | Silver Edge | 50 NC | `#9CA3AF` |
| plainGold | Plain Gold | 50 NC | `#CA8A04` |

#### UNCOMMON — Slow Shimmer, Free
| Frame ID | Display Name | Glow Colour |
|---|---|---|
| gradientShift | Gradient Shift | `#10B981` |
| oceanBreeze | Ocean Breeze | `#0EA5E9` |
| midnightWave | Midnight Wave | `#1D4ED8` |
| forestEdge | Forest Edge | `#166534` |
| iceBlue | Ice Blue | `#BAE6FD` |
| springMint | Spring Mint | `#34D399` |
| vintageCopper | Vintage Copper | `#C2410C` |

#### UNCOMMON — Slow Shimmer, Paid
| Frame ID | Display Name | NC Cost | Glow Colour |
|---|---|---|---|
| mossGlow | Moss Glow | 75 NC | `#16A34A` |
| roseGold | Rose Gold | 75 NC | `#FB7185` |
| amberGlow | Amber Glow | 75 NC | `#D97706` |
| lavenderMist | Lavender Mist | 75 NC | `#A78BFA` |
| citrusBurst | Citrus Burst | 75 NC | `#F97316` |
| crimsonEdge | Crimson Edge | 75 NC | `#DC2626` |
| desertSun | Desert Sun | 75 NC | `#FCD34D` |
| duskPurple | Dusk Purple | 75 NC | `#7C3AED` |

#### RARE — Pulse Glow, Free
| Frame ID | Display Name | Glow Colour |
|---|---|---|
| rippleRing | Ripple Ring | `#38BDF8` |
| glitchShake | Glitch Shake | `#22D3EE` |
| frostbite | Frostbite | `#7DD3FC` |
| bloodMoon | Blood Moon | `#B91C1C` |
| shadowPulse | Shadow Pulse | `#6D28D9` |
| cosmicDust | Cosmic Dust | `#818CF8` |
| stormCloud | Storm Cloud | `#64748B` |

#### RARE — Pulse Glow, Paid
| Frame ID | Display Name | NC Cost | Glow Colour |
|---|---|---|---|
| cyberGlow | Cyber Glow | 150 NC | `#00E5FF` |
| plasmaRing | Plasma Ring | 150 NC | `#E879F9` |
| solarFlare | Solar Flare | 150 NC | `#FB923C` |
| acidGreen | Acid Green | 150 NC | `#4ADE80` |
| ultraviolet | Ultraviolet | 150 NC | `#818CF8` |
| crystalline | Crystalline | 150 NC | `#93C5FD` |
| venomDrip | Venom Drip | 150 NC | `#65A30D` |
| vortexEdge | Vortex Edge | 150 NC | `#9333EA` |

#### EPIC — Rotating Gradient, Free
| Frame ID | Display Name | Glow Colour |
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

#### EPIC — Rotating Gradient, Paid
| Frame ID | Display Name | NC Cost | Glow Colour |
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

#### LEGENDARY — Electric Flicker, Free (Earned through gameplay)
| Frame ID | Display Name | Glow Colour |
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

#### LEGENDARY — Electric Flicker, Paid
| Frame ID | Display Name | NC Cost | Glow Colour |
|---|---|---|---|
| cyberSpark | Cyber Spark | 1,000 NC | `#22D3EE` |
| godRay | God Ray | 1,000 NC | `#FBBF24` |
| plasmaBolt | Plasma Bolt | 1,000 NC | `#D946EF` |
| ironClad | Iron Clad | 1,000 NC | `#CBD5E1` |

#### MYTHIC — Matrix Ripple (Achievement/Event Only)
| Frame ID | Display Name | Glow Colour |
|---|---|---|
| matrixRain | Matrix Rain | `#00FF41` |
| spectral | Spectral | `#F0F9FF` |
| voidCore | Void Core | `#7C3AED` |
| hackerElite | Hacker Elite | `#00FF41` |
| shadowLord | Shadow Lord | `#1E1B4B` |
| cosmicHorror | Cosmic Horror | `#6B21A8` |
| theAbyss | The Abyss | `#0C0A09` |
| deathCode | Death Code | `#EF4444` |

---

## SECTION 18 — AVATAR SYSTEM `[PHASE 1]`

Every player has a **procedurally generated SVG avatar** unique to their account seed.

### Generation
```js
// hashStr(username) → numeric hash → bit-shift extract indices
// Same username always produces same avatar
```

Components (all SVG, no image files):
- Background Shape: Circle, Diamond, Hexagon, Square
- Background Colour: 12 cyberpunk palette colours
- Eye Style: Rectangles, slashes, scanner lines, dots
- Mouth Style: Flat line, smirk, grill
- Hair Style: Spikes, mohawk, long, bun, fade, dreads
- Accessories: Glasses, bandana, face mask, visor, none
- Skin Tone: 6 options

### Custom Avatar
Players can set `avatarUrl` — a Pollinations AI generated image.

**"Generate Avatar" button flow:**
1. Player enters character description
2. Game builds prompt: `"cyberpunk portrait of [description], faction: [faction], neon city 2047, dark aesthetic, digital art"`
3. Sends to: `https://image.pollinations.ai/prompt/[encoded_prompt]?width=256&height=256&nologo=true`
4. Saves URL to `user.avatarUrl`

**Server-side validation:** Only accept URLs matching `https://image.pollinations.ai/*`

### NPC Avatars
NPCs use `generateNPCAvatarSVG()` — more robotic/cybernetic appearances with faction-coded colours:
- Director Webb: cold blue/grey
- Mama Nova: warm orange/red
- Ghost: green matrix tones
- Marco: dark grey/brown
- Cleo: gold/pink
- Chief Ralston: navy/black

---

## SECTION 19 — MARKET & ECONOMY `[PHASE 1]`

### Player Market (Fixed Price)
Any player can list any tradeable item for any DC price. Listings last 48 hours.

- **Listing fee:** None
- **Sale fee:** 5% of sale price taken as currency sink. Seller receives 95%.
- **Cancelling:** Seller can cancel; item returns to inventory.
- **Filters:** Category, Rarity, Price (min/max), Sort (Price ↑↓, Newest, Rarity)

### Auction House `[PHASE 2]`
- Starting bid, optional reserve price, optional Buy Now price
- Duration: 1 hour / 6 hours / 12 hours / 24 hours
- Each bid: minimum 5% higher than current bid
- Previous bidder refunded DC immediately on outbid
- 10% auction fee on final sale price
- Access unlocks at Level 25

### Black Market `[PHASE 2]`
Port District only. Items with `blackMarket: true` flag. Anonymous sellers. No listing fee.

### Direct Player Trade `[PHASE 2]`
Both players add items/DC to offer → both click Ready → both click Confirm → atomic swap.

### Economy Principles
- Jobs provide the earning floor — always accessible
- Crimes multiply income at real risk cost
- 5% market fee + 10% auction fee = currency sinks preventing inflation
- Bank protects savings from PvP
- NC is premium-only and not earnable in-game

---

## SECTION 20 — BANK SYSTEM `[PHASE 1]`

- `POST /api/bank/deposit` — moves DC from wallet to bank. No fee.
- `POST /api/bank/withdraw` — moves DC from bank to wallet. No fee.
- PvP theft only takes from wallet `dc`, never from `bankBalance`
- Bank accessible regardless of district, hospitalization, or Wanted Level

---

## SECTION 21 — PROPERTY SYSTEM `[PHASE 2]`

Players own properties in New Vanta generating passive hourly income.

**Rules:**
- Income accumulates in per-property vault hourly
- Vault max = 24 hours income (stops if not collected)
- Sell back at 70% of purchase price
- One property of each tier per player

### Property Catalog

| Property | Cost | Income/hr | Vault Cap | District | Min Level |
|---|---|---|---|---|---|
| Small Apartment | 50,000 DC | 100 DC | 2,400 DC | Any | 1 |
| City Apartment | 150,000 DC | 300 DC | 7,200 DC | Residential North | 1 |
| Small Shop | 100,000 DC | 200 DC | 4,800 DC | Any | 1 |
| Loft | 500,000 DC | 1,000 DC | 24,000 DC | The Boulevard | 10 |
| Warehouse | 750,000 DC | 1,500 DC | 36,000 DC | Industrial East / Port | 15 |
| Penthouse | 2,000,000 DC | 4,000 DC | 96,000 DC | Downtown Core | 50 |
| Nightclub | 5,000,000 DC | 10,000 DC | 240,000 DC | The Boulevard | 40 |
| Casino | 10,000,000 DC | 20,000 DC | 480,000 DC | Downtown Core | 50 |

---

## SECTION 22 — GUILDS `[PHASE 2]`

### Creating a Guild
- Costs 5,000 DC + Level 15
- Creator becomes Leader
- Choose: name, 3-letter tag, description, faction alignment

### Guild Hierarchy
- **Leader** — Full control
- **Officer** — Can invite, kick Members/Recruits
- **Member** — Can donate, chat
- **Recruit** — Limited; waiting period before full Member

### Guild Features
- **Guild Treasury** — Shared DC pool. Only Leader can spend it.
- **Guild Chat** — Private real-time chat (socket room `guild:ID`)
- **Guild Upgrades** — Treasury funds unlock buffs (+5% job income, +10 max Energy, etc.)
- **Max Members:** 25 (upgradeable with NC from treasury)

### Leaving / Disbanding
- Leaving: 24-hour cooldown before joining another guild
- Disbanding: returns 50% of treasury to Leader

---

## SECTION 23 — SOCIAL FEED `[PHASE 1]`

The game's social hub. Scrollable, real-time feed.

### Post Types
- **Adventure posts** — Auto-generated when player does something notable (crime success, PvP win, level up, property purchase). Narrative written by the server.
- **Manual posts** — Player writes their own update (max 280 chars)
- **Herald posts** — Official game news and event announcements
- **System posts** — Server announcements
- **Vanta posts** — Lore/world-building posts from New Vanta "news sources"

### Post Interactions
- Reactions: 👍 Like, 😂 Laugh, 😱 Shock, 🫡 Respect — update in real time
- Comments — Any player can reply to any post
- @Mentions — Notifies tagged player

### Feed Filters
- All Activity (default), Faction Only, Guild Only, Following Only

---

## SECTION 24 — NPC SYSTEM (AI-POWERED) `[PHASE 2]`

Key characters in New Vanta respond using **Groq API (llama-3.3-70b-versatile)**. Each NPC has persistent per-player memory.

### How NPC Conversations Work
1. Player travels to NPC's district
2. Opens NPC encounter panel
3. Types message → `POST /api/npc/talk`
4. Server retrieves last 50 messages from `NpcMemory` model for this player+NPC pair
5. Groq called with: NPC system prompt + conversation history + new message
6. Response returned and saved to `NpcMemory`
7. `bondScore` increments per conversation

**Groq API call:**
```js
const response = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    { role: "system", content: npc.systemPrompt },
    ...last50Messages,
    { role: "user", content: playerMessage }
  ],
  max_tokens: 300,
  temperature: 0.85
});
```

### Full NPC Roster

| NPC | District | Type | Personality |
|---|---|---|---|
| Director Webb | Downtown Core | Story (Suits) | Cold, brilliant, measured. Speaks in corporate metaphors. |
| Mama Nova | Industrial East | Story (Street) | Warm like a grandmother, terrifying like a boss. Calls everyone "baby." |
| Ghost | Tech Quarter | Story (Grid) | Cryptic, text-only comms. Talks in riddles and code references. |
| Marco | Port District | Shop (Neutral) | Gruff, no-nonsense black market operator. Pure business. |
| Cleo | The Boulevard | Shop (Neutral) | Charming, gossip-rich, knows everyone. Arms dealer with a smile. |
| Chief Ralston | Residential North | Bribe Target | Corrupt, authoritative, always wants DC. Lowers Wanted Level for payment. |

### NPC Memory Model
```js
{
  npcId: String,
  userId: ObjectId,
  bondScore: Number,
  memories: [{ role: "user"|"assistant", content: String, at: Date }]
  // Cap at last 50 messages
}
```

---

## SECTION 25 — REAL-TIME FEATURES (SOCKET.IO) `[PHASE 1]`

All real-time features run through a persistent WebSocket connection on login.

### Client → Server Events

| Event | Payload | Action |
|---|---|---|
| `auth` | `{ userId }` | Authenticates socket, joins private room `user:{userId}` |
| `join_district` | `{ districtId }` | Joins district chat room |
| `leave_district` | `{ districtId }` | Leaves district chat room |
| `join_global` | — | Joins global chat room |
| `join_guild` | `{ guildId }` | Joins guild chat room |
| `chat_message` | `{ districtId, content }` | Sends to district room |
| `global_message` | `{ content, equippedFrame, equippedFrameRarity }` | Broadcasts to global room |
| `guild_message` | `{ guildId, content }` | Sends to guild room |
| `dm_sent` | `{ recipientId }` | Notifies recipient of new DM |
| `notify_attack` | `{ targetId, result }` | Sends PvP result to both players |

### Server → Client Events

| Event | Payload | When |
|---|---|---|
| `chat_message` | Message object | Relays district chat |
| `global_message` | Message + frame data | Relays global chat |
| `guild_message` | Message object | Relays guild chat |
| `new_dm` | `{ senderId }` | Notifies recipient of incoming DM |
| `attack_notification` | Combat result | Notifies target of attack |
| `chat_error` | Error string | Rate limit or permission violation |

### Chat Rate Limiting
- Max 10 messages per 60 seconds per player
- Same message 3× in a row → temporary mute
- Violations return `chat_error` event

### Global Chat Message Format
Every global message must include `equippedFrame` and `equippedFrameRarity` from player's profile, used client-side to render `FrameRectBubble`.

---

## SECTION 26 — MESSAGES (DIRECT MESSAGES) `[PHASE 2]`

Player-to-player DMs. Content encrypted at rest using AES-256-CBC.

- Stored as `encryptedContent` + `iv` — no plaintext stored
- Socket event `dm_sent` notifies recipient instantly
- Blocked users cannot send DMs
- `read` flag updates on message open

---

## SECTION 27 — NOTIFICATIONS `[PHASE 1]`

| Trigger | Notification |
|---|---|
| PvP attack received | Real-time overlay + notification tray entry |
| New DM received | Notification badge + toast |
| Outbid on auction | Tray entry + DC refunded |
| Auction won | Tray entry + item in inventory |
| Property vault full | "Your property is at max — collect!" |
| Hospital release | "You've been released." |
| Guild invitation | Tray entry |
| Level up | Toast overlay on action screen |
| New patch notes | Badge on Herald nav item |

**Notification Tray:** Bell icon in header with unread count badge. Dropdown list of recent notifications. Clicking navigates to the relevant page.

---

## SECTION 28 — TELEGRAM BOT `[PHASE 2]`

Players link account to bot for out-of-game push notifications.

**Linking:** Settings → Enter Telegram username → game sends link code → player sends `/link CODE` to bot → `telegramId` saved.

**Commands:**
- `/link CODE` — Links Telegram to game account
- `/buy` — Initiates NC purchase via Telegram Stars

**NC Purchase flow:** Bot creates Telegram Stars payment invoice → on payment confirmation → NC credited to player's account automatically.

**Bot sends messages for:**
- PvP attacks received
- Property vault full
- Events starting
- Auction wins/outbids

---

## SECTION 29 — AUTHENTICATION `[PHASE 1]`

### Signup Flow
1. User provides email, username, password, chosen faction
2. Server creates account, generates unique tag (`Username#NNNN`), referral code
3. OTP email sent via Gmail SMTP
4. User enters OTP → account becomes `verified`
5. Referral bonus: referrer gets 500 DC + 200 XP; new user gets 750 DC
6. Onboarding screen shown (faction confirmation, tutorial)

### Login
1. Email + password → bcrypt compare
2. Returns: Access Token (15 min JWT), Refresh Token (30 day JWT), user summary object
3. Both tokens stored client-side in localStorage
4. `lastLoginAt` updated → triggers Daily Reward check

### Token Refresh
- Access token sent as `Authorization: Bearer <token>` on every API call
- On 401 → client auto-hits `POST /api/auth/refresh` with refresh token
- New token pair issued

### Password Reset
1. `POST /api/forgot-password` → sends email with reset link
2. Player clicks link → opens reset form
3. `POST /api/reset-password` → password updated, tokens invalidated

---

## SECTION 30 — SEASONS & BATTLE PASS `[PHASE 2]`

### Seasons
~60-day themed chapters. Each season has:
- Number and theme name (e.g., Season 1: "Cold Concrete")
- Narrative arc playing out through events and Herald posts
- Season Leaderboard tracking season-specific performance
- Exclusive items only obtainable during that season

### Battle Pass
50-tier per season. **Free Track:** DC, items, common frames. **Premium Track (500 NC):** Exclusive animated frames, rare/epic items, titles, bonus DC.

Tiers advance by earning Season XP. No tier skipping. Progression is played, not bought.

---

## SECTION 31 — EVENTS SYSTEM `[PHASE 2]`

World Events created by the owner. Active events modify the game world.

### Event Data Fields
- `name`, `emoji`, `type`, `status` (draft/active/ended)
- `startAt` / `endAt`
- `primaryColor` / `accentColor`
- `backgroundGradient`, `particleEffect` (snow/embers/matrix/confetti)
- `dcMultiplier`, `xpMultiplier`, `crimeSuccessBoost`, `marketFeeReduction`, `dropRateBoost`
- `announcements` — login popup text, herald headline, auto social post

### Event Types
| Type | Effect |
|---|---|
| Double XP | `xpMultiplier: 2.0` for 48 hours |
| Crime Spree | `crimeSuccessBoost: +10%` for 24 hours |
| Market Frenzy | `marketFeeReduction: 100%` for 12 hours |
| Faction War | Territory control weighted 3× for 72 hours |
| Boss Raid | Elite NPC in The Outskirts; first to defeat wins legendary loot |
| Holiday Events | Grants event-exclusive items |

---

## SECTION 32 — LEADERBOARDS `[PHASE 1]`

### Global (Never Reset)
- **Wealthiest** — ranked by total DC (wallet + bank)
- **Level** — ranked by level then XP as tiebreak

### Periodic
- **Most Dangerous** — PvP wins (resets weekly)
- **Crime Lord** — total crimes (resets monthly)
- **Guild Rankings** — combined guild score (resets weekly) `[PHASE 2]`
- **Faction Power** — faction influence across all 7 districts (resets weekly)
- **Season Wealth** — DC earned during current season `[PHASE 2]`

### Leaderboard UI
- Top 3: Gold, Silver, Bronze styled rows
- Each row: rank, avatar with frame, username, faction badge, equipped title, stat
- Clicking a player opens Player Inspect Modal
- Season leaderboard shows countdown to season end

---

## SECTION 33 — UI PAGES `[PHASE 1 PAGES LISTED FIRST]`

### Global Layout Shell
- **Sticky Header:** DriftLife logo (home link), animated XP progress bar, DC balance (rolling number animation), NC balance, notification bell (with badge count), Owner panel icon (staff only)
- **Player Status Strip:** tag, faction emoji, prestige badge, hospitalized indicator (red), equipped title
- **Top Nav Bar:** Horizontally scrollable carousel. Phase 1 links: Feed, Map, Combat, Crime, Jobs, Inventory, Market, Profile, Bank, Daily Reward, Leaderboard. Phase 2 links visible but disabled with "Coming Soon" tooltip.

---

### PHASE 1 PAGES

**🏠 Feed (`/`) `[PHASE 1]`**
Post composer at top (280 char limit, submit button). Infinite-scroll feed below, newest first. Each post: avatar+frame, username, title, faction badge, content, reactions with live counts, comments (collapsible), timestamp. New posts appear in real time without reload.

---

**🗺️ Map (`/map`) `[PHASE 1]`**
7 district panels. Each shows: controlling faction (colour-coded), danger level bars, live player count, jobs available count. Clicking a district expands it: Zone Chat (real-time), available jobs, available crimes, NPCs in zone, "Travel Here" button with energy cost. If already there: "You are here."

---

**⚔️ Combat (`/combat`) `[PHASE 1]`**
Two tabs:
- **NPCs** — Cards per NPC in current district: avatar, name, level, HP, strength, DC range, XP, drop chance. "Fight" resolves immediately with narrative result dialog.
- **PvP** — List of eligible targets in same district (within 25 levels). Shows avatar, name, level, faction, cooldown timer. Combat result shows both rolls and narrative outcome.

---

**🎭 Crime (`/crime`) `[PHASE 1]`**
Crime cards filtered by level and district. Each card: name, flavour text, nerve cost, live success probability, DC range, risk level, failure consequences. "Commit Crime" button. Result shown as styled success/failure overlay with narrative and rewards/penalties.

---

**🎒 Inventory (`/inventory`) `[PHASE 1]`**
Tabbed grid: All, Consumables, Weapons, Clothing, Vehicles, Materials, Badges, Cards. Each item: rarity-coloured icon, name, quantity, "Equipped" badge. Clicking opens item detail sheet with action buttons: Use / Equip+Unequip / Salvage / List on Market / Trade. "Salvage All Commons" bulk action included.

---

**🏪 Market (`/market`) `[PHASE 1]`**
Two tabs:
- **Market** — Filter/sort bar, listings grid. Each listing: seller avatar+frame, item name, rarity, quantity, price, Buy button.
- **My Listings** — Active listings with Cancel option.
Auction tab `[PHASE 2]` — visible but disabled.

---

**👤 Profile (`/profile` or `/profile/:tag`) `[PHASE 1]`**
Own profile: avatar+frame, username, tag, title, faction badge, prestige badge, bio (editable inline), core stats with visual stat bars, resources with regen timers, DC/NC balance, equipped items, owned frames strip, earned badges, recent activity log, follow/follower count.
Other player (via tag): same but read-only. Extra buttons: Attack (if eligible), Message, Trade, Follow/Unfollow.

---

**💰 Bank (`/bank`) `[PHASE 1]`**
Wallet balance and bank balance displayed side by side. Deposit/Withdraw fields with buttons. No fees. Instant.

---

**🎁 Daily Reward (`/daily`) `[PHASE 1]`**
7-day calendar strip: past claims (green checkmarks), today's reward (glowing border), future days (dimmed). "Claim" button → animation → reward modal.

---

**📊 Leaderboard (`/leaderboard`) `[PHASE 1]`**
Tab switcher: Wealth, Level, PvP, Crime, Faction (Phase 2: Guild, Season). Each leaderboard: top 100 with avatar+frame, rank styling, username, faction, title, ranked metric. Clicking any row opens Player Inspect Modal.

---

**🛠️ Owner Panel (`/owner`) `[PHASE 1 — Basic]`**
Protected by `requireStaff` or `requireOwner` middleware.

Phase 1 sections:
- **Dashboard** — Live player count, total DC in economy, recent crimes, recent fights
- **Players** — Search by username/tag. View full data. Actions: Adjust DC, Adjust NC, Set Level, Ban (with reason), Unban, Mute (with duration)
- **Patch Notes** — Rich text editor. Publish immediately or schedule.

Phase 2 sections (stub routes only in Phase 1):
- Items, Economy, Events, Secrets, Moderation/VantaLog

---

### PHASE 2 PAGES

**🏗️ Crafting (`/crafting`)** — Mastery level progress bar, recipe cards, ingredient stock shown in green/red, craft timer, Instant Craft (NC) button.

**🌳 Skills (`/skills`)** — Branching node graph per skill tree. Purchase Skill Point nodes.

**👥 Guild (`/guild`)** — Guild browser/creator if not in guild. Guild dashboard if in guild: treasury, members, chat, upgrades.

**🏠 Properties (`/properties`)** — Owned properties list (collect income). Property market (purchase).

**🤖 NPC (`/npc`)** — NPC cards by district. Click to open AI chat modal with conversation history.

**💬 Social / DMs (`/social`)** — Conversation list + message thread, real-time DMs.

**🪞 Frames Store (`/frames`)** — Browse by rarity tab. Preview, purchase, equip frames.

**🏷️ Titles (`/titles`)** — List of earned titles. Click any to equip.

**📜 Herald (`/herald`)** — Scrollable patch notes. Unread entries have glowing border.

**⚙️ Settings (`/settings`)** — Bio, custom avatar (AI generate or enter Pollinations URL), username change (5,000 DC), password change, Telegram link/unlink, notification preferences, delete account.

---

## SECTION 34 — PLAYER INSPECT MODAL `[PHASE 1]`

Full-screen overlay triggered by clicking any player avatar, username, or leaderboard row.

Shows:
- Large avatar with equipped frame (full animation)
- Username, tag, faction badge, prestige badge, equipped title
- Level and XP bar
- Core stats: Strength, Charisma, Intelligence, Street Cred
- Bio
- Owned badges (up to 6)

Action buttons (if not own profile): Attack (if eligible), Message, Trade, Follow/Unfollow

---

## SECTION 35 — DEV TOOLBAR `[PHASE 1]`

Floating debug panel visible to players with `devMode: true`. Fixed bottom-right corner. Toggle open/close.

Actions:
- **+DC** — Input field + button; adds DC directly to wallet
- **Lvl Up** — Sets level to chosen value; recalculates XP, skill points
- **⚡ Fill** — Instantly fills Energy and Nerve to max
- **🏥 Heal** — Clears hospitalization, restores full health
- **🚨 Clear** — Removes all Wanted Level stars

---

## SECTION 36 — TITLES SYSTEM `[PHASE 2]`

| Title | Rarity | How Earned |
|---|---|---|
| New in Town | Common | Default on signup |
| Street Rat | Uncommon | Complete 50 crimes |
| City Legend | Legendary | Reach Prestige Rank 5 (+5% all stats) |

More titles unlocked through gameplay achievements. `equippedTitle` determines which displays.

---

## SECTION 37 — EMBLEM BADGE SYSTEM `[PHASE 1]`

`EmblemBadge` component renders achievement badges as dynamic SVGs with rarity-based glow.

Badge categories: Combat, Social, Faction, Economy, Crime.

`EmblemRow` sub-component displays up to 3 badges horizontally (used in profile cards and leaderboard rows).

---

## SECTION 38 — TONE, WRITING STYLE & UI DESIGN

### Narrative Voice (ALL auto-generated strings must follow this)
- **Gritty and cinematic** — Narrate events matter-of-factly, no editorialising
- **Player is competent** — Failures happen because the world is hard. "The security system flagged your biometrics" not "You failed"
- **Dark humour** — Pickpocket result: *"You lifted a wallet. It had a loyalty card and 42 DC. New Vanta is as disappointing as always."*
- **City feels alive** — Posts, NPC dialogue, and herald text all reference real district names and faction tensions

### UI Design — Strict Colour Palette
```
Background:     #0a0a0f
Surface:        #111118
Border:         #1e1e2e
Text Primary:   #e2e8f0
Text Secondary: #64748b

Accent Cyan:    #00d4ff   ← primary interactive elements
Warning Orange: #ff6b35
Danger Red:     #ff2d55
Success Green:  #39d353
NC Purple:      #a855f7
DC Gold:        #f59e0b
```

### UI Design Rules
- **Dark-first, always** — No light mode. Ever.
- **Monospace for stats** — All numbers, DC values, and stats use monospace font
- **No particle explosions** — Subtle hover states only. Animations only on frames.
- **Dense but readable** — Every panel shows maximum useful information. Hierarchy through size, colour, spacing.
- **Mobile-first** — All UI works on small screens. Bottom nav on mobile. Touch-friendly tap targets.
- **Rolling Numbers** — DC and NC balances animate with rolling digit counter whenever they change
- **XP Bar** — Always visible in sticky header

---

## SECTION 39 — COMPLETE GAME LOOP SUMMARY

```
NEW PLAYER:
Signup → Email OTP verify → Faction choice → Arrive in Residential North
↓
Claim Daily Reward → Work basic jobs (Delivery Driver, Building Super) → Earn DC
↓
Level 5: Can join a Guild. Level 8: First crime (Pickpocket) unlocked.
↓
Level 10: PvP unlocked. Choose Skill Tree. Spend Skill Points.
↓
Grind jobs + crimes → DC accumulates → Buy items on market → Equip for stat boosts
↓
Fight NPCs → Earn XP faster + item drops → Sell drops on market
↓
Level 15: Create a Guild. Level 20: Smuggling unlocked.
↓
Buy first property → Passive income starts → Bank DC to protect it
↓
PvP: attack rivals, steal DC → Build Street Cred → Unlock elite crimes
↓
Level 25: Heist unlocked. Auction House access.
↓
Crafting: farm materials → craft rare items → list on market for profit
↓
Level 50: Secondary Skill Tree. Double down on specialisation.
↓
Seasons: earn Season XP → advance Battle Pass → earn exclusive cosmetics
↓
Level 100: Prestige. Cosmetic bonuses and prestige badge.
↓
Guild Wars: coordinate with crew → dominate district control → earn faction bonuses
```

---

*DRIFTLIFE — New Vanta never sleeps. Neither do the players who run it.*
