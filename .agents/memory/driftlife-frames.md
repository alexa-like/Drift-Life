---
name: DriftLife Frames System
description: How frames are stored, catalogued, and rendered — critical sync requirement between backend and frontend catalogs.
---

## Rule
Frontend `driftlife/src/lib/frames.ts` FRAME_CATALOG `id` fields must exactly match backend `api-server/src/routes/frames.ts` FRAME_CATALOG `frameId` fields. If a backend frameId is not in the frontend FRAME_MAP, `getFrame()` falls back to `ghostFrame` and the frame renders as empty/invisible.

## Frame Ownership — Free Frames Bug
Free frames (`isFree: true` on backend, e.g. `ghostFrame`) are NEVER added to `user.ownedFrames`. ProfilePage must fetch `GET /api/frames` and use `frame.owned` (which correctly returns true for free frames) rather than filtering by `user.ownedFrames`. Direct filter on `user.ownedFrames` misses all free frames.

## FRAME_VARIANT (PlayerFrame.tsx) — 0-9 unique per tier
FRAME_VARIANT maps each frameId to 0-9 (unique index within the rarity tier). PlayerFrame.tsx and FrameCardWrapper.tsx use this index to parameterize animations (speed, direction, count, tail, freq, style). Common frames get 10 distinct static border designs (rounded/square/chamfer/double/dashed/glow/brackets/dots/X/rings). Animated tiers use index to vary speed/direction/count/frequency.

**Why:** The backend is the source of truth for what frames exist and can be purchased. The frontend only uses the catalog for color lookup and rendering. A mismatch means users see ghost frames even after purchasing/equipping real ones.

**How to apply:** Any time a new frame is added to the backend catalog, add the matching entry to the frontend catalog with the same id, correct glowColor, and rarity.

## Current IDs (backend frameId = frontend id)
- Common (static): ghostFrame, basicWhite, basicGray, neonBlue, neonGreen, neonRed, corpGray, streetOrange, cyanPulse, goldBasic
- Uncommon (shimmer): shimmerCyan, shimmerPurple, shimmerGold, shimmerRed, shimmerGreen, shimmerOrange, techShimmer, suitShimmer, crimsonShimmer, iceShimmer
- Rare (pulse): pulseCyan, pulsePurple, pulseGold, pulseRed, pulseGreen, hackerPulse, corePulse, vaultPulse, streetPulse, spectralPulse
- Epic (rotate): epicCyan, epicPurple, epicGold, epicRed, syndicate, gridCore, suitsFrame, epicVoid, epicInferno, epicNova
- Legendary (flicker): legendCyan, legendPurple, legendGold, legendRed, crimsonLord, arcLight, plasmaBolt, thunderClap, vantaLegend, executioner
- Mythic (matrix): matrixGreen, matrixBlue, matrixGold, matrixRed, omega, voidWalker, architect, nova2047, godMode, theOne

## Other notes
- ownedFrames + equippedFrame on User model; equip-frame route in user.ts; give-frame in dev.ts
- FrameLivePreview in FramesStorePage: always pass `colorOverride={frame.glowColor}` so backend color is used directly, not re-derived from the frontend catalog
- PRICE_OVERRIDES (Map) exported from market.ts — owner can set item prices via POST /api/owner/shop-items/:id/price (requireOwner); resets on server restart
