import { User } from "../lib/types";

const PRESTIGE_CSS = `
@keyframes prestigeGlow {
  0%, 100% { box-shadow: 0 0 8px #FFD70088, 0 0 20px #FFD70044; border-color: #FFD700; }
  50%       { box-shadow: 0 0 20px #FFD700cc, 0 0 40px #FFD70077; border-color: #fffbe6; }
}
.prestige-btn-glow {
  animation: prestigeGlow 1.8s ease-in-out infinite;
}
`;

interface Props {
  user: User;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  confirming: boolean;
}

export function PrestigeConfirmModal({ user, onClose, onConfirm, confirming }: Props) {
  const nextPrestige = (user.prestige ?? 0) + 1;
  const eligible = user.level >= 100;

  return (
    <>
      <style>{PRESTIGE_CSS}</style>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "1rem",
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "#0d0d15", border: "2px solid #FFD70066",
            borderRadius: 12, padding: "2rem", maxWidth: 420, width: "100%",
            boxShadow: "0 0 40px #FFD70022",
          }}
        >
          {/* Title */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👑</div>
            <div style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "1.3rem", color: "#FFD700", letterSpacing: "0.15em" }}>
              PRESTIGE {nextPrestige}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
              This is a permanent, irreversible action.
            </div>
          </div>

          {/* Eligibility check */}
          {!eligible && (
            <div style={{
              background: "#ef444415", border: "1px solid #ef444440",
              borderRadius: 8, padding: "10px 14px", marginBottom: "1.25rem",
              fontFamily: "monospace", fontSize: "0.75rem", color: "#ef4444",
            }}>
              ⚠ You must reach <strong>Level 100</strong> before prestiging.
              You are currently Level {user.level}.
            </div>
          )}

          {/* Three-column summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: "1.5rem" }}>
            {/* Resets */}
            <div style={{ background: "#ef444410", border: "1px solid #ef444430", borderRadius: 8, padding: "12px 10px" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#ef4444", fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 8 }}>
                YOU LOSE
              </div>
              {[
                "Level → 1",
                "XP → 0",
                "Health → reset",
              ].map(item => (
                <div key={item} style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#94a3b8", marginBottom: 4 }}>
                  ✗ {item}
                </div>
              ))}
            </div>

            {/* Kept */}
            <div style={{ background: "#39d35310", border: "1px solid #39d35330", borderRadius: 8, padding: "12px 10px" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#39d353", fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 8 }}>
                YOU KEEP
              </div>
              {[
                "DC & NC",
                "Items",
                "Achievements",
                "Faction",
                "Friends",
              ].map(item => (
                <div key={item} style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#94a3b8", marginBottom: 4 }}>
                  ✓ {item}
                </div>
              ))}
            </div>

            {/* Gains */}
            <div style={{ background: "#FFD70010", border: "1px solid #FFD70030", borderRadius: 8, padding: "12px 10px" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#FFD700", fontWeight: "bold", letterSpacing: "0.1em", marginBottom: 8 }}>
                YOU GAIN
              </div>
              {[
                `P${nextPrestige} badge`,
                `P${nextPrestige} frame`,
                "+10% XP boost",
                `+200 max HP`,
              ].map(item => (
                <div key={item} style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#94a3b8", marginBottom: 4 }}>
                  ★ {item}
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              disabled={confirming}
              style={{
                flex: 1, padding: "0.75rem", borderRadius: 8,
                background: "#1e1e2e", border: "1px solid #334155",
                color: "#94a3b8", fontFamily: "monospace", fontWeight: "bold",
                cursor: "pointer", fontSize: "0.85rem",
              }}
            >
              CANCEL
            </button>
            <button
              onClick={onConfirm}
              disabled={!eligible || confirming}
              style={{
                flex: 1, padding: "0.75rem", borderRadius: 8,
                background: eligible ? "#FFD70022" : "#1e1e2e",
                border: `1px solid ${eligible ? "#FFD700" : "#334155"}`,
                color: eligible ? "#FFD700" : "#475569",
                fontFamily: "monospace", fontWeight: "bold",
                cursor: eligible && !confirming ? "pointer" : "not-allowed",
                fontSize: "0.85rem",
                opacity: confirming ? 0.7 : 1,
              }}
            >
              {confirming ? "PRESTIGING..." : `CONFIRM PRESTIGE ${nextPrestige}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default PrestigeConfirmModal;
