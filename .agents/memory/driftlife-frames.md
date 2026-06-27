---
name: DriftLife Frames System
description: Frame catalog, user model fields, and routes for the avatar frame system
---

## Key facts

- `frames.ts` exports `FRAME_CATALOG` (array of FrameDef) — NOT `FRAMES`. Always import as `FRAME_CATALOG` or alias it.
- Also exports: `FRAME_MAP`, `getFrame()`, `RARITY_ORDER`, `RARITY_COLOR`, `FrameDef`, `FrameRarity`
- `FrameDef` has: `id`, `name`, `rarity`, `glowColor`, `ncCost`, `earnedBy?` — NO `description` field

## User model
- `equippedFrame: string` (default: "ghostFrame") — already existed
- `ownedFrames: string[]` — added; must be included in `safeUser()` via `(user as any).ownedFrames || []`

## Routes
- `POST /api/user/equip-frame` — checks ownedFrames, sets equippedFrame
- `POST /api/dev/give-frame` — dev-only, adds frameId to ownedFrames

## Components
- `PlayerFrame` — canvas-based animated border per rarity (common=static, uncommon=shimmer, rare=pulse, epic=conic gradient, legendary=sparks, mythic=matrix rain)
- `AvatarWithFrame` — wraps PlayerFrame + procedural SVG avatar fallback
- `FrameRectBubble` — chat bubble with miniature frame; ChatMessage interface includes `districtId?`

**Why:** `pick()` in avatar.ts must accept `readonly T[]` arrays — the `as const` tuples are readonly.
