// ─── ChatFrame Component ──────────────────────────────────────────────────────
// Single component used everywhere frames appear (chat, feed, store, profile,
// and other players' profile previews via PlayerInspectModal).
// size="full"    → max-width 85%, used in chat/feed
// size="preview" → 100% width, used in store cards and locker
//
// Layout (matches the approved tier-gallery mockup):
//   ┌──────────┐
//   │ NAME TAG │←— overlaps the box's top-left corner by half its height
//   └┬─────────┴────────────────────────────────┐  ⟨ TIER NAME ⟩ ←floats top-right
//    │                                           │
//    │              message body                 │
//    │                                           │
//    └───────────────────────────────────────────┘
//   LEVEL N                                 12:00 PM

import type { CSSProperties } from 'react'
import type { Frame } from '../lib/chatFrames'
import { RARITY_COLOR } from '../lib/chatFrames'
import { BodyArtLayer } from './frame-art'
import { SubscriberNameBadge, type SubscriberTier } from './SubscriberNameBadge'

// ── CSS injected once for APEX shimmer + Sovereign weave ──────────────────────

const GLOBAL_FRAME_CSS = `
@keyframes apexHeaderShimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes blackoutBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.frame-header-apex {
  background: linear-gradient(90deg, #b8860b 0%, #FFD700 30%, #fffbe6 50%, #FFD700 70%, #b8860b 100%);
  background-size: 200% 100%;
  animation: apexHeaderShimmer 2s linear infinite;
}
.frame-header-sovereign {
  background-color: #4B0082;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.04) 0px,
    rgba(255,255,255,0.04) 1px,
    transparent 1px,
    transparent 6px
  ),
  repeating-linear-gradient(
    -45deg,
    rgba(255,255,255,0.04) 0px,
    rgba(255,255,255,0.04) 1px,
    transparent 1px,
    transparent 6px
  );
}
`

let cssInjected = false
function ensureCss() {
  if (cssInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = GLOBAL_FRAME_CSS
  document.head.appendChild(el)
  cssInjected = true
}

// ── Tag clip-paths ─────────────────────────────────────────────────────────────

const PENNANT_CLIP = 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)'
const SQUARE_CLIP = 'none'

const TAG_HEIGHT = 24

// ── Name tag (overlaps the top-left of the body box) ──────────────────────────

function NameTag({ frame, username, subscriptionTier }: { frame: Frame; username: string; subscriptionTier?: SubscriberTier }) {
  ensureCss()
  const textColor = frame.textOnHeader === 'dark' ? '#111111' : '#FFFFFF'
  const shape = frame.tagShape ?? 'pennant'

  let headerClass = ''
  let headerStyle: CSSProperties = { background: frame.headerColor }

  if (frame.headerVariant === 'animated-shimmer') {
    headerClass = 'frame-header-apex'
    headerStyle = {}
  } else if (frame.headerVariant === 'textured-weave') {
    headerClass = 'frame-header-sovereign'
    headerStyle = {}
  }

  const hasBlinkCursor = frame.id === 'blackout_protocol'

  return (
    <div
      className={`font-mono inline-flex items-center ${headerClass}`}
      style={{
        ...headerStyle,
        clipPath: shape === 'pennant' ? PENNANT_CLIP : SQUARE_CLIP,
        height: TAG_HEIGHT,
        minHeight: TAG_HEIGHT,
        padding: shape === 'pennant' ? '0 16px 0 10px' : '0 10px',
        fontSize: 11,
        fontWeight: 'bold',
        color: textColor,
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 3,
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100% - 60px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      <SubscriberNameBadge username={username} tier={subscriptionTier} fontSize={11} />
      {hasBlinkCursor && (
        <span style={{ animation: 'blackoutBlink 0.8s step-start infinite', marginLeft: 2 }}>█</span>
      )}
    </div>
  )
}

// ── Tier badge (floats free, top-right) ────────────────────────────────────────

function TierBadge({ frame }: { frame: Frame }) {
  const color = RARITY_COLOR[frame.rarity]
  return (
    <div
      className="font-mono"
      style={{
        position: 'absolute',
        top: -9,
        right: 8,
        zIndex: 3,
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: '0.06em',
        padding: '3px 8px',
        borderRadius: 3,
        background: '#0A0A12',
        color,
        border: `1px solid ${color}88`,
        boxShadow: `0 0 8px ${color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {frame.name.toUpperCase()}
    </div>
  )
}

// ── Null frame (no frame equipped) ────────────────────────────────────────────

function NullFrame({ username, level, timestamp, children, size, subscriptionTier }: {
  username: string; level?: number; timestamp?: string; children: React.ReactNode; size: 'full' | 'preview'; subscriptionTier?: SubscriberTier
}) {
  return (
    <div style={{ maxWidth: size === 'full' ? '85%' : '100%' }}>
      <div className="font-mono" style={{
        background: '#1A1A24',
        height: 33,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: 12,
        color: '#e2e8f0',
      }}>
        <SubscriberNameBadge username={username} tier={subscriptionTier} fontSize={12} />
        {level !== undefined && <span style={{ opacity: 0.6, fontSize: 10 }}>Lv.{level}</span>}
      </div>
      <div style={{
        background: '#0A0008',
        border: '1px solid #2A2A3A',
        padding: '8px 12px',
        fontSize: 12,
        color: '#e2e8f0',
        position: 'relative',
        zIndex: 0,
      }}>
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

export function ChatFrame({ frame, username, level, timestamp, size = 'full', subscriptionTier, children }: ChatFrameProps) {
  if (!frame) {
    return <NullFrame username={username} level={level} timestamp={timestamp} size={size} subscriptionTier={subscriptionTier}>{children}</NullFrame>
  }

  const accentGlow = frame.rarity !== 'elite'
    ? `0 0 10px ${frame.accentColor}66`
    : undefined

  const bodyBoxShadow = frame.id === 'void_signal'
    ? '0 0 8px #3030CC66'
    : accentGlow

  return (
    <div style={{ maxWidth: size === 'full' ? '85%' : '100%', wordBreak: 'break-word' }}>
      {/* Overlap zone: name tag + tier badge float above/over the body box */}
      <div style={{ position: 'relative', paddingTop: TAG_HEIGHT / 2 }}>
        <NameTag frame={frame} username={username} subscriptionTier={subscriptionTier} />
        <TierBadge frame={frame} />

        {/* Body */}
        <div style={{
          background: '#0A0008',
          border: `1px solid ${frame.accentColor}`,
          boxShadow: bodyBoxShadow,
          position: 'relative',
          overflow: 'hidden',
          minHeight: 36,
          marginTop: TAG_HEIGHT / 2,
          paddingTop: 4,
        }}>
          {/* Body art layer (behind message) */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <BodyArtLayer bodyArt={frame.bodyArt} accentColor={frame.accentColor} />
          </div>
          {/* Message text */}
          <div style={{
            position: 'relative', zIndex: 1,
            padding: '10px 12px 8px',
            fontSize: 12,
            color: '#e2e8f0',
            background: 'rgba(0,0,0,0.45)',
          }}>
            {level !== undefined && (
              <span className="font-mono" style={{ display: 'block', fontSize: 9, opacity: 0.55, marginBottom: 2 }}>
                Lv.{level}
              </span>
            )}
            {children}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="font-mono flex justify-between" style={{
        fontSize: 10, color: '#555', marginTop: 2, paddingLeft: 2, paddingRight: 4,
      }}>
        {level !== undefined && <span>LEVEL {level}</span>}
        {timestamp && <span>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
    </div>
  )
}

// ─── Backward-compat wrapper (used in ChatPage / FeedPage via frameId string) ─

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
    <ChatFrame
      frame={frame}
      username={username}
      level={level}
      timestamp={timestamp}
      size={compact ? 'preview' : 'full'}
      subscriptionTier={subscriptionTier}
    >
      {children}
    </ChatFrame>
  )
}
