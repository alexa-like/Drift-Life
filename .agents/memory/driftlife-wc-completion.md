---
name: DriftLife Wire Cartel Completion
description: Wire Cartel spec gaps that were filled — cybernetics, turf war, racing minigames, gym mastery, pursuit modal — plus key lessons from post-build code review.
---

## Completed systems

- **Cybernetics** (`routes/cyber.ts`, `pages/CyberPage.tsx`): 10 implants, 5 slots, humanity loss thresholds at 3/6/9; install/remove with 30% removal cost
- **Turf war** (`routes/guilds.ts`, `pages/GuildsPage.tsx`): atomic treasury deduction via `findOneAndUpdate + $gte`; lazy weekly reset using `lastTurfResetAt`; instant district control transfer on win (not weekly — simpler and functionally complete)
- **Racing minigames** (`pages/GaragePage.tsx`): 3-phase flow (setup → minigame → result); DragMinigame uses `requestAnimationFrame`; CircuitMinigame has 3 corner prompts; DriftMinigame oscillates with `requestAnimationFrame`; all defined as function components inside GaragePage — acceptable but they re-create on each GaragePage render
- **Gym mastery rewards** (`routes/gym.ts`): milestones at 10/25/50/100 attempts; `$inc dc` + `$addToSet titles`; milestone data returned in response as `milestoneReward`
- **Pursuit modal** (`pages/CrimesPage.tsx`): fixed-position overlay blocking when `user.pursuiteActive === true`; bribe/outrun/busted options; bribe cost = `Math.floor(heat * 500)`
- **Outrun car bonus** (`routes/crimes.ts`): reads `user.activeCar` Car doc, computes `min(0.40, (power+handling)/500)` — done in previous session

## Key decisions

**Race bonus clamping:** Client minigames produce `[0, 1]` and send to server. Server clamps with `Math.max(0, Math.min(1, Number(bonus) || 0))` before multiplying by the max advantage (0.3 for drag, 0.5 for circuit). This preserves server authority while allowing the minigame to improve outcomes.

**Atomic turf treasury:** Use `Guild.findOneAndUpdate({ _id, treasury: { $gte: cost } }, { $inc: { treasury: -cost } }, { new: true })` — returns null if treasury insufficient, preventing double-spend.

**Pre-existing TS errors (NOT mine):** `crafting.ts`, `properties.ts`, `vanta.ts`, `races.ts /accept handler`, `crimes.ts /runId handler`, and several React pages (NetPage, StreetPage, WorldPage) — all `r is unknown` or `string | string[]` errors from original codebase.

**Why:**
- Bonus clamping needed after code review found client could submit `launchBonus=100`
- Atomic treasury needed to prevent concurrent turf races depleting more than they should
