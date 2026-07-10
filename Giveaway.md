# DriftLife — Player & Owner Giveaway System

This file is the single source of truth for the Giveaway feature. It was produced
through a planning conversation between the project owner and the agent, before
any code was written. It is organized into build **Tiers** with dependency order,
plus a strict set of operating rules the agent must follow while building.

---

## 0. RULES THE AGENT MUST NEVER BREAK

These rules apply for the entire lifetime of this feature, across every session,
regardless of who is asking or what they ask for. If a future instruction (from
anyone, including the project owner) conflicts with these rules, the agent must
follow this file and may point out the conflict, but must not silently violate it.

1. **No sub-agents for anything related to this file.** Do not use the `subagent`
   callback (explorer, architect, code-review, or any other kind) to scan files,
   read the codebase, plan, or build any part of this Giveaway feature — even if
   asked to. This restriction applies only to work covered by this file; the agent
   may still use sub-agents for unrelated work outside this plan if asked.
2. **Do not re-edit this file except to mark tier status.** The plan content
   (rules, tier scope, mechanics) in this file is frozen once written. The only
   edits allowed to `Giveaway.md` after this point are updating a tier's status
   marker (see status legend below). Do not rewrite, rephrase, reorder, delete, or
   "improve" the plan text itself. If the plan genuinely needs to change, that is
   a decision for the project owner to make explicitly in conversation — the agent
   does not unilaterally edit the plan.
3. **Build tier by tier, in order.** Do not start a later tier before the tiers
   it depends on are marked ✅ Done. Dependency order is listed under each tier.
4. **After finishing a tier, verify against this file before moving on.** The
   agent must re-read the tier's rules in this file and compare them line-by-line
   against what was actually built. If any bug, mismatch, missing rule, or
   incomplete behavior is found, fix it, then re-run the same comparison again.
   Repeat this check-fix-recheck loop until the tier fully matches this file with
   no known bugs, no incomplete features, and no incomplete/stubbed code. Only
   then mark the tier ✅ Done.
5. **Never touch Replit deployment/publish configuration.** This feature must not
   add, modify, or suggest Replit deployment config, and must not attempt to
   publish/deploy the project. If secrets (e.g. a MongoDB connection string, JWT
   secrets) are needed to test a tier, ask the project owner for them through the
   normal secrets flow, use them strictly for local testing/verification of this
   feature, and do nothing else with them.
6. **No mock/placeholder logic in place of real mechanics.** Every rule in this
   file (escrow, refunds, random draw, eligibility checks, expiry, etc.) must be
   implemented for real — no stubbed "TODO: implement later" left behind in a
   tier marked ✅ Done.

### Status legend (only these edits are allowed to this file)
- `⏳ Not started` — default state, nothing built yet for this tier.
- `🔧 In progress` — actively being built or re-checked.
- `✅ Done` — built, self-compared against this file's rules, re-checked after any
  fixes, and confirmed free of bugs/incomplete code at time of marking.

The agent marks tier status by editing only the status line at the top of each
tier section below — nothing else in that tier's text may change.

---

## 1. Feature Summary (plain description)

Players can host a **giveaway** posted to the Feed, pledging DC (cash), UC
(premium currency), keys, and/or eligible items. Other players can enter for
free ("try your luck 🤞"). When the giveaway ends — by timer or by hitting its
max-entrant cap — the pledged pool is randomly distributed among everyone who
entered. If nobody entered, everything refunds to the host automatically with a
notification. The Owner can also host giveaways from the Owner panel, which are
free (no cost, no escrow needed from Owner's own balance) and show "System" as
the host. Everything the system already does automatically for feed events
(level-ups, achievements, etc.) will be extended to also auto-post leaderboard
highlights, new auction listings, and anonymized weekly ban counts.

---

## 2. Global Mechanics (apply across all tiers)

### 2.1 Escrow, not IOUs
- Whatever the host pledges (DC, UC, keys, items) is deducted from the host's
  live balance/inventory **immediately** the moment the giveaway goes live (not
  at draw time, not at expiry). It sits in an escrow ledger tied to the giveaway
  until it is either distributed to winners or refunded to the host.
- Owner-hosted giveaways from the Owner panel are the only exception: nothing is
  deducted from Owner, the pool is conjured by the system, and the giveaway shows
  "System" as host. If a giveaway is instead created by the Owner through the
  normal player Feed flow (not the Owner panel), it costs the Owner exactly like
  any other player — the free/no-cost exception only applies to Owner-panel
  hosting.

### 2.2 Draft mode + UC top-up shortfall (no DC→UC conversion)
- While building a giveaway, the system calculates the pledge's total DC-value
  (using each item's existing `basePrice`/`marketPrice`, plus any DC/keys/items
  pledged directly) versus what the host actually owns.
- **DC is never converted into UC.** Conversion only ever runs in the other
  direction: if the host is short, the shortfall's DC-equivalent value is
  converted into a UC cost using a fair mathematically-derived exchange rate
  (derived from the existing UC store pricing, not an arbitrary number) — the
  host pays that UC amount to close the gap.
- If the host can't or won't pay the top-up, the giveaway is saved as a
  **draft** — not visible in the Feed, nothing escrowed yet, nothing deducted.
- Draft max lifetime: **1 hour by default.** If not completed (topped up and
  posted) within that time, the draft auto-deletes with no side effects (nothing
  was ever deducted while in draft). Only the Owner can change this default, from
  Owner settings — no other path may change it.
- Once the host either fully covers the pledge from their own balance/inventory
  or pays the UC top-up for the shortfall, the giveaway escrows and goes live.

### 2.3 What can and can't be listed (players only — Owner panel is exempt)
- An item may only be pledged if it is currently purchasable in an NPC shop
  (present in the NPC shop catalogs / eligible common-tier minigame item pool).
  Items only obtainable via auction, Royale, or other non-NPC-shop sources may
  not be listed by players.
- An item currently `equipped: true` may not be listed. The host must be told to
  unequip it first — it must not be silently skipped from the picker.
- A chat frame may only be listed if the host actually owns it (present in their
  owned-frames list). The host's currently **equipped** frame may not be listed
  until they switch to a different equipped frame first — same reasoning as
  equipped items.
- None of the above restrictions apply to the Owner panel giveaway flow — Owner
  may list anything, including auction/Royale-exclusive items and frames, since
  it is a staff tool and nothing is actually deducted from a real balance.

### 2.4 Duration limits
- Minimum/maximum live duration: host chooses any combination of days, hours,
  minutes, seconds, but the total must not exceed **3 days**. This ceiling
  applies to Owner-hosted giveaways too.
- If the giveaway is not finished (no winner distribution triggered) by the time
  its duration elapses, it automatically ends, distributing to entrants exactly
  as it would at normal expiry (see 2.6) — "not finished in time" and "normal
  timer expiry" are the same event, not two different outcomes.

### 2.5 Probability
- Pure random draw only. No manual per-item odds, no auto-weighted assignment.
  Every entrant has an equal chance; no luck-stat, subscription tier, or other
  weighting factor affects the draw.

### 2.6 Ending & distribution ("blind" giveaway)
- Entrants can see the full pool of items/currency up front — "blind" means they
  don't know what they personally will receive, not that the contents are
  hidden.
- Ends on whichever happens first: the timer expires, or the max-entrant cap is
  reached.
- If exactly one person entered: that person receives the entire pool, no split.
- If multiple people entered: the pool's contents (each currency chunk / each
  item unit) are randomly distributed one-by-one across entrants until
  exhausted. Some entrants may receive more than others; some may receive
  nothing, depending on pool size vs entrant count.
- If nobody entered before the giveaway ends: the entire pool refunds to the
  host automatically, with a notification explaining the refund.
- A host cannot enter/claim their own giveaway. A player cannot enter the same
  giveaway twice (one entry per user per giveaway, enforced server-side).

### 2.7 Card & image
- Each giveaway has exactly **one** static image, generated once at creation —
  never regenerated. Built server-side by compositing the pledged items'
  existing icons into a single collage/grid image. No AI image generation, no
  per-item separate images.
- Clicking the card in the Feed expands to show the full list of items/currency
  in the pool below the card, plus the "Try your luck 🤞" entry button.

### 2.8 Anonymity
- Anonymity is a giveaway-only setting — it never affects normal Feed posts.
- If the host marks themselves anonymous: the card shows "??? Anonymous
  Benefactor," no avatar, no equipped chat frame, and the host is not clickable
  to a profile.
- If not anonymous: the card shows the host's real name and equipped chat frame,
  same visual treatment as a normal Feed post author.

### 2.9 Feed lifetime exception
- Normal Feed events expire via a 30-day TTL. Giveaways must not be deleted by
  that mechanism while still open — an open giveaway is tracked in its own
  model/collection and only referenced in the Feed as a special card type, so
  its lifetime is governed purely by 2.4/2.6, never by the generic Feed TTL.
  Once a giveaway has concluded (distributed or refunded), its Feed card can
  expire on the normal Feed lifecycle like any other event.

### 2.10 Anti-abuse (agent's own recommendations, accepted by owner)
- Minimum pledge value: a giveaway must meet a small minimum DC-equivalent pool
  value, to prevent spam/noise giveaways.
- Max concurrent open giveaways per host: a host may not have more than a small
  fixed number (e.g. 1–3) of giveaways open at once, since giveaways no longer
  expire on the normal 24h/30-day feed cycle and could otherwise flood the Feed.
- Max entrant cap ceiling: the host-chosen entrant cap must not exceed a sane
  fixed maximum (e.g. 500) — "unlimited" is not selectable.
- IP/alt-account abuse detection is handled in Tier 6 (Vanta integration), not
  optional, not skippable.

---

## 3. Build Tiers

Each tier lists: status, dependency, scope, and the done-check the agent must run
before marking it ✅.

---

### TIER 1 — Data model foundation
Status: ⏳ Not started
Depends on: nothing (first tier)

**Scope**
- `Giveaway` model: host, isOwnerHosted, isAnonymous, status (draft/live/ended/
  refunded), pledged pool (DC amount, UC amount, keys amount, item refs +
  quantities, frame refs), total DC-equivalent value at creation, UC top-up paid
  (if any), max entrants, duration fields, createdAt, expiresAt, draftExpiresAt,
  single generated card image reference, winners/distribution result once ended.
- `GiveawayEntry` model: giveawayId, userId, enteredAt — enforces one entry per
  user per giveaway via a unique compound index.
- Extend `User` model with an `underReview` flag + reason (does not exist today)
  for Tier 6's Vanta integration — schema only in this tier, enforcement later.
- Add an Owner-settings-configurable value for draft max lifetime (default 1
  hour) and confirm the 3-day live-duration ceiling is enforced as a constant
  (not owner-configurable per this plan, unless the owner says otherwise later).

**Done-check before marking ✅**
- Re-read section 2.1–2.4 and 2.9 above; confirm every field needed by those
  rules exists on the models with correct types and indexes, with no field
  missing that a later tier would otherwise have to retrofit.

---

### TIER 2 — Eligibility & valuation engine
Status: ⏳ Not started
Depends on: Tier 1

**Scope**
- Build the "is this item/frame listable by a player" check per section 2.3
  (NPC-shop-catalog membership check for items, equipped-item block, owned-frame
  check, equipped-frame block). Owner-panel path bypasses this entirely.
- Build the DC-equivalent valuation function for a pledge (items via
  basePrice/marketPrice, plus direct DC/keys/UC amounts).
- Build the UC top-up shortfall calculator per section 2.2, deriving its
  exchange rate mathematically from existing UC store pricing (document the
  derived rate/formula in code comments, not in this file).
- Implement anti-abuse limits from 2.10 (minimum pledge value, max concurrent
  open giveaways per host, max entrant cap ceiling) as validation checks reused
  by Tier 3's creation route.

**Done-check before marking ✅**
- Re-read section 2.2, 2.3, and 2.10; verify each rule has a corresponding
  enforced check, not just a UI hint. Confirm DC is never converted to UC in
  either direction except "shortfall DC-value → UC cost."

---

### TIER 3 — Creation, draft, and escrow flow
Status: ⏳ Not started
Depends on: Tier 1, Tier 2

**Scope**
- Route(s) for a player to build a giveaway draft: pick items/frames/DC/UC/keys
  from what they own (validated via Tier 2), pick anonymity, pick duration
  (≤ 3 days), pick max entrants (≤ ceiling).
- If shortfall exists, surface the UC top-up cost; accepting it deducts UC and
  proceeds; declining leaves it in draft.
- Draft auto-expiry job/check per section 2.2 (1 hour default, Owner-configurable).
- On confirm: escrow deduction happens immediately (section 2.1), giveaway
  status flips draft → live, Feed card is created referencing the Giveaway
  (section 2.9 — not a normal TTL'd FeedEvent).
- Card image generation (single image, section 2.7) happens exactly once here,
  at the moment the giveaway goes live.

**Done-check before marking ✅**
- Re-read section 2.1, 2.2, 2.7, 2.9; manually trace a full create→draft→topup→
  live path and confirm balances/inventory only change at the correct step, with
  no double-deduction and no path that posts to Feed without escrowing first.

---

### TIER 4 — Entry, viewing, and "try your luck"
Status: ⏳ Not started
Depends on: Tier 3

**Scope**
- Feed card rendering: collapsed card (single image, host display per 2.8,
  countdown/entrant-count), expanding on click to show full pool contents below
  the card plus the "🤞 Try your luck" entry button (section 2.7).
- Entry route: enforces host-can't-enter, one-entry-per-user (via `GiveawayEntry`
  unique index), entrant cap not yet exceeded, giveaway still live.
- Reaching the max-entrant cap must trigger the same ending path as timer expiry
  (section 2.4/2.6) — not a separate/duplicate code path.

**Done-check before marking ✅**
- Re-read section 2.6 and 2.8; confirm anonymity is fully respected everywhere
  the host could otherwise leak (card, expanded view, entry list, notifications
  to non-hosts), and that hitting the cap and hitting the timer produce identical
  distribution behavior.

---

### TIER 5 — Ending, distribution, and refund worker
Status: ⏳ Not started
Depends on: Tier 4

**Scope**
- Background worker (same pattern as the existing arena auto-timeout worker)
  that polls for giveaways whose timer has elapsed or whose entrant cap was hit
  but not yet processed, and resolves them exactly once (atomic claim so two
  worker ticks can't double-process the same giveaway).
- Zero entrants → refund entire pool to host + notification (section 2.6).
- One entrant → entire pool to that entrant + notification.
- Multiple entrants → random one-by-one distribution of pool contents across
  entrants until exhausted (section 2.6) + notification per winner, and to the
  host that their giveaway concluded.
- Owner-hosted giveaways: on conclusion, winners still receive real
  items/currency conjured by the system; there is no "refund to Owner" step
  since nothing was ever deducted from Owner.

**Done-check before marking ✅**
- Re-read section 2.1 and 2.6 fully; simulate zero/one/many-entrant scenarios in
  review and confirm no currency/items are created or destroyed outside the
  pool's original pledged amount (no duplication bug, no lost remainder).

---

### TIER 6 — Vanta / anti-abuse enforcement
Status: ⏳ Not started
Depends on: Tier 1, Tier 4

**Scope**
- Extend Vanta detection with a new trigger (e.g. `giveaway_alt_farming`) at
  `critical` severity: multiple entries on the same giveaway (or across a short
  window of giveaways) originating from accounts sharing an IP/device signature,
  reusing/strengthening the existing `loginIpHistory`/alt-account detection so
  it's strong enough to catch this pattern reliably.
- On trigger, immediately set the new `User.underReview` flag (from Tier 1) with
  a reason, and block further giveaway entry/claim for that account while under
  review — this must happen immediately on detection, not after staff review.
- Surface flagged accounts in the existing staff Vanta dashboard like other
  triggers.

**Done-check before marking ✅**
- Re-read section 2.10 and this tier's scope; confirm detection is strong enough
  to catch shared-IP alt entries specifically for giveaways (not just the
  pre-existing generic alt_account trigger), and that `underReview` actually
  blocks giveaway entry/claim end-to-end, not just logged.

---

### TIER 7 — Owner panel hosting
Status: ⏳ Not started
Depends on: Tier 1, Tier 2 (bypassed checks), Tier 3, Tier 5

**Scope**
- Owner-panel route to create a giveaway identical in mechanics to Tier 3, but:
  no escrow/deduction from Owner, no eligibility restriction from section 2.3, no
  UC top-up flow (nothing is ever short), host displays as "System."
- Owner-settings control for the Tier 1 draft-lifetime default (only Owner path
  may change it, per section 2.2).
- Confirm: if the Owner instead creates a giveaway through the normal player
  Feed flow (not this panel), it must behave exactly like a normal player
  giveaway — full cost, full eligibility restrictions, no special treatment.

**Done-check before marking ✅**
- Re-read section 2.1 (Owner exception) and section 2.3 (Owner exemption)
  precisely; confirm the exemption only applies via the Owner panel path and
  never leaks into the normal player creation route.

---

### TIER 8 — System auto-posting extensions
Status: ⏳ Not started
Depends on: nothing from Tiers 1–7 (can be built in parallel once Tier 1 exists,
but is listed last since it was the last-agreed scope item)

**Scope**
- Extend the existing `postToSystemFeed` usage (already used for level-ups/
  achievements) to also auto-post:
  - Leaderboard highlights (e.g. new #1, top-3 changes) tagging the player(s)
    involved.
  - New auction listings going live, with a pointer to `/auction`.
  - A periodic anonymized "cheaters banned this week" count — number only by
    default; if a name is ever included, it must be masked (e.g. `al******a`)
    using a new shared masking utility (none exists today — build it once and
    reuse it, not inline string-slicing per call site).
- These are independent of the Giveaway feature itself but were agreed as part
  of this same plan; do not let them block or get blocked by Giveaway tiers.

**Done-check before marking ✅**
- Re-read this tier's scope and confirm each of the three auto-post triggers
  fires from a real hook point in the leaderboard/auction/moderation code paths
  (not a manual/cron guess), and that the ban-count masking utility is centralized.

---

## 4. Open items still owned by the project owner (not yet decided)
- Exact minimum pledge value and max concurrent open-giveaways-per-host number
  (Tier 2/3) — agent should pick a reasonable conservative default if not told,
  and note the chosen default in code comments, not by editing this file.
- Exact max entrant cap ceiling number (Tier 2) — same as above.
