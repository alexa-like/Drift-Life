/**
 * MessageCard — wraps a chat message bubble with variant-based styling.
 *
 * Variants (applied in priority order by the caller):
 *  staff      — red/orange left border + small STAFF role badge
 *  own        — right-aligned, cyan-tinted background
 *  subscriber — subtle cyan glow border
 *  event      — golden border + faint golden background tint
 *  default    — current plain card look
 */

import React from "react";

export type MessageCardVariant = "default" | "subscriber" | "event" | "staff" | "own";

interface Props {
  variant: MessageCardVariant;
  isOwn: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<MessageCardVariant, React.CSSProperties> = {
  default: {
    background: "#111118",
    border: "1px solid #1e1e2e",
    color: "#e2e8f0",
    boxShadow: "none",
  },
  own: {
    background: "#00d4ff10",
    border: "1px solid #00d4ff40",
    color: "#e2e8f0",
    boxShadow: "0 0 15px rgba(0,212,255,0.05)",
  },
  subscriber: {
    background: "#001a2e",
    border: "1px solid #00E0FF55",
    color: "#e2e8f0",
    boxShadow: "0 0 12px rgba(0,224,255,0.08)",
  },
  event: {
    background: "#1a1400",
    border: "1px solid #FFD70055",
    color: "#e2e8f0",
    boxShadow: "0 0 12px rgba(255,215,0,0.06)",
  },
  staff: {
    background: "#1a0808",
    border: "1px solid #1e1e2e",
    borderLeft: "3px solid #FF4444",
    color: "#e2e8f0",
    boxShadow: "none",
  },
};

export function MessageCard({ variant, isOwn, children, className = "", style }: Props) {
  const base = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;

  return (
    <div
      className={`font-mono text-sm px-4 py-2 clip-btn relative overflow-hidden ${className}`}
      style={{
        ...base,
        maxWidth: "85%",
        wordBreak: "break-word",
        alignSelf: isOwn ? "flex-end" : "flex-start",
        ...style,
      }}
    >
      {/* Subtle scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "linear-gradient(transparent 50%, rgba(0,0,0,0.2) 50%)",
          backgroundSize: "100% 4px",
        }}
      />

      {/* Staff badge */}
      {variant === "staff" && (
        <span
          className="absolute top-1 right-2 font-mono font-bold uppercase"
          style={{ fontSize: 8, color: "#FF4444", letterSpacing: "0.05em", opacity: 0.8 }}
        >
          STAFF
        </span>
      )}

      {/* Event shimmer accent */}
      {variant === "event" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, transparent 40%, rgba(255,215,0,0.03) 100%)",
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Derive the correct MessageCard variant from message metadata.
 * Call this in the rendering component before passing to <MessageCard>.
 */
export function deriveMessageVariant(params: {
  isOwn: boolean;
  senderRole?: string | null;
  subscriptionTier?: string | null;
  hasEventCard?: boolean;
}): MessageCardVariant {
  const { isOwn, senderRole, subscriptionTier, hasEventCard } = params;

  if (senderRole === "staff" || senderRole === "admin" || senderRole === "owner") return "staff";
  if (isOwn) return "own";
  if (subscriptionTier) return "subscriber";
  if (hasEventCard) return "event";
  return "default";
}
