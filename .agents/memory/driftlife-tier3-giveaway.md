---
name: DriftLife Giveaway Tier 3 — Creation/Draft/Escrow/Card
description: Key decisions made while building the giveaway creation routes (Tier 3).
---

## FeedEvent approach (§3.5)
**Approach B chosen**: no FeedEvent while a giveaway is live. Live giveaways served from `GET /api/giveaways/live` (Giveaway collection). FeedEvent of type "giveaway" created only at conclusion (Tier 5). "giveaway" added to FeedEvent enum now.

**Why:** Approach A (FeedEvent while live) conflicts with the 30-day MongoDB TTL index — no conditional TTL possible. Approach B is simpler and spec-allowed.

## Confirm route race safety
The draft→live flip is the **first write inside `session.withTransaction`**, acting as an optimistic lock. Filter is `{ _id, host, status: "draft", draftExpiresAt: { $gt: now } }`. If a second concurrent request tries to claim the same draft, it finds `status: "live"` and aborts. All deductions (NC, DC, keys, items, frames) run inside the same session.

**Why:** Without transactional lock, two concurrent confirms could both pass the draft check and double-deduct escrow.

## Business errors inside withTransaction
Use a container object `const biz = { err: null as T | null }` inside the transaction, NOT `let bizErr`. TypeScript narrows `let` variables to `never` after async callbacks (it can't track mutations). Object property accesses bypass this narrowing.

## UC top-up escrow math
`totalNcDeduction = computeUcTopUpCost(shortfallDcEquivalent) + pledge.uc`  
Both are deducted from nc in one atomic step. DC/keys/items deduct `min(pledge.X, available)` — the gap is funded by ucTopUpCost (NC covers the DC-equivalent value). At distribution time (Tier 5), winners receive the full pledge amounts (minting DC funded by NC, which is standard game economy).

## Card image storage
PNG bytes stored as `cardImageData: Buffer` on the Giveaway document. Served via `GET /api/giveaways/:id/card` (public, no auth). `cardImageUrl` stores that path. Generated fire-and-forget after the transaction commits — card failure is non-fatal (giveaway already live).

## sharp package
Installed in api-server. Already in build.mjs externals list as `"sharp"`. Import: `import sharp, { type OverlayOptions } from "sharp"` — NOT `sharp.OverlayOptions` (that fails since sharp is a default export, not a namespace).

## sweepExpiredDrafts()
Exported from `routes/giveaways.ts`. Called from `setInterval` (5 min) + startup run in `index.ts`. When Tier 5's resolution worker is built, absorb this into that worker's single polling loop — do not leave two separate intervals.
