---
name: DriftLife Giveaway Tier 4 — Entry, Viewing, Try Your Luck
description: Key decisions from building giveaway entry + the shared resolution function used by both cap-reached and timer-expiry.
---

## Shared resolution function built early
`lib/resolveGiveaway.ts` was written during Tier 4 (not deferred to Tier 5) because §4.4's cap-reached trigger must call the *exact same* function the Tier 5 worker will use. Tier 5 only needs to add the polling loop — it must import and call `resolveGiveaway()`, never reimplement distribution.

## Resolution mechanics (§5.2, implemented ahead of schedule)
- Atomic claim: `findOneAndUpdate({ _id, status: "live" }, { status: targetStatus })` inside a `session.withTransaction` — first write, acts as the sole lock against double-processing (cap-reached and timer-expiry can race freely).
- 0 entrants → refund to host (skipped for `isOwnerHosted` — pool just dissolves, no notification to a real user).
- 1 entrant → gets 100% of pledge.
- 2+ entrants → shuffle entrant list, then split DC/UC/keys evenly via `Math.floor(total/n)` + remainder-to-first-N (mathematically identical to but O(1) instead of O(total) vs. literally handing out one-DC-at-a-time). Items/frames use a shared round-robin cursor since they're indivisible units.
- Post-distribution assertion verifies sums exactly equal the original pledge — throws (aborts transaction) on any mismatch rather than silently proceeding.

## Entrant cap race condition
Naive "create entry, then $inc entrantCount" allows concurrent requests near the cap to push `entrantCount` past `maxEntrants`. Fixed by claiming the slot FIRST via `findOneAndUpdate` with `$expr: { $lt: ["$entrantCount", "$maxEntrants"] } }`, then creating the `GiveawayEntry` doc, rolling back the increment if entry creation fails (duplicate user).

**Why:** `$expr` is required to compare two fields on the same document atomically in a MongoDB filter — a plain `{ entrantCount: { $lt: N } }` filter can't reference another field's live value.

## Item/frame granting on payout
No generic "grant item to user" helper existed before this. `grantItem()` in `resolveGiveaway.ts` merges into an existing non-equipped/non-listed stack of the same name+rarity, or creates a fresh `Item` doc copying metadata from the source item (falls back to bare defaults if the source item was since deleted — a payout must never vanish silently).
