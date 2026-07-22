# Neonoir — Full Game Restructuring Plan
## Feature-First Architecture Migration — Complete & Verified Edition

---

## HOW TO USE THIS FILE

This file contains one prompt per tier. Each tier is a **separate chat session**.
**Start a new chat, paste the tier prompt, and the agent will execute that tier only.**
Complete each tier fully and verify the app still builds and runs before starting the next one.

**Order is strict — never skip tiers. Each tier depends on the one before it.**

---

## CURRENT STATE — VERIFIED FILE COUNT

| Area | Files |
|---|---|
| Frontend pages | 54 |
| Frontend components (custom) | 41 |
| Frontend UI components (shadcn) | 55 |
| Frontend lib files | 7 |
| Frontend hooks | 7 |
| Frontend context files | 2 |
| Backend routes | 67 |
| Backend models | 57 |
| Backend lib/utilities | 47 |
| Backend seeds & jobs | 3 |
| Root workspace libs (lib/) | ~120 files |
| **Grand total source files** | **~349** |

---

## PERMANENT RULES FOR EVERY TIER

These apply to every agent in every session. Read before doing anything.

1. Read `replit.md` fully — follow every rule without exception
2. Read `NEONOIR_MASTER_PLAN.md` to understand what each feature does
3. Read `artifacts/neonoir/ARCHITECTURE.md` (created in Tier 0) before touching any feature
4. One feature at a time — build and verify before moving to the next
5. `pnpm run build` from workspace root must pass with zero errors before finishing any tier
6. Never move a file that is listed under **NEVER MOVE** in this document
7. Never touch the root `lib/` packages — they are generated/managed separately
8. Never touch `scripts/` — it contains Replit post-merge infrastructure

---

## THINGS THAT NEVER MOVE — READ THIS FIRST

These files are imported by so many features that moving them would break everything.
They stay where they are permanently. Every feature imports from them.

### Backend — Permanent Infrastructure (stays in `artifacts/api-server/src/`)
| File | Why it never moves |
|---|---|
| `lib/db.ts` | Database connection — imported by almost every model |
| `lib/cors.ts` | CORS config — used by `app.ts` and `index.ts` |
| `lib/keepAlive.ts` | Server keep-alive ping — used by `index.ts` and vanta |
| `lib/schemas.ts` | Shared validation schemas — used by 8+ route files |
| `lib/avatar.ts` | Avatar generation — used by 11 different route files |
| `lib/logger.ts` | Logging — used everywhere |
| `lib/logBuffer.ts` | Log buffering — used with logger |
| `middlewares/auth.ts` | Auth middleware — every protected route uses it |
| `middlewares/banGate.ts` | Ban gate middleware — applied globally |
| `middlewares/validate.ts` | Validation middleware — used by many routes |
| `routes/health.ts` | Health check endpoint — server infrastructure |
| `routes/index.ts` | Route registry — stays but gets updated each tier |
| `app.ts` | Express app setup — stays |
| `index.ts` | Server entry point — stays |

### Backend — Permanent Shared Models (stays in `artifacts/api-server/src/models/`)
| Model | Why it never moves |
|---|---|
| `User.ts` | Imported by **83 files** — the core player model |
| `Item.ts` | Imported by **15 files** — the core item/inventory model |

### Frontend — Permanent Shared Files (moved to `shared/` in Tier 0, then never move again)
| File | Goes to |
|---|---|
| `lib/api.ts` | `shared/api.ts` — API client used by **67 files** |
| `lib/utils.ts` | `shared/utils.ts` — utilities used by **58 files** |
| `lib/format.ts` | `shared/format.ts` — formatting used by **20 files** |
| `lib/types.ts` | `shared/types.ts` — shared TypeScript types |
| `lib/avatar.ts` | `shared/avatar.ts` — procedural SVG avatar generator |
| `lib/animTicker.ts` | `shared/animTicker.ts` — shared animation ticker |
| `lib/pushNotifications.ts` | `shared/pushNotifications.ts` |

### Root Workspace Packages — DO NOT TOUCH
These live in `lib/` at the project root. They are generated packages — do not restructure, move, or edit them.
| Package | What it is |
|---|---|
| `lib/api-client-react/` | Auto-generated React API client (from OpenAPI spec) |
| `lib/api-spec/` | OpenAPI specification + orval config |
| `lib/api-zod/` | Auto-generated Zod validation types |
| `lib/db/` | Drizzle + PostgreSQL setup (separate from MongoDB) |

---

## FROZEN FEATURES — READ BEFORE TIER 13

The **Royale** system is frozen (disabled in nav, commented out). However its code still exists and is still referenced by active pages. It must be organized into a folder but NOT registered in the route registry or nav.

Files involved:
- Frontend: `RoyaleItemCard.tsx` (referenced by GaragePage, MissionsPage, NpcStorePage, OwnerPage, StorePage, CardArt)
- Backend models: `RoyaleItem.ts`, `PlayerRoyaleLog.ts`
- Backend lib: `royaleSeed.ts`

These move to `features/royale/` in Tier 13 but are NOT added to the route registry. They stay accessible as imports for the active pages that reference them.

---

## TIER OVERVIEW

| Tier | Name | What moves |
|---|---|---|
| 0 | Foundation | Shared folder, hooks, wiring layer, one example feature |
| 1 | Simple action features | Crimes, Jobs, Hospital, Daily, Training, Energy |
| 2 | Game & combat | Arena, Race, Garage/Mini-games, Hack, Cyber, Net |
| 3 | Economy & trading | Bank, Market, Shop, Inventory, Loadout, Auction, Trade, Bounties |
| 4 | Social & community | Feed, Chat, Friends, Leaderboard, Notifications, Reports, Search |
| 5 | Progression & mastery | Missions/Quests, Achievements, Prestige, Battle Pass, Seasons, Mentor |
| 6 | Events & cosmetics | Events, Cosmetics, Giveaways |
| 7 | Organizations & world | Factions, Guilds, Business, Districts, Travel, City/World |
| 8 | Gang system | Gang Wars, Gang Crimes, Gang Upgrades |
| 9 | Vanta AI system | Player panel, AI routes, vanta admin, vanta models |
| 10 | Referrals, subscriptions & payments | Referral, Subscriptions, Platform codes |
| 11 | Integrations & notifications | Telegram, Discord, Push notifications, Onboarding |
| 12 | Admin, staff & moderation | Owner, Staff, Bans, Audit, Dev tools, Game config |
| 13 | Core + frozen features | Auth, Profile, Dashboard, Settings, Support, Legal, Royale |

---
---

## TIER 0 — FOUNDATION
### Paste this prompt to start Tier 0

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md fully before doing anything.
Pay close attention to the THINGS THAT NEVER MOVE section — those files stay where they are.

Your job is Tier 0: lay the foundation. No features are moved yet. You are only setting up
shared infrastructure, utilities, and wiring patterns that every future tier will follow.

---

WHAT TO BUILD:

1. SHARED FRONTEND FOLDER
Create `artifacts/neonoir/src/shared/` with the following:

a) `shared/theme.ts`
Move and expand the existing `src/theme.ts`.
Export: DL (all colors), GLOWS (all glow effects). Add Z_INDEX scale.
Single source of truth — no component may hardcode a hex color.

b) `shared/api.ts`
Move `src/lib/api.ts` here (used by 67 files — update all imports).

c) `shared/utils.ts`
Move `src/lib/utils.ts` here (used by 58 files — update all imports).

d) `shared/format.ts`
Move `src/lib/format.ts` here (used by 20 files — update all imports).
This handles general formatting. Currency-specific formatting goes in shared/currency.ts below.

e) `shared/currency.ts`
Create a new file. Export:
- formatDC(n: number): string
- formatNC(n: number): string
- formatCurrency(n: number, type: string): string
- CURRENCY_LABELS: Record<string, string>
- CURRENCY_COLORS: Record<string, string> — import colors from shared/theme.ts

f) `shared/types.ts`
Move `src/lib/types.ts` here. Keep all types that are used across more than one feature.

g) `shared/avatar.ts`
Move `src/lib/avatar.ts` here (procedural SVG avatar generator).

h) `shared/animTicker.ts`
Move `src/lib/animTicker.ts` here (shared animation ticker used by animated components).

i) `shared/pushNotifications.ts`
Move `src/lib/pushNotifications.ts` here.

j) `shared/hooks/`
Move ALL hook files from `src/hooks/` into `shared/hooks/`:
- useAuth.ts         ← will move again in Tier 13, but lives in shared/hooks for now
- useConnectivity.ts
- use-mobile.tsx
- useSwipe.ts
- useUpdateCheck.ts
- use-toast.ts
- useToast.ts
Update all imports across the codebase.

k) `shared/context/`
Move both context files here for now (will move again in Tier 13):
- PreferencesContext.tsx
- SocketContext.tsx

l) `shared/components/`
Move these components that are used across many features:
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
- PlayerInspectModal.tsx
- AnnouncementBanner.tsx
- not-found.tsx          ← the 404 page belongs in shared

2. ROUTE REGISTRY
Create `artifacts/neonoir/src/registry.ts`.
Single source of truth for every page in the game.

Each entry shape:
{
  id: string,
  label: string,
  icon: LucideIcon,
  component: lazy React component,
  nav: boolean,
  bottomNav: boolean,
  roles?: string[],
  minStage?: number,
  statusFilter?: "normal" | "normal|abroad" | "abroad",
  group?: string,
}

Migrate ALL entries from:
- The NAV array in NavBar.tsx (lines 41–78)
- The ITEMS array in BottomNav.tsx
- All lazy imports and every case in renderPage() in App.tsx

Update App.tsx, NavBar.tsx, BottomNav.tsx to read from registry.ts.

3. FEATURES FOLDER + ONE EXAMPLE
Create `artifacts/neonoir/src/features/`.
Migrate Hospital as the example:
- Frontend: features/hospital/pages/HospitalPage.tsx
- Registry: update to point to new location
- Backend: artifacts/api-server/src/features/hospital/routes.ts
- Update artifacts/api-server/src/routes/index.ts

4. ARCHITECTURE.md
Create `artifacts/neonoir/ARCHITECTURE.md` documenting:
- The full folder structure
- How to add a new feature (step by step)
- How to add a page to nav (one line in registry.ts)
- Where shared things live and import paths
- The NEVER MOVE list with reasons
- Rules: no hardcoded hex, no inline currency formatting, no hardcoded image paths

---

IMPORTANT — DO NOT MOVE:
- artifacts/api-server/src/lib/db.ts
- artifacts/api-server/src/lib/cors.ts
- artifacts/api-server/src/lib/keepAlive.ts
- artifacts/api-server/src/lib/schemas.ts
- artifacts/api-server/src/lib/avatar.ts
- artifacts/api-server/src/lib/logger.ts
- artifacts/api-server/src/lib/logBuffer.ts
- artifacts/api-server/src/middlewares/
- artifacts/api-server/src/routes/health.ts
- artifacts/api-server/src/routes/index.ts
- artifacts/api-server/src/models/User.ts
- artifacts/api-server/src/models/Item.ts
- lib/ (root workspace packages — never touch)

VERIFY before finishing:
- pnpm run build from workspace root — zero errors
- App starts and all pages are reachable
- Hospital page still works as the example migrated feature
```

---
---

## TIER 1 — SIMPLE ACTION FEATURES
### Paste this prompt to start Tier 1

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tier 0 is complete. Your job is Tier 1: migrate the simple standalone action features.
Low risk — they barely touch other features. One at a time, verify after each.

---

FEATURES TO MIGRATE:

1. crimes
   Frontend: features/crimes/pages/CrimesPage.tsx
   Backend:
   - features/crimes/routes.ts ← from routes/crimes.ts
   - features/crimes/models/CrimeLog.ts ← from models/CrimeLog.ts

2. jobs
   Frontend: features/jobs/pages/JobsPage.tsx
   Backend:
   - features/jobs/routes.ts ← from routes/jobs.ts

3. hospital
   Already done in Tier 0 — skip.

4. daily
   Frontend: features/daily/pages/DailyPage.tsx
   Backend:
   - features/daily/routes.ts ← from routes/daily.ts

5. training / gym
   Frontend: features/training/pages/TrainingCenterPage.tsx
   Backend:
   - features/training/routes.ts ← merge routes/training.ts and routes/gym.ts
   - features/training/models/ActionMastery.ts ← from models/ActionMastery.ts

6. energy (backend only — no frontend page)
   Backend:
   - features/energy/routes.ts ← from routes/energy.ts
   - features/energy/lib/regen.ts ← from lib/regen.ts
   - features/energy/lib/atomicRegen.ts ← from lib/atomicRegen.ts

---

FOR EACH FEATURE:
Frontend: move page → features/<name>/pages/, move feature-only components →
features/<name>/components/, update registry.ts, fix all imports.
Backend: move routes → features/<name>/routes.ts, move feature-only models →
features/<name>/models/, update routes/index.ts.
Verify: build passes, page loads, nothing else broken.

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, schemas.ts, avatar.ts (backend),
logger.ts, middlewares/, health.ts, routes/index.ts
```

---
---

## TIER 2 — GAME & COMBAT FEATURES
### Paste this prompt to start Tier 2

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0 and 1 are complete. Your job is Tier 2: migrate game and combat features.
More complex but still self-contained worlds. One at a time, verify after each.

---

FEATURES TO MIGRATE:

1. arena
   Frontend:
   features/arena/
     hub/pages/ArenaHubPage.tsx
     combat/pages/ArenaCombatPage.tsx
     components/MatchResultModal.tsx   ← used only by ArenaCombatPage
   Backend:
   - features/arena/routes.ts ← from routes/arena.ts
   - features/arena/models/CombatMatch.ts ← from models/CombatMatch.ts
   - features/arena/lib/arenaItemSeed.ts ← from lib/arenaItemSeed.ts
   STRUCTURE NOTE: Arena is built as sub-folders (hub/, combat/) so adding a new
   arena game mode in the future = create features/arena/<new-mode>/ and add to registry.

2. race
   Frontend:
   features/race/
     hub/pages/RaceHubPage.tsx
     match/pages/RaceMatchPage.tsx
   Backend:
   - features/race/routes.ts ← from routes/race.ts
   - features/race/models/RaceCar.ts ← from models/RaceCar.ts
   - features/race/models/RaceMatch.ts ← from models/RaceMatch.ts
   - features/race/seeds/raceCars.ts ← from seeds/raceCars.ts

3. garage (+ mini-games)
   Garage contains the mini-game system — keep together.
   Frontend:
   features/garage/
     pages/GaragePage.tsx
     components/MiniGameModal.tsx
   Backend:
   - features/garage/routes.ts ← from routes/minigame-garage.ts
   - features/garage/models/CarPart.ts ← from models/CarPart.ts
   - features/garage/models/PlayerGarage.ts ← from models/PlayerGarage.ts
   - features/garage/models/MiniGameItem.ts ← from models/MiniGameItem.ts
   - features/garage/models/MiniGameLeaderboard.ts ← from models/MiniGameLeaderboard.ts
   - features/garage/models/PlayerMiniGameInventory.ts ← from models/PlayerMiniGameInventory.ts
   - features/garage/seeds/miniGameItems.ts ← from seeds/miniGameItems.ts

4. hack
   Frontend: features/hack/pages/HackPage.tsx
   Backend:
   - features/hack/routes.ts ← from routes/hacking.ts
   - features/hack/models/HackSession.ts ← from models/HackSession.ts

5. cyber
   Frontend: features/cyber/pages/CyberPage.tsx
   Backend:
   - features/cyber/routes.ts ← from routes/cyber.ts

6. net
   Frontend: features/net/pages/NetPage.tsx
   Backend:
   - features/net/routes.ts ← from routes/net.ts

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, schemas.ts, avatar.ts (backend),
logger.ts, middlewares/, health.ts, routes/index.ts
```

---
---

## TIER 3 — ECONOMY & TRADING
### Paste this prompt to start Tier 3

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–2 are complete. Your job is Tier 3: migrate economy and trading features.
These all deal with currency and items — do together for consistency.

IMPORTANT: All currency formatting must use shared/currency.ts.
If any feature does its own currency math, move that logic to shared/currency.ts first.
Shared item/inventory TypeScript types belong in shared/types.ts.

---

FEATURES TO MIGRATE:

1. bank
   Frontend: features/bank/pages/BankPage.tsx
   Backend:
   - features/bank/routes.ts ← from routes/bank.ts

2. market (regular + black market + dark listings — all one feature)
   Frontend: features/market/pages/MarketPage.tsx
   Backend:
   - features/market/routes.ts ← from routes/market.ts
   - features/market/models/BlackMarketListing.ts ← from models/BlackMarketListing.ts
   - features/market/models/DarkListing.ts ← from models/DarkListing.ts
   - features/market/models/NpcStoreListing.ts ← from models/NpcStoreListing.ts
   - features/market/models/PriceOverride.ts ← from models/PriceOverride.ts

3. shop (NPC stores hub)
   Frontend:
   features/shop/
     hub/pages/ShopHubPage.tsx
     npc/pages/NpcStorePage.tsx
   Backend:
   - features/shop/routes.ts ← from routes/npcStores.ts

4. inventory
   Frontend: features/inventory/pages/InventoryPage.tsx
   Backend:
   - features/inventory/routes.ts ← from routes/inventory.ts
   NOTE: Item.ts and PlayerLoadout.ts are shared — do not move them.

5. loadout
   Frontend: features/loadout/pages/LoadoutPage.tsx
   Backend:
   - features/loadout/routes.ts ← from routes/loadout.ts
   - features/loadout/models/PlayerLoadout.ts ← from models/PlayerLoadout.ts
     (only if used exclusively by loadout — check first)

6. auction
   Frontend: features/auction/pages/AuctionPage.tsx
   Backend:
   - features/auction/routes.ts ← from routes/auction.ts
   - features/auction/models/AuctionListing.ts ← from models/AuctionListing.ts

7. trade
   Frontend: features/trade/pages/TradePage.tsx
   Backend:
   - features/trade/routes.ts ← from routes/trade.ts
   - features/trade/models/PlayerTrade.ts ← from models/PlayerTrade.ts

8. bounties (backend only — no dedicated page)
   Backend:
   - features/bounties/routes.ts ← from routes/bounties.ts
   - features/bounties/models/Bounty.ts ← from models/Bounty.ts

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 4 — SOCIAL & COMMUNITY
### Paste this prompt to start Tier 4

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–3 are complete. Your job is Tier 4: migrate social and community features.
These connect players to each other — take extra care with shared types.

IMPORTANT: PlayerInspectModal lives in shared/components/ — never move it into any feature.
MentionInput, MentionText, MessageCard are chat-only — they go in features/chat/components/.
All shared player/user TypeScript types belong in shared/types.ts.

---

FEATURES TO MIGRATE:

1. feed
   Frontend: features/feed/pages/FeedPage.tsx
   Backend:
   - features/feed/routes.ts ← from routes/feed.ts
   - features/feed/models/FeedEvent.ts ← from models/FeedEvent.ts
   - features/feed/lib/feedEvents.ts ← from lib/feedEvents.ts
   - features/feed/lib/systemFeed.ts ← from lib/systemFeed.ts

2. chat
   Frontend:
   features/chat/
     pages/ChatPage.tsx
     components/MentionInput.tsx
     components/MentionText.tsx
     components/MessageCard.tsx
   Backend:
   - features/chat/routes.ts ← from routes/chat.ts
   - features/chat/models/ChatMessage.ts ← from models/ChatMessage.ts
   - features/chat/models/ChatReport.ts ← from models/ChatReport.ts
   - features/chat/lib/chatMod.ts ← from lib/chatMod.ts
   - features/chat/lib/mentions.ts ← from lib/mentions.ts

3. friends
   Frontend: features/friends/pages/FriendsPage.tsx
   Backend:
   - features/friends/routes.ts ← from routes/friends.ts
   - features/friends/models/FriendRequest.ts ← from models/FriendRequest.ts

4. leaderboard
   Frontend:
   features/leaderboard/
     pages/LeaderboardPage.tsx
     pages/HallOfFamePage.tsx
     pages/MatchHistoryPage.tsx
   Backend:
   - features/leaderboard/routes.ts ← merge routes/leaderboard.ts, routes/mini-leaderboard.ts,
                                        routes/match-history.ts
   - features/leaderboard/lib/leaderboardHighlights.ts ← from lib/leaderboardHighlights.ts

5. notifications
   Frontend: features/notifications/pages/NotificationsPage.tsx
   Backend:
   - features/notifications/routes.ts ← from routes/notifications.ts
   - features/notifications/models/Notification.ts ← from models/Notification.ts
   - features/notifications/lib/notifyUser.ts ← from lib/notifyUser.ts

6. reports & moderation
   Frontend:
   features/reports/
     components/ReportPlayerModal.tsx
   Backend:
   - features/reports/routes.ts ← from routes/reports.ts
   - features/reports/models/PlayerReport.ts ← from models/PlayerReport.ts

7. search (backend only — UI lives in NavBar SearchBar component)
   Backend:
   - features/search/routes.ts ← from routes/search.ts

DO NOT MOVE: User.ts, Item.ts, PlayerInspectModal.tsx (shared/components),
db.ts, cors.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 5 — PROGRESSION & MASTERY
### Paste this prompt to start Tier 5

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–4 are complete. Your job is Tier 5: migrate progression and mastery features —
systems that reward and track player growth.

---

FEATURES TO MIGRATE:

1. missions & quests (closely linked — keep together)
   Frontend: features/missions/pages/MissionsPage.tsx
   Backend:
   - features/missions/routes.ts ← merge routes/missions.ts and routes/quests.ts
   - features/missions/models/Quest.ts ← from models/Quest.ts
   - features/missions/lib/questProgress.ts ← from lib/questProgress.ts
   - features/missions/lib/missionEvents.ts ← from lib/missionEvents.ts

2. achievements
   Frontend: features/achievements/pages/AchievementsPage.tsx
   Backend:
   - features/achievements/routes.ts ← from routes/achievements.ts
   - features/achievements/models/Achievement.ts ← from models/Achievement.ts

3. prestige (no dedicated page — modal triggered from profile/other pages)
   Frontend:
   features/prestige/
     components/PrestigeConfirmModal.tsx
   Backend:
   (prestige logic may live inside user/profile routes — extract to features/prestige/routes.ts
   only if it has dedicated endpoints)

4. battle-pass
   Frontend:
   features/battle-pass/
     pages/BattlePassPage.tsx
     components/BattlePassTab.tsx
     components/CosmeticsTab.tsx
   Backend:
   - features/battle-pass/routes.ts ← from routes/battle-pass.ts
   - features/battle-pass/models/BattlePass.ts ← from models/BattlePass.ts
   - features/battle-pass/lib/battlePassXp.ts ← from lib/battlePassXp.ts

5. seasons (backend only — no dedicated page)
   Backend:
   - features/seasons/routes.ts ← from routes/seasons.ts

6. mentor
   Frontend: features/mentor/pages/MentorPage.tsx
   Backend:
   - features/mentor/routes.ts ← from routes/mentor.ts
   - features/mentor/lib/mentorBonus.ts ← from lib/mentorBonus.ts

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 6 — EVENTS & COSMETICS
### Paste this prompt to start Tier 6

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–5 are complete. Your job is Tier 6: migrate events and cosmetics systems.

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
   - features/events/routes.ts ← from routes/events.ts
   - features/events/models/Event.ts ← from models/Event.ts
   - features/events/models/EventProgress.ts ← from models/EventProgress.ts
   - features/events/lib/eventEngine.ts ← from lib/eventEngine.ts

2. cosmetics
   Structure for easy future expansion — new cosmetic type = new sub-folder only.
   Frontend:
   features/cosmetics/
     name-tiers/        ← components and logic for name tier cosmetics
     chat-bubbles/      ← components and logic for chat bubble cosmetics
     badges/
       components/EmblemBadge.tsx  ← move from shared/components if badge-specific
     index.ts           ← exports everything, wires to registry
   Backend:
   - features/cosmetics/routes.ts ← from routes/cosmetics.ts
   - features/cosmetics/models/CosmeticItem.ts ← from models/CosmeticItem.ts

3. giveaways
   Frontend:
   features/giveaways/
     components/CreateGiveawayModal.tsx
     components/GiveawayCard.tsx
   Backend:
   (find and move giveaway-specific API routes into features/giveaways/routes.ts)

COSMETICS PATTERN: Adding a new cosmetic type in the future = create
features/cosmetics/<new-type>/ sub-folder and add one entry to features/cosmetics/index.ts.
Nothing else changes. Document this in ARCHITECTURE.md.

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 7 — ORGANIZATIONS & WORLD
### Paste this prompt to start Tier 7

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–6 are complete. Your job is Tier 7: migrate organization and world features.

IMPORTANT: Faction name and color are displayed in NavBar — those types stay in shared/types.ts.

---

FEATURES TO MIGRATE:

1. factions
   Frontend:
   features/factions/
     pages/FactionPage.tsx
     pages/FactionSelectPage.tsx
   Backend:
   - features/factions/routes.ts ← merge routes/factions.ts and routes/factionBank.ts
   - features/factions/models/Faction.ts ← from models/Faction.ts
   - features/factions/models/FactionBankLog.ts ← from models/FactionBankLog.ts
   - features/factions/models/FactionCrime.ts ← from models/FactionCrime.ts

2. guilds
   Frontend: features/guilds/pages/GuildsPage.tsx
   Backend:
   - features/guilds/routes.ts ← from routes/guilds.ts
   - features/guilds/models/Guild.ts ← from models/Guild.ts
   - features/guilds/models/GuildTreasuryEntry.ts ← from models/GuildTreasuryEntry.ts

3. business
   Frontend: features/business/pages/BusinessPage.tsx
   Backend:
   - features/business/routes.ts ← from routes/businesses.ts
   - features/business/models/Business.ts ← from models/Business.ts
   - features/business/lib/businessIncomeWorker.ts ← from lib/businessIncomeWorker.ts
   - features/business/lib/employeePerks.ts ← from lib/employeePerks.ts

4. districts
   Frontend:
   features/districts/
     pages/DistrictPage.tsx
     pages/DistrictHubPage.tsx
   Backend:
   - features/districts/routes.ts ← from routes/districts.ts

5. travel
   Frontend: features/travel/pages/TravelPage.tsx
   Backend:
   - features/travel/routes.ts ← (find travel-specific routes)
   - features/travel/lib/travelHelper.ts ← from lib/travelHelper.ts

6. city & world
   Frontend: features/city/pages/CityPage.tsx
   Backend:
   - features/city/routes.ts ← merge routes/city.ts and routes/world.ts
   - features/city/models/WorldState.ts ← from models/WorldState.ts
   - features/city/lib/npcEncounters.ts ← from lib/npcEncounters.ts
   - features/city/lib/dangerRoll.ts ← from lib/dangerRoll.ts

DO NOT MOVE: User.ts, Item.ts, Faction type in shared/types.ts,
db.ts, cors.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 8 — GANG SYSTEM
### Paste this prompt to start Tier 8

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–7 are complete. Your job is Tier 8: migrate the gang system.
Its own tier because gang wars, crimes, and upgrades are interconnected.

---

WHAT TO BUILD:

features/gangs/
  wars/
    routes.ts   ← from routes/gang-wars.ts
    models/GangWar.ts ← from models/GangWar.ts
  crimes/
    routes.ts   ← from routes/gang-crimes.ts
    models/GangCrime.ts ← from models/GangCrime.ts
  upgrades/
    routes.ts   ← from routes/gang-upgrades.ts
    models/GangUpgrade.ts ← from models/GangUpgrade.ts
  lib/
    warScoring.ts ← from lib/warScoring.ts
  index.ts       ← wires all sub-systems, exports routes for routes/index.ts

Frontend: Check if gang features appear inside existing pages (factions, city, etc.)
and ensure those pages import from the new locations. If a dedicated gang page is
needed in the future, add it as features/gangs/pages/ and register in registry.ts.

Backend: Update routes/index.ts to import from features/gangs/index.ts.

GANG PATTERN: Adding a new gang sub-system in future = create features/gangs/<new-system>/
and add to features/gangs/index.ts. Document in ARCHITECTURE.md.

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 9 — VANTA AI SYSTEM
### Paste this prompt to start Tier 9

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–8 are complete. Your job is Tier 9: migrate the Vanta AI system.
Complex and unique — treat with extra care.

---

WHAT IS VANTA:
An AI companion/NPC system with: a player-facing panel, AI conversation routes,
player vanta tracking, vanta admin, vanta logs/sessions/tasks, and Groq AI integration.

WHAT TO BUILD:

features/vanta/
  panel/
    components/PlayerVantaPanel.tsx   ← move from src/components/
  ai/
    routes.ts   ← from routes/vanta-ai.ts
  player/
    routes.ts   ← from routes/player-vanta.ts
    models/VantaLog.ts ← from models/VantaLog.ts
    models/VantaAISession.ts ← from models/VantaAISession.ts
  admin/
    routes.ts   ← from routes/vanta.ts
    models/VantaScheduledTask.ts ← from models/VantaScheduledTask.ts
  lib/
    vanta.ts    ← from lib/vanta.ts
    groq.ts     ← from lib/groq.ts ONLY IF groq is used exclusively by vanta.
                   Check first: grep -r "groq" artifacts/api-server/src --include="*.ts" -l
                   If used by other features, it stays in lib/ permanently.
  index.ts      ← wires all vanta sub-systems

Frontend: PlayerVantaPanel is rendered globally in App.tsx.
Update that import to point to features/vanta/panel/components/PlayerVantaPanel.tsx.

Backend: Update routes/index.ts to import from features/vanta/index.ts.

VERIFY: Test the vanta panel opens, AI responses work, vanta logs are saved.

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, keepAlive.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 10 — REFERRALS, SUBSCRIPTIONS & PAYMENTS
### Paste this prompt to start Tier 10

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–9 are complete. Your job is Tier 10: migrate referral, subscription,
and payment features. Payment logic is sensitive — test thoroughly after each step.

---

FEATURES TO MIGRATE:

1. referrals
   Backend:
   - features/referrals/routes.ts ← from routes/referral.ts
   - features/referrals/lib/referralReward.ts ← from lib/referralReward.ts
   Frontend: Check where referral UI appears (profile? onboarding?) and ensure
   those pages import from the new location.

2. subscriptions & premium store
   Frontend: features/subscriptions/pages/StorePage.tsx
   Backend:
   - features/subscriptions/routes.ts ← from routes/store.ts
   - features/subscriptions/models/UcPurchaseLog.ts ← from models/UcPurchaseLog.ts
   - features/subscriptions/models/TelegramPayment.ts ← from models/TelegramPayment.ts
   - features/subscriptions/lib/subscription.ts ← from lib/subscription.ts

3. platform codes
   Backend:
   - features/platform/routes.ts ← from routes/platform.ts
   - features/platform/lib/platformCodes.ts ← from lib/platformCodes.ts

VERIFY: Test premium store loads, purchases are recorded, referral rewards fire correctly.

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 11 — INTEGRATIONS & NOTIFICATIONS
### Paste this prompt to start Tier 11

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–10 are complete. Your job is Tier 11: migrate integrations and
notification infrastructure. These connect the game to the outside world.

---

FEATURES TO MIGRATE:

1. telegram integration
   Telegram appears in settings AND onboarding — wire to both correctly.
   features/integrations/telegram/
     routes.ts   ← from routes/telegram.ts
     lib/telegram.ts ← from lib/telegram.ts
   Frontend: wire telegram linking UI into settings page and onboarding modal.
   NOTE: TelegramPayment model already moved in Tier 10.

2. discord integration
   features/integrations/discord/
     routes.ts   ← from routes/discord.ts
     lib/discord.ts ← from lib/discord.ts
   Frontend: wire discord linking UI into settings page.

3. push notifications (infrastructure — no dedicated page)
   features/notifications/push/
     lib/webPush.ts ← from lib/webPush.ts
     lib/sendPushToUser.ts ← from lib/sendPushToUser.ts
     models/PushSubscription.ts ← from models/PushSubscription.ts
   NOTE: shared/pushNotifications.ts (frontend) was already moved in Tier 0.

4. onboarding
   Frontend:
   features/onboarding/
     components/OnboardingModal.tsx
   Backend:
   - features/onboarding/lib/onboardingHelper.ts ← from lib/onboardingHelper.ts

INTEGRATIONS PATTERN: Adding a new integration in future (e.g. WhatsApp) =
create features/integrations/whatsapp/ and wire it into settings.
Document in ARCHITECTURE.md.

VERIFY: Test telegram linking, discord linking, push notification subscription,
and onboarding modal flow after migrating.

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, schemas.ts, avatar.ts (backend)
```

---
---

## TIER 12 — ADMIN, STAFF & MODERATION
### Paste this prompt to start Tier 12

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–11 are complete. Your job is Tier 12: migrate admin, staff, and moderation.
Admin pages have role checks — verify those still work after every move.

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
     models/BanAppeal.ts ← from models/BanAppeal.ts
     lib/banRecap.ts ← from lib/banRecap.ts

4. audit & economy logging
   features/admin/audit/
     models/AdminAuditLog.ts ← from models/AdminAuditLog.ts
     models/EconomyLog.ts ← from models/EconomyLog.ts
     lib/economyLog.ts ← from lib/economyLog.ts
   NOTE: logger.ts and logBuffer.ts stay permanently in lib/ — do not move them.

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
     routes.ts ← routes that manage GameConfig and ServerConfig
     models/GameConfig.ts ← from models/GameConfig.ts
     models/ServerConfig.ts ← from models/ServerConfig.ts
     lib/gameConfig.ts ← from lib/gameConfig.ts
     lib/seed.ts ← from lib/seed.ts
     lib/royaleSeed.ts ← from lib/royaleSeed.ts (frozen royale seed — keep but do not activate)

VERIFY: Test owner page, staff portal, ban appeal submission, dev toolbar.
All role-restricted pages must still enforce their role checks.

DO NOT MOVE: User.ts, Item.ts, db.ts, cors.ts, keepAlive.ts, schemas.ts,
avatar.ts (backend), logger.ts, logBuffer.ts, middlewares/, health.ts
```

---
---

## TIER 13 — CORE + FROZEN FEATURES (DO THIS LAST)
### Paste this prompt to start Tier 13

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and
artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–12 are complete. Your job is Tier 13: the core of the app and frozen features.
These are the most critical files — auth especially. Be extra careful. Test after every step.

---

PART A — FROZEN FEATURES

1. royale (frozen — do NOT add to registry or nav)
   Move to features/royale/ to keep it organized, but it stays disabled.
   features/royale/
     components/RoyaleItemCard.tsx ← from src/components/ (still imported by active pages)
     models/RoyaleItem.ts ← from models/RoyaleItem.ts
     models/PlayerRoyaleLog.ts ← from models/PlayerRoyaleLog.ts
   Update all active pages that import RoyaleItemCard to use the new path:
   - GaragePage, MissionsPage, NpcStorePage, OwnerPage, StorePage, CardArt.tsx
   Do NOT register in registry.ts. Do NOT add to nav.

---

PART B — CORE FEATURES

2. settings
   Frontend: features/settings/pages/SettingsPage.tsx
   Backend:
   - features/settings/routes.ts ← from routes/settings.ts
   NOTE: Settings imports integrations (Telegram, Discord) — import from
   features/integrations/telegram/ and features/integrations/discord/.

3. connections
   Frontend: features/connections/pages/ConnectionsPage.tsx

4. profile
   Frontend: features/profile/pages/ProfilePage.tsx
   Backend:
   - features/profile/routes.ts ← merge routes/profile.ts and routes/user.ts

5. support
   Frontend: features/support/pages/SupportPage.tsx
   Backend:
   - features/support/routes.ts ← from routes/support.ts
   - features/support/models/SupportTicket.ts ← from models/SupportTicket.ts

6. legal
   Frontend: features/legal/pages/LegalPage.tsx

7. dashboard
   Frontend: features/dashboard/pages/Dashboard.tsx

8. auth (most critical — do absolutely last)
   Frontend:
   features/auth/
     pages/AuthPage.tsx
     hooks/useAuth.ts ← move from shared/hooks/
     context/SocketContext.tsx ← move from shared/context/
     context/PreferencesContext.tsx ← move from shared/context/
   Backend:
   - features/auth/routes.ts ← from routes/auth.ts
   - features/auth/lib/jwt.ts ← from lib/jwt.ts
   - features/auth/lib/mailer.ts ← from lib/mailer.ts (only used by auth routes)
   CRITICAL: App.tsx imports useAuth and context providers. Update those imports carefully.
   CRITICAL: Test login, logout, and session persistence before doing anything else.

---

PART C — FINAL CLEANUP

After all features are migrated:

CLEANUP:
- artifacts/neonoir/src/pages/ should be empty — delete the folder
- artifacts/api-server/src/routes/ top-level files should all be gone —
  only routes/index.ts remains (it imports from features/)
- artifacts/api-server/src/models/ should only contain User.ts and Item.ts
- artifacts/api-server/src/lib/ should only contain permanent infrastructure:
  db.ts, cors.ts, keepAlive.ts, schemas.ts, avatar.ts, logger.ts, logBuffer.ts
- artifacts/api-server/src/jobs/ should be empty (migration.ts moved to Tier 12)
- Review anything remaining in these folders and decide: feature folder or permanent infra

FINAL BUILD:
- pnpm run build from workspace root — must pass with zero errors
- Start all workflows and verify every single page is reachable
- Test login, logout, all currency displays, arena combat, chat, vanta panel, admin pages

FINAL ARCHITECTURE.md UPDATE:
- Confirm documented structure matches what was actually built
- Add: How to add a new integration (follow integrations/telegram pattern)
- Add: How to add a new cosmetic type (follow cosmetics/name-tiers pattern)
- Add: How to add a new arena game mode (follow arena/hub structure)
- Add: How to add a new gang sub-system (follow gangs/wars pattern)
- Add: How to add a new admin tool (follow admin/dev pattern)
- Add: The frozen Royale section — how to reactivate it when ready
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

Step 2: Register it (the ONLY files you touch outside the feature folder)
  - Add 1 entry to artifacts/neonoir/src/registry.ts
    → auto-wires routing + nav + BottomNav
  - Add 1 import line to artifacts/api-server/src/routes/index.ts
    → API routes go live

That's it. Two lines in two files. Nothing else to hunt for.
```

---

## QUICK REFERENCE — Complete Feature Map

| Feature | Frontend | Backend |
|---|---|---|
| **Tier 1** | | |
| crimes | features/crimes/ | features/crimes/ |
| jobs | features/jobs/ | features/jobs/ |
| hospital | features/hospital/ | features/hospital/ |
| daily | features/daily/ | features/daily/ |
| training | features/training/ | features/training/ |
| energy | — | features/energy/ |
| **Tier 2** | | |
| arena | features/arena/ | features/arena/ |
| race | features/race/ | features/race/ |
| garage + minigames | features/garage/ | features/garage/ |
| hack | features/hack/ | features/hack/ |
| cyber | features/cyber/ | features/cyber/ |
| net | features/net/ | features/net/ |
| **Tier 3** | | |
| bank | features/bank/ | features/bank/ |
| market | features/market/ | features/market/ |
| shop / npc stores | features/shop/ | features/shop/ |
| inventory | features/inventory/ | features/inventory/ |
| loadout | features/loadout/ | features/loadout/ |
| auction | features/auction/ | features/auction/ |
| trade | features/trade/ | features/trade/ |
| bounties | — | features/bounties/ |
| **Tier 4** | | |
| feed | features/feed/ | features/feed/ |
| chat | features/chat/ | features/chat/ |
| friends | features/friends/ | features/friends/ |
| leaderboard | features/leaderboard/ | features/leaderboard/ |
| notifications | features/notifications/ | features/notifications/ |
| reports | features/reports/ | features/reports/ |
| search | — | features/search/ |
| **Tier 5** | | |
| missions + quests | features/missions/ | features/missions/ |
| achievements | features/achievements/ | features/achievements/ |
| prestige | features/prestige/ | — |
| battle-pass | features/battle-pass/ | features/battle-pass/ |
| seasons | — | features/seasons/ |
| mentor | features/mentor/ | features/mentor/ |
| **Tier 6** | | |
| events | features/events/ | features/events/ |
| cosmetics | features/cosmetics/ | features/cosmetics/ |
| giveaways | features/giveaways/ | features/giveaways/ |
| **Tier 7** | | |
| factions | features/factions/ | features/factions/ |
| guilds | features/guilds/ | features/guilds/ |
| business | features/business/ | features/business/ |
| districts | features/districts/ | features/districts/ |
| travel | features/travel/ | features/travel/ |
| city + world | features/city/ | features/city/ |
| **Tier 8** | | |
| gangs | features/gangs/ | features/gangs/ |
| **Tier 9** | | |
| vanta AI | features/vanta/ | features/vanta/ |
| **Tier 10** | | |
| referrals | features/referrals/ | features/referrals/ |
| subscriptions | features/subscriptions/ | features/subscriptions/ |
| platform codes | — | features/platform/ |
| **Tier 11** | | |
| telegram | features/integrations/telegram/ | features/integrations/telegram/ |
| discord | features/integrations/discord/ | features/integrations/discord/ |
| push notifications | shared/ | features/notifications/push/ |
| onboarding | features/onboarding/ | features/onboarding/ |
| **Tier 12** | | |
| owner panel | features/admin/owner/ | features/admin/owner/ |
| staff portal | features/admin/staff/ | features/admin/staff/ |
| ban system | — | features/admin/bans/ |
| audit + economy log | — | features/admin/audit/ |
| dev tools | features/admin/dev/ | features/admin/dev/ |
| migration admin | — | features/admin/migration/ |
| game config | — | features/admin/config/ |
| **Tier 13** | | |
| royale (frozen) | features/royale/ | — |
| settings | features/settings/ | features/settings/ |
| connections | features/connections/ | — |
| profile | features/profile/ | features/profile/ |
| support | features/support/ | features/support/ |
| legal | features/legal/ | — |
| dashboard | features/dashboard/ | — |
| auth | features/auth/ | features/auth/ |
| **Permanent — never move** | | |
| shared hooks | shared/hooks/ | — |
| shared context | shared/context/ → features/auth/context/ | — |
| shared components | shared/components/ | — |
| shared lib | shared/ (api, utils, format, theme, types…) | — |
| core models | — | models/User.ts, models/Item.ts |
| server infra | — | lib/db, cors, keepAlive, schemas, avatar, logger |
| workspace packages | — | lib/ (root — never touch) |
