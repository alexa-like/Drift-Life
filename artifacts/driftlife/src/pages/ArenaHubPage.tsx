import { useState } from "react";
import { User } from "../lib/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigate: (page: string) => void;
}

const ARENA_CSS = `
@keyframes arenaCardGlow {
  0%,100% { box-shadow: 0 0 18px var(--glow-color, #ff2d55); }
  50%      { box-shadow: 0 0 36px var(--glow-color, #ff2d55), 0 0 60px var(--glow-color, #ff2d55); }
}
@keyframes arenaPulse {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.6; }
}
`;

function NeonBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color, fontWeight: "bold", letterSpacing: 1 }}>{label}</span>
        <span style={{ fontFamily: "monospace", fontSize: 10, color, fontWeight: "bold" }}>{value}/{max}</span>
      </div>
      <div style={{ background: "#1e293b", borderRadius: 4, height: 7, overflow: "hidden", border: `1px solid ${color}30` }}>
        <div style={{
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          height: "100%", borderRadius: 4,
          width: `${pct}%`,
          boxShadow: `0 0 8px ${color}80`,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

interface ArenaCardProps {
  title: string;
  subtitle: string;
  imageSrc: string;
  glowColor: string;
  barLabel: string;
  barValue: number;
  barMax: number;
  onClick: () => void;
  disabled?: boolean;
  disabledMsg?: string;
  icon: string;
}

function ArenaCard({ title, subtitle, imageSrc, glowColor, barLabel, barValue, barMax, onClick, disabled, disabledMsg, icon }: ArenaCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        minWidth: 260,
        maxWidth: 420,
        borderRadius: 14,
        overflow: "hidden",
        border: `2px solid ${hovered && !disabled ? glowColor : glowColor + "40"}`,
        background: "#0a0a14",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "border-color 0.2s, transform 0.2s",
        transform: hovered && !disabled ? "translateY(-4px) scale(1.01)" : "none",
        position: "relative",
        opacity: disabled ? 0.6 : 1,
        ["--glow-color" as any]: glowColor,
        animation: hovered && !disabled ? "arenaCardGlow 1.5s ease-in-out infinite" : "none",
      }}
    >
      {/* Image area */}
      <div style={{ height: 240, position: "relative", overflow: "hidden", background: `${glowColor}08` }}>
        {!imgFailed ? (
          <img
            src={imageSrc}
            alt={title}
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          /* Fallback styled div with icon */
          <div style={{
            width: "100%", height: "100%",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: `radial-gradient(ellipse at center, ${glowColor}15 0%, #0a0a14 70%)`,
          }}>
            <div style={{ fontSize: 72, marginBottom: 12, filter: `drop-shadow(0 0 16px ${glowColor})` }}>{icon}</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: glowColor, letterSpacing: 2, opacity: 0.7 }}>
              {title.toUpperCase()}
            </div>
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(180deg, transparent 40%, #0a0a14 100%)`,
        }} />
        {/* Top glow bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
          opacity: hovered ? 1 : 0.4,
          transition: "opacity 0.2s",
        }} />
      </div>

      {/* Content area */}
      <div style={{ padding: "14px 18px 18px" }}>
        {/* Resource bar */}
        <NeonBar value={barValue} max={barMax} color={glowColor} label={barLabel} />

        <h2 style={{
          fontFamily: "monospace", fontSize: 20, fontWeight: "bold",
          color: hovered && !disabled ? glowColor : "#e2e8f0",
          letterSpacing: 3, margin: "12px 0 4px",
          textShadow: hovered && !disabled ? `0 0 12px ${glowColor}` : "none",
          transition: "color 0.2s, text-shadow 0.2s",
        }}>
          {title}
        </h2>
        <p style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", margin: "0 0 14px" }}>
          {subtitle}
        </p>

        {disabled && disabledMsg ? (
          <div style={{
            fontFamily: "monospace", fontSize: 11, color: "#ef4444",
            background: "#ef444415", border: "1px solid #ef444430",
            borderRadius: 6, padding: "6px 10px", textAlign: "center",
          }}>
            {disabledMsg}
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 0",
            fontFamily: "monospace", fontSize: 12, fontWeight: "bold",
            color: glowColor, letterSpacing: 2,
            border: `1px solid ${glowColor}50`,
            borderRadius: 8,
            background: `${glowColor}10`,
            transition: "background 0.2s",
          }}>
            ▶ ENTER
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArenaHubPage({ user, onNavigate }: Props) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <style>{ARENA_CSS}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 8 }}>
        <h1 style={{
          fontFamily: "monospace", fontSize: 26, fontWeight: "bold",
          color: "#e2e8f0", letterSpacing: 4, margin: 0,
          textShadow: "0 0 20px #ff2d5540",
        }}>
          ⚡ ARENA HUB
        </h1>
        <p style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginTop: 6 }}>
          Choose your battleground. Glory awaits.
        </p>
      </div>

      {/* Two-card layout */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <ArenaCard
          title="SHOOTING ARENA"
          subtitle="1v1 turn-based combat. Loadout matters."
          imageSrc="/assets/arena/shooting.png"
          glowColor="#ff2d55"
          barLabel="🥊 ADRENALINE"
          barValue={user.adrenaline}
          barMax={user.maxAdrenaline}
          onClick={() => onNavigate("arena-combat")}
          disabled={user.adrenaline < 1}
          disabledMsg={`Need adrenaline — have ${user.adrenaline}/${user.maxAdrenaline}`}
          icon="🎯"
        />
        <ArenaCard
          title="RACING ARENA"
          subtitle="High-speed races. Upgrade your ride."
          imageSrc="/assets/arena/racing.png"
          glowColor="#00d4ff"
          barLabel="🏁 NITRO"
          barValue={user.nitro}
          barMax={user.maxNitro}
          onClick={() => onNavigate("race-hub")}
          disabled={user.nitro < 1}
          disabledMsg={`Need nitro — have ${user.nitro}/${user.maxNitro}`}
          icon="🏎"
        />
      </div>

      {/* Quick links row */}
      <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { label: "⚙ Loadout", page: "loadout", color: "#ff6b35" },
          { label: "🏆 Match History", page: "match-history", color: "#a855f7" },
          { label: "🏁 Race Garage", page: "garage", color: "#00d4ff" },
        ].map(link => (
          <button
            key={link.page}
            onClick={() => onNavigate(link.page)}
            style={{
              padding: "8px 16px", borderRadius: 8,
              fontFamily: "monospace", fontSize: 11, cursor: "pointer",
              background: `${link.color}10`,
              border: `1px solid ${link.color}40`,
              color: link.color,
            }}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
