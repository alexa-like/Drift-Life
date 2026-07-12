---
name: DriftLife Frame Border System
description: The SVG corner-art border system for chat frames, built in frame-borders.tsx
---

## Rule
All chat frame border decoration lives in `artifacts/driftlife/src/components/frame-borders.tsx`. Do NOT add borders back to ChatFrame.tsx directly.

**Why:** The old flat `border: 2px solid accentColor` was replaced with a full SVG corner-art system where every frame has unique themed artwork (dragon claws, sakura branches, palm trees, spider webs, holly berries, etc.) plus a 3D layered box-shadow. This was a deliberate artistic overhaul requested by the user.

## How to apply
- `FrameBorderWrapper` wraps the frame body div in ChatFrame.tsx — it handles both the themed border line AND the 4 corner SVG pieces
- `FrameTagIcon` renders a small (13px) SVG icon in the name tag, replacing emoji icons
- `BORDER_MAP` maps each frame ID → `BorderDef` (width, color, style, shadow, cornerSize, Corner component)
- Each `Corner*` component renders an SVG at 32×32 viewBox, mirrored with CSS `scale(-1,1)` etc. for each corner position
- `ensureBorderCss()` injects animation classes (`fb-pulse`, `fb-flicker`, `fb-shimmer`) into `<head>` once

## Key design details
- Corner pieces use `position: absolute` with `zIndex: 5` and extend OUTSIDE the border box (`overflow: visible` on FrameBorderWrapper)
- Body art clipping is handled by an inner `overflow: hidden` div inside FrameBorderWrapper (so particles don't escape)
- The `glow()` helper builds the layered box-shadow: outer glow × 2 + inset tinted glow + inset highlight top/shadow bottom
- Corner size: 22px elite, 24-28px legendary, 28-32px mythic

## Adding a new frame
1. Create a `Corner*` function in frame-borders.tsx (SVG at 32×32 viewBox, tl-canonical orientation)
2. Create an entry in `FRAME_ICON_SVG` (13px SVG for name tag)
3. Add entry to `BORDER_MAP` with appropriate glow strength
