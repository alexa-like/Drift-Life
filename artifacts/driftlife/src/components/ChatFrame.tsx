// ─── ChatFrame Component ──────────────────────────────────────────────────────
// Redesigned to match the reference cybercodeonline donation-tier gallery style:
//  • Full-width header banner (not a pennant) with frame-specific background
//  • Themed body background with inline art overlays (dragon face, xmas tree…)
//  • Special floating decorations above the frame (snow, blossom branch, santa hat)
//  • Clean rectangular border — no corner SVG pieces sticking out
//
// Layout:
//   FRAME LABEL (small text above)
//   ┌──────────────────────────────────────────────────────────┐
//   │ [icon] Username                          [header-right]  │ ← header 32 px
//   ├──────────────────────────────────────────────────────────┤
//   │  Message text                       [body-right art]    │ ← body
//   └──────────────────────────────────────────────────────────┘
//   LEVEL N                                             HH:MM

import type { CSSProperties } from 'react'
import type { Frame } from '../lib/chatFrames'
import { RARITY_COLOR } from '../lib/chatFrames'
import { BodyArtLayer } from './frame-art'
import { SubscriberNameBadge, type SubscriberTier } from './SubscriberNameBadge'
import { getFrameDef, defaultFrameDef } from './frame-defs'

// ── Global CSS ─────────────────────────────────────────────────────────────────
const GLOBAL_FRAME_CSS = `
@keyframes apexHeaderShimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes blackoutBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes frameScanLine {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(200%); }
}
.frame-header-apex {
  background: linear-gradient(90deg, #b8860b 0%, #FFD700 30%, #fffbe6 50%, #FFD700 70%, #b8860b 100%);
  background-size: 200% 100%;
  animation: apexHeaderShimmer 2s linear infinite;
}
.frame-header-sovereign {
  background-color: #4B0082;
  background-image:
    repeating-linear-gradient(45deg,rgba(255,255,255,0.04) 0,rgba(255,255,255,0.04) 1px,transparent 1px,transparent 6px),
    repeating-linear-gradient(-45deg,rgba(255,255,255,0.04) 0,rgba(255,255,255,0.04) 1px,transparent 1px,transparent 6px);
}
.frame-header-santa {
  background-image: repeating-linear-gradient(-45deg,#C41E3A 0,#C41E3A 9px,#1e6e1e 9px,#1e6e1e 18px);
}
.frame-header-lightwalker {
  background: linear-gradient(135deg, #0d1b3e 0%, #1a3a8a 30%, #2d1b6e 60%, #0a1628 100%);
}
.frame-header-lunar {
  background: linear-gradient(135deg, #080820 0%, #151555 40%, #0a0a30 70%, #080818 100%);
}
.frame-header-void {
  background: linear-gradient(135deg, #080820 0%, #202080 45%, #080820 100%);
}
.frame-header-rogue {
  background: linear-gradient(90deg, #0a1228 65%, #8B0020 65%);
}
.frame-header-prestige1 { background: #22CC22; }
.frame-header-prestige2 { background: linear-gradient(90deg, #2a2a3a, #c0c0c0 40%, #888 60%, #2a2a3a); }
.frame-header-prestige3 { background: linear-gradient(135deg, #2a0050, #6a00c8 40%, #2a0050); }
.frame-header-prestige4 { background: linear-gradient(90deg, #3a0010 0%, #CC1020 40%, #FFD700 50%, #CC1020 60%, #3a0010 100%); background-size: 200% 100%; animation: apexHeaderShimmer 3s linear infinite; }
`

let cssInjected = false
function ensureCss() {
  if (cssInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = GLOBAL_FRAME_CSS
  document.head.appendChild(el)
  cssInjected = true
}

// ── Null frame (no frame equipped) ────────────────────────────────────────────
function NullFrame({ username, level, timestamp, children, size, subscriptionTier }: {
  username: string; level?: number; timestamp?: string
  children: React.ReactNode; size: 'full' | 'preview'; subscriptionTier?: SubscriberTier
}) {
  return (
    <div style={{ width: size === 'full' ? '85%' : '100%' }}>
      <div className="font-mono" style={{
        background: '#1A1A24', height: 33,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', fontSize: 12, color: '#e2e8f0',
      }}>
        <SubscriberNameBadge username={username} tier={subscriptionTier} fontSize={12} />
        {level !== undefined && <span style={{ opacity: 0.6, fontSize: 10 }}>Lv.{level}</span>}
      </div>
      <div style={{ background: '#0A0008', border: '1px solid #2A2A3A', padding: '8px 12px', fontSize: 12, color: '#e2e8f0' }}>
        {children}
      </div>
      <div className="font-mono flex justify-between" style={{ fontSize: 10, color: '#555', marginTop: 2, paddingLeft: 2, paddingRight: 4 }}>
        {level !== undefined && <span>LEVEL {level}</span>}
        {timestamp && <span>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
    </div>
  )
}

// ── Main ChatFrame component ──────────────────────────────────────────────────
export interface ChatFrameProps {
  frame: Frame | null
  username: string
  level?: number
  timestamp?: string
  size?: 'full' | 'preview'
  subscriptionTier?: SubscriberTier
  children: React.ReactNode
}

export function ChatFrame({
  frame, username, level, timestamp, size = 'full', subscriptionTier, children,
}: ChatFrameProps) {
  ensureCss()

  if (!frame) {
    return (
      <NullFrame username={username} level={level} timestamp={timestamp} size={size} subscriptionTier={subscriptionTier}>
        {children}
      </NullFrame>
    )
  }

  const def = getFrameDef(frame.id) ?? defaultFrameDef(frame)
  const rarityColor = RARITY_COLOR[frame.rarity]

  // Glow scales with rarity
  const glowPx = frame.rarity === 'mythic' ? 18 : frame.rarity === 'legendary' ? 14 : 8
  const glow = `0 0 ${glowPx}px ${def.borderColor}cc, 0 0 ${glowPx / 2}px ${def.borderColor}88, inset 0 0 ${glowPx + 6}px ${def.borderColor}12`

  const headerTextColor = def.headerText ?? '#ffffff'

  return (
    <div style={{ width: size === 'full' ? '85%' : '100%', wordBreak: 'break-word' }}>

      {/* Frame name label above */}
      <div className="font-mono" style={{
        fontSize: 9, fontWeight: 'bold', letterSpacing: '0.08em',
        color: rarityColor, paddingLeft: 4, paddingBottom: 2, opacity: 0.85,
      }}>
        {frame.name.toUpperCase()}
      </div>

      {/* Outer wrapper — overflow:visible so topFloat can protrude above */}
      <div style={{ position: 'relative', overflow: 'visible' }}>

        {/* Top float decoration (snow drift, blossom branch, santa hat) */}
        {def.topFloat && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 12, pointerEvents: 'none', overflow: 'visible' }}>
            {def.topFloat()}
          </div>
        )}

        {/* Main frame box */}
        <div style={{ border: `2px solid ${def.borderColor}`, boxShadow: glow, overflow: 'hidden' }}>

          {/* ── Header bar ── */}
          <div
            className={def.headerClass ?? ''}
            style={{
              ...(def.headerStyle ?? {}),
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 8px 0 10px',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {/* Left: optional icon + username */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
              {def.headerLeft && (
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                  {def.headerLeft()}
                </span>
              )}
              <span
                className="font-mono"
                style={{
                  fontWeight: 'bold',
                  fontSize: 12,
                  color: headerTextColor,
                  letterSpacing: def.uppercase ? '0.04em' : undefined,
                  textTransform: def.uppercase ? 'uppercase' : undefined,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <SubscriberNameBadge username={username} tier={subscriptionTier} fontSize={12} />
                {def.blinkCursor && (
                  <span style={{ animation: 'blackoutBlink 0.8s step-start infinite', marginLeft: 2 }}>█</span>
                )}
              </span>
            </div>

            {/* Right: frame-specific decoration */}
            {def.headerRight && (
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {def.headerRight()}
              </div>
            )}
          </div>

          {/* ── Body ── */}
          <div style={{
            ...(def.bodyStyle ?? {}),
            position: 'relative',
            overflow: 'hidden',
            minHeight: size === 'preview' ? 32 : 38,
          }}>
            {/* Particle body art (behind everything) */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
              <BodyArtLayer bodyArt={frame.bodyArt} accentColor={frame.accentColor} />
            </div>

            {/* Frame-specific body art overlay */}
            {def.bodyRight && (
              <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none' }}>
                {def.bodyRight()}
              </div>
            )}

            {/* Message text */}
            <div style={{
              position: 'relative', zIndex: 2,
              padding: size === 'preview' ? '6px 10px' : '8px 12px',
              fontSize: 12,
              color: def.bodyText ?? '#e2e8f0',
              textShadow: def.bodyText && def.bodyText === '#111111' ? 'none' : '0 1px 3px rgba(0,0,0,0.9)',
            }}>
              {size === 'full' && level !== undefined && (
                <span className="font-mono" style={{ display: 'block', fontSize: 9, opacity: 0.5, marginBottom: 2 }}>
                  Lv.{level}
                </span>
              )}
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {size === 'full' && (
        <div className="font-mono flex justify-between" style={{ fontSize: 10, color: '#555', marginTop: 2, paddingLeft: 2, paddingRight: 4 }}>
          {level !== undefined && <span>LEVEL {level}</span>}
          {timestamp && <span>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      )}
    </div>
  )
}

// ─── Backward-compat wrapper ───────────────────────────────────────────────────
import { getFrame } from '../lib/chatFrames'

export interface ChatFrameRendererProps {
  frameId: string | null | undefined
  username: string
  level?: number
  children: React.ReactNode
  isOwn?: boolean
  timestamp?: string
  compact?: boolean
  subscriptionTier?: SubscriberTier
}

/** @deprecated Use ChatFrame with frame={getFrame(frameId)} directly */
export function ChatFrameRenderer({
  frameId, username, level, children, timestamp, compact = false, subscriptionTier,
}: ChatFrameRendererProps) {
  const frame = getFrame(frameId)
  return (
    <ChatFrame frame={frame} username={username} level={level} timestamp={timestamp}
      size={compact ? 'preview' : 'full'} subscriptionTier={subscriptionTier}>
      {children}
    </ChatFrame>
  )
}
