---
name: DriftLife Racing System (Tier 5)
description: Completion notes for Tier 5 — what was missing, what was fixed, key design decisions.
---

## What was already built
- `routes/race.ts` — full backend: queue join/leave/status, match get, shift, nitro, AI generation, rewards, leaderboard writes
- `RaceHubPage.tsx` — lobby with mode select, animated queue waiting, cancel
- `RaceMatchPage.tsx` — Canvas 2D pseudo-3D road, gear shift timing strip, nitro, mini-leaderboard, finish screen
- `App.tsx` — race-hub and race-match cases already wired

## What was missing (gaps fixed)
1. **Route not registered** — `import raceRouter` + `router.use("/race", raceRouter)` added to `routes/index.ts`
2. **No NavBar entry** — `{ id: "race-hub", label: "Race" }` added to NAV array in `NavBar.tsx`
3. **Non-atomic energy deduction** — replaced `findById + save` with `findOneAndUpdate({ energy: { $gte: cost } }, { $inc: { energy: -cost } })` on queue join
4. **Queue timeout bug** — old worker created one match per expired user; fixed to batch all expired humans in same mode into groups first, then AI-fill remaining seats
5. **Anti-cheat bypass** — server now ignores client `hit` boolean; computes hit server-side from sweep timing (same formula as frontend). `MIN_SHIFT_INTERVAL_MS=250` and `MAX_SHIFTS_PER_RACE=120` guards added. `lastShiftAt`/`shiftCount` added to `RacePlayer` schema.
6. **Frontend feedback** — `handleShift` now uses server-returned `hit` to correct visual feedback after response

## Key model changes
- `RaceMatch.ts` → `RacePlayer` interface/schema now has `lastShiftAt: number | null` and `shiftCount: number`

**Why:** anti-cheat must be server-authoritative; client should only send intent (shift now, nitro now), server validates timing and computes quality.
