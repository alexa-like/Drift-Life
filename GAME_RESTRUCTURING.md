# Neonoir — Game Restructuring Plan
## Feature-First Architecture Migration

---

## HOW TO USE THIS FILE

This file contains one prompt per tier. Each tier is a separate session.
**Start a new chat, paste the tier prompt, and the agent will execute that tier only.**
Complete each tier fully and verify the app still works before starting the next one.

**Order is strict — do not skip tiers. Each tier depends on the one before it.**

---

## THE GOAL

Move from this (organized by file type — messy):
```
pages/        ← 50+ pages all mixed together
components/   ← all components mixed together
routes/       ← all API routes mixed together
models/       ← all DB models mixed together
```

To this (organized by feature — clean):
```
shared/           ← things every feature uses (theme, common components, currency, images)
features/
  arena/
    shooting/     ← everything for this game only
    racing/       ← everything for this game only
  cosmetics/
    name-tiers/
    chat-bubbles/
  bank/
  crimes/
  ...
```

With a **single wiring layer** — one registry file where every feature is registered once.
Nav, routing, and page loading all read from that registry automatically.

---

---

## TIER 0 — FOUNDATION
### Paste this prompt to start Tier 0

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md before doing anything.

Your job is Tier 0 of the game restructuring plan: lay the foundation. No features are moved yet. You are only setting up the structure and patterns that every future tier will follow.

---

WHAT TO BUILD:

1. SHARED FOLDER
Create `artifacts/neonoir/src/shared/` with:
- `theme.ts` — move and expand the existing `src/theme.ts` here. Export DL (colors) and GLOWS. This is the single source of truth for all colors and glow effects.
- `components/` — move these shared components here (they are used across many features): StatBar.tsx, NeonProgressBar.tsx, CyberButton.tsx, CyberSectionHeader.tsx, CyberSkeleton.tsx, AnimatedCard.tsx, EmblemBadge.tsx, PrestigeBadge.tsx, PlayerNameBadge.tsx, SubscriberNameBadge.tsx, PageTransition.tsx, ActionResult.tsx, StatCounter.tsx
- `currency.ts` — create a utility file that exports: formatDC(n), formatNC(n), formatCurrency(n, type), CURRENCY_COLORS (a map of currency name to color). Import from theme.ts for colors.
- `images.ts` — create a central image registry. Scan `attached_assets/` and `artifacts/neonoir/public/` for all image files and register them by name. Export a typed object so any feature can import images by name instead of by path.

2. ROUTE REGISTRY
Create `artifacts/neonoir/src/registry.ts`.
This file is the single source of truth for every page in the game.
Each entry defines:
- id: string (the route key, e.g. "arena")
- label: string (display name)
- icon: LucideIcon
- component: lazy React component
- nav: boolean (show in NavBar?)
- bottomNav: boolean (show in BottomNav? max 5)
- roles?: string[] (restrict to these roles only)
- minStage?: number (hide until onboarding stage reached)
- statusFilter?: "normal" | "normal|abroad" | "abroad" (hide based on player status)

Migrate all entries currently in:
- The NAV array in `artifacts/neonoir/src/components/NavBar.tsx` (lines 41-78)
- The ITEMS array in `artifacts/neonoir/src/components/BottomNav.tsx`
- The lazy imports and renderPage() switch in `artifacts/neonoir/src/App.tsx`

...into this single registry.

3. UPDATE App.tsx, NavBar.tsx, BottomNav.tsx to read from registry.ts
- App.tsx: lazy imports come from registry, renderPage() iterates the registry
- NavBar.tsx: the NAV array is replaced by reading registry entries where nav=true
- BottomNav.tsx: the ITEMS array is replaced by reading registry entries where bottomNav=true

4. FEATURES FOLDER + ONE EXAMPLE
Create `artifacts/neonoir/src/features/`.
Migrate ONE feature to prove the pattern works — use Hospital (simple, self-contained):
- `features/hospital/` — move HospitalPage.tsx here
- Update registry.ts to point to the new location
- Verify it still works

Mirror on the backend:
- Create `artifacts/api-server/src/features/hospital/` 
- Move `artifacts/api-server/src/routes/hospital.ts` here
- Move `artifacts/api-server/src/models/` files related to hospital if any
- Update `artifacts/api-server/src/routes/index.ts` to import from the new location

5. ARCHITECTURE.md
Create `artifacts/neonoir/ARCHITECTURE.md` documenting:
- The feature folder structure and what goes where
- How to add a new feature (step by step)
- How to add a new page to the nav (add one entry to registry.ts)
- Where shared things live and how to import them
- The rule: never hardcode hex colors — import from shared/theme.ts

---

RULES:
- Read replit.md before starting — follow every rule in it without exception
- Do not move features other than Hospital in this tier
- Do not restructure anything not listed above
- Build and verify the app works after every significant change
- Run `pnpm run build` from the workspace root and fix all errors before finishing
- The app must start and all pages must be reachable when you are done
```

---

---

## TIER 1 — SIMPLE ACTION FEATURES
### Paste this prompt to start Tier 1

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tier 0 is complete. The feature folder structure, shared folder, and route registry are in place. Your job is Tier 1: migrate the simple standalone action features into feature folders one by one.

These features are chosen first because they are low risk — they barely depend on other features and are safe to move.

---

FEATURES TO MIGRATE (in this order):

1. crimes      → features/crimes/
2. jobs        → features/jobs/
3. hospital    ← already done in Tier 0, skip
4. daily       → features/daily/
5. training    → features/training/    (TrainingCenterPage)
6. missions    → features/missions/

For each feature:

FRONTEND:
- Move the page file(s) into `features/<name>/pages/`
- Move any components used ONLY by this feature into `features/<name>/components/`
- Components used by multiple features stay in `shared/components/` — do not duplicate them
- Update registry.ts to point to the new component location
- Update all import paths

BACKEND:
- Move `artifacts/api-server/src/routes/<name>.ts` into `artifacts/api-server/src/features/<name>/routes.ts`
- Move any models used ONLY by this feature into `artifacts/api-server/src/features/<name>/models/`
- Models shared across features stay in `artifacts/api-server/src/models/` — do not move them
- Update `artifacts/api-server/src/routes/index.ts` to import from the new location

VERIFY after each feature:
- App builds with no errors (`pnpm run build`)
- The page is reachable and works correctly
- No other pages are broken

---

RULES:
- Read replit.md before starting — follow every rule in it without exception
- Do one feature at a time — verify before moving to the next
- Do not touch features not listed in this tier
- If a component is used by more than one feature, put it in shared/components/ not in the feature folder
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---

---

## TIER 2 — GAME & COMBAT FEATURES
### Paste this prompt to start Tier 2

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0 and 1 are complete. Your job is Tier 2: migrate the game and combat features. These are more complex but still self-contained — each is its own world.

---

FEATURES TO MIGRATE:

1. arena       → features/arena/
   - ArenaHubPage goes in features/arena/pages/hub/
   - ArenaCombatPage goes in features/arena/pages/combat/
   - Any arena-only components go in features/arena/components/
   - Backend: routes/arena* → features/arena/routes/
   - IMPORTANT: Arena has sub-systems. Structure it so a future arena game (e.g. a new mode) can be added as features/arena/<new-game-name>/ without touching anything else

2. race        → features/race/
   - RaceHubPage → features/race/pages/hub/
   - RaceMatchPage → features/race/pages/match/
   - Backend: routes/race.ts → features/race/routes/

3. hack        → features/hack/
   - HackPage → features/hack/pages/
   - Backend: routes/hacking.ts → features/hack/routes/

4. cyber       → features/cyber/
   - CyberPage → features/cyber/pages/
   - Backend: routes related to cyber → features/cyber/routes/

5. net         → features/net/
   - NetPage → features/net/pages/
   - Backend: routes/net.ts → features/net/routes/

For each feature follow the same process as Tier 1:
- Frontend: move pages + feature-only components, update registry.ts, fix imports
- Backend: move routes + feature-only models, update routes/index.ts
- Verify: build passes, page works, nothing else broken

---

RULES:
- Read replit.md before starting — follow every rule in it without exception
- Do one feature at a time — verify before moving to the next
- The arena folder structure must support future sub-games cleanly
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---

---

## TIER 3 — ECONOMY FEATURES
### Paste this prompt to start Tier 3

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0, 1, and 2 are complete. Your job is Tier 3: migrate the economy features. These all deal with currency, items, and trading — do them together so currency handling stays consistent.

---

FEATURES TO MIGRATE:

1. bank        → features/bank/
2. market      → features/market/     (ShopHubPage + NpcStorePage)
3. inventory   → features/inventory/
4. loadout     → features/loadout/
5. auction     → features/auction/
6. trade       → features/trade/

IMPORTANT — Currency:
`shared/currency.ts` was created in Tier 0. Make sure all economy features import currency formatting from there — not from their own local copies and not hardcoded. If any feature is doing its own currency formatting, move that logic into shared/currency.ts.

IMPORTANT — Item types:
Items, cosmetic items, and inventory types are likely shared across these features. Any TypeScript types used by more than one economy feature belong in `shared/types.ts`, not duplicated in each feature folder.

For each feature follow the same process as previous tiers:
- Frontend: move pages + feature-only components, update registry.ts, fix imports
- Backend: move routes + feature-only models, update routes/index.ts
- Verify: build passes, page works, nothing else broken

---

RULES:
- Read replit.md before starting — follow every rule in it without exception
- Do one feature at a time — verify before moving to the next
- Never duplicate currency logic — it lives in shared/currency.ts only
- Never duplicate item/inventory types — shared ones live in shared/types.ts
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---

---

## TIER 4 — SOCIAL FEATURES
### Paste this prompt to start Tier 4

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–3 are complete. Your job is Tier 4: migrate the social features. These connect players to each other — they are more interconnected than previous tiers so take extra care with shared types.

---

FEATURES TO MIGRATE:

1. feed        → features/feed/        (FeedPage, FeedEvent related)
2. chat        → features/chat/        (ChatPage + chat-only components: MentionInput, MentionText, MessageCard)
3. friends     → features/friends/     (FriendsPage)
4. leaderboard → features/leaderboard/ (LeaderboardPage, HallOfFamePage, MatchHistoryPage)
5. notifications → features/notifications/ (NotificationsPage)

IMPORTANT — PlayerInspectModal:
The PlayerInspectModal is used across multiple social features (feed, friends, chat, etc.). It stays in `shared/components/` — do not put it inside any single feature folder.

IMPORTANT — Shared player types:
Any TypeScript type for player/user data used across these features belongs in `shared/types.ts`.

For each feature follow the same process as previous tiers:
- Frontend: move pages + feature-only components, update registry.ts, fix imports
- Backend: move routes + feature-only models, update routes/index.ts
- Verify: build passes, page works, nothing else broken

---

RULES:
- Read replit.md before starting — follow every rule in it without exception
- Do one feature at a time — verify before moving to the next
- Components shared across features go in shared/components/ — never duplicated
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---

---

## TIER 5 — PROGRESSION & REWARDS
### Paste this prompt to start Tier 5

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–4 are complete. Your job is Tier 5: migrate the progression and rewards features. These are the systems that reward players over time.

---

FEATURES TO MIGRATE:

1. achievements  → features/achievements/
2. battle-pass   → features/battle-pass/   (BattlePassPage + BattlePassTab + CosmeticsTab)
3. events        → features/events/        (EventPage, UpcomingEventsPage, EventArchivePage, EventBanner, EventGameModesTab)
4. cosmetics     → features/cosmetics/
   Structure it this way so future cosmetic types are easy to add:
   features/cosmetics/
     name-tiers/      ← name tier cosmetics
     chat-bubbles/    ← chat bubble cosmetics
     badges/          ← badge cosmetics (EmblemBadge, PrestigeBadge if cosmetic-specific)
     index.ts         ← exports everything, wires up to registry

IMPORTANT — Cosmetics pattern:
The cosmetics folder is designed so that adding a NEW cosmetic type in the future means creating a new sub-folder inside features/cosmetics/ and adding one entry to the index.ts. Nothing else needs to change.

For each feature follow the same process as previous tiers:
- Frontend: move pages + feature-only components, update registry.ts, fix imports
- Backend: move routes + feature-only models, update routes/index.ts
- Verify: build passes, page works, nothing else broken

---

RULES:
- Read replit.md before starting — follow every rule in it without exception
- Do one feature at a time — verify before moving to the next
- The cosmetics sub-folder pattern MUST be followed exactly — it enables easy future expansion
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---

---

## TIER 6 — ORGANIZATION FEATURES
### Paste this prompt to start Tier 6

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–5 are complete. Your job is Tier 6: migrate the organization and world features. These are the systems where players form groups and interact with the game world.

---

FEATURES TO MIGRATE:

1. factions    → features/factions/    (FactionPage, FactionSelectPage + faction-only components)
2. guilds      → features/guilds/      (GuildsPage)
3. business    → features/business/    (BusinessPage)
4. districts   → features/districts/   (DistrictPage, DistrictHubPage)
5. travel      → features/travel/      (TravelPage)
6. city        → features/city/        (CityPage)
7. store       → features/store/       (StorePage — the premium currency store)

IMPORTANT — Faction types:
Faction data (faction name, color, rank) is used in the NavBar and across the app. These types stay in `shared/types.ts`.

For each feature follow the same process as previous tiers:
- Frontend: move pages + feature-only components, update registry.ts, fix imports
- Backend: move routes + feature-only models, update routes/index.ts
- Verify: build passes, page works, nothing else broken

---

RULES:
- Read replit.md before starting — follow every rule in it without exception
- Do one feature at a time — verify before moving to the next
- Run `pnpm run build` from workspace root and fix all errors before finishing
```

---

---

## TIER 7 — CORE (DO THIS LAST)
### Paste this prompt to start Tier 7

```
Read GAME_RESTRUCTURING.md and NEONOIR_MASTER_PLAN.md and replit.md and artifacts/neonoir/ARCHITECTURE.md before doing anything.

Tiers 0–6 are complete. Your job is Tier 7: the core features. These are the most critical parts of the app — auth, profile, settings, and admin. Do these last because everything else depends on them.

---

FEATURES TO MIGRATE:

1. settings + integrations → features/settings/
   Structure:
   features/settings/
     pages/           ← SettingsPage
     integrations/
       telegram/      ← everything for Telegram linking (UI + backend logic)
       discord/       ← everything for Discord linking (UI + backend logic)
   
   The integrations sub-folder pattern means: adding a NEW integration in the future = create a new sub-folder inside features/settings/integrations/ and wire it up in settings. Nothing else changes.

2. profile      → features/profile/    (ProfilePage + profile-only components)
3. connections  → features/connections/ (ConnectionsPage)
4. mentor       → features/mentor/     (MentorPage)
5. support      → features/support/    (SupportPage)
6. legal        → features/legal/      (LegalPage)

ADMIN (keep together, access-controlled):
7. admin → features/admin/
   - OwnerPage → features/admin/pages/owner/
   - StaffPortalPage → features/admin/pages/staff/
   - DevToolbar → features/admin/components/
   Registry entries for these already have role restrictions — keep them.

CORE (most critical, most careful):
8. auth → features/auth/
   - AuthPage → features/auth/pages/
   - All auth hooks and context: useAuth.ts, SocketContext.tsx, PreferencesContext.tsx
   - These move to features/auth/ but are still imported globally by App.tsx
   - Test login/logout thoroughly after this step

9. dashboard → features/dashboard/
   - Dashboard.tsx → features/dashboard/pages/

---

AFTER ALL FEATURES ARE MIGRATED:

Clean up:
- The original `artifacts/neonoir/src/pages/` folder should now be empty — delete it
- The original `artifacts/api-server/src/routes/` top-level files should be gone — only features/*/routes remain
- Run a final `pnpm run build` from workspace root — zero errors required
- Start all workflows and verify every page in the game is reachable

Final check — update ARCHITECTURE.md:
- Confirm the documented pattern matches what was actually built
- Add a "How to add a new integration" section (following the telegram/discord pattern)
- Add a "How to add a new cosmetic type" section (following the name-tiers/chat-bubbles pattern)
- Add a "How to add a new arena game mode" section

---

RULES:
- Read replit.md before starting — follow every rule in it without exception
- Auth is the most critical step — verify login, logout, and session persistence after migrating it
- Run `pnpm run build` from workspace root and fix all errors before finishing
- This tier is complete when: zero files remain in the old pages/ folder, the app builds clean, and every page is reachable
```

---

---

## QUICK REFERENCE — Feature Folder Template

When adding a brand new feature in the future, follow this template:

```
features/
  <feature-name>/
    pages/           ← React page components
    components/      ← components used only by this feature
    hooks/           ← hooks used only by this feature (optional)
    types.ts         ← TypeScript types for this feature only (optional)
    index.ts         ← exports the feature's pages for registry.ts
```

Backend mirror:
```
artifacts/api-server/src/features/
  <feature-name>/
    routes.ts        ← Express routes for this feature
    models/          ← Mongoose models used only by this feature (optional)
```

Wiring (the only files you touch outside the feature folder):
- `artifacts/neonoir/src/registry.ts` — add one entry to register the page in routing + nav
- `artifacts/api-server/src/routes/index.ts` — import and mount the feature's routes

That's it. Two lines in two files. Everything else lives inside the feature folder.
