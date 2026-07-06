---
name: DriftLife Frame System (current)
description: Full frame catalog, component API, store/locker architecture, and backend routes after the spec-driven rebuild
---

## Frame Catalog (FRAMES in lib/chatFrames.ts)
- Exported as `FRAMES` (array of `Frame`) and `getFrame(id)` helper
- Two rarities only: `'elite'` and `'legendary'` — no standard/rare/common tiers
- 8 elite frames (500 NC): neon_drift, grid_static, street_phantom, urban_heat, signal_breach, night_market, chrome_edge, void_signal
- 4 legendary frames (2000 NC): apex, blackout_protocol, nova_circuit, sovereign
- All purchased with NC only; `availableVia` stub supports 'season-pass' | 'subscription' but unused
- `enrichFrames(frames, owned, equipped)` merges server ownership into `FrameWithStatus[]`
- Rarity colors: elite = #FFD700, legendary = #FF4FA3

## Frame Type Shape
```ts
interface Frame {
  id, name, rarity, description,
  headerVariant: 'solid' | 'animated-shimmer' | 'textured-weave',
  headerColor, accentColor, textOnHeader: 'white' | 'dark',
  bodyArt: BodyArt, logoComponent: string, profileBgAnimation: BodyArt,
  priceNC, availableVia[]
}
```

## ChatFrame Component (components/ChatFrame.tsx)
- `<ChatFrame frame={Frame|null} username level? timestamp? size? children>`
- `size="full"` → 85% max-width (chat/feed); `size="preview"` → 100% (store/locker)
- Chevron header clip-path: `polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)`
- Body: `#0A0008` bg, 1px solid accent border, BodyArtLayer behind message at z-index 0
- Footer: LEVEL N + timestamp, dim grey, outside the body
- `ChatFrameRenderer` is a backward-compat wrapper (same file); old imports still work
- Global CSS (`GLOBAL_FRAME_CSS`) injected lazily via `ensureCss()` on first render

## Body Art (components/frame-art/index.tsx)
- `<BodyArtLayer bodyArt={BodyArt} accentColor={string}>`
- CSS-based: speed-lines, data-grid, thermal-heat, glitch-tears, lantern-drift, chrome-shimmer, aurora-sovereign
- Canvas-based (useEffect + cancelAnimationFrame cleanup): smoke-particles, void-stars, gold-sparkles, code-rain, nova-burst

## Frame Logos (components/frame-logos/index.tsx)
- `<GlitchLogo frame={Frame} size={number}>` — 3-layer SVG glitch animation, fires every ~5-8s
- Logo map keyed by `frame.logoComponent` string (e.g. "ApexLogo", "SovereignLogo")
- Legendary frames get float animation (floatUpDown) on the logo

## Backend (api-server/src/routes/chatframes.ts)
- GET /api/chatframes → `{ catalog, owned[], equipped, nc }`
- POST /api/chatframes/buy/:frameId → deducts NC, adds to ownedChatFrames
- POST /api/chatframes/equip/:frameId → "none" to unequip
- frameId is cast via `String(req.params.frameId)` to avoid string|string[] TS error

## Store (pages/FrameStore.tsx)
- Owned frames are HIDDEN from listing (filtered out server-side via owned array)
- Filter tabs always render with (0) counts even when store is empty
- "Preview as others see you" toggle only shown when list is non-empty
- Profile preview triggers FrameProfilePreview page component (not modal)
- Equip/unequip happens only in Frame Locker (not the store)

## Frame Locker (Profile → Frames tab)
- Equipped block: full ChatFrame preview + [Unequip] button
- Collection grid: owned non-equipped frames, sorted Legendary-first then alpha
- [Go to Frame Store →] link always visible
- Uses `enrichFrames()` to combine local state with server response

## Profile Page (pages/ProfilePage.tsx)
- Banner zone (120px): headerVariant fill + ambient bodyArt at 20% opacity + gradient overlay
- Avatar ring: 3px solid accentColor + glow shadow
- Rarity badge + frame name pill in banner
- XP bar fill = accentColor (falls back to #3A3A5C with no frame)
- Stat strip: wallets keep own colors (never accent override); combat labels use accentColor
- Section card borders: borderLeft: 3px solid accentColor
- Tabs: OVERVIEW | STATS | FRAMES | INVENTORY | HISTORY | ACHIEVEMENTS
- BANNER_CSS injected as `<style>` tag for frame-header-apex + frame-header-sovereign classes

## FeedEvent model fix
- Added `actorChatFrame: string | null` and `actorLevel: number` to IFeedEvent interface (was missing, causing TS errors)
