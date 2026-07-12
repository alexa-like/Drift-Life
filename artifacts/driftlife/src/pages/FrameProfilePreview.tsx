// ─── Frame Profile Preview Screen ─────────────────────────────────────────────
// Full-screen identity card preview, triggered from "Preview on Profile" in store.
// Shows how the frame themes a profile card — NOT the player's actual profile.

import { useState, useEffect } from "react";
import type { Frame } from "../lib/chatFrames";
import { RARITY_COLOR, RARITY_LABEL } from "../lib/chatFrames";
import type { User } from "../lib/types";
import { BodyArtLayer } from "../components/frame-art";
import { GlitchLogo } from "../components/frame-logos";
import { CyberButton } from "../components/CyberButton";

interface Props {
  frame: Frame;
  user: User;
  nc: number;
  onBack: () => void;
  onBuy: () => void;
  buying: boolean;
  alreadyOwned: boolean;
  canAfford: boolean;
}

// Simple barcode decoration
function Barcode({ color }: { color: string }) {
  const bars = [3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 1];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 28 }}>
      {bars.map((w, i) => (
        <div key={i} style={{
          width: w, height: `${40 + (i % 3) * 25}%`,
          background: color, opacity: 0.7,
        }} />
      ))}
    </div>
  );
}

// Radar chart (5-stat octagon)
function RadarChart({ color, stats }: { color: string; stats: number[] }) {
  const N = stats.length;
  const SIZE = 60;
  const CX = SIZE / 2, CY = SIZE / 2, R = SIZE * 0.42;

  const toXY = (i: number, r: number) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
  };

  const outerPts = Array.from({ length: N }, (_, i) => toXY(i, R));
  const valuePts = stats.map((v, i) => toXY(i, R * Math.min(1, v / 100)));

  const pathData = (pts: number[][]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + "Z";

  return (
    <svg width={SIZE} height={SIZE}>
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon key={scale}
          points={outerPts.map(([x, y]) => `${CX + (x - CX) * scale},${CY + (y - CY) * scale}`).join(" ")}
          fill="none" stroke={color} strokeWidth="0.5" opacity="0.2"
        />
      ))}
      {outerPts.map(([x, y], i) => (
        <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke={color} strokeWidth="0.5" opacity="0.2" />
      ))}
      <path d={pathData(valuePts)} fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

const STAT_LABELS = ["STR", "CHR", "INT", "REP", "LVL"];

export function FrameProfilePreview({ frame, user, nc, onBack, onBuy, buying, alreadyOwned, canAfford }: Props) {
  const rarityColor = RARITY_COLOR[frame.rarity];
  const accent = frame.accentColor;
  const isLegendary = frame.rarity !== "elite";

  const stats = [
    Math.min(100, (user.strength  || 0) * 2),
    Math.min(100, (user.charisma  || 0) * 2),
    Math.min(100, (user.intelligence || 0) * 2),
    Math.min(100, (user.streetCred || 0) * 2),
    Math.min(100, (user.level || 1) * 2),
  ];

  // Banner accent bar color
  const bannerBg = isLegendary ? rarityColor : "#475569";

  return (
    <div className="max-w-2xl mx-auto space-y-0">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="font-mono text-xs" style={{ color: "#64748b" }}>← Back</button>
        <span className="font-mono text-xs" style={{ color: "#00E0FF" }}>{nc.toLocaleString()} NC</span>
      </div>

      {/* Preview label banner */}
      <div style={{
        background: isLegendary ? `${rarityColor}20` : "#1e1e2e",
        border: `1px solid ${isLegendary ? rarityColor + "50" : "#2a2a3a"}`,
        borderRadius: "8px 8px 0 0",
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ width: 3, height: 20, background: isLegendary ? rarityColor : accent, borderRadius: 2 }} />
        <span className="font-mono text-xs font-bold" style={{ color: isLegendary ? rarityColor : accent }}>
          PREVIEWING: {frame.name.toUpperCase()}
        </span>
        <span className="font-mono px-2 py-0.5 rounded" style={{
          fontSize: 9, background: `${rarityColor}18`, color: rarityColor, border: `1px solid ${rarityColor}40`,
        }}>
          {RARITY_LABEL[frame.rarity]}
        </span>
      </div>

      {/* ── Profile identity card ── */}
      <div style={{
        border: `2px solid ${accent}`,
        borderTop: "none",
        borderRadius: "0 0 12px 12px",
        overflow: "hidden",
        background: frame.id === "blackout_protocol" ? "#000" : "#080608",
        position: "relative",
        boxShadow: isLegendary ? `0 0 24px ${accent}44` : undefined,
      }}>
        {/* Background animation layer */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <BodyArtLayer bodyArt={frame.profileBgAnimation} accentColor={accent} />
        </div>

        {/* Signal Breach watermark */}
        {frame.id === "signal_breach" && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: "rotate(-25deg)",
          }}>
            <span className="font-mono font-bold select-none" style={{
              fontSize: 28, color: "#FF0040", opacity: 0.05, letterSpacing: "0.2em",
            }}>SYSTEM BREACH</span>
          </div>
        )}

        {/* Blackout scan-line overlay */}
        {frame.id === "blackout_protocol" && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 4px)",
          }} />
        )}

        {/* Card content */}
        <div style={{ position: "relative", zIndex: 2, padding: "20px 20px 16px" }}>
          {/* Row 1: Avatar + identity */}
          <div className="flex items-start gap-4 mb-5">
            {/* Avatar */}
            <div style={{
              width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
              border: `3px solid ${accent}`, boxShadow: `0 0 12px ${accent}55`,
              background: "#1e1e2e", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 22, overflow: "hidden",
            }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                : user.username.charAt(0).toUpperCase()
              }
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="font-mono font-bold text-lg" style={{ color: "#e2e8f0", letterSpacing: "0.05em" }}>
                {user.username}
              </div>
              <div className="font-mono text-xs mt-0.5" style={{ color: accent }}>{frame.name}</div>
              <div className="font-mono mt-1 flex items-center gap-2 flex-wrap">
                <span style={{ fontSize: 10, color: "#64748b" }}>NC {nc.toLocaleString()}</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>·</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>LVL {user.level}</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>·</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>{user.district?.replace(/-/g, " ") || "New Vanta"}</span>
              </div>
              {/* Status */}
              <div className="font-mono mt-1" style={{ fontSize: 10, color: accent, opacity: 0.8 }}>
                ◈ {user.equippedTitle || "Drifter"}
              </div>
            </div>

            {/* Logo */}
            <div className="flex-shrink-0">
              <GlitchLogo frame={frame} size={44} />
            </div>
          </div>

          {/* Row 2: Bio (redacted) + Barcode */}
          <div className="flex items-end justify-between gap-4 mb-5">
            <div style={{ flex: 1 }}>
              <div className="font-mono" style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 4 }}>STATUS</div>
              <div className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                {user.bio
                  ? user.bio.slice(0, 60).replace(/./g, (c, i) => i > 30 ? "█" : c)
                  : "██████████ ████████ ███████"}
              </div>
            </div>
            <div>
              <div className="font-mono" style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 4 }}>ID</div>
              <Barcode color={accent} />
            </div>
          </div>

          {/* Row 3: Radar + Stats */}
          <div className="flex items-center gap-6 mb-4">
            <RadarChart color={accent} stats={stats} />
            <div className="flex-1">
              {STAT_LABELS.map((label, i) => (
                <div key={label} className="flex items-center gap-2 mb-1">
                  <span className="font-mono" style={{ fontSize: 9, color: "#475569", width: 28 }}>{label}</span>
                  <div style={{ flex: 1, height: 4, background: "#1e1e2e", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${stats[i]}%`,
                      background: accent, borderRadius: 2,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                  <span className="font-mono" style={{ fontSize: 9, color: "#64748b", width: 24, textAlign: "right" }}>
                    {Math.round(stats[i])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: `${accent}30`, margin: "0 0 12px" }} />

          {/* NC + rarity */}
          <div className="flex items-center justify-between">
            <span className="font-mono" style={{ fontSize: 9, color: "#475569", letterSpacing: "0.12em" }}>
              DRIFT IDENTITY SYSTEM
            </span>
            <span className="font-mono px-2 py-0.5 rounded" style={{
              fontSize: 9, background: `${rarityColor}18`, color: rarityColor, border: `1px solid ${rarityColor}40`,
            }}>
              {RARITY_LABEL[frame.rarity]}
            </span>
          </div>
        </div>
      </div>

      {/* Sticky buy button */}
      <div style={{ paddingTop: 16 }}>
        {alreadyOwned ? (
          <div className="font-mono text-xs text-center" style={{ color: "#39d353" }}>
            ✓ You own this frame — equip it in your Frame Locker
          </div>
        ) : canAfford ? (
          <CyberButton variant="success" loading={buying} onClick={onBuy} className="w-full">
            Buy Frame — {frame.priceNC.toLocaleString()} NC
          </CyberButton>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div className="font-mono text-sm font-bold" style={{ color: "#ff4444" }}>
              {frame.priceNC.toLocaleString()} NC required
            </div>
            <div className="font-mono text-xs mt-1" style={{ color: "#475569" }}>
              You have {nc.toLocaleString()} NC
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
