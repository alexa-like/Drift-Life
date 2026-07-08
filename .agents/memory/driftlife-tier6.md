---
name: DriftLife Tier 6 Completion
description: Missions, Achievements, and Leaderboards — wiring details and decisions for Tier 6.
---

## Status
All Tier 6 gaps filled as of July 2026. DRIFTLIFE_BUILD_PLAN.md Tier 6 marked [x].

## Key decisions

### Mission event utility
`artifacts/api-server/src/lib/missionEvents.ts` holds the canonical MISSION_CATALOG, getDailyMissions(), getTodayKey(), getTodaySeed(), and `fireMissionEvent(userId, type, amount?)`. All game routes import from here and call `.catch(() => {})` so mission failures are non-fatal.

**Why:** Avoids HTTP round-trips between routes and prevents mission event duplication if routes import the catalog for display.

### Achievement stat mapping
`checkAchievements` stat switch cases added: `raceWins` → `user.raceWins`, `totalRaces` → `user.totalRaces`, `royaleSpins` → `user.totalRoyaleSpins`, `combatWinStreak` → `user.maxCombatWinStreak`. These were previously falling through to `default: return 0` making those achievements uncompletable.

### maxCombatWinStreak vs combatWinStreak
`combatWinStreak` resets on loss (current streak). `maxCombatWinStreak` (Number, default 0) was added to User model to track the historical peak used for achievements. Updated in arena.ts `grantCombatRewards`.

### keyReward granting
`checkAchievements` now grants `keys` via `$inc` alongside `dcReward`. The GET `/api/achievements` response now includes `keyReward` field so the frontend can display it.

### Missions claim response
`POST /missions/claim/:id` returns `{ message, rewards: { dc, xp, keyShards } }`. MissionsPage reads `r.rewards.dc/xp/keyShards` (not flat `r.dc`).

### mini-leaderboard registration
Route was built but never registered. Added `import miniLeaderboardRouter` and `router.use("/mini-leaderboard", miniLeaderboardRouter)` to `routes/index.ts`.

## Frontend additions
- `MissionsPage.tsx` — daily missions with progress bars, claim buttons, type-color coding, countdown to reset
- `LeaderboardPage.tsx` — added "City Rankings" / "Mini-Game Weekly" tab switcher; MiniLeaderboard component for 5 board types with weekly countdown and rewards info
- `AchievementsPage.tsx` — key reward badge shown alongside DC reward badge
- `NavBar.tsx` — "Missions" added to NAV array
- `App.tsx` — `case "missions"` routes to MissionsPage
