---
name: DriftLife Security Fixes
description: Durable security/concurrency lessons from the DriftLife audit — patterns to apply consistently.
---

## Atomic regen: use DB-side pipeline, not app-side computation

**Rule:** Never compute regen in application code and write it back. Any read-modify-write creates a mint window under concurrency.

**Why:** Two concurrent requests reading the same stale `energyRegenAt` both compute the same large delta (e.g. 60 energy after 3h offline) and both apply `$inc: { energy: delta - cost }`, minting N×delta. Also, app-side `$inc` can't enforce the `maxEnergy` cap.

**How to apply:** Use `energySufficientExpr(cost)` / `nerveSufficientExpr(cost)` from `src/lib/atomicRegen.ts` as the `findOneAndUpdate` filter (embeds `$$NOW`-based regen check), paired with `buildRegenPipeline(opts)` as the update (computes regen delta in Stage 1, applies + caps in Stage 2, cleans up in Stage 3). Requires MongoDB 4.2+ for `$$NOW` in `$expr` and pipeline updates — verify on first deploy.

- Regen tick rates: energy = 1 per 3 min (180 000 ms), nerve = 1 per 5 min (300 000 ms) — mirrors `applyRegen()` in `User.ts`. Keep in sync.

---

## DC cap: always use aggregation pipeline $min, never $inc alone

**Rule:** Any operation that credits DC must use `[{ $set: { dc: { $min: [{ $add: ["$dc", amount] }, 100_000_000] } } }]` (aggregation pipeline update) — not `$inc: { dc: amount }`.

**Why:** `$inc` with pre-save hook clamping does NOT run in `findByIdAndUpdate`; the pre-save only runs on `doc.save()`. A user near the cap can exceed 100M DC with any plain `$inc`.

**How to apply:** All reward credits (jobs, crimes, daily, market seller, bank transfer recipient) use the pipeline `$min` pattern. Regular deductions can still use `$inc: { dc: -amount }` since going negative is guarded by a condition predicate.

---

## Atomic two-gate market buy (race between two buyers)

**Rule:** Two separate atomic ops: (1) deduct buyer DC with `findOneAndUpdate({ dc: { $gte: price } }, { $inc: { dc: -price } })`, (2) claim listing with `findOneAndUpdate({ _id, marketListed: true }, { $set: { marketListed: false } })`. If gate-2 fails, refund buyer.

**Why:** A single read-then-update lets two buyers both pass the DC check and both receive the item.

---

## Market: self-buy guard after populate

**Rule:** After `.populate("owner", "username")`, compare `String((listing.owner as any)._id)` vs `req.userId` — NOT `String(listing.owner)` which gives `[object Object]`.

---

## Bank transfer: recipient credit is not end-to-end atomic

**Known gap:** Sender debit is atomic (conditional `findOneAndUpdate`). Recipient credit uses aggregation pipeline `$min` cap but is a separate op. If recipient credit fails after sender debit succeeds, DC is lost. No transaction/compensation exists.

**Why accepted:** MongoDB transactions require replica set sessions (available on Atlas but adds latency and complexity). The failure window is a transient DB error scenario — acceptable game trade-off. If this becomes a player issue, add a `pendingTransfer` field as compensating state.

---

## NoSQL injection guard

**Rule:** In any route that takes user-provided credentials or identifiers and passes them to MongoDB, check `typeof value !== "string"` before any query. Otherwise `{ $gt: "" }` objects bypass checks.

**How to apply:** Implemented in `auth.ts` login + register. Also relevant for any new auth-adjacent routes.

---

## Helmet + trust proxy ordering

**Rule:** `app.set("trust proxy", 1)` MUST come before rate limiters. Without it, `express-rate-limit` sees the proxy IP as the client IP, so all requests share one bucket.

---

## NPC combat cooldown: three-arm `$or` condition

**Rule:** First-fight edge case — `lastNpcCombatAt` can be `null`, `undefined` (field missing), or a Date. The atomic gate must cover all three: `$or: [{ lastNpcCombatAt: null }, { lastNpcCombatAt: { $exists: false } }, { lastNpcCombatAt: { $lte: threshold } }]`.

---

## Friend request ObjectId validation

**Rule:** Always call `mongoose.isValidObjectId(id)` before using any user-supplied ID as a MongoDB `_id`. Prevents CastError 500s and potential query manipulation.
