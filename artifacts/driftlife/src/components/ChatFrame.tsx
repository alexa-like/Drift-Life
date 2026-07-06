// ─── ChatFrame Component ──────────────────────────────────────────────────────
// Single component used everywhere frames appear (chat, feed, store, profile).
// size="full"    → max-width 85%, used in chat/feed
// size="preview" → 100% width, used in store cards and locker
//
// Clip-path (chevron/ribbon right end):
//   polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)

import type { CSSProperties } from 'react'
import type { Frame } from '../lib/chatFrames'
import { BodyArtLayer } from './frame-art'

// ── CSS injected once for APEX shimmer + Sovereign weave ──────────────────────

const GLOBAL_FRAME_CSS = `
@keyframes apexShimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
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

// ── Chevron clip-path ─────────────────────────────────────────────────────────

const CHEVRON_CLIP = 'polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)'

// ── Header rendering ──────────────────────────────────────────────────────────

function FrameHeader({ frame, username, level }: { frame: Frame; username: string; level?: number }) {
  ensureCss()
  const textColor = frame.textOnHeader === 'dark' ? '#111111' : '#FFFFFF'

  let headerClass = ''
  let headerStyle: CSSProperties = { background: frame.headerColor }

  if (frame.headerVariant === 'animated-shimmer') {
    headerClass = 'frame-header-apex'
    headerStyle = {}
  } else if (frame.headerVariant === 'textured-weave') {
    headerClass = 'frame-header-sovereign'
    headerStyle = {}
  }

  // Special: Signal Breach has static scan-line overlay on header
  const hasHeaderScanlines = frame.id === 'signal_breach'

  // Special: Blackout Protocol has blinking cursor
  const hasBlinkCursor = frame.id === 'blackout_protocol'

  return (
    <div
      className={`font-mono flex items-center justify-between px-3 ${headerClass}`}
      style={{
        ...headerStyle,
        clipPath: CHEVRON_CLIP,
        paddingRight: 28, // account for the chevron taper
        height: 33,
        minHeight: 33,
        fontSize: 12,
        color: textColor,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {hasHeaderScanlines && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,0,64,0.10) 0px, rgba(255,0,64,0.10) 1px, transparent 1px, transparent 3px)',
        }} />
      )}
      <span style={{ fontWeight: 'bold', position: 'relative' }}>
        {username}
        {hasBlinkCursor && (
          <span style={{ animation: 'blackoutBlink 0.8s step-start infinite', marginLeft: 2 }}>█</span>
        )}
      </span>
      {level !== undefined && (
        <span style={{ opacity: 0.75, fontSize: 10, position: 'relative' }}>Lv.{level}</span>
      )}
    </div>
  )
}

// ── Null frame (no frame equipped) ────────────────────────────────────────────

function NullFrame({ username, level, timestamp, children, size }: {
  username: string; level?: number; timestamp?: string; children: React.ReactNode; size: 'full' | 'preview'
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
        <span style={{ fontWeight: 'bold' }}>{username}</span>
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
  children: React.ReactNode
}

export function ChatFrame({ frame, username, level, timestamp, size = 'full', children }: ChatFrameProps) {
  if (!frame) {
    return <NullFrame username={username} level={level} timestamp={timestamp} size={size}>{children}</NullFrame>
  }

  const accentGlow = frame.rarity === 'legendary'
    ? `0 0 10px ${frame.accentColor}66`
    : undefined

  const bodyBoxShadow = frame.id === 'void_signal'
    ? '0 0 8px #3030CC66'
    : accentGlow

  // Void Signal has a slight blue header border glow
  const headerWrapper: CSSProperties = frame.id === 'void_signal'
    ? { filter: 'drop-shadow(0 0 4px #4040FF88)' }
    : {}

  return (
    <div style={{ maxWidth: size === 'full' ? '85%' : '100%', wordBreak: 'break-word' }}>
      {/* Header */}
      <div style={headerWrapper}>
        <FrameHeader frame={frame} username={username} level={level} />
      </div>

      {/* Body */}
      <div style={{
        background: '#0A0008',
        border: `1px solid ${frame.accentColor}`,
        boxShadow: bodyBoxShadow,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 36,
      }}>
        {/* Body art layer (behind message) */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <BodyArtLayer bodyArt={frame.bodyArt} accentColor={frame.accentColor} />
        </div>
        {/* Message text */}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '8px 12px',
          fontSize: 12,
          color: '#e2e8f0',
          background: 'rgba(0,0,0,0.45)',
        }}>
          {children}
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
}

/** @deprecated Use ChatFrame with frame={getFrame(frameId)} directly */
export function ChatFrameRenderer({
  frameId, username, level, children, timestamp, compact = false,
}: ChatFrameRendererProps) {
  const frame = getFrame(frameId)
  return (
    <ChatFrame
      frame={frame}
      username={username}
      level={level}
      timestamp={timestamp}
      size={compact ? 'preview' : 'full'}
    >
      {children}
    </ChatFrame>
  )
}
