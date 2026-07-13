# NC Spending Expansion — Utility Purchases + Cosmetics Store (Name Styles)

## Summary
Expand what players can buy with NC (Nova Credits) in two parts:
- **A. Utility purchases** — four NC buys added to their existing pages (energy refill, business
  laundering cooldown skip, name change token, loadout slot expansion).
- **B. Cosmetics Store** — a new store tab selling **Name Styles**: cosmetic username treatments
  (glow, gradient, glitch) that render wherever a username appears, following the existing
  `SubscriberNameBadge` visual pattern. Built as an extensible catalog so future cosmetic
  categories (banners, chat accents, themes) can slot in later without rework.

## Scope correction: "Stat Respec" dropped
Investigated the stats system: `charisma`/`intelligence`/`streetCred`/`strength` auto-increase on
level-up (no manual point allocation), and the Training Center's three trainable bonuses
(`combatAccuracyBonus`, `raceGearBonus`, `energyRegenBonus`) are independent caps a player can
train all three of — there's no build tradeoff to "undo." A respec has nothing meaningful to do
in this system, so it's dropped from scope rather than built as a purchase with no real effect.
Five original ideas → four utility purchases + the cosmetics store.

---

## A. Utility Purchases

### 1. Energy Refill
- **Where:** Store page, new "Boosts" section (alongside existing Keys purchase).
- **What:** Instantly refill energy to `maxEnergy`.
- **Cost:** `2 NC per point of energy restored` (min charge 10 NC), computed server-side from
  the player's current deficit at request time — mirrors the crafting timer-skip pricing pattern
  (`Math.max(floor, missing * rate)`).
- **Route:** `POST /api/store/refill-energy` — atomic `findOneAndUpdate` gated on
  `nc: { $gte: cost }`, sets `energy: maxEnergy`, deducts `nc`.

### 2. Business Laundering Cooldown Skip
- **Where:** Business page, next to the active laundering batch's countdown (same UX slot as the
  crafting job skip).
- **What:** Instantly completes the in-progress laundering batch (`launderCompletesAt` set to now).
- **Cost:** `Math.max(5, minutesRemaining)` NC — identical formula to the existing crafting skip,
  for cost-model consistency.
- **Route:** `POST /api/business/:id/skip-launder` — validates ownership + an active batch,
  atomic NC deduction, then completes the batch (reuses existing laundering-completion logic).

### 3. Name Change Token
- **Where:** Settings page, new field under the existing profile/account section.
- **What:** Change `username` (subject to existing validation: 3–20 chars, uniqueness, trim).
- **Cost:** Flat **500 NC**. No cooldown beyond normal validation — NC cost itself is the friction.
- **Route:** `POST /api/settings/change-username` — atomic NC deduction + uniqueness check in one
  transaction (existing username-uniqueness index enforces the race-safe fallback).
- **Side effects to update:** `senderTitle`/username-dependent denormalized fields, if any get
  discovered during implementation, get refreshed; confirmed no chat message documents store a
  denormalized username (they store `senderId` + resolve live) other than `ChatMessage.senderTitle`,
  which is unaffected.

### 4. Loadout Slot Expansion
- **Where:** Inventory page, near the equipped-loadout section.
- **What:** Permanently increases the number of equippable loadout slots by 1.
- **Cost:** Scaling — `300 NC * (current extra slots purchased + 1)`, capped at **+3 slots total**
  beyond the base loadout, to keep balance bounded.
- **Data:** New `User.purchasedLoadoutSlots` field (default 0, max 3).
- **Route:** `POST /api/inventory/buy-loadout-slot` — atomic NC deduction gated on both NC balance
  and the max-slots cap.

All four follow the existing atomic-deduction pattern (`findOneAndUpdate` with an `nc: { $gte }`
guard) already used across `store.ts`/`royale.ts`/`crafting.ts` — no new concurrency pattern needed.

---

## B. Cosmetics Store — Name Styles (v1 category)

### Concept
A new **Cosmetics Store** tab (accessible from the Store page as a sub-tab, matching the existing
Store page's tab pattern) that sells purely visual username treatments. Owned styles are equipped
one-at-a-time, similar in spirit to `equippedTitle`. Built as a generic catalog + equip system so
future categories (profile banners, chat accents, UI themes) reuse the same backend shape without
a redesign — but only Name Styles ships in this round.

### Catalog (initial 3 styles, priced by visual complexity)
| Style | Look | Price |
|---|---|---|
| **Cyan Pulse** | Steady soft cyan glow, gentle pulse (reuses `SubscriberNameBadge`'s cyan pulse keyframe at lower intensity) | 400 NC |
| **Magenta Drift** | Slow-moving gradient sweep across the username (cyan → magenta → cyan) | 800 NC |
| **Glitch Flicker** | Occasional 100ms glitch-flicker + chromatic-aberration split, evoking a corrupted signal | 1,200 NC |

Not reusing subscriber-tier colors/animations 1:1 — new, distinct palettes/keyframes so purchased
styles are visually distinguishable from subscription badges (avoids confusing "is this player
subscribed?" signal with "did they buy a cosmetic?").

### Data model
- New `CosmeticItem` collection: `{ id, category: "name_style", label, price, cssKey }` — seeded
  once (like `RoyaleItem`/`GameEmoji` patterns), not user-facing CRUD.
- `User` gains:
  - `ownedCosmetics: string[]` (cosmetic item ids owned)
  - `equippedNameStyle: string | null`

### Routes
- `GET /api/cosmetics` — catalog + which ones the current user owns/has equipped.
- `POST /api/cosmetics/:id/buy` — atomic NC deduction, `$addToSet` into `ownedCosmetics`.
- `POST /api/cosmetics/:id/equip` (or `null` to unequip) — validates ownership, sets
  `equippedNameStyle`.

### Rendering
- New `<NameStyle username tier styleId>` component wraps `SubscriberNameBadge`'s existing
  username slot — same integration point, so no per-page rewiring beyond passing the extra prop.
  Every screen currently rendering `user.username` directly (Chat, Leaderboard, Profile, Friends,
  City, Dashboard, Guilds, Arena, Race, Staff/Support/Owner) gets updated to pass
  `equippedNameStyle` through. If a subscriber tier badge is also active, the name style layers
  underneath/alongside it rather than overriding it (subscriber badge icon+label stays; the glow/
  animation on the username text itself comes from the name style if one is equipped and no
  subscriber tier is set — subscriber tier styling takes visual priority since it's rarer/paid-status
  signaling, to avoid clashing animations on the same text).

### Store UI
- New "Cosmetics" tab inside StorePage: grid of style cards showing a live preview of the
  player's own username rendered in that style, a price tag, and Buy/Equip/Equipped state —
  matches the visual language of the existing NC subscription tier cards.

---

## Out of scope (deferred, not part of this build)
- Profile Banners, Chat Accents, UI Accent Theme, Avatar Frames — user picked Name Styles only
  for now; the cosmetics backend (catalog + owned/equipped shape) is designed to accept these as
  new `category` values later without migration.

## Testing plan
- Manual: buy each utility purchase, confirm NC deduction + effect (energy set to max, laundering
  batch completes, username changes, loadout slots increase up to cap).
- Manual: buy a name style, equip it, confirm it renders in chat, leaderboard, and profile; confirm
  unequip reverts to plain username; confirm subscriber-tier players see tier styling take priority.
- Confirm insufficient-NC paths return clear error messages (matches existing `notEnoughNc` pattern).
