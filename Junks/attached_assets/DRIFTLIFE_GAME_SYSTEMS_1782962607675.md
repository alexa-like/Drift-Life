# DRIFTLIFE — Complete Game Systems & Mechanics Reference

> New Vanta, 2047. A persistent browser-based text RPG.
> This document covers every game system and mechanic from the original Driftlife project, written as a feature reference for the new build.

---

## TABLE OF CONTENTS

1. [Currencies](#1-currencies)
2. [Player Progression](#2-player-progression)
3. [Stats & Vitals](#3-stats--vitals)
4. [Skill Trees](#4-skill-trees)
5. [Prestige System](#5-prestige-system)
6. [Titles](#6-titles)
7. [Emblems](#7-emblems)
8. [Equippable Frames](#8-equippable-frames)
9. [Factions](#9-factions)
10. [Districts & Buildings](#10-districts--buildings)
11. [Travel](#11-travel)
12. [Jobs](#12-jobs)
13. [Crimes](#13-crimes)
14. [Wanted Level System](#14-wanted-level-system)
15. [Combat](#15-combat)
16. [Hospitalization](#16-hospitalization)
17. [Banking](#17-banking)
18. [Marketplace](#18-marketplace)
19. [Auction House](#19-auction-house)
20. [Player Trading](#20-player-trading)
21. [Inventory & Items](#21-inventory--items)
22. [Properties & Passive Income](#22-properties--passive-income)
23. [Crafting System](#23-crafting-system)
24. [Trading Cards](#24-trading-cards)
25. [Social & Feed](#25-social--feed)
26. [Chat System](#26-chat-system)
27. [Guilds](#27-guilds)
28. [NPCs & Bonding](#28-npcs--bonding)
29. [Seasons & Battle Pass](#29-seasons--battle-pass)
30. [Events & Event Shop](#30-events--event-shop)
31. [Leaderboards](#31-leaderboards)
32. [VANTA System (Anti-Cheat)](#32-vanta-system-anti-cheat)
33. [Notifications](#33-notifications)
34. [Herald / News](#34-herald--news)
35. [Owner / Admin Panel](#35-owner--admin-panel)

---

## 1. CURRENCIES

### DC — Drift Credits
- Primary earned in-game currency.
- Used for: jobs, crimes, market listings, auctions, crafting, property purchases, bribing wanted levels, hospital bail, bank deposits, guild treasury.
- Can be stolen in PvP (10% of held DC, not banked DC).

### NC — Nova Credits
- Premium / rare currency.
- Used for: Battle Pass (950 NC), premium shop frames, instant crafting skips (1 NC per minute remaining), special item shop.
- Earned via: Battle Pass rewards, events, and specific quests.

---

## 2. PLAYER PROGRESSION

- **XP** is earned through completing jobs, crimes, and winning combat.
- Leveling up requires increasing XP thresholds.
- **Skill Points** start being awarded at Level 10 and are used to unlock skill tree nodes.
- Level 100 is the cap before Prestige is available.

---

## 3. STATS & VITALS

### Core Stats
| Stat | Primary Use |
|---|---|
| Strength | Combat power |
| Charisma | Social interactions, some jobs |
| Intelligence | Crime success, hacking jobs |
| Street Cred | Reputation, progression gating |

### Vitals
| Vital | Use | Notes |
|---|---|---|
| Health | Survives combat | Depleted in fights; restored at hospital or with items |
| Energy | Required for jobs | Regenerates over time; restored by consumables |
| Nerve | Required for crimes | Regenerates over time; restored by consumables |

- Vitals regenerate passively over time.
- Skill tree nodes and prestige bonuses can affect regen rates and caps.

---

## 4. SKILL TREES

Players choose a **primary tree at Level 10** and a **secondary tree at Level 50**.

### The Hustler (Economy)
| Node | Effect | Cost |
|---|---|---|
| Fast Hands | Job completion 10% faster | 1 pt |
| Market Shark | Market fees -1% | 1 pt |
| Business Empire | Business income +20% | 2 pts |
| DC Magnet | All DC gains +10% | 2 pts |
| The Mogul (APEX) | Ability to own any business type | 3 pts |

### The Fighter (Combat)
| Node | Effect | Cost |
|---|---|---|
| Iron Fist | +10% attack power | 1 pt |
| Thick Skin | +10% defense | 1 pt |
| Street Brawler | Win PvP = +50 bonus DC | 2 pts |
| Relentless | Daily PvP attack cap +5 | 2 pts |
| The Undisputed (APEX) | 5% one-hit KO chance | 3 pts |

### The Ghost (Stealth)
| Node | Effect | Cost |
|---|---|---|
| Light Feet | Crime detection chance -10% | 1 pt |
| Inside Man | Crime rewards +15% | 1 pt |
| Clean Hands | VANTA flags clear 2x faster | 2 pts |
| Shadow | Wanted level decay 2x faster | 2 pts |
| The Phantom (APEX) | 1 free crime escape per day | 3 pts |

### The Connector (Social)
| Node | Effect | Cost |
|---|---|---|
| Silver Tongue | Trade value +10% | 1 pt |
| Network | Guild XP shared +50% | 1 pt |
| Reputation | Referral rewards +25% | 2 pts |
| City Voice | Posts get 2x engagement | 2 pts |
| The Mayor (APEX) | Ability to start city-wide votes | 3 pts |

---

## 5. PRESTIGE SYSTEM

- **Requirement:** Reach Level 100.
- **What Resets:** Level (back to 1), XP, Strength/Charisma/Intelligence (reset to 5), Skill Points, Skill Trees.
- **What Persists:** DC, NC, items, guild membership, titles, posts.

### Prestige Tiers & Bonuses
| Tier | Bonus |
|---|---|
| P1 | +10% XP bonus, Prestige PvP league access |
| P2 | +15% XP bonus, +5% DC from jobs |
| P3 | +20% XP bonus, Reduced crime cooldowns |
| P4 | +25% XP bonus, Daily PvP cap +5, "The Prestige" title |
| P5 | +30% XP bonus, Permanent "City Legend" title, all previous bonuses |

### Prestige Exclusive Frames
- **Scan Line** — unlocked at Prestige 1.
- **Rainbow Pulse** — unlocked at Prestige 5.

---

## 6. TITLES

Titles are equippable text identifiers earned by hitting specific milestones. Each grants a small passive bonus.

| Title | Unlock Condition | Bonus |
|---|---|---|
| New in Town | Default | None |
| Street Rat | 50 crimes committed | +1 Street Cred |
| Market Shark | 1M DC profit on market | +2% market sales |
| Ghost of Vanta | 25 crime escapes | +1% stealth |
| Iron Fist | 100 PvP wins | +1% attack |
| The Connector | 20 referrals | +1% trade value |
| Most Wanted | Reach Wanted Level 5 three times | +1% nerve |
| Old Vanta | 1 year playtime | +1% all stats |
| City Legend | Reach Prestige 5 | +5% all stats |
| Untouchable | Complete a full season without any losses | +2% defense |
| The Prestige | Reach Prestige 4 | — |

---

## 7. EMBLEMS

- Collectible cosmetic badges with rarities: **Common → Uncommon → Rare → Epic → Legendary → Ultimate**.
- Categories include: Achievement, Faction, Combat, Social, and Event.
- Earned through specific quests and milestone completions.
- Can be equipped to display on a player's profile.

---

## 8. EQUIPPABLE FRAMES

Animated borders displayed around player avatars in chat and on profiles.

| Frame | How to Earn |
|---|---|
| Neon Pulse | Default (all players) |
| Iron Border | Default (all players) |
| Cold Steel | Default (all players) |
| Silver Edge | Purchase for 50 NC |
| Hologram Flicker | Purchase for 500 NC |
| Cyber Spark | Purchase for 1,000 NC |
| Particle Trail | Battle Pass — Epic tier reward |
| Electric Arc | Win 100 NPC combat fights |
| Matrix Rain | Complete The Grid faction quest line |
| Scan Line | Achieve Prestige 1 |
| Rainbow Pulse | Achieve Prestige 5 |

---

## 9. FACTIONS

Players choose one faction on character creation. Faction affects available NPCs, job flavour, and district presence.

| Faction | Theme | Symbol |
|---|---|---|
| The Suits | Corporate, Order, Power | 🏢 |
| The Street | Chaos, Anarchy, Hustle | 🔥 |
| The Grid | Hacking, Intelligence, Shadow | 💻 |

---

## 10. DISTRICTS & BUILDINGS

7 districts make up New Vanta. Each has a danger rating, a controlling faction, and interactable buildings.

| District | Danger | Faction | Key Features |
|---|---|---|---|
| Downtown Core | 5 | The Suits | Citadel Tower — Corporate Spy & Bodyguard jobs |
| The Boulevard | 3 | Neutral | Clubs, fashion, social hub, Bartender & Club Promoter jobs |
| Industrial East | 4 | The Street | Crime hotspot, Dock Worker & Enforcer jobs |
| Port District | 4 | The Street | The Basement — Black market, Smuggling crimes |
| Tech Quarter | 2 | The Grid | Hacker-for-Hire & Data Courier jobs, Bank |
| Residential North | 1 | Neutral | Starter area, safe zone, Street Vendor job |
| The Outskirts | 5 | None | Boss spawns, rare scavenging drops, Bounty Hunter job |

### Standard Buildings (appear in multiple districts)
- **Bank** — deposit/withdraw DC, bribe wanted level via Ralston NPC.
- **Hospital** — recover from hospitalization (time-based or pay DC).
- **Shop** — buy consumables and standard items.

---

## 11. TRAVEL

- Players must physically move to a district to access its jobs, NPCs, and targets.
- Traveling consumes time (or possibly energy at higher tiers — depends on implementation).
- PvP can only target players in the same district.

---

## 12. JOBS

Jobs consume **Energy** and sometimes **Nerve**. They have a level requirement, a cooldown, and a district lock. Rewards scale with mini-game performance (scored 0–1000).

**Reward formula:** `Final DC = baseReward * (score / 1000) * levelMultiplier`

### Job List
| Job | District | Energy | Nerve | Min Level | Cooldown | DC Range |
|---|---|---|---|---|---|---|
| Delivery Driver | Any | 2 | 0 | 1 | 30 min | 100–250 |
| Street Vendor | Residential North | 2 | 0 | 1 | 20 min | 80–200 |
| Bartender | The Boulevard | 2 | 0 | 1 | 40 min | 200–400 |
| Club Promoter | The Boulevard | 1 | 2 | 1 | 45 min | 300–600 |
| Hacker-for-Hire | Tech Quarter | 2 | 2 | 5 | 60 min | 400–900 |
| Corporate Spy | Downtown Core | 3 | 5 | 15 | 120 min | 800–2,000 |
| Bounty Hunter | The Outskirts | 4 | 5 | 20 | 180 min | 1,000–3,000 |

### Mini-Games
| Mini-Game | Used By | Mechanic |
|---|---|---|
| Typing Rush | Delivery Driver | Type displayed words quickly; typos penalize score |
| Memory Mix | Bartender | Memorize and repeat a drink order sequence |
| Pattern Match | Hacker-for-Hire | Memorize and repeat a flashing circuit pattern |
| Timing Clicker | Enforcer / Bounty Hunter | Click when a moving bar hits green/yellow zones (Perfect = full score, Good = 60%) |
| Rhythm Tap | Club Promoter | Tap falling notes on a hit line to build combos |

---

## 13. CRIMES

Crimes consume **Nerve** and **Energy**. Success is determined by a base success rate modified by the player's Intelligence and Ghost skill tree nodes.

### Crime List
| Crime | Min Level | Nerve | Energy | Base Success | Wanted Risk |
|---|---|---|---|---|---|
| Pickpocket | 5 | 2 | 1 | 65% | +1 |
| Break-In | 8 | 4 | 2 | 50% | +2 |
| Vehicle Theft | 10 | 5 | 3 | 40% | +2 |
| Heist (Solo) | 25 | 8 | 5 | 30% | +4 |

- **Success:** Awards DC and XP.
- **Failure:** Increases Wanted Level; can result in hospitalization at high Wanted levels.

---

## 14. WANTED LEVEL SYSTEM

- Scale: **0 to 5**.
- Higher levels = higher hospital bail costs, increased VANTA flag risk, and staff attention.
- **Clearing Methods:**
  - **Bribing Ralston (NPC):** `Cost = (WantedLevel² × 2,500) DC`
  - **Natural Decay:** Decreases over time passively.
  - **Ghost Tree — Shadow node:** Decay happens 2× faster.
  - **Ghost Tree — The Phantom (APEX):** 1 free escape per day.

---

## 15. COMBAT

### PvE (vs NPCs)
- Available from Level 1.
- Fight: Street Thugs, Corrupt Officers, and Boss enemies (Outskirts).
- Rewards: DC + XP.

### PvP (vs Players)
- Unlocks at **Level 10**.
- Requires both players to be in the **same district**.
- Limited daily attack cap (increases with Fighter tree / Prestige).
- **Harassment protection:** Attacking the same player 3+ times in 24 hours triggers a VANTA flag.

### Combat Resolution
- **Automated** — no real-time action required.
- **Formula:** `AttackerPower = Strength + random(0–10)`. Highest power wins.
- **PvP Loot:** Winner takes **10% of the loser's held (non-banked) DC**.

---

## 16. HOSPITALIZATION

- Triggered by: losing a fight, failing a high-risk crime.
- **Recovery time:** ~20–30 minutes.
- **Shorten recovery:** Pay **50 DC per remaining minute** to bail out early.
- **Items:** First Aid Kit reduces recovery time by 50%.
- While hospitalized, the player cannot take actions.

---

## 17. BANKING

- Players deposit DC into the bank to protect it from PvP theft.
- Only **held DC** (not banked) can be looted in PvP.
- **Interest:** Planned — accrues on deposited DC at the Bank building.
- **Loans:** Planned feature for Bank buildings in Tech Quarter / Downtown Core.

---

## 18. MARKETPLACE

- **Player-to-player** fixed-price item listings.
- **Seller fee:** 5% deducted from the sale price on completion.
- Any player can list items; any player can buy.

---

## 19. AUCTION HOUSE

- **Unlocks at:** Level 25 (or Prestige 1+).
- **Duration:** Seller sets between 1 and 72 hours (default: 24 hours).
- **Minimum bid:** Must be at least `currentBid + 1 DC` (or starting price if no bids).
- **Outbid refund:** Previous bidder's DC is automatically returned when outbid.
- **Snipe protection:** Any bid placed in the final 5 minutes extends the auction by 5 more minutes.
- **Seller fee:** 5% taken from final sale price.
- **No bids:** Item is returned to seller's inventory.

---

## 20. PLAYER TRADING

- Direct, secure 1-for-1 trades between players (items and/or DC).
- Both players must confirm before the trade executes.
- Trading Cards can also be swapped through this system.

---

## 21. INVENTORY & ITEMS

### Item Categories
| Category | Examples | Notes |
|---|---|---|
| Clothing | Jackets, masks | Equippable for stat bonuses |
| Weapons | Knives, firearms | Boost Strength in combat |
| Vehicles | Bikes, cars | Equippable for mobility/stat bonuses |
| Consumables | Energy Drink, Repair Kit, First Aid Kit | One-use; restore vitals or reduce hospitalization |
| Materials | Scrap Metal, Electronics, Nano Materials | Used in crafting |
| Cards | Trading Cards (Common–Event) | Collectibles; tradeable |

### Equipping
- Clothing, Weapons, and Vehicles can be equipped for active stat boosts.

---

## 22. PROPERTIES & PASSIVE INCOME

- Players can purchase and upgrade real estate with DC.
- **Max upgrades:** 5 per property.
- **Income formula:** `hoursElapsed × baseIncome × (1 + upgrades × 0.2)`
- **Income storage cap:** 168 hours (7 days) of accrued income.
- Properties also provide item storage slots.
- Player-owned Shops can have a public storefront.

### Property Types & Income
| Property | Cost | Base Income |
|---|---|---|
| Small Apartment | 50,000 DC | 100 DC/hr |
| Nightclub | 5,000,000 DC | 10,000 DC/hr |
| Casino | 10,000,000 DC | 20,000 DC/hr |

---

## 23. CRAFTING SYSTEM

### Crafting Mastery Levels
Players level up crafting through use. Higher mastery unlocks more recipes and grants success/efficiency bonuses.

| Level Name | Notes |
|---|---|
| Scavenger | Entry level |
| Tinkerer | Basic combinations |
| Artisan | Mid-tier recipes |
| Craftsman | — |
| Engineer | — |
| Inventor | Advanced recipes |
| Master Crafter | Near-top tier |
| Legendary Smith | Max mastery |

### Materials & Base Prices
| Material | Approximate Shop Price |
|---|---|
| Wood | 50 DC |
| Fabric | 80 DC |
| Scrap Metal | 100 DC |
| Leather | 120 DC |
| Chemicals | 150 DC |
| Electronics | 200 DC |
| Rare Metal | 10,000 DC |
| Faction Token | 15,000 DC |
| Nano Materials | 100,000 DC |
| Legendary Core | 1,000,000 DC |

### Key Recipes
| Output | Ingredients | Min Mastery Level |
|---|---|---|
| Energy Drink ×3 | 3× Street Food + 1× Chemicals | 1 (Scavenger) |
| Repair Kit | 1× Scrap Metal + 1× Chemicals | 1 (Scavenger) |
| Tactical Vest | 5× Scrap Metal + 3× Fabric | 10 (Artisan) |
| Nano Suit | 5× Nano Materials + 2× Rare Metal + 5× Electronics | 50 (Legendary Smith) |

### Instant Crafting
- Players can skip craft timers by spending **1 NC per minute** of remaining time (minimum 5 NC).

---

## 24. TRADING CARDS

### Rarities & Drop Weights
| Rarity | Drop Weight |
|---|---|
| Common | 50% |
| Uncommon | 25% |
| Rare | 15% |
| Epic | 7% |
| Legendary | 3% |
| Event | 1% |

### How to Obtain
- **Card Packs:** Purchase for **500 DC** each. Grants 1 random card (weighted by rarity) + 10 XP.
- **Player Trading:** Swap cards 1-for-1 via the player trading system.

---

## 25. SOCIAL & FEED

- **Feed:** A shared social timeline. Player actions (heist completions, PvP wins, level-ups) auto-post as feed events.
- Players can also manually post text updates.
- **The Connector — City Voice node:** Posts receive 2× engagement when this skill is active.

---

## 26. CHAT SYSTEM

| Channel | Scope |
|---|---|
| Global | All online players |
| Zone (District) | Players currently in that district only |
| Guild | Guild members only |
| Direct Message (DM) | Private 1-to-1 between players |

- District zone chat is powered by **real-time Socket.io rooms** (`district:<id>`).
- DMs feature **end-to-end encryption**.
- Player avatars display their equipped **frame** inside chat bubbles.

---

## 27. GUILDS

- **Creation requirement:** Level 15.
- **Ranks within a guild:** Leader, Officer, Member, Recruit.
- **Guild Treasury:** Members donate DC to a shared pool used for guild upgrades (e.g., Faction Crest).
- **Guild XP Sharing:** The Connector — Network node increases shared XP by 50%.
- **Operations (Planned):** Cooperative district takeovers and faction-specific group missions.

---

## 28. NPCS & BONDING

### NPC Types
- **Story NPCs:** Characters with lore and dialogue (e.g., Director Webb, Mama Nova).
- **Shop NPCs:** Sell items, offer services (e.g., Ralston for bribe/wanted clearing).

### AI Dialogue
- NPCs use **AI (Groq / Llama-3)** to generate context-aware responses.
- Conversations are stored in memory so NPCs can reference past interactions.

### Bonding System
- Each NPC has a **Bond Score** from 0 to 100.
- Score increases by **+1 per interaction** with the NPC.
- High bond scores unlock:
  - Unique / deeper dialogue options.
  - Better bribe rates and exclusive NPC services.

---

## 29. SEASONS & BATTLE PASS

### Seasons
- Periodic themed updates (e.g., "Season 3: Test").
- Each season has a defined start and end date.
- Seasons drive the Battle Pass and exclusive seasonal content.

### Battle Pass
- **Tiers:** 50 tiers per season.
- **Cost:** 950 NC for the Premium track.
- **Tracks:**
  - **Free track:** Basic rewards available to all players.
  - **Premium track:** Additional DC, NC, exclusive items, and special frames (e.g., Particle Trail at Epic tiers).

---

## 30. EVENTS & EVENT SHOP

- Timed world events with unique gameplay bonuses active for their duration.
- Events can modify item stats or prices temporarily (Event Overrides).
- **Event Shop:** Sells exclusive items only available during the event.
- Owners can start/stop events and create event-specific items via the Owner Panel.

---

## 31. LEADERBOARDS

| Board | Ranked By |
|---|---|
| Wealth | Total DC held |
| Street Cred | Total XP earned |
| Combat | Strength stat |

---

## 32. VANTA SYSTEM (Anti-Cheat & Moderation)

VANTA is an automated background monitoring system that logs suspicious behavior and flags it for staff review.

### What VANTA Monitors
| Trigger | Severity |
|---|---|
| Repeated failed crimes (bot-like pattern) | Low–Medium |
| Economy exploits (abnormal DC gain spikes) | High–Critical |
| Attack spam (3+ attacks on same player in 24h) | Medium |
| Alt account behavior | High |

### Severity Levels
- Low, Medium, High, Critical.

### VANTA Settings (Owner-Configurable)
- Toggle each detection module on/off.
- Tune sensitivity per module.

### Clearing Flags
- Staff can manually dismiss logs from the Owner Panel.
- **Clean Hands (Ghost tree):** Player's VANTA flags clear 2× faster automatically.

---

## 33. NOTIFICATIONS

Players receive real-time alerts for:
- Combat results (win/loss, who attacked you).
- Incoming and completed trades.
- Guild invites and guild activity.
- Auction updates (outbid, auction won/lost).
- System messages (patch notes, events starting).

Delivered via:
- **In-app** real-time notifications (Socket.io).
- **Telegram Bot** (if configured by owner).
- **Gmail SMTP** email (if configured by owner).

---

## 34. HERALD / NEWS

- A public news feed published by staff/owners.
- Articles can contain world lore, announcements, and city-wide story updates.
- Only the **20 most recent articles** are shown in the public feed.
- Visible to all players without requiring login.

---

## 35. OWNER / ADMIN PANEL

The Owner Panel is a restricted admin interface accessible only to accounts with `role=owner` or `role=staff`.

### Dashboard
- Real-time player count (total / active online).
- Economy stats: total DC and NC in circulation.
- Count of open, unreviewed VANTA logs.
- Total items and active events.

### Player Management
Staff can take the following actions on any player account:
- Search players by username.
- **Ban / Unban** accounts.
- **Mute / Unmute** (silences chat).
- **Heal** (restore health to full).
- **Clear Wanted Level** (set to 0).
- **Give DC** (grant currency directly).
- **Give Items** (grant any item directly).
- **Set Level** (override player level).
- **Toggle Dev Mode** (special debugging/test flag).

### Content Creation Tools
- **Item Editor:** Create and edit all game items, including AI-generated images via image generation (Pollinations).
- **Event Manager:** Create, start, and stop global timed events.
- **Season Manager:** Create and manage seasons and Battle Pass tiers.
- **Patch Notes Publisher:** Write and publish patch notes visible to all players.

### VANTA Management
- View all VANTA logs with severity, trigger reason, and player details.
- Dismiss or escalate individual logs.
- Toggle and tune each VANTA detection module.

### Secrets Manager
- Securely store and manage encrypted API keys (Groq, Telegram, Cloudinary, Together AI, Gmail SMTP).
- Keys are AES-256 encrypted in the database — never stored in plain text or environment files.

### Seeding & Reset Tools
- Seed or reset default game content (items, districts, NPCs) without manual database edits.

---

*End of Driftlife Game Systems Reference.*
