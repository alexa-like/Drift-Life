---
name: DriftLife Giveaway Tier 5 — Ending/Distribution Worker
description: How the timer-expiry worker was wired without duplicating Tier 4's resolution logic or locking layer.
---

## No separate worker-level lock needed
`resolveGiveaway()` (built in Tier 4) already performs its own atomic claim (`findOneAndUpdate({status:"live"})` inside a transaction) before doing any distribution. Tier 5's worker just queries candidates (`status:"live", liveExpiresAt<=now`) and calls `resolveGiveaway(id)` for each — it does NOT need a second claim/lock step. Two overlapping ticks, or a tick racing the §4.4 cap-reached trigger, safely collapse to one winner via that inner claim.

## Single polling loop, not two
`lib/giveawayWorker.ts` exports one `runGiveawayMaintenance()` that does both the draft-expiry sweep (§3.3, moved out of routes/giveaways.ts's old standalone interval) and the live-timer resolution sweep (§5.1). index.ts calls only this one function on a 1-minute interval (matches the auction auto-close cadence) — never add a second interval for either sweep.

**Why:** the plan explicitly calls for absorbing the draft sweep into Tier 5's worker once it exists, to avoid two independent intervals touching the same collection.
