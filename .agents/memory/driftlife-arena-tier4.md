---
name: DriftLife Arena Combat — Tier 4
description: Key decisions, bugs found, and patterns for the arena combat system
---

## Arena route registration
`arena.ts` was NOT in `routes/index.ts` — always check this when adding a new route file. Added as `/api/arena`.

## CombatMatch.player1/2ConsumablesUsed
Originally typed as `number` (a count). Changed to `string[]` (tracks specific item IDs used) so the action handler can check which consumable slots are still available without reading them back from inventory.

## Defend timing in same-turn resolution
The action handler resolves both the player action AND the AI counterattack in a single HTTP request. If the player defends, the defend bonus must apply to the AI's attack *in the same call* — not just the "previous turn's action" from `match.turns`. Fix: derive `p1DefendingThisTurn = action === "defend" && isP1` and pass that flag directly to `calcDamage`.

## Queue worker widened-range matching bug
In the 15–30s bucket, the original code deleted both entries from `combatQueue` then called `tryMatch(entry)`. `tryMatch` only searches the queue — both were already deleted, so it found no candidates and returned null. Fix: `matchPair(a, b)` directly creates a match from two resolved entries without re-searching the queue.

**Why:** `tryMatch` is an opportunistic search helper; it must not be called after the entries it would find have already been removed.

## Atomic turn guard
Action handler uses `findOne({ matchId, status: "active", currentTurn: expectedTurn })`. Client sends `expectedTurn` with every action request. If the turn has already advanced (concurrent submission), the findOne returns null and we return 409. Client on 409 silently re-fetches match state.

## PvP turn ownership
For non-AI matches: odd `currentTurn` values = P1's turn, even = P2's turn. Enforced server-side before processing the action.

## Daily reward cap
30 full-reward matches, 50 half-reward (0.5×), beyond 50 tiny (0.05×). Tracked via `user.miniGameMatchesToday` + `user.miniGameResetAt` (resets to midnight UTC). Key shards only granted on full-reward matches (mult >= 1).

## Win streak bonus
Capped at +300 DC bonus (streak × 50, max 6 streak positions). Stored on User as `combatWinStreak`. Must be included in `User` interface in `lib/types.ts`.
