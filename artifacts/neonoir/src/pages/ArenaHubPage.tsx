import { useState } from "react";
import { User } from "../shared/types";
import { CyberSectionHeader } from "../shared/components/CyberSectionHeader";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigate: (page: string) => void;
}

function NeonBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
        <span className="font-mono text-[10px]" style={{ color: "#e2e8f0" }}>{value}/{max}</span>
      </div>
      <div className="clip-bar h-2 bg-[#161622] border border-[#1e1e2e]">
        <div 
          className="h-full clip-bar transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}60, ${color})`,
            boxShadow: `0 0 10px ${color}`
          }} 
        />
      </div>
    </div>
  );
}

interface ArenaCardProps {
  title: string;
  subtitle: string;
  glowColor: string;
  barLabel: string;
  barValue: number;
  barMax: number;
  onClick: () => void;
  disabled?: boolean;
  disabledMsg?: string;
  icon: string;
}

function ArenaCard({ title, subtitle, glowColor, barLabel, barValue, barMax, onClick, disabled, disabledMsg, icon }: ArenaCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex-1 min-w-[280px] clip-card relative overflow-hidden transition-all duration-300 group"
      style={{
        background: "#0a0a0f",
        border: `1px solid ${hovered && !disabled ? glowColor : "#1e1e2e"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        transform: hovered && !disabled ? "translateY(-4px)" : "none",
        opacity: disabled ? 0.6 : 1,
        boxShadow: hovered && !disabled ? `0 10px 40px ${glowColor}20` : "none"
      }}
    >
      {/* Background Graphic area */}
      <div className="absolute inset-0 pointer-events-none opacity-20 transition-opacity duration-300 group-hover:opacity-40">
         <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
         <div 
           className="absolute inset-0"
           style={{ 
             background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
             mixBlendMode: "screen" 
           }} 
         />
      </div>

      <div className="p-8 h-full flex flex-col relative z-10">
        <div className="text-6xl mb-6 flex justify-center filter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>

        <h2 
          className="font-display font-black text-2xl uppercase tracking-widest text-center mb-2"
          style={{ 
            color: hovered && !disabled ? "#fff" : glowColor,
            textShadow: hovered && !disabled ? `0 0 20px ${glowColor}` : "none"
          }}
        >
          {title}
        </h2>
        
        <p className="font-mono text-sm text-[#94a3b8] text-center mb-8 uppercase leading-relaxed h-10">
          {subtitle}
        </p>

        <div className="mt-auto">
          <NeonBar value={barValue} max={barMax} color={glowColor} label={barLabel} />

          {disabled && disabledMsg ? (
            <div className="font-mono text-xs text-center p-3 clip-bar bg-red-950/30 text-red-500 border border-red-500/50 mt-4 uppercase">
              {disabledMsg}
            </div>
          ) : (
            <div 
              className="mt-4 font-display font-bold text-center py-4 text-sm tracking-widest uppercase transition-all duration-300 clip-btn"
              style={{
                background: hovered ? glowColor : `${glowColor}15`,
                color: hovered ? "#000" : glowColor,
                border: `1px solid ${glowColor}`
              }}
            >
              INITIALIZE MATCH
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ArenaHubPage({ user, onNavigate }: Props) {
  return (
    <div className="max-w-5xl mx-auto space-y-8 relative z-10">
      <div className="dl-page-bg bg-arena" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      
      <div className="text-center py-8 relative">
        {/* Background glow for header */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 bg-[#ff2d55] opacity-10 blur-[50px] pointer-events-none" />
        
        <h1 className="font-display font-black text-5xl uppercase tracking-widest text-white glitch-text mb-4">
          ARENA <span className="text-[#ff2d55]">HUB</span>
        </h1>
        <p className="font-mono text-sm text-[#94a3b8] uppercase tracking-widest">
          Choose your battleground. Glory awaits.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <ArenaCard
          title="COMBAT ZONE"
          subtitle="Turn-based tactical combat. Loadout is everything."
          glowColor="#ff2d55"
          barLabel="ENERGY REQ. (5)"
          barValue={user.energy}
          barMax={user.maxEnergy}
          onClick={() => onNavigate("arena-combat")}
          disabled={user.energy < 5}
          disabledMsg={`INSUFFICIENT ENERGY — NEED 5 (${user.energy}/${user.maxEnergy})`}
          icon="⚔️"
        />
        <ArenaCard
          title="RACING CIRCUIT"
          subtitle="High-speed underground races. Upgrade your ride."
          glowColor="#00d4ff"
          barLabel="NITRO REQ."
          barValue={user.nitro}
          barMax={user.maxNitro}
          onClick={() => onNavigate("race-hub")}
          disabled={user.nitro < 1}
          disabledMsg={`INSUFFICIENT NITRO (${user.nitro}/${user.maxNitro})`}
          icon="🏎️"
        />
      </div>

      <div className="pt-8 border-t border-[#1e1e2e]">
        <CyberSectionHeader title="ARENA UTILITIES" accent="#f59e0b" />
        
        <div className="flex flex-wrap gap-4 mt-4">
          {[
            { label: "ARMORY / LOADOUT", page: "loadout", color: "#ff2d55" },
            { label: "GARAGE / TUNING", page: "garage", color: "#00d4ff" },
            { label: "COMBAT LOGS", page: "match-history", color: "#a855f7" },
          ].map(link => (
            <button
              key={link.page}
              onClick={() => onNavigate(link.page)}
              className="flex-1 min-w-[200px] clip-btn py-4 font-display font-bold text-sm tracking-widest uppercase transition-all duration-300 relative group overflow-hidden"
              style={{
                background: `${link.color}10`,
                border: `1px solid ${link.color}40`,
                color: link.color
              }}
            >
              <div className="absolute inset-0 bg-current opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-current" />
              <span className="relative z-10 group-hover:text-white transition-colors">{link.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
