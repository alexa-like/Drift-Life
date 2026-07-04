---
name: DriftLife Atomic Update Patterns
description: Rules for safe concurrent writes in DriftLife's MongoDB-backed game routes
---

## Combat (`/combat/attack`)
- Use `$inc` for DC, XP, health, totalFights, wins, losses — safe under concurrent A↔B attacks
- Use `$set` for attacksToday, attackCooldowns, attackResetAt, hospitalizedUntil, level fields
- **Why `$set` for attacksToday:** daily reset sets it to 0 in memory before incrementing to 1. Using `$inc: { attacksToday: 1 }` after a reset would read the stale DB counter. Using `$set: { attacksToday: attacker.attacksToday }` writes the computed value directly.

## Market P2P Buy (`/market/listings/:id/buy`)
- 3-step atomic flow: (1) `findOneAndUpdate({ marketListed: true })` claims listing — only one buyer wins; (2) `findOneAndUpdate({ dc: { $gte: price } })` deducts buyer DC — restores listing on failure; (3) parallel credit seller + transfer item owner
- Steps 1 and 2 are atomic; step 3 has no rollback (MongoDB single-node, no transactions). Partial step-3 failure is a known limitation.

## Pink-Slip Race Accept (`/races/accept/:raceId`)
- Use `findOneAndDelete({ _id, defenderId })` at the top of the handler — atomically claims and removes the challenge
- Prevents two concurrent accepts from both resolving the same race
- No need for a second `findByIdAndDelete` at the end

## Dark Market Buy (`/net/dark-market/buy/:listingId`)
- Use `findOneAndDelete` to claim listing atomically — prevents double-sell
- Sting heat increment must use aggregation pipeline update to cap at 100: `[{ $set: { heat: { $min: [100, { $add: ["$heat", 20] }] } } }]`
- Buyer debit uses `findOneAndUpdate({ [currency]: { $gte: price } })` — restores listing on insufficient funds

## Hack Sessions (`/net/hack/submit`)
- Use `findOneAndDelete({ _id: sessionId, hackerId: req.userId })` to atomically claim+delete session — prevents replay attacks

## Price Overrides (market.ts)
- `PRICE_OVERRIDES` is an in-memory Map backed by `PriceOverride` collection
- Lazy-loaded via `ensureOverridesLoaded()` — must be called in ALL endpoints that read prices: `GET /shop` AND `POST /shop/buy`
- On write (POST /price-override): update both Map and DB with `findOneAndUpdate upsert` / `findOneAndDelete`

**How to apply:** whenever adding a new endpoint that reads prices or does multi-doc writes, follow these patterns. No standalone `.save()` on multiple documents — always use targeted findByIdAndUpdate with $inc/$set.
