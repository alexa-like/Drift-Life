import { useState } from "react";
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
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0a0a0f" }}>
        <div style={{ background: "#111118", border: `1px solid ${faction.color}60`, borderRadius: 12, padding: 40, maxWidth: 480, width: "100%" }}>
          <div className="text-center mb-6">
            <div className="font-mono font-bold text-5xl mb-2" style={{ color: faction.color }}>{faction.emblem}</div>
            <h2 className="font-mono font-bold text-xl" style={{ color: faction.color }}>{faction.name}</h2>
            <p className="font-mono text-sm mt-2" style={{ color: "#94a3b8", fontStyle: "italic" }}>"{faction.tagline}"</p>
          </div>
          <div style={{ background: "#0a0a0f", border: "1px solid #ff2d5540", borderRadius: 8, padding: 16 }} className="mb-6">
            <p className="font-mono text-xs text-center" style={{ color: "#ff2d55" }}>
              WARNING — THIS CHOICE IS PERMANENT
            </p>
            <p className="font-mono text-xs text-center mt-1" style={{ color: "#64748b" }}>
              Faction allegiance cannot be changed after confirmation.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 font-mono text-sm py-3 rounded"
              style={{ background: "transparent", color: "#64748b", border: "1px solid #1e1e2e" }}
            >
              Go Back
            </button>
            <button
              onClick={joinFaction}
              disabled={submitting}
              className="flex-1 font-mono text-sm py-3 rounded font-bold"
              style={{ background: faction.color + "20", color: faction.color, border: `1px solid ${faction.color}60` }}
            >
              {submitting ? "Joining..." : `Join ${faction.name}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "#0a0a0f" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-mono font-bold text-2xl mb-2" style={{ color: "#00d4ff" }}>CHOOSE YOUR FACTION</h1>
          <p className="font-mono text-sm" style={{ color: "#64748b" }}>
            New Vanta, 2047. Three factions control the city. You must choose one.
          </p>
          <p className="font-mono text-xs mt-1" style={{ color: "#ff2d55" }}>
            This decision is permanent.
          </p>
        </div>

        <div className="grid gap-4">
          {FACTIONS.map(f => (
            <button
              key={f.id}
              onClick={() => setSelected(selected === f.id ? null : f.id)}
              className="text-left rounded-lg transition-all"
              style={{
                background: selected === f.id ? f.color + "10" : "#111118",
                border: `1px solid ${selected === f.id ? f.color + "80" : "#1e1e2e"}`,
                padding: 24,
                outline: "none",
                transform: selected === f.id ? "scale(1.01)" : "scale(1)",
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="font-mono font-bold text-3xl flex-shrink-0"
                  style={{ color: f.color, textShadow: selected === f.id ? `0 0 12px ${f.color}80` : "none" }}
                >
                  {f.emblem}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-bold text-lg" style={{ color: f.color }}>{f.name}</span>
                    {selected === f.id && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: f.color + "20", color: f.color, border: `1px solid ${f.color}40` }}>
                        SELECTED
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs mb-3" style={{ color: "#94a3b8", fontStyle: "italic" }}>"{f.tagline}"</p>
                  <p className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>{f.description}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {f.perks.map((p, i) => (
                      <div key={i} className="font-mono text-xs flex items-start gap-1.5">
                        <span style={{ color: f.color, flexShrink: 0 }}>+</span>
                        <span style={{ color: "#94a3b8" }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setConfirming(true)}
              className="font-mono font-bold text-sm px-8 py-3 rounded"
              style={{
                background: FACTIONS.find(f => f.id === selected)!.color + "20",
                color: FACTIONS.find(f => f.id === selected)!.color,
                border: `1px solid ${FACTIONS.find(f => f.id === selected)!.color}60`,
              }}
            >
              Confirm — Join {FACTIONS.find(f => f.id === selected)?.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
