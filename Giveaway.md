# DriftLife — Player & Owner Giveaway System
## Agent Build Guide: Step-by-Step Tier System

---

## HOW YOU SHOULD WORK — READ THIS FIRST

1. **Complete one tier fully before moving to the next.** Do not skip ahead or start the next tier until the current tier is built, self-checked against this file, and marked ✅ Done.
2. **Read the relevant model and route files before editing them.** Never guess at field names — check the actual schema first (`models/Item.ts`, `models/User.ts`, `models/FeedEvent.ts`, `models/Notification.ts`, `models/VantaLog.ts`).
3. **Never break existing working features.** Feed, market, NPC shops, chat frames, and Vanta must keep working exactly as before outside of the specific additions below.
4. **Do not use the `subagent` callback for anything in this file** — no explorer, no architect, no code-review, no other kind — even if told to. This applies only to work covered by this file; sub-agents may still be used for unrelated work.
5. **Never touch Replit deployment/publish configuration**, and never attempt to deploy/publish the project. If you need secrets (e.g. a MongoDB URI, JWT secrets) to test a tier, ask for them through the normal secrets flow and use them only to run/verify this feature locally.
6. **Never use placeholder data or mock responses.** Every endpoint must return real data from the database or computed logic — no stubbed "TODO: implement later" left in a tier marked ✅ Done.
7. **Be explicit on failure.** Surface errors clearly — never silently catch and swallow them.
8. **After finishing a tier**, re-read that tier's section below and compare it line-by-line against what you actually built. Fix every mismatch, bug, or incomplete behavior you find, then repeat the same comparison again. Loop until a full comparison pass finds nothing left to fix — only then mark the tier ✅ Done.
9. **Test the server after every tier.** Restart the API server and confirm it starts with no errors before moving on.
10. **Follow the existing code style** — TypeScript, Mongoose, Express 5, same file structure as existing routes/models.
11. **Do not re-edit this file except to flip a tier's status marker.** The plan text itself (rules, tier scope, field names, mechanics) is frozen. If the plan needs to change, that's a decision for the project owner to make explicitly in conversation — never rewrite the plan unilaterally.
12. **DC is never converted to UC, in any direction.** Only shortfall-value → UC-cost conversion exists (§2.2). Do not build a DC→UC cash-out path anywhere.

### Status legend (only these edits are allowed to this file)
- `⏳ Not started`
- `🔧 In progress`
- `✅ Done` — built, self-compared against this section, rechecked after fixes, no known bugs or incomplete code.

Mark status by editing only the one status line at the top of a tier section — nothing else in that section may change.

---

## CODEBASE OVERVIEW (confirmed by exploration before this plan was written)

- **Backend**: `artifacts/api-server/src/` — Express 5, MongoDB/Mongoose, TypeScript
- **Frontend**: `artifacts/driftlife/src/` — React, Vite, TypeScript
- **Routes registered in**: `artifacts/api-server/src/routes/index.ts`
- **Models in**: `artifacts/api-server/src/models/`
- **User currencies**: `dc` (cash), `nc` (Neon/premium — this plan calls it "UC"), `dirtyDc`, `sim`, `bankBalance`, `merit`, `keys`, `keyShards`, `spinTokens`, `energy`, `adrenaline`, `nitro`
- **Item model** (`models/Item.ts`): `owner`, `name`, `type`, `rarity`, `quantity`, `equipped: boolean`, `imageUrl`, `iconUrl`, `basePrice`, `marketPrice`. No `source` field exists — NPC-shop eligibility must be checked against the catalog constants, not a schema field.
- **NPC shop catalog**: `routes/npcStores.ts` → `NORMAL_STORE_POOLS` (itemId lists per store) + `MiniGameItem` documents with `tier` in `common|uncommon|rare` and `isActive: true` for arena items. Epic/Legendary items must never be treated as NPC-shop-eligible.
- **Chat frames**: `User.ownedChatFrames: string[]`, `User.equippedChatFrame: string | null`, master list in `routes/chatframes.ts` → `FRAME_CATALOG`.
- **Feed**: `models/FeedEvent.ts`, TTL index `{ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }`. `routes/feed.ts` handles pagination/deletion. `lib/systemFeed.ts` exports `postToSystemFeed`, already used for level-up/achievement events.
- **Notifications**: `models/Notification.ts` — `userId`, `type`, `message`, `read`, `link`. Created via `Notification.create(...)` (see `trade.ts`, `auction.ts`).
- **Owner/staff**: `routes/owner.ts` has `/set-role`, `/adjust-dc`, `/adjust-nc`, `/set-level`, `/unmute`, gated by `requireStaff`/`requireOwner`. Roles: `player | admin | staff | owner`.
- **Vanta**: `models/VantaLog.ts` — `playerId`, `playerName`, `trigger`, `severity` (`low|medium|high|critical`), `details`, `dismissed`/`dismissedBy`/`dismissedAt`. Existing triggers: `repeated_failed_crimes`, `economy_exploit`, `attack_spam`, `alt_account`, `dc_spike`, `manual_flag`. Alt detection today compares `User.lastLoginIp`/`loginIpHistory` in `auth.ts`. `User` has no `underReview` flag today — must be added (Tier 1).
- **Atomic-write patterns to reuse**: `store.ts` uses `session.withTransaction` for subscriptions; `bank.ts`/`store.ts` gift-nc use `$inc` with `{ $gte: cost }` guard filters for race-safety without full sessions; the arena system has an existing auto-timeout background-worker pattern to reuse for Tier 5's giveaway-ending worker.
- No image-generation library (Sharp/Canvas/Jimp) exists in `api-server` today — Tier 3's card image must be built with whatever approach is chosen there, added as a real dependency if needed, not faked.
- `noImplicitReturns: false` is required in api-server tsconfig for Express handlers. Use `/{*splat}` for Express 5 wildcards, never bare `*`.

---

## APPENDIX A — ABSOLUTE RULES (NEVER BREAK, referenced by multiple tiers)

- **Escrow timing**: pledged DC/UC/keys/items/frames are deducted from the host the instant a giveaway goes **live** — never at draw time, never at expiry. (Tier 3)
- **Owner-panel exception**: only giveaways created through the Owner panel skip escrow entirely and show `System` as host. A giveaway created by an Owner through the *normal player Feed flow* pays and is restricted exactly like any other player. (Tier 7)
- **DC never converts to UC.** Only "shortfall DC-equivalent value → UC top-up cost" exists, one direction only. (Tier 2, Tier 3)
- **Player listing eligibility**: an item is listable only if it is present in `NORMAL_STORE_POOLS` or is an eligible common/uncommon/rare `MiniGameItem` with `isActive: true`. Auction-only, Royale-only, or otherwise NPC-shop-ineligible items can never be listed by a player. Equipped items (`equipped: true`) can never be listed — the host must be told to unequip first, never silently filtered. A frame can only be listed if present in `ownedChatFrames`, and never if it is the currently `equippedChatFrame`. None of this applies to the Owner panel path. (Tier 2)
- **Duration ceiling**: total live duration ≤ 3 days, for both player and Owner-panel giveaways. Draft lifetime defaults to 1 hour, changeable only from Owner settings. (Tier 1, Tier 3, Tier 7)
- **Probability**: pure equal-odds random draw only. No manual per-item odds, no auto-weighting, no luck-stat/VIP influence. (Tier 5)
- **Ending & distribution**: ends on timer expiry OR max-entrant cap reached, whichever is first — both trigger the identical resolution path. Zero entrants → full refund to host + notification. One entrant → entrant gets the entire pool. Multiple entrants → pool contents randomly distributed one unit at a time across entrants until exhausted. (Tier 4, Tier 5)
- **One entry per user per giveaway; host can never enter their own giveaway.** Enforced server-side via a unique index, never just UI-hidden. (Tier 4)
- **Card image**: exactly one image per giveaway, generated once at creation, never regenerated. (Tier 3)
- **Anonymity is giveaway-only** and never touches normal Feed posts. Anonymous host: no name, no avatar, no frame, not clickable, shown as "??? Anonymous Benefactor". (Tier 3, Tier 4)
- **Feed TTL exception**: an open giveaway must never be deleted by the normal 30-day `FeedEvent` TTL. It lives in its own `Giveaway` collection and is only referenced in the Feed as a special card type; once concluded, its Feed card can expire normally. (Tier 1, Tier 3)

---

## TIER 1 — DATA MODELS & OWNER SETTINGS
**Goal: every field every later tier needs must exist here, correctly typed, with no retrofits needed downstream.**
Status: ✅ Done

### 1.1 — `Giveaway` model
Create `artifacts/api-server/src/models/Giveaway.ts`:
```typescript
host: ObjectId (ref: User)
isOwnerHosted: Boolean (default: false)
isAnonymous: Boolean (default: false)
status: "draft" | "live" | "ended" | "refunded"
pledge: {
  dc: Number (default: 0)
  uc: Number (default: 0)        // nc field on User
  keys: Number (default: 0)
  items: [{ itemId: ObjectId (ref: Item), name: String, quantity: Number, iconUrl: String }]
  frames: [String]                // frame ids from FRAME_CATALOG
}
pledgeValueDc: Number             // total DC-equivalent value at creation, from §2.2 valuation
ucTopUpPaid: Number (default: 0)
maxEntrants: Number
durationMs: Number                // total chosen live duration, ≤ 3 days in ms
createdAt: Date
draftExpiresAt: Date              // only meaningful while status === "draft"
liveExpiresAt: Date               // only set once status flips to "live"
cardImageUrl: String              // set once, never regenerated
resolvedAt: Date
winners: [{ userId: ObjectId, dc: Number, uc: Number, keys: Number, items: [{ itemId: ObjectId, quantity: Number }], frames: [String] }]
feedEventId: ObjectId (ref: FeedEvent)
```
Add indexes: `{ host: 1, status: 1 }` (for the Tier 2 concurrent-open-giveaway check), `{ status: 1, liveExpiresAt: 1 }` (for the Tier 5 worker poll), `{ status: 1, draftExpiresAt: 1 }` (for draft auto-expiry).

### 1.2 — `GiveawayEntry` model
Create `artifacts/api-server/src/models/GiveawayEntry.ts`:
```typescript
giveawayId: ObjectId (ref: Giveaway)
userId: ObjectId (ref: User)
enteredAt: Date
```
Unique compound index on `{ giveawayId: 1, userId: 1 }` — this is the server-side one-entry-per-user enforcement, not a UI check.

### 1.3 — `User` model additions
Add to `models/User.ts`, without touching any existing field:
```typescript
underReview: Boolean (default: false)
underReviewReason: String (default: null)
```

### 1.4 — Owner settings: draft lifetime config
Add an Owner-configurable setting (reuse whatever pattern owner-tunable config already uses in this codebase, e.g. a small `GameConfig`/settings doc, or a dedicated field if no such pattern exists) for `giveawayDraftLifetimeMs`, default `3600000` (1 hour). Only a route under `routes/owner.ts` gated by `requireOwner` may change it. The 3-day live-duration ceiling is a hardcoded constant (`3 * 24 * 60 * 60 * 1000`), not owner-configurable per this plan.

### Done-check before marking ✅
Re-read §1.1–1.4 above field by field and confirm every field a later tier references by name in this file exists with the correct type, and that all three indexes exist.

---

## TIER 2 — ELIGIBILITY & VALUATION ENGINE
**Depends on: Tier 1**
Status: ✅ Done

### 2.1 — Listing eligibility check
Create a reusable function (e.g. `lib/giveawayEligibility.ts`):
- `isItemGiveawayEligible(item)`: `false` if `item.equipped === true`; otherwise `true` only if `item.name`/id appears in `NORMAL_STORE_POOLS` (any store) or matches an active `MiniGameItem` with `tier` in `common|uncommon|rare`. Epic/Legendary and anything not found in either catalog returns `false`.
- `isFrameGiveawayEligible(user, frameId)`: `false` if `frameId === user.equippedChatFrame`; otherwise `true` only if `frameId` is in `user.ownedChatFrames`.
- Both functions take an `bypassForOwnerPanel: boolean` param (or equivalent) so Tier 7's Owner-panel route can skip these checks entirely without duplicating logic.
- When an item/frame fails eligibility, the API response must say *why* (e.g. "unequip this item first", "not sold in NPC shops") — never silently drop it from the accepted list.

### 2.2 — Valuation & UC shortfall calculator
Create (e.g. `lib/giveawayValuation.ts`):
- `computePledgeValueDc(pledge)`: sums `dc` + `keys * <keys-to-dc reference value already used elsewhere in the economy, if one exists — otherwise treat keys as their own line item with a documented fallback>` + each item's `marketPrice ?? item.basePrice`. UC pledged directly is tracked separately, not folded into this DC total.
- `computeHostCoverage(host, pledge)`: for each pledge line (dc, keys, each item quantity), compare against what the host actually owns; return the shortfall.
- `computeUcTopUpCost(shortfallDcValue)`: converts the shortfall's DC-equivalent value into a UC cost using a rate derived mathematically from the current UC store pricing (locate the existing UC purchase price-per-unit in `store.ts` and derive DC-per-UC from it; document the exact formula in a code comment at the top of this function). This is the **only** DC→UC-adjacent conversion allowed anywhere in the codebase for this feature, and it only ever produces a UC *cost*, never a DC payout.

### 2.3 — Anti-abuse limits
Add validation constants and checks (used by Tier 3's creation route):
- `MIN_PLEDGE_VALUE_DC` — reasonable conservative default, documented in a code comment.
- `MAX_CONCURRENT_OPEN_GIVEAWAYS_PER_HOST` — reasonable conservative default (e.g. within 1–3), documented in a code comment. Query via the `{ host: 1, status: 1 }` index from Tier 1.
- `MAX_ENTRANT_CAP` — reasonable conservative default (e.g. within 500), documented in a code comment. Host-chosen `maxEntrants` must be validated against this and rejected if higher; "unlimited" must not be a selectable value anywhere in the API surface.

### Done-check before marking ✅
Re-read §2.1–2.3 and Appendix A's eligibility/DC-UC bullets; confirm every check is enforced server-side (not just suggested in a comment), and manually trace one item through each eligibility function to confirm correct pass/fail behavior.

---

## TIER 3 — CREATION, DRAFT, ESCROW, AND CARD IMAGE
**Depends on: Tier 1, Tier 2**
Status: ✅ Done

### 3.1 — Draft creation route
`POST /api/giveaways/draft` (player-authenticated): accepts pledge selections, anonymity flag, duration (validated ≤ 3-day ceiling), `maxEntrants` (validated against Tier 2's cap). Runs Tier 2's eligibility checks on every item/frame; rejects with a specific reason on any ineligible item rather than dropping it. Runs Tier 2's valuation + coverage check; if short, returns the required `ucTopUpCost` without deducting anything yet. Creates the `Giveaway` doc with `status: "draft"`, `draftExpiresAt: now + giveawayDraftLifetimeMs`. Nothing is deducted from the host at this step.

### 3.2 — Confirm/top-up route
`POST /api/giveaways/:id/confirm`: if a shortfall exists, atomically deduct the required UC (reuse the `$inc` + `{ $gte: cost }` guard pattern from `store.ts`/`bank.ts` to avoid race conditions); if the host declines or doesn't have enough UC, the draft simply remains in draft until it naturally expires per §3.3 — do not auto-cancel it early just because top-up was declined once. On successful confirm: atomically deduct the full pledge (dc, keys, each item quantity, each frame flag) from the host, flip `status` to `"live"`, set `liveExpiresAt = now + durationMs`, generate the card image (§3.4), and create the Feed card (§3.5).

### 3.3 — Draft auto-expiry
Add a check (reuse the Tier 5 worker, or a lightweight scheduled check if that worker isn't ready yet — but do not duplicate the polling logic once Tier 5 exists) that deletes any `Giveaway` with `status: "draft"` and `draftExpiresAt < now`. Since nothing was ever deducted while in draft, deletion has no side effects — no refund logic needed here.

### 3.4 — Card image generation
Generate exactly one image at the moment a giveaway goes live, by compositing the pledged items' existing `iconUrl`s into a single collage/grid image server-side. Add whatever real image-compositing dependency this requires (e.g. a canvas/image library) — do not fake this with a placeholder image or skip it. Store the result at `cardImageUrl`. This function must never run a second time for the same giveaway.

### 3.5 — Feed card creation
Create a `FeedEvent` of a new type (e.g. `"giveaway"`) pointing at the `Giveaway._id` via `feedEventId`/a reference field, so the Feed only needs to render a card, not duplicate the giveaway's data. This `FeedEvent` must be exempt from being treated as expired/removed by the normal 30-day TTL while the referenced `Giveaway.status` is `"live"` — implement this either by excluding `"giveaway"`-type events from the TTL-driven UI/query while live, or by only creating the `FeedEvent` once the giveaway concludes (collapsed card while live must instead be served directly from the `Giveaway` collection). Pick one approach and apply it consistently — do not half-implement both.

### Done-check before marking ✅
Re-read Appendix A's escrow-timing and card-image bullets plus §3.1–3.5; trace a full draft → shortfall → top-up → live path and confirm balances change exactly once, at the correct step, with no path that reaches `"live"` without escrow having run first.

---

## TIER 4 — ENTRY, VIEWING, "TRY YOUR LUCK"
**Depends on: Tier 3**
Status: ✅ Done

### 4.1 — Feed/collapsed card rendering
Frontend: collapsed card shows the single `cardImageUrl`, host display (real name+frame if not anonymous, "??? Anonymous Benefactor" with no avatar/frame/click-through if anonymous), countdown to `liveExpiresAt`, and current entrant count vs `maxEntrants`.

### 4.2 — Expanded view
Clicking the card expands to show the full pledge contents (all items/dc/uc/keys/frames in the pool) below the card, plus a "🤞 Try your luck" button.

### 4.3 — Entry route
`POST /api/giveaways/:id/enter`: reject if `giveaway.host === userId` (host can't enter own giveaway), reject if `status !== "live"`, reject via the Tier 1 unique index if the user already entered, reject if `user.underReview === true` (ties into Tier 6). On success, insert a `GiveawayEntry` and increment an entrant counter.

### 4.4 — Cap-reached trigger
If inserting the entry brings the entrant count to `maxEntrants`, immediately invoke the exact same resolution path Tier 5's worker uses for timer expiry — do not write a second/duplicate distribution code path for this case.

### Done-check before marking ✅
Re-read Appendix A's anonymity and one-entry-per-user bullets plus §4.1–4.4; confirm anonymity is respected in every response payload the entry/expanded-view routes return, not just the collapsed card, and that cap-reached and timer-expiry call the same underlying function.

---

## TIER 5 — ENDING, DISTRIBUTION, REFUND WORKER
**Depends on: Tier 4**
Status: ✅ Done

### 5.1 — Background worker
Add a worker following the existing arena auto-timeout worker's pattern: polls for `Giveaway` docs with `status: "live"` and `liveExpiresAt <= now`, and atomically claims each one before resolving (e.g. a conditional `findOneAndUpdate` that only succeeds if `status` is still `"live"`) so two ticks can never double-process the same giveaway.

### 5.2 — Resolution logic
Shared function, called both by the worker (§5.1) and by the cap-reached trigger (§4.4):
- Zero `GiveawayEntry` docs for this giveaway → return the entire pledge to `host` via the same atomic `$inc` patterns used elsewhere, create a `Notification` explaining the refund, set `status: "refunded"`.
- Exactly one entrant → transfer the entire pledge to that entrant, `Notification` to them, `Notification` to host that the giveaway concluded, `status: "ended"`.
- Multiple entrants → randomly shuffle the list of entrants, then distribute the pool's contents one unit at a time (each DC unit/keys unit/item unit/frame) across the shuffled list until exhausted, looping the entrant list if there are more units than entrants; record the final per-user split in `winners`; `Notification` to every winner with what they received, `Notification` to host that it concluded; `status: "ended"`.
- In every branch, verify the sum of what's distributed/refunded exactly equals the original `pledge` — no created or destroyed currency/items.

### 5.3 — Owner-hosted resolution
Same resolution function, but for `isOwnerHosted: true` giveaways there is no "refund to Owner" branch — on zero entrants, the conjured pool simply dissolves (nothing to return, since nothing was ever deducted from a real balance); log this outcome instead of creating a refund notification to a real user.

### Done-check before marking ✅
Re-read Appendix A's ending/distribution bullet and §5.1–5.3; simulate zero/one/many-entrant cases by tracing the code and confirm no duplication or lost remainder, and that the worker's atomic claim genuinely prevents double-processing.

---

## TIER 6 — VANTA / ANTI-ABUSE ENFORCEMENT
**Depends on: Tier 1, Tier 4**
Status: ✅ Done

### 6.1 — New Vanta trigger
Add a `giveaway_alt_farming` trigger at `severity: "critical"` to the existing Vanta detection in/near `auth.ts`'s alt-account check: when multiple `GiveawayEntry` docs on the same giveaway (or across a short recent window) come from accounts sharing `lastLoginIp`/overlapping `loginIpHistory`, log a `VantaLog` entry with this trigger and enough `details` for staff to review (which giveaway, which accounts, which shared IP).

### 6.2 — Immediate enforcement
On trigger, immediately set `User.underReview = true` with `underReviewReason` set on every implicated account — not after staff review, at detection time. Tier 4's `enter` route (§4.3) and any future "claim winnings" step must reject action from any account with `underReview === true`.

### 6.3 — Staff dashboard
Surface the new trigger in the existing staff Vanta dashboard (`routes/vanta.ts`) alongside existing triggers — no separate UI needed, reuse what's there.

### Done-check before marking ✅
Re-read Appendix A and §6.1–6.3; confirm `underReview` truly blocks entry/claim end-to-end (test by tracing a flagged account through `enter`), not just written to the log.

---

## TIER 7 — OWNER PANEL HOSTING
**Depends on: Tier 1, Tier 2, Tier 3, Tier 5**
Status: ✅ Done

### 7.1 — Owner-panel creation route
`POST /api/owner/giveaways` gated by `requireOwner`: identical shape to Tier 3's `draft`/`confirm` flow, but sets `isOwnerHosted: true`, `host` display resolved to "System" everywhere in the API/UI, skips Tier 2's eligibility checks entirely (pass the bypass flag), skips escrow deduction entirely, skips the UC top-up flow entirely (nothing is ever short). Still enforces the Tier 1 3-day duration ceiling.

### 7.2 — Draft-lifetime setting route
`PATCH /api/owner/settings/giveaway-draft-lifetime` gated by `requireOwner`, updates the Tier 1.4 config value. No other route may change it.

### 7.3 — Normal-flow exception check
Confirm explicitly (write a note in code comments, not in this file) that if a user with the `owner` role creates a giveaway through the *normal player* route (§3.1), `isOwnerHosted` stays `false` and every player restriction (escrow, eligibility, cost) still applies — the exemption exists only via the §7.1 route.

### Done-check before marking ✅
Re-read Appendix A's Owner-panel-exception bullet and §7.1–7.3; confirm the exemption cannot be reached from the normal player creation route under any input.

---

## TIER 8 — SYSTEM AUTO-POSTING EXTENSIONS
**Depends on: nothing else in this file (can be built any time after Tier 1 exists)**
Status: ✅ Done

### 8.1 — Leaderboard highlights
Hook into wherever leaderboard rank changes are already computed; call `postToSystemFeed` when a player reaches #1 or enters the top 3, tagging the player(s).

### 8.2 — New auction listings
Hook into the auction-listing-creation route; call `postToSystemFeed` when a new auction goes live, linking to `/auction`.

### 8.3 — Anonymized weekly ban count
Add a scheduled post (weekly) reporting the number of accounts banned that week. If a name is ever included, it must be masked using a new shared utility (e.g. `lib/maskUsername.ts` — `al******a` style), centralized and reused, not inline string-slicing at the call site. Default to count-only if no name-inclusion requirement is confirmed elsewhere.

### Done-check before marking ✅
Re-read §8.1–8.3; confirm each hook fires from a real code path that already exists for that event (not a guessed cron interval), and that the masking utility is the single implementation used anywhere a partially-masked name is needed.

---

## OPEN ITEMS OWNED BY THE PROJECT OWNER (not yet decided, defaults chosen by agent if untold)
- Exact `MIN_PLEDGE_VALUE_DC`, `MAX_CONCURRENT_OPEN_GIVEAWAYS_PER_HOST`, and `MAX_ENTRANT_CAP` values (Tier 2) — agent picks a reasonable conservative default and documents it in code comments only, never by editing this file.
