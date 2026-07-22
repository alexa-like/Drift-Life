import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";

const FACTIONS = [
  {
    id: "suits",
    name: "The Suits",
    color: "#f59e0b",
    emblem: "◆",
    tagline: "Money is power. Power is everything.",
    perks: [
      "+10% DC earned from all jobs",
      "+5% success on Scam & Corporate Espionage",
      "Market discount in Downtown Core",
      "Suits-only black market access",
    ],
    description: "Corporate players with fingers in every pie. They run Downtown Core from glass towers and wield lawyers like weapons. Join them and play the long game — quietly accumulate power until you own the city.",
  },
  {
    id: "street",
    name: "The Street",
    color: "#ff6b35",
    emblem: "◉",
    tagline: "Take what you need. Leave the rest bleeding.",
    perks: [
      "+10% DC from PvP wins",
      "+5% success on Break-In & Heist",
      "+10% XP from all combat",
      "Street-only combat gear access",
    ],
    description: "Born on the pavement, bred in the alley. The Street runs on reputation and violence. Industrial East and the Port District bow to them. Fast life, hard kills, legendary status.",
  },
  {
    id: "grid",
    name: "The Grid",
    color: "#00d4ff",
    emblem: "◈",
    tagline: "All systems are vulnerable. Including you.",
    perks: [
      "-10% Energy cost on all jobs",
      "+5% success on Data Breach & Scam",
      "Access to Grid-only hacking jobs",
      "Tech Quarter market discount",
    ],
    description: "Ghosts in the machine. Grid operatives move through systems like water through cracks. They don't fight — they control. Join the Grid and you'll never go looking for information again. It'll find you.",
  },
];

interface Props {
  onComplete: () => void;
  addToast: (msg: string, t?: string) => void;
}

export function FactionSelectPage({ onComplete, addToast }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function joinFaction() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post("/auth/select-faction", { faction: selected });
      addToast(`You have joined ${FACTIONS.find(f => f.id === selected)?.name}. This is permanent.`, "success");
      onComplete();
    } catch (e: any) {
      addToast(e.message, "error");
      setSubmitting(false);
      setConfirming(false);
    }
  }

  if (confirming && selected) {
    const faction = FACTIONS.find(f => f.id === selected)!;
    return (
      <div className="flex items-center justify-center px-4 relative overflow-hidden" style={{ minHeight: "calc(100dvh / var(--dl-scale, 1))", background: "var(--dl-bg, #08080c)" }}>
        <div className="dl-page-bg bg-faction" />
        <div className="scanlines absolute inset-0 pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="clip-card p-1" style={{ background: `linear-gradient(135deg, ${faction.color}80, transparent)` }}>
            <div style={{ background: "#08080c" }} className="clip-card p-10">
              <div className="text-center mb-8">
                <div className="font-mono font-bold text-6xl mb-4 animate-pulse-glow" style={{ color: faction.color, textShadow: `0 0 20px ${faction.color}` }}>{faction.emblem}</div>
                <h2 className="font-display font-black text-3xl uppercase tracking-widest" style={{ color: faction.color }}>{faction.name}</h2>
                <p className="font-mono text-sm mt-3" style={{ color: "#94a3b8", fontStyle: "italic" }}>"{faction.tagline}"</p>
              </div>
              <div style={{ background: "rgba(255,45,85,0.1)", border: "1px solid #ff2d55", padding: 20 }} className="mb-8 clip-bar">
                <p className="font-mono text-sm text-center font-bold" style={{ color: "#ff2d55" }}>
                  WARNING — THIS CHOICE IS PERMANENT
                </p>
                <p className="font-mono text-xs text-center mt-2" style={{ color: "#94a3b8" }}>
                  Faction allegiance cannot be changed after confirmation.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 font-mono text-sm py-4 clip-btn uppercase tracking-widest transition-colors hover:bg-[#1e1e2e]"
                  style={{ background: "#111118", color: "#94a3b8", border: "1px solid #2a2a3e" }}
                >
                  ABORT
                </button>
                <button
                  onClick={joinFaction}
                  disabled={submitting}
                  className="flex-1 font-mono text-sm py-4 clip-btn uppercase tracking-widest font-bold animate-pulse-glow transition-transform hover:scale-105"
                  style={{ background: faction.color + "20", color: faction.color, border: `1px solid ${faction.color}` }}
                >
                  {submitting ? "UPLOADING..." : `PLEDGE LOYALTY`}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 relative overflow-hidden" style={{ minHeight: "calc(100dvh / var(--dl-scale, 1))", background: "var(--dl-bg, #08080c)" }}>
      <div className="dl-page-bg bg-faction" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-50" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display font-black text-4xl mb-4 tracking-widest uppercase glitch-text" style={{ color: "#00d4ff", textShadow: "0 0 20px #00d4ff" }}>SELECT FACTION ALIGNMENT</h1>
          <p className="font-mono text-sm uppercase tracking-widest" style={{ color: "#94a3b8" }}>
            New Vanta, 2047. Three factions control the city.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FACTIONS.map((f, i) => (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={f.id}
              onClick={() => setSelected(selected === f.id ? null : f.id)}
              className="text-left transition-all relative group clip-card"
              style={{
                background: selected === f.id ? f.color + "15" : "rgba(17, 17, 24, 0.8)",
                border: `1px solid ${selected === f.id ? f.color : "#1e1e2e"}`,
                padding: "32px 24px",
                outline: "none",
                transform: selected === f.id ? "scale(1.02)" : "scale(1)",
                boxShadow: selected === f.id ? `0 0 30px ${f.color}40, inset 0 0 20px ${f.color}20` : "none",
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ background: `linear-gradient(180deg, ${f.color}, transparent)` }} />
              
              <div className="flex flex-col items-center text-center mb-6">
                <div
                  className="font-mono font-bold text-6xl mb-4"
                  style={{ color: f.color, textShadow: selected === f.id ? `0 0 20px ${f.color}` : "none" }}
                >
                  {f.emblem}
                </div>
                <span className="font-display font-black text-2xl uppercase tracking-widest mb-2" style={{ color: f.color }}>{f.name}</span>
                <p className="font-mono text-xs" style={{ color: "#94a3b8", fontStyle: "italic" }}>"{f.tagline}"</p>
              </div>
              
              <p className="font-mono text-sm leading-relaxed mb-6" style={{ color: "#e2e8f0" }}>{f.description}</p>
              
              <div className="space-y-2 border-t border-[#1e1e2e] pt-4">
                {f.perks.map((p, j) => (
                  <div key={j} className="font-mono text-xs flex items-start gap-2">
                    <span style={{ color: f.color, flexShrink: 0 }}>+</span>
                    <span style={{ color: "#94a3b8" }}>{p}</span>
                  </div>
                ))}
              </div>
              
              {selected === f.id && (
                <div className="absolute top-4 right-4 font-mono text-[10px] font-bold px-2 py-1 clip-btn animate-pulse" style={{ background: f.color, color: "#000" }}>
                  SELECTED
                </div>
              )}
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-12 text-center"
            >
              <button
                onClick={() => setConfirming(true)}
                className="font-display font-black text-xl px-12 py-5 clip-btn uppercase tracking-widest transition-all hover:scale-105 animate-pulse-glow"
                style={{
                  background: FACTIONS.find(f => f.id === selected)!.color + "20",
                  color: FACTIONS.find(f => f.id === selected)!.color,
                  border: `1px solid ${FACTIONS.find(f => f.id === selected)!.color}`,
                }}
              >
                CONFIRM SELECTION
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
