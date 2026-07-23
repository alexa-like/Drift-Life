# Neonoir — Full Game Restructuring Plan
## Feature-First Architecture Migration — Deep-Audited Edition v3

> **Last verified:** Every single source file in the codebase was cross-referenced against
> this plan. Import graphs were traced for every `lib/` file. Nothing is unaccounted for.

---

## HOW TO USE THIS FILE

This file contains one prompt per tier. Each tier is a **separate chat session**.
**Start a new chat, paste the tier prompt, and the agent will execute that tier only.**
Complete each tier fully and verify the app still builds and runs before starting the next one.

**Order is strict — never skip tiers. Each tier depends on the one before it.**

---

## VERIFIED FILE COUNTS

| Area | Count |
|---|---|
| Frontend pages | 54 |
| Frontend components (custom, non-ui) | 41 |
| Frontend UI components (shadcn) | 55 |
| Frontend hooks | 7 |
| Frontend lib files | 7 |
| Frontend context files | 2 |
| Frontend root src files | 4 (App.tsx, main.tsx, index.css, theme.ts) |
| Backend routes | 67 |
| Backend models | 57 |
| Backend lib/utilities | 47 |
| Backend middlewares | 3 |
| Backend seeds | 2 |
| Backend jobs | 1 |
| Root workspace libs (lib/) | ~120 files |

---

## PERMANENT RULES FOR EVERY TIER

1. Read `replit.md` fully — follow every rule without exception
2. Read `NEONOIR_MASTER_PLAN.md` to understand what each feature does
3. Read `artifacts/neonoir/ARCHITECTURE.md` (created in Tier 0) before any feature work
4. One feature at a time — build and verify before moving to the next
5. `pnpm run build` from workspace root must pass with zero errors before finishing
6. Never move a file listed under **NEVER MOVE** in this document
7. Never touch the root `lib/` packages — they are generated/managed separately
8. Never touch `scripts/` — it contains Replit post-merge infrastructure
9. `Junks/` folder — leave it alone, it contains old audit reports

---

## ══════════════════════════════════════════════
## THINGS THAT NEVER MOVE — READ THIS FIRST
## ══════════════════════════════════════════════

All files below stay permanently where they are. Every feature imports **from** them.
Moving them would require updating 3–83 import paths and breaks the architecture.

---

### A — ROOT WORKSPACE PACKAGES
These live in `lib/` at the project root. They are generated — do not restructure or edit.
| Package | What it is |
|---|---|
| `lib/api-client-react/` | Auto-generated React API client (from OpenAPI spec) |
| `lib/api-spec/` | OpenAPI specification + orval config |
| `lib/api-zod/` | Auto-generated Zod validation types |
| `lib/db/` | Drizzle + PostgreSQL setup (separate from MongoDB) |

---

### B — BACKEND: PURE INFRASTRUCTURE
These files have no game logic — they are server plumbing.
| File | Why it never moves |
|---|---|
| `lib/db.ts` | MongoDB connection — imported by almost every model |
| `lib/cors.ts` | CORS config — used by app.ts |
| `lib/keepAlive.ts` | Server ping — used by index.ts and vanta routes |
| `lib/logger.ts` | Logging — used everywhere |
| `lib/logBuffer.ts` | Log buffering — used with logger |
| `lib/schemas.ts` | Shared validation schemas — used by 8+ route files |
| `lib/avatar.ts` | Avatar generation — used by 11 different route files |
| `middlewares/auth.ts` | JWT auth — every protected route uses it |
| `middlewares/banGate.ts` | Ban check — applied globally |
| `middlewares/validate.ts` | Request validation — used by many routes |
| `routes/health.ts` | Health check endpoint |
| `routes/index.ts` | Route registry — stays but gets one new import per tier |
| `app.ts` | Express app setup |
| `index.ts` | Server entry point |

---

### C — BACKEND: SHARED GAME SERVICES
**CRITICAL — these lib/ files look like they belong to one feature but they don't.**
**Every one of these is imported by 3 or more different features.**
**Moving them into a feature folder creates circular cross-feature dependencies.**

| File | Who imports it (verified) | Wrong plan assumption |
|---|---|---|
| `lib/jwt.ts` | `middlewares/auth.ts`, `middlewares/banGate.ts`, `index.ts`, auth, vanta-ai | "move to features/auth/" — WRONG, middlewares are permanent infrastructure |
| `lib/notifyUser.ts` | 14 files: battlePassXp, mentorBonus, onboardingHelper, referralReward, warScoring, battle-pass, gang-wars, hacking, jobs, market, mentor, npcStores, seasons, trade | "move to features/notifications/" — WRONG |
| `lib/systemFeed.ts` | 11 files: banRecap, leaderboardHighlights, onboardingHelper, referralReward, warScoring, auction, crimes, gang-wars, hacking, leaderboard, user | "move to features/feed/" — WRONG |
| `lib/eventEngine.ts` | `index.ts` (startup) + arena, crimes, events, owner, race, vanta-ai | "move to features/events/" — WRONG, index.ts is permanent |
| `lib/regen.ts` | auth, daily, districts, energy, jobs, profile, user — 7 routes | "move to features/energy/" — WRONG |
| `lib/atomicRegen.ts` | city, crimes, districts, gym, jobs, net — 6 routes | "move to features/energy/" — WRONG |
| `lib/subscription.ts` | chat, crimes, store, telegram — 4 routes | "move to features/subscriptions/" — WRONG |
| `lib/economyLog.ts` | onboardingHelper, referralReward, arena, auction, crimes, jobs, market, npcStores — 8 files | "move to features/admin/audit/" — WRONG |
| `lib/battlePassXp.ts` | arena, crimes, quests, race — 4 routes | "move to features/battle-pass/" — WRONG |
| `lib/employeePerks.ts` | crimes, gym, jobs, net — 4 routes | "move to features/business/" — WRONG |
| `lib/dangerRoll.ts` | `middlewares/auth.ts` — permanent infrastructure! | "move to features/city/" — WRONG |
| `lib/groq.ts` | player-vanta, telegram, vanta-ai — 3 routes | "move to features/vanta/ if exclusive" — NOT exclusive |
| `lib/feedEvents.ts` | arena, bounties, owner — 3 routes | "move to features/feed/" — WRONG |
| `lib/missionEvents.ts` | arena, daily, missions, race — 4 routes | "move to features/missions/" — WRONG |
| `lib/mentorBonus.ts` | arena, city, crimes, daily, jobs — 5 routes | "move to features/mentor/" — WRONG |
| `lib/questProgress.ts` | arena, crimes, quests, race — 4 routes | "move to features/missions/" — WRONG |
| `lib/arenaItemSeed.ts` | `lib/db.ts` and `lib/seed.ts` — permanent infra files! | "move to features/arena/" — WRONG |
| `lib/referralReward.ts` | `models/User.ts` (permanent model!), auth.ts, onboardingHelper.ts, referral.ts | "move to features/referrals/" — WRONG, User.ts imports it |
| `lib/telegram.ts` | `index.ts` (startup) + 11 other files across 8+ features | "move to features/integrations/telegram/" — WRONG, used everywhere |
| `lib/discord.ts` | `index.ts` (startup), discord routes, routes/index.ts, platform — startup infrastructure | "move to features/integrations/discord/" — WRONG, index.ts imports it |
| `lib/gameConfig.ts` | crimes, jobs, owner, vanta-ai — 4 different features | "move to features/admin/config/" — WRONG |
| `lib/leaderboardHighlights.ts` | arena, race — 2 routes (cross-feature) | "move to features/leaderboard/" — WRONG |
| `lib/vanta.ts` | `routes/auth.ts` + `routes/chat.ts` — 2 different features | "move to features/vanta/ if exclusive" — NOT exclusive |
| `lib/onboardingHelper.ts` | `routes/crimes.ts` + `routes/jobs.ts` — called from Tier 1 features | "move to features/onboarding/" — WRONG |
| `lib/platformCodes.ts` | discord, platform, telegram routes — 3 different features | "move to features/platform/" — WRONG |
| `lib/warScoring.ts` | `index.ts` (startup) + arena, crimes, gang-wars — 4 files | "move to features/gangs/wars/" — WRONG, index.ts + cross-feature |
| `lib/webPush.ts` | `lib/eventEngine.ts` + `lib/notifyUser.ts` + events, notifications routes | "move to features/notifications/push/" — WRONG, permanent lib files import it |
| `lib/sendPushToUser.ts` | `lib/eventEngine.ts` + `lib/mentions.ts` + auction, bounties, chat | "move to features/notifications/push/" — WRONG, permanent lib files import it |

**The rule: if a lib/ file is imported by files from 2+ different features, it stays in lib/.**

**`lib/travelHelper.ts` — ZERO import callers found in the entire codebase.**
It may be dead code. In every tier, do NOT move it. Before Tier 7, verify it is truly
unused with `grep -rn "travelHelper" artifacts/api-server/src --include="*.ts"`.
If still zero results: note it as dead code in ARCHITECTURE.md but leave it in lib/.

---

### D — BACKEND: SHARED MODELS
These models are imported by so many features they cannot belong to any one of them.
| Model | Why it never moves |
|---|---|
| `models/User.ts` | Imported by **83 files** — the core player model |
| `models/Item.ts` | Imported by **15 files** — the core item/inventory model |
| `models/PlayerLoadout.ts` | Used by arena.ts, loadout.ts, AND owner.ts — 3 different features |

---

### E — FRONTEND: PERMANENT ROOT FILES
These stay at `artifacts/neonoir/src/` root, unchanged.
| File | Why it never moves |
|---|---|
| `App.tsx` | App shell — updated in Tier 0 to use registry.ts but stays at src/App.tsx |
| `main.tsx` | Entry point — never moves |
| `index.css` | Global styles — never moves |
| `theme.ts` | Moved to `shared/theme.ts` in Tier 0, then never moves again |

---

### F — FRONTEND: PERMANENT NAVIGATION INFRASTRUCTURE
These components are updated (to read from registry.ts in Tier 0) but never moved to a feature.
| File | Why it stays in `components/` |
|---|---|
| `components/NavBar.tsx` | Navigation shell — reads from registry.ts, stays as layout infrastructure |
| `components/BottomNav.tsx` | Mobile nav shell — reads from registry.ts, stays as layout infrastructure |

---

### G — FRONTEND: PERMANENT UI LIBRARY
**Not mentioned in feature tiers at all — they stay permanently in `components/ui/`.**
The 55 shadcn/ui components (`button.tsx`, `dialog.tsx`, `input.tsx`, etc.) live in
`components/ui/` and are never moved. They are a library layer, not feature code.
No tier touches them.

---

## ══════════════════════════════════════════════
## FROZEN FEATURES
## ══════════════════════════════════════════════

The **Royale** system is frozen (disabled in nav, commented out of routing).
Its code still exists and is still **imported by active pages** — it cannot simply be deleted.
It is organized in Tier 13 but is **NOT registered** in registry.ts or nav.

Files:
- Frontend: `RoyaleItemCard.tsx` → `features/royale/components/RoyaleItemCard.tsx`
  Active importers: GaragePage, MissionsPage, NpcStorePage, OwnerPage, StorePage, CardArt.tsx
  → All those pages must update their import path to the new location.
- Backend models: `RoyaleItem.ts`, `PlayerRoyaleLog.ts` → `features/royale/models/`
- Backend lib: `lib/royaleSeed.ts` → `features/admin/config/lib/royaleSeed.ts`
  (royaleSeed is only used by admin seed/config — it can move there)

---

## ══════════════════════════════════════════════
## TIER OVERVIEW
## ══════════════════════════════════════════════

| Tier | Name | What moves |
|---|---|---|
| 0 | Foundation | Shared folder, hooks, wiring layer, Hospital example |
| 1 | Simple actions | Crimes, Jobs, Hospital, Daily, Training, Energy |
| 2 | Game & combat | Arena, Race, Garage/Mini-games, Hack, Cyber, Net |
| 3 | Economy & trading | Bank, Market, Shop, Inventory, Loadout, Auction, Trade, Bounties |
| 4 | Social & community | Feed, Chat, Friends, Leaderboard, Notifications, Reports, Search |
| 5 | Progression | Missions/Quests, Achievements, Prestige, Battle Pass, Seasons, Mentor |
| 6 | Events & cosmetics | Events, Cosmetics, Giveaways |
| 7 | Organizations & world | Factions, Guilds, Business, Districts, Travel, City/World |
| 8 | Gang system | Wars, Crimes, Upgrades |
| 9 | Vanta AI | Panel, AI routes, player vanta, admin vanta |
| 10 | Referrals, subscriptions & payments | Referral, Subscriptions, Platform codes |
| 11 | Integrations & notifications | Onboarding, Push notifications |
| 12 | Admin, staff & moderation | Owner, Staff, Bans, Audit, Dev tools, Config |
| 13 | Core + frozen | Auth, Profile, Dashboard, Settings, Support, Legal, Royale |

---
---

## TIER 0 — FOUNDATION
### Paste this prompt to start Tier 0

```
Read GAME_RESTRUCTURING.md fully — especially the THINGS THAT NEVER MOVE section.
Read NEONOIR_MASTER_PLAN.md and replit.md before doing anything.

Your job is Tier 0: lay the foundation. No features are moved yet.
You are only creating shared infrastructure and wiring patterns that every future tier follows.

---

WHAT TO BUILD:

1. SHARED FRONTEND FOLDER — create artifacts/neonoir/src/shared/

a) shared/theme.ts
Move and expand the existing src/theme.ts.
Export: DL (all colors), GLOWS (glow effects), Z_INDEX scale.
Single source of truth — no component may hardcode a hex color.

b) shared/api.ts
Move src/lib/api.ts here. Update all 67 import paths across the codebase.

c) shared/utils.ts
Move src/lib/utils.ts here. Update all 58 import paths.

d) shared/format.ts
Move src/lib/format.ts here. Update all 20 import paths.

e) shared/currency.ts
Create new file. Export:
- formatDC(n: number): string
- formatNC(n: number): string
- formatCurrency(n: number, type: string): string
- CURRENCY_LABELS: Record<string, string>
- CURRENCY_COLORS: Record<string, string>   ← import colors from shared/theme.ts

f) shared/types.ts
Move src/lib/types.ts here. Update all import paths.

g) shared/avatar.ts
Move src/lib/avatar.ts here. Update all import paths.

h) shared/animTicker.ts
Move src/lib/animTicker.ts here. Update all import paths.

i) shared/pushNotifications.ts
Move src/lib/pushNotifications.ts here. Update all import paths.

j) shared/hooks/
Move ALL 7 hook files from src/hooks/ into shared/hooks/:
- useAuth.ts         ← will move again to features/auth/ in Tier 13
- useConnectivity.ts
- use-mobile.tsx
- useSwipe.ts
- useUpdateCheck.ts
- use-toast.ts
- useToast.ts
Update all import paths.

k) shared/context/
Move both context files here for now (will move to features/auth/ in Tier 13):
- PreferencesContext.tsx
- SocketContext.tsx
Update all import paths.

l) shared/components/
Move these cross-feature components (used by many different pages):
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
- not-found.tsx
Update all import paths.

2. ROUTE REGISTRY
Create artifacts/neonoir/src/registry.ts.
Single source of truth for every page in the game.

Each entry shape:
{
  id: string,
  label: string,
  icon: LucideIcon,
  component: lazy(() => import(...)),
  nav: boolean,
  bottomNav: boolean,
  roles?: string[],
  minStage?: number,
  statusFilter?: "normal" | "normal|abroad" | "abroad",
  group?: string,
}

Migrate ALL entries from:
- The NAV array in NavBar.tsx
- The ITEMS array in BottomNav.tsx
- All lazy imports and every case in renderPage() in App.tsx

Update App.tsx, NavBar.tsx, BottomNav.tsx to read from registry.ts.
NavBar.tsx and BottomNav.tsx stay in components/ — do NOT move them.
App.tsx stays at src/App.tsx — do NOT move it.

3. FEATURES FOLDER + ONE EXAMPLE
Create artifacts/neonoir/src/features/.
Migrate Hospital as the example:
Frontend: features/hospital/pages/HospitalPage.tsx
Registry: update to point to new location.
Backend: artifacts/api-server/src/features/hospital/routes.ts (from routes/hospital.ts)
Update artifacts/api-server/src/routes/index.ts to import from features/hospital/routes.ts.

4. ARCHITECTURE.md
Create artifacts/neonoir/ARCHITECTURE.md documenting:
- Full folder structure
- How to add a new feature (step by step)
- How to add a page to nav (one line in registry.ts)
- Where shared things live and their import paths
- The NEVER MOVE list with reasons
- Rules: no hardcoded hex, no inline currency formatting, no hardcoded image paths

---

DO NOT MOVE (from NEVER MOVE section):
Backend lib/: db.ts, cors.ts, keepAlive.ts, logger.ts, logBuffer.ts, schemas.ts,
              avatar.ts, jwt.ts, notifyUser.ts, systemFeed.ts, eventEngine.ts,
              regen.ts, atomicRegen.ts, subscription.ts, economyLog.ts,
              battlePassXp.ts, employeePerks.ts, dangerRoll.ts, groq.ts,
              feedEvents.ts, missionEvents.ts, mentorBonus.ts, questProgress.ts,
              arenaItemSeed.ts, referralReward.ts, telegram.ts, discord.ts,
              gameConfig.ts, leaderboardHighlights.ts, vanta.ts, onboardingHelper.ts,
              platformCodes.ts, warScoring.ts, webPush.ts, sendPushToUser.ts
Backend models/: User.ts, Item.ts, PlayerLoadout.ts
Backend: middlewares/, routes/health.ts, routes/index.ts, app.ts, index.ts
Frontend: components/NavBar.tsx, components/BottomNav.tsx, App.tsx, main.tsx, index.css
Frontend: components/ui/ (all 55 shadcn files — never touch)
Root: lib/ (all workspace packages)

VERIFY before finishing:
- pnpm run build from workspace root — zero errors
- App starts and all pages are reachable
- Hospital page works as the example migrated feature
```

---
---

## TIER 1 — SIMPLE ACTION FEATURES
### Paste this prompt to start Tier 1

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tier 0 is complete. Your job is Tier 1: migrate simple standalone action features.
One feature at a time. Verify build after each.

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

3. hospital — already done in Tier 0, skip.

4. daily
   Frontend: features/daily/pages/DailyPage.tsx
   Backend:
   - features/daily/routes.ts ← from routes/daily.ts

5. training (merge gym into training)
   Frontend: features/training/pages/TrainingCenterPage.tsx
   Backend:
   - features/training/routes.ts ← merge routes/training.ts + routes/gym.ts into one file
   - features/training/models/ActionMastery.ts ← from models/ActionMastery.ts

6. energy (backend only — no frontend page)
   Backend:
   - features/energy/routes.ts ← from routes/energy.ts
   NOTE: regen.ts and atomicRegen.ts are used by 6–7 other features — they DO NOT move.
   They stay in lib/ permanently. features/energy/routes.ts imports from lib/regen.ts
   and lib/atomicRegen.ts as normal.

---

FOR EACH FEATURE:
Frontend: move page → features/<name>/pages/, move feature-only components →
features/<name>/components/, update registry.ts, fix all imports.
Backend: move routes → features/<name>/routes.ts, move feature-only models →
features/<name>/models/, update routes/index.ts.

DO NOT MOVE: User.ts, Item.ts, PlayerLoadout.ts, regen.ts, atomicRegen.ts,
economyLog.ts, battlePassXp.ts, employeePerks.ts, missionEvents.ts,
questProgress.ts, mentorBonus.ts, systemFeed.ts, notifyUser.ts, subscription.ts,
onboardingHelper.ts, warScoring.ts, webPush.ts, sendPushToUser.ts,
db.ts, cors.ts, schemas.ts, avatar.ts, jwt.ts, logger.ts, logBuffer.ts
```

---
---

## TIER 2 — GAME & COMBAT FEATURES
### Paste this prompt to start Tier 2

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–1 are complete. Your job is Tier 2: game and combat features.

---

FEATURES TO MIGRATE:

1. arena
   Frontend:
   features/arena/
     hub/pages/ArenaHubPage.tsx
     combat/pages/ArenaCombatPage.tsx
     components/MatchResultModal.tsx   ← only used by ArenaCombatPage
   Backend:
   - features/arena/routes.ts ← from routes/arena.ts
   - features/arena/models/CombatMatch.ts ← from models/CombatMatch.ts
   NOTE: arenaItemSeed.ts is imported by lib/db.ts and lib/seed.ts — it STAYS in lib/.
   features/arena/routes.ts imports from lib/arenaItemSeed.ts as normal.
   NOTE: arena routes also import battlePassXp, missionEvents, feedEvents,
   questProgress, mentorBonus, leaderboardHighlights — ALL stay in lib/.

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

DO NOT MOVE (shared game services): arenaItemSeed.ts, battlePassXp.ts,
missionEvents.ts, feedEvents.ts, questProgress.ts, mentorBonus.ts,
leaderboardHighlights.ts, notifyUser.ts, systemFeed.ts, economyLog.ts,
regen.ts, atomicRegen.ts, subscription.ts, groq.ts, gameConfig.ts,
vanta.ts, onboardingHelper.ts, warScoring.ts, webPush.ts, sendPushToUser.ts,
platformCodes.ts, User.ts, Item.ts, PlayerLoadout.ts
```

---
---

## TIER 3 — ECONOMY & TRADING
### Paste this prompt to start Tier 3

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–2 are complete. Your job is Tier 3: economy and trading features.

IMPORTANT: PlayerLoadout.ts is used by arena, loadout, AND owner — it STAYS
as a shared model in models/PlayerLoadout.ts. Do NOT move it into any feature.
All currency formatting must use shared/currency.ts.

---

FEATURES TO MIGRATE:

1. bank
   Frontend: features/bank/pages/BankPage.tsx
   Backend:
   - features/bank/routes.ts ← from routes/bank.ts

2. market
   Frontend: features/market/pages/MarketPage.tsx
   Backend:
   - features/market/routes.ts ← from routes/market.ts
   - features/market/models/BlackMarketListing.ts ← from models/BlackMarketListing.ts
   - features/market/models/DarkListing.ts ← from models/DarkListing.ts
   - features/market/models/PriceOverride.ts ← from models/PriceOverride.ts
   NOTE: economyLog.ts is cross-feature — stays in lib/. market routes import it from there.

3. shop (NPC stores)
   Frontend:
   features/shop/
     hub/pages/ShopHubPage.tsx
     npc/pages/NpcStorePage.tsx
   Backend:
   - features/shop/routes.ts ← from routes/npcStores.ts
   - features/shop/models/NpcStoreListing.ts ← from models/NpcStoreListing.ts
   NOTE: NpcStoreListing is ONLY used by npcStores.ts — it goes in features/shop/,
   NOT in features/market/.

4. inventory
   Frontend: features/inventory/pages/InventoryPage.tsx
   Backend:
   - features/inventory/routes.ts ← from routes/inventory.ts

5. loadout
   Frontend: features/loadout/pages/LoadoutPage.tsx
   Backend:
   - features/loadout/routes.ts ← from routes/loadout.ts
   NOTE: PlayerLoadout.ts is shared by arena + loadout + owner — it STAYS
   in models/PlayerLoadout.ts. features/loadout/routes.ts imports from there.

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

8. bounties (backend only)
   Backend:
   - features/bounties/routes.ts ← from routes/bounties.ts
   - features/bounties/models/Bounty.ts ← from models/Bounty.ts

DO NOT MOVE: User.ts, Item.ts, PlayerLoadout.ts, economyLog.ts, systemFeed.ts,
notifyUser.ts, subscription.ts, feedEvents.ts, mentorBonus.ts, battlePassXp.ts,
warScoring.ts, webPush.ts, sendPushToUser.ts, onboardingHelper.ts
```

---
---

## TIER 4 — SOCIAL & COMMUNITY
### Paste this prompt to start Tier 4

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–3 are complete. Your job is Tier 4: social and community features.

IMPORTANT: PlayerInspectModal lives in shared/components/ — never move it.
systemFeed.ts is used by 11 files across features — it stays in lib/ permanently.
feedEvents.ts is used by arena, bounties, and owner — stays in lib/ permanently.
notifyUser.ts is used by 14 files — stays in lib/ permanently.

---

FEATURES TO MIGRATE:

1. feed
   Frontend: features/feed/pages/FeedPage.tsx
   Backend:
   - features/feed/routes.ts ← from routes/feed.ts
   - features/feed/models/FeedEvent.ts ← from models/FeedEvent.ts
   NOTE: feedEvents.ts and systemFeed.ts are cross-feature — BOTH stay in lib/.
   features/feed/routes.ts imports them from lib/ as normal.

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
   - features/chat/lib/chatMod.ts ← from lib/chatMod.ts    (chat-only ✓)
   - features/chat/lib/mentions.ts ← from lib/mentions.ts  (chat-only ✓)
   NOTE: subscription.ts is cross-feature (chat checks subscription) — stays in lib/.

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
   - features/leaderboard/routes.ts ← merge routes/leaderboard.ts + routes/mini-leaderboard.ts
                                         + routes/match-history.ts
   NOTE: leaderboardHighlights.ts is used by arena and race too — stays in lib/.

5. notifications
   Frontend: features/notifications/pages/NotificationsPage.tsx
   Backend:
   - features/notifications/routes.ts ← from routes/notifications.ts
   - features/notifications/models/Notification.ts ← from models/Notification.ts
   NOTE: notifyUser.ts is used by 14 files — stays in lib/. This feature's routes
   import from lib/notifyUser.ts as normal.

6. reports
   Frontend:
   features/reports/
     components/ReportPlayerModal.tsx
   Backend:
   - features/reports/routes.ts ← from routes/reports.ts
   - features/reports/models/PlayerReport.ts ← from models/PlayerReport.ts

7. search (backend only)
   Backend:
   - features/search/routes.ts ← from routes/search.ts

DO NOT MOVE: User.ts, Item.ts, systemFeed.ts, feedEvents.ts, notifyUser.ts,
subscription.ts, leaderboardHighlights.ts, missionEvents.ts,
vanta.ts, webPush.ts, sendPushToUser.ts, onboardingHelper.ts, platformCodes.ts
```

---
---

## TIER 5 — PROGRESSION & MASTERY
### Paste this prompt to start Tier 5

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–4 are complete. Your job is Tier 5: progression and mastery features.

IMPORTANT: battlePassXp.ts is used by arena, crimes, quests, race — stays in lib/.
questProgress.ts is used by arena, crimes, quests, race — stays in lib/.
missionEvents.ts is used by arena, daily, missions, race — stays in lib/.
mentorBonus.ts is used by arena, city, crimes, daily, jobs — stays in lib/.
These are shared game services and cannot move into any feature folder.

---

FEATURES TO MIGRATE:

1. missions & quests
   Frontend: features/missions/pages/MissionsPage.tsx
   Backend:
   - features/missions/routes.ts ← merge routes/missions.ts + routes/quests.ts
   - features/missions/models/Quest.ts ← from models/Quest.ts
   NOTE: missionEvents.ts and questProgress.ts are cross-feature — stay in lib/.

2. achievements
   Frontend: features/achievements/pages/AchievementsPage.tsx
   Backend:
   - features/achievements/routes.ts ← from routes/achievements.ts
   - features/achievements/models/Achievement.ts ← from models/Achievement.ts

3. prestige (no dedicated page — triggered via modal from other pages)
   Frontend:
   features/prestige/
     components/PrestigeConfirmModal.tsx

4. battle-pass
   Frontend:
   features/battle-pass/
     pages/BattlePassPage.tsx
     components/BattlePassTab.tsx
     components/CosmeticsTab.tsx
   Backend:
   - features/battle-pass/routes.ts ← from routes/battle-pass.ts
   - features/battle-pass/models/BattlePass.ts ← from models/BattlePass.ts
   NOTE: battlePassXp.ts is used by arena + crimes + race — stays in lib/.

5. seasons (backend only)
   Backend:
   - features/seasons/routes.ts ← from routes/seasons.ts

6. mentor
   Frontend: features/mentor/pages/MentorPage.tsx
   Backend:
   - features/mentor/routes.ts ← from routes/mentor.ts
   NOTE: mentorBonus.ts is used by 5 different routes — stays in lib/.

DO NOT MOVE: User.ts, Item.ts, battlePassXp.ts, questProgress.ts,
missionEvents.ts, mentorBonus.ts, notifyUser.ts, systemFeed.ts,
warScoring.ts, webPush.ts, sendPushToUser.ts, onboardingHelper.ts
```

---
---

## TIER 6 — EVENTS & COSMETICS
### Paste this prompt to start Tier 6

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–5 are complete. Your job is Tier 6: events and cosmetics.

IMPORTANT: eventEngine.ts is imported by index.ts (server startup), arena, crimes,
events, owner, race, vanta-ai — it STAYS in lib/ permanently. It is NOT moved
to features/events/. features/events/routes.ts imports it from lib/eventEngine.ts.

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
   NOTE: eventEngine.ts stays in lib/ — cross-feature and used at server startup.

2. cosmetics
   features/cosmetics/
     name-tiers/        ← name tier cosmetic components
     chat-bubbles/      ← chat bubble cosmetic components
     badges/
       components/EmblemBadge.tsx  ← move from shared/components if badge-specific
                                       (check if used outside cosmetics first)
     index.ts
   Backend:
   - features/cosmetics/routes.ts ← from routes/cosmetics.ts
   - features/cosmetics/models/CosmeticItem.ts ← from models/CosmeticItem.ts
   PATTERN: Adding a new cosmetic type = create features/cosmetics/<new-type>/ sub-folder only.

3. giveaways
   Frontend:
   features/giveaways/
     components/CreateGiveawayModal.tsx
     components/GiveawayCard.tsx
   Backend: (locate and move any giveaway-specific routes)

DO NOT MOVE: User.ts, Item.ts, eventEngine.ts, notifyUser.ts, systemFeed.ts,
feedEvents.ts, subscription.ts, warScoring.ts, webPush.ts, sendPushToUser.ts,
vanta.ts, onboardingHelper.ts, platformCodes.ts
```

---
---

## TIER 7 — ORGANIZATIONS & WORLD
### Paste this prompt to start Tier 7

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–6 are complete. Your job is Tier 7: organization and world features.

IMPORTANT:
- dangerRoll.ts is imported by middlewares/auth.ts (permanent infrastructure) —
  it STAYS in lib/ permanently. features/city/ imports it from lib/.
- npcEncounters.ts is used only by routes/districts.ts — it CAN move to features/city/
  since that is the only consumer.
- travelHelper.ts — verify usages before moving. If only travel routes use it, move to
  features/travel/lib/travelHelper.ts. If other routes import it, leave it in lib/.
- employeePerks.ts is used by crimes, gym, jobs, net — STAYS in lib/ permanently.
- businessIncomeWorker.ts is started from index.ts but can still move to features/business/.
  Update index.ts import path after moving.

---

FEATURES TO MIGRATE:

1. factions
   Frontend:
   features/factions/
     pages/FactionPage.tsx
     pages/FactionSelectPage.tsx
   Backend:
   - features/factions/routes.ts ← merge routes/factions.ts + routes/factionBank.ts
   - features/factions/models/Faction.ts ← from models/Faction.ts
   - features/factions/models/FactionBankLog.ts ← from models/FactionBankLog.ts
   - features/factions/models/FactionCrime.ts ← from models/FactionCrime.ts
   NOTE: Faction type displayed in NavBar — ensure type stays in shared/types.ts.

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
     (update index.ts import to new path after moving)
   NOTE: employeePerks.ts is used by 4 different feature routes — STAYS in lib/.

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
   FIRST: check `grep -r "travelHelper" artifacts/api-server/src --include="*.ts" -l`
   If only travel-related routes use it → move to features/travel/lib/travelHelper.ts
   If used by other features → leave in lib/

6. city & world
   Frontend: features/city/pages/CityPage.tsx
   Backend:
   - features/city/routes.ts ← merge routes/city.ts + routes/world.ts
   - features/city/models/WorldState.ts ← from models/WorldState.ts
   - features/city/lib/npcEncounters.ts ← from lib/npcEncounters.ts  (districts-only ✓)
   NOTE: dangerRoll.ts is used by middlewares/auth.ts — STAYS in lib/ permanently.

DO NOT MOVE: User.ts, Item.ts, PlayerLoadout.ts, dangerRoll.ts, employeePerks.ts,
regen.ts, atomicRegen.ts, mentorBonus.ts, notifyUser.ts, systemFeed.ts,
feedEvents.ts, eventEngine.ts, warScoring.ts, webPush.ts, sendPushToUser.ts,
vanta.ts, onboardingHelper.ts, platformCodes.ts
```

---
---

## TIER 8 — GANG SYSTEM
### Paste this prompt to start Tier 8

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–7 are complete. Your job is Tier 8: the gang system.

IMPORTANT: warScoring.ts is only used by gang-wars routes — it CAN move to
features/gangs/wars/lib/warScoring.ts.

---

WHAT TO BUILD:

features/gangs/
  wars/
    routes.ts       ← from routes/gang-wars.ts
    models/GangWar.ts ← from models/GangWar.ts
   NOTE: warScoring.ts is used by index.ts (startup), arena, crimes, AND gang-wars —
   it is NOT exclusive to gangs. warScoring.ts STAYS in lib/ permanently.
  crimes/
    routes.ts       ← from routes/gang-crimes.ts
    models/GangCrime.ts ← from models/GangCrime.ts
  upgrades/
    routes.ts       ← from routes/gang-upgrades.ts
    models/GangUpgrade.ts ← from models/GangUpgrade.ts
  index.ts          ← wires all sub-systems, exports combined router

Backend: Update routes/index.ts to import from features/gangs/index.ts.
Frontend: Gang-related UI currently lives inside faction/city pages.
No dedicated gang page exists yet — no registry entry needed unless you find one.

PATTERN: Adding a new gang sub-system = create features/gangs/<new-system>/ only.

DO NOT MOVE: User.ts, Item.ts, notifyUser.ts, systemFeed.ts, feedEvents.ts,
warScoring.ts, webPush.ts, sendPushToUser.ts, vanta.ts, onboardingHelper.ts,
platformCodes.ts, eventEngine.ts, battlePassXp.ts, questProgress.ts
```

---
---

## TIER 9 — VANTA AI SYSTEM
### Paste this prompt to start Tier 9

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–8 are complete. Your job is Tier 9: the Vanta AI system.

IMPORTANT:
- groq.ts is used by player-vanta, telegram, AND vanta-ai routes — it is NOT exclusive
  to vanta. groq.ts STAYS in lib/ permanently.
- telegram.ts (lib) is used by index.ts startup + 11 other files across 8+ features —
  it STAYS in lib/ permanently.
- vanta.ts (lib) — verify usages first. If ONLY used by vanta routes, it can move.
  Check: grep -r "from.*\/vanta\b" artifacts/api-server/src --include="*.ts" -l

---

WHAT TO BUILD:

features/vanta/
  panel/
    components/PlayerVantaPanel.tsx ← from src/components/PlayerVantaPanel.tsx
  ai/
    routes.ts     ← from routes/vanta-ai.ts
  player/
    routes.ts     ← from routes/player-vanta.ts
    models/VantaLog.ts ← from models/VantaLog.ts
    models/VantaAISession.ts ← from models/VantaAISession.ts
  admin/
    routes.ts     ← from routes/vanta.ts
    models/VantaScheduledTask.ts ← from models/VantaScheduledTask.ts
  index.ts        ← wires all vanta sub-systems
   NOTE: lib/vanta.ts is imported by routes/auth.ts AND routes/chat.ts — it is NOT
   exclusive to vanta. lib/vanta.ts STAYS in lib/ permanently.
   features/vanta/routes import from lib/vanta.ts as normal.

Frontend: PlayerVantaPanel is rendered globally in App.tsx.
Update that import to features/vanta/panel/components/PlayerVantaPanel.tsx.

Backend: Update routes/index.ts to import from features/vanta/index.ts.

DO NOT MOVE: groq.ts, telegram.ts, discord.ts, vanta.ts (auth + chat use it),
User.ts, jwt.ts, keepAlive.ts, webPush.ts, sendPushToUser.ts, notifyUser.ts,
systemFeed.ts, eventEngine.ts, platformCodes.ts, onboardingHelper.ts
```

---
---

## TIER 10 — REFERRALS, SUBSCRIPTIONS & PAYMENTS
### Paste this prompt to start Tier 10

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–9 are complete. Your job is Tier 10: referrals, subscriptions, payments.

IMPORTANT:
- referralReward.ts is imported by models/User.ts (!) and auth.ts, onboardingHelper.ts,
  referral.ts — it STAYS in lib/ permanently. features/referrals/routes.ts imports it
  from lib/ as normal.
- subscription.ts is used by chat, crimes, store, telegram — STAYS in lib/ permanently.
- telegram.ts (lib) STAYS in lib/ permanently — used by index.ts and many features.

---

FEATURES TO MIGRATE:

1. referrals
   Backend:
   - features/referrals/routes.ts ← from routes/referral.ts
   NOTE: referralReward.ts stays in lib/ — used by User.ts model and multiple routes.
   Frontend: Referral UI appears in profile/onboarding — update those imports if needed.

2. subscriptions & premium store
   Frontend: features/subscriptions/pages/StorePage.tsx
   Backend:
   - features/subscriptions/routes.ts ← from routes/store.ts
   - features/subscriptions/models/UcPurchaseLog.ts ← from models/UcPurchaseLog.ts
   - features/subscriptions/models/TelegramPayment.ts ← from models/TelegramPayment.ts
   NOTE: subscription.ts is cross-feature — stays in lib/.

3. platform codes
   Backend:
   - features/platform/routes.ts ← from routes/platform.ts
   NOTE: platformCodes.ts is used by discord, platform, AND telegram routes — it is NOT
   exclusive to platform. platformCodes.ts STAYS in lib/ permanently.
   features/platform/routes.ts imports from lib/platformCodes.ts as normal.

DO NOT MOVE: User.ts, Item.ts, referralReward.ts, subscription.ts, telegram.ts,
discord.ts, notifyUser.ts, economyLog.ts, platformCodes.ts,
webPush.ts, sendPushToUser.ts, onboardingHelper.ts
```

---
---

## TIER 11 — INTEGRATIONS & NOTIFICATIONS
### Paste this prompt to start Tier 11

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–10 are complete. Your job is Tier 11: onboarding and push notifications.

CRITICAL SCOPE CHANGE FROM ORIGINAL PLAN:
lib/telegram.ts and lib/discord.ts CANNOT be moved into integration feature folders.
- telegram.ts is imported by index.ts (startup) + 11 other files across 8+ features.
- discord.ts is imported by index.ts (startup) + routes/index.ts + platform routes.
Both are shared game services and stay in lib/ permanently.

The integrations sub-folder pattern (features/integrations/telegram/,
features/integrations/discord/) is therefore NOT USED for lib files.
Only route files move into feature folders:
- routes/telegram.ts → features/integrations/telegram/routes.ts
- routes/discord.ts → features/integrations/discord/routes.ts
These routes import lib/telegram.ts and lib/discord.ts from lib/ as normal.

---

FEATURES TO MIGRATE:

1. telegram integration (ROUTES ONLY — lib stays)
   features/integrations/telegram/
     routes.ts ← from routes/telegram.ts
     (NO lib files move here — lib/telegram.ts stays in lib/)

2. discord integration (ROUTES ONLY — lib stays)
   features/integrations/discord/
     routes.ts ← from routes/discord.ts
     (NO lib files move here — lib/discord.ts stays in lib/)

3. push notifications
   features/notifications/push/
     models/PushSubscription.ts ← from models/PushSubscription.ts
   NOTE: webPush.ts is imported by lib/eventEngine.ts and lib/notifyUser.ts (permanent
   lib files) → webPush.ts STAYS in lib/ permanently.
   NOTE: sendPushToUser.ts is imported by lib/eventEngine.ts and lib/mentions.ts
   (permanent lib files) → sendPushToUser.ts STAYS in lib/ permanently.
   NOTE: shared/pushNotifications.ts (frontend) was already moved in Tier 0.
   NOTE: notifyUser.ts stays in lib/ — it's cross-feature.

4. onboarding
   Frontend:
   features/onboarding/
     components/OnboardingModal.tsx
   NOTE: onboardingHelper.ts is imported by routes/crimes.ts AND routes/jobs.ts
   (Tier 1 features) → onboardingHelper.ts STAYS in lib/ permanently.
   features/onboarding/ has no backend lib of its own; it imports from lib/onboardingHelper.ts.

VERIFY: Telegram linking, discord linking, push subscription, onboarding modal.

DO NOT MOVE: telegram.ts, discord.ts, notifyUser.ts, referralReward.ts,
systemFeed.ts, economyLog.ts, webPush.ts, sendPushToUser.ts, onboardingHelper.ts,
platformCodes.ts, vanta.ts, warScoring.ts, User.ts
```

---
---

## TIER 12 — ADMIN, STAFF & MODERATION
### Paste this prompt to start Tier 12

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–11 are complete. Your job is Tier 12: admin, staff, and moderation.

IMPORTANT:
- gameConfig.ts is used by crimes, jobs, owner, vanta-ai — STAYS in lib/ permanently.
  Admin config routes import it from lib/gameConfig.ts as normal.
- economyLog.ts is used by 8+ feature routes — STAYS in lib/ permanently.
- systemFeed.ts is used by 11 files — STAYS in lib/ permanently.
- logger.ts and logBuffer.ts STAY in lib/ permanently — pure infrastructure.
- staffTiers.ts — only used by staffEarningsWorker + owner routes.
  It CAN move to features/admin/staff/lib/staffTiers.ts.

---

FEATURES TO MIGRATE:

1. owner panel
   features/admin/owner/
     pages/OwnerPage.tsx
     routes.ts ← from routes/owner.ts
     lib/ownerIpAllowlist.ts ← from lib/ownerIpAllowlist.ts  (owner-only ✓)

2. staff portal
   features/admin/staff/
     pages/StaffPortalPage.tsx
     lib/staffTiers.ts ← from lib/staffTiers.ts  (staff/owner only ✓)
     lib/staffEarningsWorker.ts ← from lib/staffEarningsWorker.ts

3. ban system
   features/admin/bans/
     routes.ts ← from routes/ban-appeal.ts
     models/BanAppeal.ts ← from models/BanAppeal.ts
     lib/banRecap.ts ← from lib/banRecap.ts  (only used by index.ts startup — update that import)

4. audit & economy logging
   features/admin/audit/
     models/AdminAuditLog.ts ← from models/AdminAuditLog.ts
     models/EconomyLog.ts ← from models/EconomyLog.ts
   NOTE: lib/economyLog.ts STAYS in lib/ — used by 8+ features. The model moves,
   the lib helper does NOT.

5. dev tools
   features/admin/dev/
     components/DevToolbar.tsx
     routes.ts ← from routes/dev.ts

6. migration admin
   features/admin/migration/
     routes.ts ← from routes/migration-admin.ts
     jobs/migration.ts ← from jobs/migration.ts

7. game config & seed
   features/admin/config/
     routes.ts ← (config management endpoints from owner routes, if any)
     models/GameConfig.ts ← from models/GameConfig.ts
     models/ServerConfig.ts ← from models/ServerConfig.ts
     lib/royaleSeed.ts ← from lib/royaleSeed.ts  (admin seed for frozen royale system)
     lib/seed.ts ← from lib/seed.ts  (verify: only used from admin/startup context)
   NOTE: lib/gameConfig.ts STAYS in lib/ — used by crimes, jobs, owner, vanta-ai.
   The model (GameConfig.ts) moves; the helper (gameConfig.ts) does NOT.

VERIFY: Owner page, staff portal, ban appeal, dev toolbar. All role checks still apply.

DO NOT MOVE: User.ts, Item.ts, PlayerLoadout.ts, gameConfig.ts, economyLog.ts,
systemFeed.ts, logger.ts, logBuffer.ts, keepAlive.ts, schemas.ts, db.ts,
cors.ts, avatar.ts, jwt.ts, middlewares/, notifyUser.ts, eventEngine.ts,
vanta.ts, onboardingHelper.ts, warScoring.ts, webPush.ts, sendPushToUser.ts,
platformCodes.ts, telegram.ts, discord.ts, referralReward.ts, subscription.ts
```

---
---

## TIER 13 — CORE + FROZEN FEATURES (DO THIS LAST)
### Paste this prompt to start Tier 13

```
Read GAME_RESTRUCTURING.md (especially THINGS THAT NEVER MOVE) and
NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md.

Tiers 0–12 are complete. Your job is Tier 13: core app features + frozen Royale.
These are the most critical files. Test after EVERY SINGLE step.

---

PART A — FROZEN ROYALE (do first — it's a dependency for active pages)

Move to features/royale/ but do NOT register in registry.ts or nav.
features/royale/
  components/RoyaleItemCard.tsx ← from src/components/RoyaleItemCard.tsx
  models/RoyaleItem.ts ← from models/RoyaleItem.ts
  models/PlayerRoyaleLog.ts ← from models/PlayerRoyaleLog.ts

Update ALL active pages that import RoyaleItemCard to use the new path:
- pages/GaragePage.tsx (now features/garage/pages/)
- pages/MissionsPage.tsx (now features/missions/pages/)
- pages/NpcStorePage.tsx (now features/shop/npc/pages/)
- pages/OwnerPage.tsx (now features/admin/owner/pages/)
- pages/StorePage.tsx (now features/subscriptions/pages/)
- components/CardArt.tsx (now shared/components/)

---

PART B — CORE FEATURES

2. settings
   Frontend: features/settings/pages/SettingsPage.tsx
   Backend:
   - features/settings/routes.ts ← from routes/settings.ts

3. connections
   Frontend: features/connections/pages/ConnectionsPage.tsx

4. profile
   Frontend: features/profile/pages/ProfilePage.tsx
   Backend:
   - features/profile/routes.ts ← merge routes/profile.ts + routes/user.ts

5. support
   Frontend: features/support/pages/SupportPage.tsx
   Backend:
   - features/support/routes.ts ← from routes/support.ts
   - features/support/models/SupportTicket.ts ← from models/SupportTicket.ts

6. legal
   Frontend: features/legal/pages/LegalPage.tsx

7. dashboard
   Frontend: features/dashboard/pages/Dashboard.tsx

8. auth (most critical — do LAST)
   BEFORE MOVING: Verify build passes with all above changes.
   Frontend:
   features/auth/
     pages/AuthPage.tsx
     hooks/useAuth.ts ← move from shared/hooks/
     context/SocketContext.tsx ← move from shared/context/
     context/PreferencesContext.tsx ← move from shared/context/
   Backend:
   - features/auth/routes.ts ← from routes/auth.ts
   - features/auth/lib/mailer.ts ← from lib/mailer.ts
     (verify mailer is only used by auth routes before moving)
   NOTE: jwt.ts STAYS in lib/ — used by middlewares/auth.ts and middlewares/banGate.ts.
   NOTE: regen.ts STAYS in lib/ — used by auth, daily, districts, jobs, profile, user.
   CRITICAL: App.tsx imports useAuth and context providers. Update those imports carefully.
   CRITICAL: Test login, logout, session persistence before finishing.

---

PART C — FINAL CLEANUP

After all features are migrated:

EXPECTED EMPTY FOLDERS (should be empty or near-empty — delete if empty):
- artifacts/neonoir/src/pages/
- artifacts/neonoir/src/components/ (only NavBar.tsx + BottomNav.tsx should remain)
- artifacts/api-server/src/routes/ (only index.ts + health.ts should remain)
- artifacts/api-server/src/models/ (only User.ts, Item.ts, PlayerLoadout.ts remain)
- artifacts/api-server/src/lib/ (only the "never move" files remain — see list)
- artifacts/api-server/src/jobs/ (empty — migration.ts moved to Tier 12)
- artifacts/api-server/src/seeds/ (empty — both seed files moved to feature folders)

VERIFY the "never move" lib/ files are still in lib/ (nothing accidentally moved):
db.ts, cors.ts, keepAlive.ts, logger.ts, logBuffer.ts, schemas.ts, avatar.ts,
jwt.ts, notifyUser.ts, systemFeed.ts, eventEngine.ts, regen.ts, atomicRegen.ts,
subscription.ts, economyLog.ts, battlePassXp.ts, employeePerks.ts, dangerRoll.ts,
groq.ts, feedEvents.ts, missionEvents.ts, mentorBonus.ts, questProgress.ts,
arenaItemSeed.ts, referralReward.ts, telegram.ts, discord.ts, gameConfig.ts,
leaderboardHighlights.ts

FINAL BUILD:
- pnpm run build from workspace root — zero errors
- Start all workflows — all services start clean
- Test: login, logout, arena combat, chat, market, vanta panel, admin pages, push subscribe

FINAL ARCHITECTURE.md UPDATE:
Confirm documented structure matches what was built. Add sections for:
- How to add a new feature (2 lines in 2 files)
- How to add a new integration (follow integrations/ pattern)
- How to add a new cosmetic type (follow cosmetics/name-tiers pattern)
- How to reactivate the frozen Royale system when ready
- The "shared game services" section — list all lib/ files that stay permanently
```

---
---

## QUICK REFERENCE — Adding a New Feature (After All Tiers Complete)

```
Step 1: Create the feature folder
  artifacts/neonoir/src/features/<feature-name>/
    pages/          ← React pages
    components/     ← components only this feature uses
    index.ts        ← exports the feature's pages

  artifacts/api-server/src/features/<feature-name>/
    routes.ts       ← Express routes
    models/         ← Mongoose models only this feature uses

Step 2: Register it (ONLY two files outside the feature folder)
  artifacts/neonoir/src/registry.ts          ← add 1 entry → auto-wires routing + nav
  artifacts/api-server/src/routes/index.ts   ← add 1 import → API routes go live

That's it. Nothing else to hunt for.

When your feature needs a shared service (notify user, economy log, etc.):
  import { notifyUser } from "../../lib/notifyUser";   ← import from lib/ directly
  Do NOT copy these into your feature folder.
```

---

## COMPLETE FEATURE MAP

| Feature | Frontend | Backend |
|---|---|---|
| **Tier 1** | | |
| crimes | features/crimes/ | features/crimes/ |
| jobs | features/jobs/ | features/jobs/ |
| hospital | features/hospital/ | features/hospital/ |
| daily | features/daily/ | features/daily/ |
| training (+ gym) | features/training/ | features/training/ |
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
| telegram (routes only) | — | features/integrations/telegram/ |
| discord (routes only) | — | features/integrations/discord/ |
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
| **Permanent — NEVER MOVE** | | |
| UI library | components/ui/ (55 files) | — |
| Navigation | components/NavBar.tsx, BottomNav.tsx | — |
| App shell | App.tsx, main.tsx, index.css | — |
| Shared lib | shared/ (api, utils, format, theme…) | — |
| Shared hooks | shared/hooks/ → features/auth/ (Tier 13) | — |
| Shared context | shared/context/ → features/auth/ (Tier 13) | — |
| Shared components | shared/components/ | — |
| Core models | — | models/User.ts, Item.ts, PlayerLoadout.ts |
| Pure infrastructure | — | lib/db, cors, keepAlive, schemas, avatar, logger, logBuffer |
| Shared game services | — | lib/jwt, notifyUser, systemFeed, eventEngine, regen, atomicRegen, subscription, economyLog, battlePassXp, employeePerks, dangerRoll, groq, feedEvents, missionEvents, mentorBonus, questProgress, arenaItemSeed, referralReward, telegram, discord, gameConfig, leaderboardHighlights |
| Workspace packages | — | lib/ (root — never touch) |
