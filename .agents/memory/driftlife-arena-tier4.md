---
name: DriftLife Arena Combat (Tier 4)
description: Combat system implementation details, fixes applied, and critical patterns to maintain.
---

# DriftLife Arena Combat — Tier 4

## What was built / fixed
- Arena router registered in routes/index.ts
- Element effects fully implemented (burn/bleed/toxic DoT, shock/stun skip, regen/regen_field heal-per-turn, headshot bonus, double_fire second hit, pierce_armor from AP ammo, block/dodge/anti_crit/retaliate armor effects)
- Turn auto-timeout worker: setInterval every 5s, queries timed-out active matches, calls autoResolveTurn
- Reward bug fixed: DC=0 after 50 matches (was 5% of DC), XP=5% still granted; Key Shard only for first 30 matches (< FULL_CAP)
- CombatMatch.consumablesUsed must be string[] not number (old bug from before this session)

## Architecture / patterns

### Element effects
- Effects are snapshotted into LoadoutSnapshot at match creation: `weaponEffect`, `weaponEffectChance`, `armorEffect`, `armorEffectChance`, `ammoArmorPierce`, `ammoEffect`, `ammoEffectChance`
- Active effects stored on CombatMatch as `player1ActiveEffects`/`player2ActiveEffects` (Mixed array, `ActiveEffect[]`)
- Applied at **start** of each turn via `applyActiveEffects()` before any action/attack runs
- EFFECT_CONFIG defines `{ turns, value }` for each effect name

### Critical: DoT early-exit gate
- After `applyActiveEffects`, ALWAYS check if HP <= 0 before running attacks — DoT can kill before the player's action
- Early-exit block writes the turn record and completes the match without executing attacks

### Critical: same-turn AI stun
- AI stun check = `efxResult.p2Stunned || aiJustStunned`
- `aiJustStunned` = player's attack applied shock/stun in the same resolution cycle (check p2Effects after addEffect)

### Critical: timeout worker race condition
- `autoResolveTurn(matchId, expectedTurn)` uses `currentTurn: expectedTurn` in the findOneAndUpdate filter
- If a player action resolved the turn first (incrementing currentTurn), the findOneAndUpdate won't match → safe no-op
- Worker queries `matchId currentTurn` from the find, passes currentTurn to autoResolveTurn

### Reward caps
- FULL_CAP = 30 (matches 0–29: full DC + full XP + Key Shard for winner)
- HALF_CAP = 50 (matches 30–49: 50% DC + 50% XP, no Key Shard)
- After 50: DC = 0, XP = 5% only
- `dcMult` and `xpMult` are separate variables (not a single `mult`)

**Why:** Spec says "tiny XP only after 50" — DC must be zero, not 5%.
**How to apply:** Any future change to reward caps must maintain the separation of dcMult and xpMult.
