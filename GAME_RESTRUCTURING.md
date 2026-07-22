# Neonoir — Full Game Restructuring Plan
## Feature-First Architecture Migration — Complete Edition

---

## HOW TO USE THIS FILE

This file contains one prompt per tier. Each tier is a **separate chat session**.
**Start a new chat, paste the tier prompt, and the agent will execute that tier only.**
Complete each tier fully and verify the app still builds and runs before starting the next one.

**Order is strict — never skip tiers. Each tier depends on the one before it.**

---

## CURRENT STATE OF THE PROJECT

**349 total source files** spread across:

| Area | Files |
|---|---|
| Frontend pages | 54 |
| Frontend components (custom) | 41 |
| Frontend UI components (shadcn) | 55 |
| Frontend lib / hooks / context | 16 |
| Backend routes | 67 |
| Backend models | 57 |
| Backend lib/utilities | 47 |
| Backend seeds & jobs | 3 |

---

## THE GOAL

**From this** (organized by file type — hard to work with):
```
pages/          ← 54 pages all dumped together
components/     ← 41 components all mixed together
routes/         ← 67 API routes all mixed together
models/         ← 57 models all mixed together
lib/            ← 47 utilities all mixed together
```

**To this** (organized by feature — easy to work with):
```
shared/                  ← things every feature uses
features/
  crimes/                ← everything crimes, front + back
  arena/
    hub/
    combat/
  cosmetics/
    name-tiers/
    chat-bubbles/
    badges/
  vanta/                 ← the whole vanta AI system
  admin/
    owner/
    staff/
  integrations/
    telegram/
    discord/
  ...
```

**With a single wiring layer** — one registry file where every feature is registered once.
Nav, routing, and page loading all read from that registry automatically.
Adding a new feature = work inside its folder + add one line to the registry.

---

## TIER OVERVIEW

| Tier | Name | Risk |
|---|---|---|
| 0 | Foundation | None — no features moved |
| 1 | Simple action features | Very low |
| 2 | Game & combat features | Low |
| 3 | Economy & trading | Medium |
| 4 | Social & community | Medium |
| 5 | Progression & mastery | Medium |
| 6 | Events & cosmetics | Medium |
| 7 | Organizations & world | Medium-high |
| 8 | Gang system | Medium-high |
| 9 | Vanta AI system | High — complex unique system |
| 10 | Referrals, subscriptions & payments | High |
| 11 | Integrations & notifications | High |
| 12 | Admin, staff & moderation | High |
| 13 | Core — auth, profile, dashboard | Highest — do this last |

---
---

## TIER 0 — FOUNDATION
### Paste this prompt to start Tier 0

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md fully before doing anything.

Your job is Tier 0 of the game restructuring: lay the foundation. No features are moved in this tier. You are only setting up the structure, shared utilities, and wiring patterns that every future tier will follow.

---

WHAT TO BUILD:

1. SHARED FOLDER
Create `artifacts/neonoir/src/shared/` with these sub-folders and files:

a) `shared/theme.ts`
Move and expand the existing `src/theme.ts` here.
Export: DL (all colors), GLOWS (all glow effects), FONTS, Z_INDEX (z-index scale).
This is the single source of truth for all visual tokens. No component may hardcode a hex color — they must import from here.

b) `shared/components/`
Move these components here — they are used across many features and belong to no single one:
- StatBar.tsx
- NeonProgressBar.tsx
- CyberButton.tsx
- CyberSectionHeader.tsx
- CyberSkeleton.tsx
- AnimatedCard.tsx
- EmblemBadge.tsx
- PrestigeBadge.tsx
- PlayerNameBadge.tsx
- SubscriberNameBadge.tsx
- SubscriberNameBadge.tsx
- PageTransition.tsx
- ActionResult.tsx
- StatCounter.tsx
- ConfirmDialog.tsx
- WantedStars.tsx
- CardArt.tsx
- ItemImage.tsx
- StatusBanner.tsx
- ToastContainer.tsx
- OfflineOverlay.tsx
- PlayerInspectModal.tsx  ← used across many features
- AnnouncementBanner.tsx

c) `shared/currency.ts`
Create a utility file that exports:
- formatDC(n: number): string
- formatNC(n: number): string
- formatCurrency(n: number, type: string): string
- CURRENCY_LABELS: Record — maps currency key to display label
- CURRENCY_COLORS: Record — maps currency key to color (imported from theme.ts)
No feature may format currency itself — they import from here.

d) `shared/images.ts`
Create a central image registry.
Scan `attached_assets/` and `artifacts/neonoir/public/` for all image/asset files.
Export a typed IMAGE object keyed by descriptive name so features import by name, not by raw path.

e) `shared/types.ts`
Create a shared types file.
Move all TypeScript types and interfaces from `artifacts/neonoir/src/lib/types.ts` that are used across more than one feature. Feature-specific types stay inside the feature folder later.

2. ROUTE REGISTRY
Create `artifacts/neonoir/src/registry.ts`.
This is the single source of truth for every page in the game.

Each entry shape:
{
  id: string,           // route key, e.g. "arena"
  label: string,        // display name
  icon: LucideIcon,
  component: lazy React component,
  nav: boolean,         // show in desktop NavBar?
  bottomNav: boolean,   // show in mobile BottomNav? (max 5)
  roles?: string[],     // restrict to these roles
  minStage?: number,    // hide until onboarding stage
  statusFilter?: "normal" | "normal|abroad" | "abroad",
  group?: string,       // nav group (e.g. "wc")
}

Migrate ALL entries from:
- The NAV array in `artifacts/neonoir/src/components/NavBar.tsx` (lines 41–78)
- The ITEMS array in `artifacts/neonoir/src/components/BottomNav.tsx`
- All lazy imports and every case in renderPage() in `artifacts/neonoir/src/App.tsx`

...into this single registry. App.tsx, NavBar.tsx, and BottomNav.tsx all read from it.

3. UPDATE App.tsx, NavBar.tsx, BottomNav.tsx
- App.tsx: lazy imports come from registry, renderPage() iterates the registry
- NavBar.tsx: NAV array replaced by registry entries where nav=true
- BottomNav.tsx: ITEMS array replaced by registry entries where bottomNav=true
No more manual lists in any of these files.

4. FEATURES FOLDER + ONE EXAMPLE
Create `artifacts/neonoir/src/features/`.
Migrate ONE simple feature to prove the pattern works — use Hospital:
- Frontend: features/hospital/pages/HospitalPage.tsx
- Update registry.ts to point to the new location
- Backend: artifacts/api-server/src/features/hospital/routes.ts (move from routes/hospital.ts)
- Update artifacts/api-server/src/routes/index.ts to import from new location
- Verify the hospital page still works

5. ARCHITECTURE.md
Create `artifacts/neonoir/ARCHITECTURE.md` with:
- The complete feature folder structure and what goes where
- Step-by-step: how to add a brand new feature
- Step-by-step: how to add a new page to nav (one entry in registry.ts)
- Step-by-step: how to add a new sub-system to an existing feature (e.g. new arena game)
- Where shared things live and how to import them
- Rule: never hardcode hex colors — import from shared/theme.ts
- Rule: never format currency inline — import from shared/currency.ts
- Rule: never hardcode image paths — import from shared/images.ts

---

VERIFY before finishing:
- `pnpm run build` from workspace root passes with zero errors
- App starts and all pages are reachable
- Hospital page works correctly as the example migrated feature

RULES:
- Read replit.md before starting — follow every rule without exception
- Do not move any feature other than Hospital in this tier
- Do not restructure anything not listed above
```

---
---

## TIER 1 — SIMPLE ACTION FEATURES
### Paste this prompt to start Tier 1

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tier 0 is complete. Foundation, shared folder, and route registry are in place. Your job is Tier 1: migrate the simple standalone action features — low risk, barely touch other features.

---

FEATURES TO MIGRATE (do in this order, one at a time):

1. crimes
   Frontend: features/crimes/ ← CrimesPage.tsx + any crimes-only components
   Backend:  features/crimes/routes.ts ← from routes/crimes.ts
             features/crimes/models/ ← CrimeLog.ts

2. jobs
   Frontend: features/jobs/ ← JobsPage.tsx
   Backend:  features/jobs/routes.ts ← from routes/jobs.ts

3. daily
   Frontend: features/daily/ ← DailyPage.tsx
   Backend:  features/daily/routes.ts ← from routes/daily.ts

4. training
   Frontend: features/training/ ← TrainingCenterPage.tsx
   Backend:  features/training/routes.ts ← from routes/gym.ts and routes/training.ts
             features/training/models/ ← ActionMastery.ts (training-specific tracking)

5. hospital
   Already done in Tier 0 — skip.

6. energy
   Backend only (no frontend page — it's infrastructure):
   features/energy/routes.ts ← from routes/energy.ts
   features/energy/lib/regen.ts ← from lib/regen.ts
   features/energy/lib/atomicRegen.ts ← from lib/atomicRegen.ts

---

FOR EACH FEATURE:

Frontend:
- Move page file(s) into features/<name>/pages/
- Move components used ONLY by this feature into features/<name>/components/
- Components used by multiple features stay in shared/components/ — never duplicated
- Update registry.ts to point to the new component locations
- Fix all import paths

Backend:
- Move route file into artifacts/api-server/src/features/<name>/routes.ts
- Move models used ONLY by this feature into features/<name>/models/
- Models shared across features stay in artifacts/api-server/src/models/ — do not move
- Update artifacts/api-server/src/routes/index.ts to import from new location

Verify after each feature:
- `pnpm run build` passes
- The page loads and works
- No other pages are broken

RULES:
- Read replit.md before starting — follow every rule without exception
- One feature at a time — verify before moving to the next
- Never put shared components inside a feature folder
```

---
---

## TIER 2 — GAME & COMBAT FEATURES
### Paste this prompt to start Tier 2

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0 and 1 are complete. Your job is Tier 2: migrate the game and combat features. These are more complex but still self-contained worlds.

---

FEATURES TO MIGRATE:

1. arena
   Frontend:
   features/arena/
     hub/pages/ArenaHubPage.tsx
     combat/pages/ArenaCombatPage.tsx
     components/ ← any arena-only UI components
   IMPORTANT: Structure arena so adding a new game mode in the future means creating
   features/arena/<new-mode-name>/ without touching any other arena file.
   Backend:
   features/arena/routes.ts ← from routes/arena.ts
   features/arena/lib/arenaItemSeed.ts ← from lib/arenaItemSeed.ts
   features/arena/models/ ← CombatMatch.ts, MiniGameItem.ts if arena-specific

2. race
   Frontend:
   features/race/
     hub/pages/RaceHubPage.tsx
     match/pages/RaceMatchPage.tsx
   Backend:
   features/race/routes.ts ← from routes/race.ts
   features/race/models/ ← RaceCar.ts, RaceMatch.ts
   features/race/seeds/raceCars.ts ← from seeds/raceCars.ts

3. garage (+ mini-games)
   The garage contains the mini-game system. Keep them together.
   Frontend:
   features/garage/
     pages/GaragePage.tsx
     components/MiniGameModal.tsx
   Backend:
   features/garage/routes.ts ← from routes/minigame-garage.ts
   features/garage/models/ ← PlayerGarage.ts, MiniGameItem.ts, MiniGameLeaderboard.ts,
                               PlayerMiniGameInventory.ts
   features/garage/seeds/miniGameItems.ts ← from seeds/miniGameItems.ts
   features/garage/lib/ ← any garage-specific lib utilities

4. hack
   Frontend: features/hack/pages/HackPage.tsx
   Backend:  features/hack/routes.ts ← from routes/hacking.ts
             features/hack/models/ ← HackSession.ts

5. cyber
   Frontend: features/cyber/pages/CyberPage.tsx
   Backend:  features/cyber/routes.ts ← from routes/cyber.ts

6. net
   Frontend: features/net/pages/NetPage.tsx
   Backend:  features/net/routes.ts ← from routes/net.ts

---

RULES:
- Read replit.md before starting — follow every rule without exception
- One feature at a time — verify before moving to the next
- Arena folder structure MUST support adding new game modes cleanly
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 3 — ECONOMY & TRADING
### Paste this prompt to start Tier 3

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–2 are complete. Your job is Tier 3: migrate the economy and trading features. These all deal with currency and items — do them together so currency handling stays consistent.

---

IMPORTANT BEFORE STARTING:
All currency formatting must use shared/currency.ts (set up in Tier 0).
If any of these features are doing their own currency math or formatting, move that logic to shared/currency.ts first.
All item/inventory TypeScript types shared across features live in shared/types.ts.

---

FEATURES TO MIGRATE:

1. bank
   Frontend: features/bank/pages/BankPage.tsx
   Backend:  features/bank/routes.ts ← from routes/bank.ts

2. market
   The market has three layers: regular market, black market, dark listings. Keep together.
   Frontend:
   features/market/
     pages/MarketPage.tsx
     components/ ← any market-only UI
   Backend:
   features/market/routes.ts ← from routes/market.ts
   features/market/models/ ← BlackMarketListing.ts, DarkListing.ts, AuctionListing.ts,
                               NpcStoreListing.ts, PriceOverride.ts

3. shop (NPC stores hub)
   Frontend:
   features/shop/
     hub/pages/ShopHubPage.tsx
     npc/pages/NpcStorePage.tsx
   Backend:
   features/shop/routes.ts ← from routes/npcStores.ts

4. inventory
   Frontend: features/inventory/pages/InventoryPage.tsx
   Backend:  features/inventory/routes.ts ← from routes/inventory.ts
             features/inventory/models/ ← Item.ts (if inventory-specific), PlayerLoadout.ts

5. loadout
   Frontend: features/loadout/pages/LoadoutPage.tsx
   Backend:  features/loadout/routes.ts ← from routes/loadout.ts

6. auction
   Frontend: features/auction/pages/AuctionPage.tsx
   Backend:  features/auction/routes.ts ← from routes/auction.ts
             features/auction/models/ ← AuctionListing.ts (if not already in market)

7. trade
   Frontend: features/trade/pages/TradePage.tsx
   Backend:  features/trade/routes.ts ← from routes/trade.ts
             features/trade/models/ ← PlayerTrade.ts

8. bounties
   Frontend: (no dedicated page — appears inside other pages, wire accordingly)
   Backend:  features/bounties/routes.ts ← from routes/bounties.ts
             features/bounties/models/ ← Bounty.ts

---

RULES:
- Read replit.md before starting — follow every rule without exception
- One feature at a time — verify before moving to the next
- Never duplicate currency logic — shared/currency.ts only
- Shared item/inventory types go in shared/types.ts
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 4 — SOCIAL & COMMUNITY
### Paste this prompt to start Tier 4

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–3 are complete. Your job is Tier 4: migrate the social and community features. These connect players to each other.

---

IMPORTANT BEFORE STARTING:
PlayerInspectModal is used across many social features — it lives in shared/components/, never inside any single feature folder.
MentionInput, MentionText, and MessageCard are chat-specific — they go inside features/chat/components/.
All shared player/user TypeScript types belong in shared/types.ts.

---

FEATURES TO MIGRATE:

1. feed
   Frontend:
   features/feed/
     pages/FeedPage.tsx
     components/ ← feed-specific display components
   Backend:
   features/feed/routes.ts ← from routes/feed.ts
   features/feed/models/ ← FeedEvent.ts
   features/feed/lib/feedEvents.ts ← from lib/feedEvents.ts
   features/feed/lib/systemFeed.ts ← from lib/systemFeed.ts

2. chat
   Frontend:
   features/chat/
     pages/ChatPage.tsx
     components/
       MentionInput.tsx
       MentionText.tsx
       MessageCard.tsx
   Backend:
   features/chat/routes.ts ← from routes/chat.ts
   features/chat/models/ ← ChatMessage.ts, ChatReport.ts
   features/chat/lib/chatMod.ts ← from lib/chatMod.ts
   features/chat/lib/mentions.ts ← from lib/mentions.ts

3. friends
   Frontend: features/friends/pages/FriendsPage.tsx
   Backend:  features/friends/routes.ts ← from routes/friends.ts
             features/friends/models/ ← FriendRequest.ts

4. leaderboard
   Frontend:
   features/leaderboard/
     pages/LeaderboardPage.tsx
     pages/HallOfFamePage.tsx
     pages/MatchHistoryPage.tsx
   Backend:
   features/leaderboard/routes.ts ← from routes/leaderboard.ts and routes/mini-leaderboard.ts
                                     and routes/match-history.ts
   features/leaderboard/lib/leaderboardHighlights.ts ← from lib/leaderboardHighlights.ts

5. notifications
   Frontend: features/notifications/pages/NotificationsPage.tsx
   Backend:  features/notifications/routes.ts ← from routes/notifications.ts
             features/notifications/models/ ← Notification.ts
             features/notifications/lib/notifyUser.ts ← from lib/notifyUser.ts

6. reports & moderation
   Frontend:
   features/reports/
     components/ReportPlayerModal.tsx
   Backend:
   features/reports/routes.ts ← from routes/reports.ts
   features/reports/models/ ← PlayerReport.ts

7. search
   Backend only (no frontend page — used via NavBar SearchBar):
   features/search/routes.ts ← from routes/search.ts

---

RULES:
- Read replit.md before starting — follow every rule without exception
- One feature at a time — verify before moving to the next
- PlayerInspectModal stays in shared/components/ — never inside a feature
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 5 — PROGRESSION & MASTERY
### Paste this prompt to start Tier 5

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–4 are complete. Your job is Tier 5: migrate the progression and mastery features — the systems that reward and track player growth over time.

---

FEATURES TO MIGRATE:

1. missions & quests
   These are closely linked — keep together.
   Frontend:
   features/missions/
     pages/MissionsPage.tsx
   Backend:
   features/missions/routes.ts ← from routes/missions.ts and routes/quests.ts
   features/missions/models/ ← Quest.ts
   features/missions/lib/questProgress.ts ← from lib/questProgress.ts
   features/missions/lib/missionEvents.ts ← from lib/missionEvents.ts

2. achievements
   Frontend: features/achievements/pages/AchievementsPage.tsx
   Backend:  features/achievements/routes.ts ← from routes/achievements.ts
             features/achievements/models/ ← Achievement.ts

3. prestige
   No dedicated page — prestige is triggered from profile/other pages.
   Frontend:
   features/prestige/
     components/PrestigeConfirmModal.tsx
     components/PrestigeBadge.tsx ← move from shared/components if prestige-specific
   Backend:
   (prestige logic likely lives inside user routes — extract into features/prestige/ if it has its own routes)

4. battle-pass
   Frontend:
   features/battle-pass/
     pages/BattlePassPage.tsx
     components/BattlePassTab.tsx
     components/CosmeticsTab.tsx
   Backend:
   features/battle-pass/routes.ts ← from routes/battle-pass.ts
   features/battle-pass/models/ ← BattlePass.ts
   features/battle-pass/lib/battlePassXp.ts ← from lib/battlePassXp.ts

5. seasons
   Backend only (no dedicated frontend page):
   features/seasons/routes.ts ← from routes/seasons.ts

6. mentor
   Frontend: features/mentor/pages/MentorPage.tsx
   Backend:  features/mentor/routes.ts ← from routes/mentor.ts
             features/mentor/lib/mentorBonus.ts ← from lib/mentorBonus.ts

---

RULES:
- Read replit.md before starting — follow every rule without exception
- One feature at a time — verify before moving to the next
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 6 — EVENTS & COSMETICS
### Paste this prompt to start Tier 6

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–5 are complete. Your job is Tier 6: migrate the events and cosmetics systems.

---

FEATURES TO MIGRATE:

1. events
   Frontend:
   features/events/
     pages/EventPage.tsx
     pages/UpcomingEventsPage.tsx
     pages/EventArchivePage.tsx
     components/EventBanner.tsx
     components/EventGameModesTab.tsx
   Backend:
   features/events/routes.ts ← from routes/events.ts
   features/events/models/ ← Event.ts, EventProgress.ts
   features/events/lib/eventEngine.ts ← from lib/eventEngine.ts

2. cosmetics
   Structure this so adding a new cosmetic type in the future means creating a new
   sub-folder and nothing else changes.
   Frontend:
   features/cosmetics/
     name-tiers/          ← name tier cosmetic logic & components
     chat-bubbles/        ← chat bubble cosmetic logic & components
     badges/
       components/EmblemBadge.tsx ← move from shared if badge-specific
     index.ts             ← exports all cosmetics, wires to registry
   Backend:
   features/cosmetics/routes.ts ← from routes/cosmetics.ts
   features/cosmetics/models/ ← CosmeticItem.ts

3. giveaways
   Giveaways appear inside events or as a standalone feature.
   Frontend:
   features/giveaways/
     components/CreateGiveawayModal.tsx
     components/GiveawayCard.tsx
   Backend:
   (wire to wherever giveaway API routes live — move into features/giveaways/routes.ts)

---

COSMETICS PATTERN (important):
The cosmetics sub-folder structure means: a future new cosmetic type (e.g. "weapon-skins") = create features/cosmetics/weapon-skins/ and add one entry to features/cosmetics/index.ts. Nothing else changes.
Document this pattern in ARCHITECTURE.md.

RULES:
- Read replit.md before starting — follow every rule without exception
- One feature at a time — verify before moving to the next
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 7 — ORGANIZATIONS & WORLD
### Paste this prompt to start Tier 7

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–6 are complete. Your job is Tier 7: migrate the organization and world features — where players form groups and interact with the game world.

---

FEATURES TO MIGRATE:

1. factions
   Frontend:
   features/factions/
     pages/FactionPage.tsx
     pages/FactionSelectPage.tsx
   Backend:
   features/factions/routes.ts ← from routes/factions.ts and routes/factionBank.ts
   features/factions/models/ ← Faction.ts, FactionBankLog.ts, FactionCrime.ts
   NOTE: Faction name/color appear in NavBar — keep those types in shared/types.ts

2. guilds
   Frontend: features/guilds/pages/GuildsPage.tsx
   Backend:  features/guilds/routes.ts ← from routes/guilds.ts
             features/guilds/models/ ← Guild.ts, GuildTreasuryEntry.ts

3. business
   Frontend: features/business/pages/BusinessPage.tsx
   Backend:  features/business/routes.ts ← from routes/businesses.ts
             features/business/models/ ← Business.ts
             features/business/lib/businessIncomeWorker.ts ← from lib/businessIncomeWorker.ts
             features/business/lib/employeePerks.ts ← from lib/employeePerks.ts

4. districts
   Frontend:
   features/districts/
     pages/DistrictPage.tsx
     pages/DistrictHubPage.tsx
   Backend:
   features/districts/routes.ts ← from routes/districts.ts

5. travel
   Frontend: features/travel/pages/TravelPage.tsx
   Backend:  features/travel/routes.ts (extract travel routes from wherever they live)
             features/travel/lib/travelHelper.ts ← from lib/travelHelper.ts

6. city & world
   Frontend: features/city/pages/CityPage.tsx
   Backend:  features/city/routes.ts ← from routes/city.ts and routes/world.ts
             features/city/models/ ← WorldState.ts
             features/city/lib/npcEncounters.ts ← from lib/npcEncounters.ts
             features/city/lib/dangerRoll.ts ← from lib/dangerRoll.ts

---

RULES:
- Read replit.md before starting — follow every rule without exception
- One feature at a time — verify before moving to the next
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 8 — GANG SYSTEM
### Paste this prompt to start Tier 8

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–7 are complete. Your job is Tier 8: migrate the gang system. This is its own tier because it is a complex interconnected system with wars, crimes, and upgrades that all connect to each other.

---

WHAT TO MIGRATE:

The gang system is a self-contained world inside the game. Structure it like arena — with sub-systems inside:

features/gangs/
  wars/
    routes.ts   ← from routes/gang-wars.ts
    models/ ← GangWar.ts
  crimes/
    routes.ts   ← from routes/gang-crimes.ts
    models/ ← GangCrime.ts
  upgrades/
    routes.ts   ← from routes/gang-upgrades.ts
    models/ ← GangUpgrade.ts
  lib/
    warScoring.ts ← from lib/warScoring.ts
  index.ts       ← wires all gang sub-systems together

Frontend:
The gang system currently has no dedicated gang page visible in the nav — check if gang features appear inside other pages (factions, city, etc.) and wire accordingly. If a dedicated gang page exists or needs to be created, add it to features/gangs/pages/ and register in registry.ts.

Backend:
Update artifacts/api-server/src/routes/index.ts to import from features/gangs/.

---

PATTERN (important):
The gang sub-folder structure means: adding a new gang system in the future (e.g. "gang-territory") = create features/gangs/territory/ and wire it in features/gangs/index.ts. Nothing else changes.
Document this in ARCHITECTURE.md.

RULES:
- Read replit.md before starting — follow every rule without exception
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 9 — VANTA AI SYSTEM
### Paste this prompt to start Tier 9

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–8 are complete. Your job is Tier 9: migrate the Vanta AI system. This is a complex and unique system — treat it with extra care.

---

WHAT IS VANTA:
Vanta is an AI companion/NPC system. It has:
- A player-facing panel (PlayerVantaPanel.tsx)
- AI conversation routes (routes/vanta-ai.ts)
- Player vanta tracking (routes/player-vanta.ts)
- Vanta admin/management (routes/vanta.ts)
- Vanta logs, sessions, and scheduled tasks (models)
- Groq AI integration (lib/groq.ts)

---

STRUCTURE:

features/vanta/
  panel/
    components/PlayerVantaPanel.tsx ← move from src/components/
  ai/
    routes.ts   ← from routes/vanta-ai.ts
  player/
    routes.ts   ← from routes/player-vanta.ts
    models/ ← VantaLog.ts, VantaAISession.ts
  admin/
    routes.ts   ← from routes/vanta.ts
    models/ ← VantaScheduledTask.ts
  lib/
    vanta.ts    ← from lib/vanta.ts
    groq.ts     ← from lib/groq.ts (if vanta-exclusive — check if used elsewhere first)
  index.ts      ← wires all vanta sub-systems

Frontend wiring:
PlayerVantaPanel is rendered globally in App.tsx — update that import to point to the new location.

Backend:
Update artifacts/api-server/src/routes/index.ts to import from features/vanta/.

---

RULES:
- Read replit.md before starting — follow every rule without exception
- Check if groq.ts is used anywhere outside vanta before moving it — if yes, keep it in a shared backend lib
- Test the vanta panel thoroughly after migrating
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 10 — REFERRALS, SUBSCRIPTIONS & PAYMENTS
### Paste this prompt to start Tier 10

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–9 are complete. Your job is Tier 10: migrate the referral, subscription, and payment features.

---

FEATURES TO MIGRATE:

1. referrals
   Backend:
   features/referrals/routes.ts ← from routes/referral.ts
   features/referrals/lib/referralReward.ts ← from lib/referralReward.ts
   Frontend: wire referral UI into the correct pages (check where referral links/forms appear)

2. subscriptions & premium
   Backend:
   features/subscriptions/routes.ts ← from routes/store.ts (the premium currency store)
   features/subscriptions/models/ ← UcPurchaseLog.ts, TelegramPayment.ts (payment records)
   features/subscriptions/lib/subscription.ts ← from lib/subscription.ts
   Frontend: features/subscriptions/pages/StorePage.tsx ← the premium store page

3. platform codes
   Backend:
   features/platform/routes.ts ← from routes/platform.ts
   features/platform/lib/platformCodes.ts ← from lib/platformCodes.ts

---

RULES:
- Read replit.md before starting — follow every rule without exception
- Payment and subscription logic is sensitive — test thoroughly after migrating
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 11 — INTEGRATIONS & NOTIFICATIONS
### Paste this prompt to start Tier 11

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–10 are complete. Your job is Tier 11: migrate integrations and notification infrastructure. These connect the game to the outside world.

---

FEATURES TO MIGRATE:

1. telegram integration
   The telegram integration appears in settings AND in account creation/onboarding.
   features/integrations/telegram/
     routes.ts   ← from routes/telegram.ts
     models/ ← TelegramPayment.ts (if not already in subscriptions)
     lib/telegram.ts ← from lib/telegram.ts
   Frontend: wire telegram linking UI into settings page and onboarding

2. discord integration
   features/integrations/discord/
     routes.ts   ← from routes/discord.ts
     lib/discord.ts ← from lib/discord.ts
   Frontend: wire discord linking UI into settings page

3. push notifications
   Infrastructure — no dedicated page.
   features/notifications/push/
     lib/webPush.ts ← from lib/webPush.ts
     lib/sendPushToUser.ts ← from lib/sendPushToUser.ts
     models/ ← PushSubscription.ts
   Frontend push lib:
   shared/pushNotifications.ts ← already at src/lib/pushNotifications.ts, just move to shared

4. onboarding
   Frontend:
   features/onboarding/
     components/OnboardingModal.tsx
   Backend:
   features/onboarding/lib/onboardingHelper.ts ← from lib/onboardingHelper.ts

---

INTEGRATIONS PATTERN (important):
The integrations sub-folder structure means: adding a new integration in the future
(e.g. "features/integrations/whatsapp/") = create the sub-folder and wire it into settings.
Nothing else changes. Document this in ARCHITECTURE.md.

RULES:
- Read replit.md before starting — follow every rule without exception
- Test telegram and discord linking after migrating — these are real external connections
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 12 — ADMIN, STAFF & MODERATION
### Paste this prompt to start Tier 12

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–11 are complete. Your job is Tier 12: migrate admin, staff, and moderation systems.

---

FEATURES TO MIGRATE:

1. owner panel
   features/admin/owner/
     pages/OwnerPage.tsx
     routes.ts ← from routes/owner.ts
     lib/ownerIpAllowlist.ts ← from lib/ownerIpAllowlist.ts

2. staff portal
   features/admin/staff/
     pages/StaffPortalPage.tsx
     lib/staffTiers.ts ← from lib/staffTiers.ts
     lib/staffEarningsWorker.ts ← from lib/staffEarningsWorker.ts

3. ban system
   features/admin/bans/
     routes.ts ← from routes/ban-appeal.ts
     models/ ← BanAppeal.ts
     lib/banRecap.ts ← from lib/banRecap.ts

4. audit & logging
   features/admin/audit/
     models/ ← AdminAuditLog.ts
     lib/economyLog.ts ← from lib/economyLog.ts (economy-level audit trail)
     lib/logger.ts ← from lib/logger.ts
     lib/logBuffer.ts ← from lib/logBuffer.ts

5. dev tools
   features/admin/dev/
     components/DevToolbar.tsx
     routes.ts ← from routes/dev.ts

6. migration admin
   features/admin/migration/
     routes.ts ← from routes/migration-admin.ts
     jobs/migration.ts ← from jobs/migration.ts

7. game config & seed data
   features/admin/config/
     routes.ts ← (routes that manage GameConfig and ServerConfig)
     models/ ← GameConfig.ts, ServerConfig.ts
     lib/gameConfig.ts ← from lib/gameConfig.ts
     lib/seed.ts ← from lib/seed.ts
     lib/royaleSeed.ts ← from lib/royaleSeed.ts (if still active)

---

RULES:
- Read replit.md before starting — follow every rule without exception
- Admin and staff pages require role checks — verify those still work after migrating
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---
---

## TIER 13 — CORE (DO THIS LAST)
### Paste this prompt to start Tier 13

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–12 are complete. Your job is Tier 13: the core of the app — authentication, profile, dashboard, and settings. These are the most critical files. Do them last. Be extra careful.

---

FEATURES TO MIGRATE:

1. settings
   Frontend:
   features/settings/
     pages/SettingsPage.tsx
   Backend:
   features/settings/routes.ts ← from routes/settings.ts
   NOTE: Settings page imports integrations (Telegram, Discord). Those features already live
   in features/integrations/ — import from there.

2. profile
   Frontend:
   features/profile/
     pages/ProfilePage.tsx
   Backend:
   features/profile/routes.ts ← from routes/profile.ts and routes/user.ts

3. connections
   Frontend: features/connections/pages/ConnectionsPage.tsx

4. support
   Frontend: features/support/pages/SupportPage.tsx
   Backend:  features/support/routes.ts ← from routes/support.ts
             features/support/models/ ← SupportTicket.ts

5. legal
   Frontend: features/legal/pages/LegalPage.tsx

6. dashboard
   Frontend: features/dashboard/pages/Dashboard.tsx

7. auth (most critical — do last)
   Frontend:
   features/auth/
     pages/AuthPage.tsx
     hooks/useAuth.ts ← from src/hooks/useAuth.ts
     context/SocketContext.tsx ← from src/context/SocketContext.tsx
     context/PreferencesContext.tsx ← from src/context/PreferencesContext.tsx
   Backend:
   features/auth/routes.ts ← from routes/auth.ts
   features/auth/lib/jwt.ts ← from lib/jwt.ts
   features/auth/lib/mailer.ts ← from lib/mailer.ts (if auth-only)
   CRITICAL: App.tsx imports useAuth and the context providers — update those imports carefully.
   Test login, logout, and session persistence thoroughly.

---

AFTER ALL FEATURES ARE MIGRATED:

CLEANUP:
- The original artifacts/neonoir/src/pages/ folder should now be empty — delete it
- The original artifacts/api-server/src/routes/ top-level files should all be gone — delete the folder (keep index.ts which now just imports from features/)
- The original artifacts/api-server/src/models/ should be empty or contain only truly shared models — review what remains
- Review artifacts/api-server/src/lib/ — anything remaining should be moved into the appropriate feature or into a shared backend lib folder

FINAL VERIFY:
- Run `pnpm run build` from workspace root — must pass with zero errors
- Start all workflows and verify every single page in the game is reachable
- Test login, logout, all currency displays, arena, chat, vanta panel, admin pages

FINAL ARCHITECTURE.md UPDATE:
- Update the "feature list" to reflect the final structure
- Add "How to add a new integration" (follow integrations/telegram pattern)
- Add "How to add a new cosmetic type" (follow cosmetics/name-tiers pattern)
- Add "How to add a new arena game mode" (follow arena/hub pattern)
- Add "How to add a new gang sub-system" (follow gangs/wars pattern)
- Add "How to add a new admin tool" (follow admin/dev pattern)

RULES:
- Read replit.md before starting — follow every rule without exception
- Auth migration is the highest-risk step — test login/logout after every change
- Run `pnpm run build` from workspace root and fix all errors before finishing
- This tier is ONLY complete when: zero files remain in old pages/ folder, the app builds clean, and every page and system is reachable and working
```

---
---

## QUICK REFERENCE — Adding a New Feature (After All Tiers Complete)

```
Step 1: Create the feature folder
  artifacts/neonoir/src/features/<feature-name>/
    pages/          ← React pages
    components/     ← components only this feature uses
    hooks/          ← hooks only this feature uses (optional)
    types.ts        ← types only this feature uses (optional)
    index.ts        ← exports the feature's pages

  artifacts/api-server/src/features/<feature-name>/
    routes.ts       ← Express routes
    models/         ← Mongoose models only this feature uses (optional)

Step 2: Register it (the only files you touch outside the feature folder)
  - Add one entry to artifacts/neonoir/src/registry.ts  → appears in nav + routing
  - Add one import to artifacts/api-server/src/routes/index.ts → API routes live

That's it. Two lines in two files. Everything else is inside the feature folder.
```

---

## QUICK REFERENCE — Full Feature Map

| Feature | Frontend | Backend |
|---|---|---|
| crimes | features/crimes/ | features/crimes/ |
| jobs | features/jobs/ | features/jobs/ |
| hospital | features/hospital/ | features/hospital/ |
| daily | features/daily/ | features/daily/ |
| training/gym | features/training/ | features/training/ |
| energy | — | features/energy/ |
| arena | features/arena/ | features/arena/ |
| race | features/race/ | features/race/ |
| garage + minigames | features/garage/ | features/garage/ |
| hack | features/hack/ | features/hack/ |
| cyber | features/cyber/ | features/cyber/ |
| net | features/net/ | features/net/ |
| bank | features/bank/ | features/bank/ |
| market | features/market/ | features/market/ |
| shop/npc | features/shop/ | features/shop/ |
| inventory | features/inventory/ | features/inventory/ |
| loadout | features/loadout/ | features/loadout/ |
| auction | features/auction/ | features/auction/ |
| trade | features/trade/ | features/trade/ |
| bounties | — | features/bounties/ |
| feed | features/feed/ | features/feed/ |
| chat | features/chat/ | features/chat/ |
| friends | features/friends/ | features/friends/ |
| leaderboard | features/leaderboard/ | features/leaderboard/ |
| notifications | features/notifications/ | features/notifications/ |
| reports | features/reports/ | features/reports/ |
| search | — | features/search/ |
| missions + quests | features/missions/ | features/missions/ |
| achievements | features/achievements/ | features/achievements/ |
| prestige | features/prestige/ | — |
| battle-pass | features/battle-pass/ | features/battle-pass/ |
| seasons | — | features/seasons/ |
| mentor | features/mentor/ | features/mentor/ |
| events | features/events/ | features/events/ |
| cosmetics | features/cosmetics/ | features/cosmetics/ |
| giveaways | features/giveaways/ | features/giveaways/ |
| factions | features/factions/ | features/factions/ |
| guilds | features/guilds/ | features/guilds/ |
| business | features/business/ | features/business/ |
| districts | features/districts/ | features/districts/ |
| travel | features/travel/ | features/travel/ |
| city + world | features/city/ | features/city/ |
| gangs | features/gangs/ | features/gangs/ |
| vanta AI | features/vanta/ | features/vanta/ |
| referrals | features/referrals/ | features/referrals/ |
| subscriptions | features/subscriptions/ | features/subscriptions/ |
| platform codes | — | features/platform/ |
| telegram | features/integrations/telegram/ | features/integrations/telegram/ |
| discord | features/integrations/discord/ | features/integrations/discord/ |
| push notifications | shared/ | features/notifications/push/ |
| onboarding | features/onboarding/ | features/onboarding/ |
| owner panel | features/admin/owner/ | features/admin/owner/ |
| staff portal | features/admin/staff/ | features/admin/staff/ |
| ban system | — | features/admin/bans/ |
| audit + logging | — | features/admin/audit/ |
| dev tools | features/admin/dev/ | features/admin/dev/ |
| migration admin | — | features/admin/migration/ |
| game config | — | features/admin/config/ |
| settings | features/settings/ | features/settings/ |
| profile | features/profile/ | features/profile/ |
| connections | features/connections/ | — |
| support | features/support/ | features/support/ |
| legal | features/legal/ | — |
| dashboard | features/dashboard/ | — |
| auth | features/auth/ | features/auth/ |
