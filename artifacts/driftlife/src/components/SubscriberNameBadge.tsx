/**
 * SubscriberNameBadge — wraps a username with the player's subscription tier
 * styling: animated glow, badge icon, and accent color.
 *
 * Usage:
 *   <SubscriberNameBadge tier={user.subscriptionTier} username={user.username} />
 *
 * When tier is null/undefined renders plain text with no extra markup.
 */

import { useEffect } from "react";

export type SubscriberTier = "street_runner" | "neon_syndicate" | "apex_sovereign" | null | undefined;

interface Props {
  username: string;
  tier: SubscriberTier;
  /** Override font size (default: inherit) */
  fontSize?: string | number;
  /** Extra className on the wrapper */
  className?: string;
  onClick?: () => void;
}

const TIER_META: Record<
  "street_runner" | "neon_syndicate" | "apex_sovereign",
  { color: string; icon: string; animClass: string; label: string }
> = {
  street_runner: {
    color: "#00E0FF",
    icon: "◈",
    animClass: "sub-badge-cyan",
    label: "Street Runner",
  },
  neon_syndicate: {
    color: "#FF4FA3",
    icon: "◉",
    animClass: "sub-badge-neon",
    label: "Neon Syndicate",
  },
  apex_sovereign: {
    color: "#FFD700",
    icon: "♛",
    animClass: "sub-badge-sovereign",
    label: "Apex Sovereign",
  },
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
function ensureSubCss() {
  if (cssInjected || typeof document === "undefined") return;
  cssInjected = true;
  const style = document.createElement("style");
  style.textContent = SUB_BADGE_CSS;
  document.head.appendChild(style);
}

export function SubscriberNameBadge({ username, tier, fontSize, className = "", onClick }: Props) {
  useEffect(() => { ensureSubCss(); }, []);

  if (!tier) {
    return (
      <span
        className={`font-mono font-bold ${className}`}
        style={{ fontSize, cursor: onClick ? "pointer" : "default" }}
        onClick={onClick}
      >
        {username}
      </span>
    );
  }

  const meta = TIER_META[tier];

  return (
    <span
      className={`font-mono font-bold ${meta.animClass} ${className}`}
      style={{ fontSize, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      title={meta.label}
    >
      <span style={{ opacity: 0.7, fontSize: "0.85em", marginRight: 2 }}>{meta.icon}</span>
      {username}
    </span>
  );
}

/** Return just the chat color for a given tier (used for inline styling in bubbles) */
export function tierChatColor(tier: SubscriberTier): string {
  if (!tier) return "#94a3b8";
  return TIER_META[tier]?.color ?? "#94a3b8";
}
