---
name: DriftLife Frame System (current)
description: Full frame catalog, component API, store/locker architecture, and backend routes after the tier-gallery redesign
---

## Frame Catalog (FRAMES in lib/chatFrames.ts)
- Exported as `FRAMES` (array of `Frame`) and `getFrame(id)` helper
- Three rarities: `'elite'` (900 NC), `'legendary'` (3,500 NC), `'mythic'` (6,000–12,000 NC, rarest/most expensive)
- Every frame is a uniquely named collectible — the on-frame badge shows the frame's own name, not a shared rarity label
- Acquisition is strictly paid: `nc-purchase`, `subscription` (paid perk), or an owner-hosted giveaway — **no frame is ever free or gacha/random-earned**
- The old free auto-granted Prestige frames (`prestige_frame_P1..P4`) were converted into purchasable mythic-tier frames (existing owned IDs preserved for players who already had them); the auto-grant on `/prestige` was removed server-side
- `RARITY_COLOR` / `RARITY_LABEL` cover all three tiers; extend both together when adding a 4th tier
- `enrichFrames(frames, owned, equipped)` merges server ownership into `FrameWithStatus[]`

## Frame Type Shape
```ts
interface Frame {
  id, name, rarity, description,
  headerVariant: 'solid' | 'animated-shimmer' | 'textured-weave',
  headerColor, accentColor, textOnHeader: 'white' | 'dark',
  bodyArt: BodyArt, tagShape?: 'pennant' | 'square',
  logoComponent: string, profileBgAnimation: BodyArt,
  priceNC, availableVia[]
}
```

## ChatFrame Component (components/ChatFrame.tsx) — tier-gallery layout
- `<ChatFrame frame={Frame|null} username level? timestamp? size? children>` — single component used everywhere a frame renders (chat, feed, store, locker, and other players' profile inspect modal)
- Layout: a name tag (pennant-clipped by default, `tagShape: 'square'` for terminal/tech themes) sits absolutely positioned top-left, overlapping the top of the bordered body box below it; a floating tier badge (`TierBadge`) sits top-right showing `frame.name.toUpperCase()` in the rarity color; footer row (LEVEL N + timestamp) sits below the box
- This one rebuild is what fixed chat/feed/profile visual inconsistency — all three already funneled through this component, the old code just hadn't been rebuilt to the new template yet (ChatFrameRenderer is only a re-export, not a divergent implementation)
- Per-frame special-case visuals kept: Blackout Protocol blink cursor in the name tag; Void Signal blue glow via `bodyBoxShadow`
- `size="full"` → 85% max-width (chat/feed); `size="preview"` → 100% (store/locker/inspect modal)
- Global CSS (`GLOBAL_FRAME_CSS`) injected lazily via `ensureCss()` on first render (APEX shimmer + Sovereign weave keyframes)

## Body Art (components/frame-art/index.tsx)
- `<BodyArtLayer bodyArt={BodyArt} accentColor={string}>`
- CSS-based: speed-lines, data-grid, thermal-heat, glitch-tears, lantern-drift, chrome-shimmer, aurora-sovereign, **petal-drift, frost-shimmer, circuit-pulse** (new, accent-color-parameterized, reused across many of the new themed tiers to avoid hand-building ~12 bespoke animations)
- Canvas-based (useEffect + cancelAnimationFrame cleanup): smoke-particles, void-stars, gold-sparkles, code-rain, nova-burst
- Known limitation: some of the original 12 canvas/CSS effects are hardcoded (not accent-color-parameterized) — accepted tradeoff for the new tiers that reuse them

## Other-player profile inspect (bug fix)
- `PlayerInspectModal.tsx` is the real "inspect another player" UI (not `FrameProfilePreview.tsx`, which is only the Store's own bespoke marketing preview card and was intentionally left alone)
- Root cause of "frames don't show on other players' profiles": the modal never fetched or rendered the frame at all. Fixed by adding `equippedChatFrame` to the backend `GET /user/profile/:id` response and rendering it via `<ChatFrame>` in the modal

## Backend (api-server/src/routes/chatframes.ts)
- `FRAME_CATALOG` (ids/rarity/priceNC) must be kept in sync with the frontend `FRAMES` catalog in `lib/chatFrames.ts` — they are two separate hand-maintained lists, no shared source of truth
- GET /api/chatframes → `{ catalog, owned[], equipped, nc }`
- POST /api/chatframes/buy/:frameId → deducts NC, adds to ownedChatFrames
- POST /api/chatframes/equip/:frameId → "none" to unequip

## Store (pages/FrameStore.tsx)
- `RarityFilter` type and filter tabs include all three rarities (`"all" | "elite" | "legendary" | "mythic"`) — extend this list too when adding a new tier
- Owned frames are HIDDEN from listing (filtered out server-side via owned array)
- Equip/unequip happens only in Frame Locker (not the store)

## Frame Locker (Profile → Frames tab)
- Collection grid sort order: mythic → legendary → elite, then alpha within tier

## Dev workflow quirk (unrelated to frame work, hit while testing it)
- `artifacts/driftlife`'s vite dev server requires `PORT` env var explicitly (throws if unset) — the shared `PORT` env var was removed earlier to fix an api-server conflict, so the driftlife `dev` script must explicitly `export PORT=5000` before invoking vite, same pattern as the api-server's `export PORT=8080`.
- The `API Server` workflow reliably fails `WorkflowsRestart` (times out / "didn't open port 8080") even though its own logs consistently show `Server listening port: 8080` right after MongoDB connects — this reproduces across many restart attempts and manual `nohup` runs die between separate shell calls, so it could not be worked around from inside the sandbox. Treat this as a platform-side port-detection issue for this repl, not a code bug, and don't loop on restarting it.
