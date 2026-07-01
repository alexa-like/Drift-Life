---
name: DriftLife Frames System
description: Frame catalog structure, equip slots, getFrame alias resolution, surface routing
---

## Frame Catalog
- Exported as `FRAME_CATALOG` (not `FRAMES`) from `artifacts/driftlife/src/lib/frames.ts`
- `FrameDef` has: id, name, rarity, glowColor, animationType, variantIndex, ncCost, earnedBy?, mythicAliasOf?, **icon**, **textColor**, **headerBg**
- `icon` — unique monospace/Unicode char per frame, shown in chat header strip
- `textColor` — null for common/uncommon; glowColor+"88" rare; +"cc" epic; +"ee" legendary; full glowColor mythic
- `headerBg` — null except mythic frames (including aliases), which define their own CSS gradient

## Alias Resolution (getFrame)
- Aliases carry their OWN `icon`, `textColor`, `headerBg` — NOT inherited from the base frame
- `getFrame()` spreads target then overrides id/name/glowColor/icon/textColor/headerBg from alias entry
- 5 aliases: matrixBlue, matrixGold, matrixRed (→ matrixGreen), omega (→ godMode), architect (→ theOne)

## Per-Surface Equip Slots
- User model has `equippedFrames: { avatar: string, chat: string, feed: string }` (default: "ghostFrame")
- `equippedFrame` legacy field retained for backward compat; new equips should use slots
- **Fallback rule everywhere**: treat `"ghostFrame"` as unset → fall back to `equippedFrame`
  - `(slot && slot !== "ghostFrame") ? slot : equippedFrame`

## Server-Side Surface Routing
- **chat** (global/district/faction/DM): `userChatFrame(user)` helper in `routes/chat.ts`
- **feed**: resolved inline in `routes/feed.ts` (feedSlot !== "ghostFrame" ? feedSlot : equippedFrame)
- **avatar/profile**: frontend only (ProfilePage uses equippedFrames.avatar slot)

## Equip Security
- `PATCH /api/user/me`: ownership validated for both `equippedFrame` (legacy) and each `equippedFrames` slot
- `POST /api/frames/equip`: seeds all 3 slots from ghostFrame on first equip (does not overwrite non-ghost slots)
- `equippedOn: string[]` (surfaces) returned in GET /api/frames per frame entry

## Other
- `ownedFrames` + `equippedFrame` on User model
- equip-frame route in `routes/frames.ts`; give-frame in `routes/dev.ts`
- `RARITY_COLORS` and `RARITY_ORDER` exported from frames.ts
