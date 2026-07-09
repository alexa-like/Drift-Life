import React from "react";
import { ItemImage } from "./ItemImage";

const RESULT_CSS = `
@keyframes victoryPulse {
  0%, 100% { text-shadow: 0 0 20px #f59e0b, 0 0 40px #f59e0b; opacity: 1; }
  50%       { text-shadow: 0 0 40px #fbbf24, 0 0 80px #fbbf24; opacity: 0.85; }
}
@keyframes resultSlideIn {
  from { opacity: 0; transform: translateY(-32px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes overlayFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;

export interface GearStatusItem {
  itemId: string;
  itemName: string;
  durability: number;
  maxDurability: number;
  destroyed: boolean;
}

export interface MatchResultProps {
  isWinner: boolean;
  opponentName: string;
  opponentLevel: number;
  rewards: { xp: number; dc: number; keyShards: number };
  matchStats: { roundsFiredPrimary: number; roundsFiredSecondary: number; consumablesUsed: number };
  gearStatus: GearStatusItem[];
  onContinue: () => void;
}

export function MatchResultModal({
  isWinner,
  opponentName,
  opponentLevel,
  rewards,
  matchStats,
  gearStatus,
  onContinue,
}: MatchResultProps) {
  const destroyedGear = gearStatus.filter(g => g.destroyed);
  const survivingGear = gearStatus.filter(g => !g.destroyed && g.maxDurability > 0);

  return (
    <>
      <style>{RESULT_CSS}</style>
      {/* Overlay */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
          animation: "overlayFadeIn 0.3s ease",
        }}
      >
        {/* Card */}
        <div
          style={{
            background: "#0a0a14",
            border: `2px solid ${isWinner ? "#f59e0b60" : "#ef444440"}`,
            borderRadius: 16,
            padding: "28px 28px 24px",
            maxWidth: 480, width: "100%",
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: isWinner
              ? "0 0 60px #f59e0b30, 0 0 120px #f59e0b10"
              : "0 0 60px #ef444420",
            animation: "resultSlideIn 0.35s ease",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>
              {isWinner ? "🏆" : "💀"}
            </div>
            <h2 style={{
              fontFamily: "monospace", fontSize: 28, fontWeight: "bold",
              margin: 0, letterSpacing: 4,
              color: isWinner ? "#f59e0b" : "#ef4444",
              animation: isWinner ? "victoryPulse 2s ease-in-out infinite" : "none",
            }}>
              {isWinner ? "★ VICTORY ★" : "DEFEAT"}
            </h2>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", marginTop: 8 }}>
              vs <span style={{ color: "#94a3b8" }}>{opponentName}</span>
              {opponentLevel > 0 && (
                <span style={{ color: "#475569" }}> · Lv.{opponentLevel}</span>
              )}
            </div>
          </div>

          {/* Rewards */}
          <div style={{
            background: "#111120", border: "1px solid #1e293b", borderRadius: 10,
            padding: "14px 16px", marginBottom: 14,
          }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", letterSpacing: 2, marginBottom: 10 }}>
              REWARDS EARNED
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "XP", value: `+${rewards.xp.toLocaleString()}`, color: "#39d353" },
                { label: "DC", value: `+${rewards.dc.toLocaleString()}`, color: "#f59e0b" },
                { label: "KEY SHARDS", value: `+${rewards.keyShards}`, color: "#a855f7" },
              ].map(r => (
                <div key={r.label} style={{
                  flex: 1, minWidth: 80,
                  background: "#0a0a0f", borderRadius: 8, padding: "10px 12px",
                  textAlign: "center",
                }}>
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: "#475569", marginBottom: 4, letterSpacing: 1 }}>
                    {r.label}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: r.color }}>
                    {r.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Match Stats */}
          <div style={{
            background: "#111120", border: "1px solid #1e293b", borderRadius: 10,
            padding: "14px 16px", marginBottom: 14,
          }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", letterSpacing: 2, marginBottom: 10 }}>
              MATCH STATS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[
                { label: "PRIMARY ROUNDS", value: matchStats.roundsFiredPrimary },
                { label: "SECONDARY ROUNDS", value: matchStats.roundsFiredSecondary },
                { label: "CONSUMABLES", value: matchStats.consumablesUsed },
              ].map(s => (
                <div key={s.label} style={{
                  background: "#0a0a0f", borderRadius: 6, padding: "8px 10px", textAlign: "center",
                }}>
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: "#475569", marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#e2e8f0" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Gear Status */}
          {gearStatus.length > 0 && (
            <div style={{
              background: "#111120", border: "1px solid #1e293b", borderRadius: 10,
              padding: "14px 16px", marginBottom: 14,
            }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", letterSpacing: 2, marginBottom: 10 }}>
                GEAR STATUS
              </div>

              {/* Destroyed */}
              {destroyedGear.map(g => (
                <div key={g.itemId} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#ef444415", border: "1px solid #ef444440",
                  borderRadius: 6, padding: "8px 10px", marginBottom: 6,
                }}>
                  <ItemImage itemId={g.itemId} size={28} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#ef4444", fontWeight: "bold" }}>
                      DESTROYED THIS MATCH: {g.itemName}
                    </span>
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: 9, color: "#ef4444" }}>0/{g.maxDurability}</span>
                </div>
              ))}

              {/* Surviving */}
              {survivingGear.map(g => {
                const pct = Math.round((g.durability / g.maxDurability) * 100);
                const color = pct > 60 ? "#39d353" : pct > 30 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={g.itemId} style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 6,
                  }}>
                    <ItemImage itemId={g.itemId} size={24} />
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", flex: 1 }}>{g.itemName}</span>
                    <div style={{ width: 60, background: "#1e293b", borderRadius: 3, height: 5 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 9, color, minWidth: 40, textAlign: "right" }}>
                      {g.durability}/{g.maxDurability}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={onContinue}
            style={{
              width: "100%", padding: "14px",
              borderRadius: 10, fontFamily: "monospace", fontSize: 14,
              fontWeight: "bold", cursor: "pointer", letterSpacing: 2,
              background: isWinner
                ? "linear-gradient(135deg, #f59e0b25, #f59e0b10)"
                : "linear-gradient(135deg, #ef444420, #ef444410)",
              border: `1px solid ${isWinner ? "#f59e0b60" : "#ef444450"}`,
              color: isWinner ? "#f59e0b" : "#ef4444",
              marginTop: 4,
            }}
          >
            [ CONTINUE ]
          </button>
        </div>
      </div>
    </>
  );
}
