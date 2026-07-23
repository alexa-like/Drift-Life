/**
 * PlayerNameBadge — renders a username with the player's highest-priority visual style.
 *
 * Priority (highest wins):
 *  1. subscriptionTier set → subscription styling (existing SubscriberNameBadge behaviour)
 *  2. equippedNameFlair set + cosmeticData → cosmetic flair color + animation
 *  3. Otherwise → plain username
 *
 * CSS animation classes (flair-pulse, flair-glow, flair-rainbow, flair-glitch, flair-gradient)
 * must be present in index.css — they are shared with the cosmetics system.
 */

import { useEffect } from "react";
import type { FlairData } from "../types";

export type { FlairData };
export type SubscriberTier = "street_runner" | "neon_syndicate" | "apex_sovereign" | null | undefined;

interface Props {
  username: string;
  subscriptionTier?: SubscriberTier;
  equippedNameFlair?: string | null;
  cosmeticData?: FlairData | null;
  fontSize?: string | number;
  className?: string;
  onClick?: () => void;
}

// ── Subscription tier meta (unchanged from SubscriberNameBadge) ──────────────

const TIER_META: Record<
  "street_runner" | "neon_syndicate" | "apex_sovereign",
  { color: string; icon: string; animClass: string; label: string }
> = {
  street_runner:  { color: "#00E0FF", icon: "◈", animClass: "sub-badge-cyan",      label: "Street Runner"  },
  neon_syndicate: { color: "#FF4FA3", icon: "◉", animClass: "sub-badge-neon",      label: "Neon Syndicate" },
  apex_sovereign: { color: "#FFD700", icon: "♛", animClass: "sub-badge-sovereign", label: "Apex Sovereign" },
};

const SUB_BADGE_CSS = `
@keyframes cyanPulse {
  0%, 100% { text-shadow: 0 0 4px #00E0FF88, 0 0 8px #00E0FF44; }
  50%       { text-shadow: 0 0 8px #00E0FFcc, 0 0 16px #00E0FF88; }
}
@keyframes neonFlicker {
  0%,19%,21%,23%,25%,54%,56%,100% { text-shadow: 0 0 4px #FF4FA388, 0 0 10px #FF4FA355; opacity: 1; }
  20%,22%,24%                     { text-shadow: none; opacity: 0.85; }
  55%                             { text-shadow: none; opacity: 0.9; }
}
@keyframes sovereignRainbow {
  0%   { color: #FFD700; text-shadow: 0 0 8px #FFD70099; }
  25%  { color: #FF4FA3; text-shadow: 0 0 8px #FF4FA399; }
  50%  { color: #A855F7; text-shadow: 0 0 8px #A855F799; }
  75%  { color: #00E0FF; text-shadow: 0 0 8px #00E0FF99; }
  100% { color: #FFD700; text-shadow: 0 0 8px #FFD70099; }
}
.sub-badge-cyan { color: #00E0FF; animation: cyanPulse 2.4s ease-in-out infinite; }
.sub-badge-neon { color: #FF4FA3; animation: neonFlicker 4s linear infinite; }
.sub-badge-sovereign { animation: sovereignRainbow 3s linear infinite; }
`;

let cssInjected = false;
function ensureCss() {
  if (cssInjected || typeof document === "undefined") return;
  cssInjected = true;
  const style = document.createElement("style");
  style.textContent = SUB_BADGE_CSS;
  document.head.appendChild(style);
}

// ── Component ────────────────────────────────────────────────────────────────

export function PlayerNameBadge({
  username,
  subscriptionTier,
  equippedNameFlair,
  cosmeticData,
  fontSize,
  className = "",
  onClick,
}: Props) {
  useEffect(() => { ensureCss(); }, []);

  const cursorStyle: React.CSSProperties = { cursor: onClick ? "pointer" : "default" };

  // 1. Subscription tier wins
  if (subscriptionTier) {
    const meta = TIER_META[subscriptionTier];
    return (
      <span
        className={`font-mono font-bold ${meta.animClass} ${className}`}
        style={{ fontSize, ...cursorStyle }}
        onClick={onClick}
        title={meta.label}
      >
        <span style={{ opacity: 0.7, fontSize: "0.85em", marginRight: 2 }}>{meta.icon}</span>
        {username}
      </span>
    );
  }

  // 2. Equipped cosmetic flair
  if (equippedNameFlair && cosmeticData) {
    const { color, cssKey } = cosmeticData;
    return (
      <span
        className={`font-mono font-bold ${cssKey} ${className}`}
        style={{ fontSize, color: color || undefined, ...cursorStyle }}
        onClick={onClick}
      >
        {username}
      </span>
    );
  }

  // 3. Plain username
  return (
    <span
      className={`font-mono font-bold ${className}`}
      style={{ fontSize, ...cursorStyle }}
      onClick={onClick}
    >
      {username}
    </span>
  );
}

/** Return just the chat color for a given tier (used for inline styling in bubbles) */
export function tierChatColor(tier: SubscriberTier): string {
  if (!tier) return "#94a3b8";
  return TIER_META[tier]?.color ?? "#94a3b8";
}
