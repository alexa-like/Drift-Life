---
name: DriftLife Tier 7 — Training Center
description: Training Center completion — root cause fix for training bonuses not persisting, and workflow package issues resolved.
---

## Status
Tier 7 complete. DRIFTLIFE_BUILD_PLAN.md Tier 7 all marked [x].

## Root cause fixed
The User Mongoose schema was missing all 5 training fields:
- `combatAccuracyBonus`, `raceGearBonus`, `energyRegenBonus` were accessed as `(user as any)` in training.ts and selected with `.select()` in arena.ts — but since they weren't in the schema, Mongoose silently discarded saves and `.select()` returned undefined, so bonuses were always 0.
- `trainingSessionsToday` (Mixed type) also needed `user.markModified('trainingSessionsToday')` before save, since Mongoose doesn't track nested object mutations on Mixed fields automatically.

**Fix:** Added all 5 fields to both `IUser` interface and `UserSchema` in `artifacts/api-server/src/models/User.ts`, plus added `markModified` call in training route.

## Integration verified (all pre-existing, just needed schema fix)
- `arena.ts` line 164: `.select("... combatAccuracyBonus")` and line 187: `resolveLoadoutStats(userId, level, (user as any).combatAccuracyBonus ?? 0)` — accuracy bonus applied to hit chance
- `race.ts`: fetches `raceGearBonus` from User, `halfWindow = 0.15 + gearBonus * 0.5` — widens green shift zone
- `energy.ts`: `REGEN_INTERVAL_MS = Math.round(3 * 60 * 1000 / (1 + energyRegenBonus))` — speeds up regen
- Training route registered in `routes/index.ts`, NavBar has id "training", App.tsx routes "training"/"gym" → TrainingCenterPage

## Workflow issues also fixed
- api-server was missing packages: `helmet`, `express-rate-limit`, `zod`, `sanitize-html` — installed via `pnpm add`
- Port 24576 held by stale vite process after failed restarts — killed with `lsof -ti:24576 | xargs kill -9`

## Training config (in training.ts)
- combat_drills: 15 energy, 5/day limit, +1% accuracy/session, max +25%
- racing_practice: 15 energy, 5/day limit, +1% gear window/session, max +25%
- endurance_training: 20 energy, 3/day limit, +0.5% regen/session, max +15%
- Daily reset at midnight UTC via `trainingResetAt` field
