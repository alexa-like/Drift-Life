import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveGiveaway } from "../shared/types";
import { api } from "../shared/api";
import { CyberButton } from "./CyberButton";

interface Props {
  giveaway: LiveGiveaway;
  currentUserId?: string;
  onInspectPlayer?: (id: string) => void;
  onEntered?: (giveawayId: string) => void;
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "ending soon…";
  const totalSec = Math.floor(msLeft / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

function useCountdown(target: string): string {
  const [label, setLabel] = useState(() => formatCountdown(new Date(target).getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      setLabel(formatCountdown(new Date(target).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
  return label;
}

function PledgeLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between font-mono" style={{ fontSize: 11 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export function GiveawayCard({ giveaway, currentUserId, onInspectPlayer, onEntered }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [entering, setEntering] = useState(false);
  const [entered, setEntered] = useState(Boolean(giveaway.alreadyEntered));
  const [error, setError] = useState<string | null>(null);
  const [entrantCount, setEntrantCount] = useState(giveaway.entrantCount ?? 0);

  const countdown = useCountdown(giveaway.liveExpiresAt);
  const isHost = giveaway.isHost || (currentUserId != null && giveaway.host.userId === currentUserId);
  const canClickHost = !giveaway.isAnonymous && !giveaway.isOwnerHosted && giveaway.host.userId && onInspectPlayer;

  async function enter() {
    if (entering || entered || isHost) return;
    setEntering(true);
    setError(null);
    try {
      const res = await api.post<{ entrantCount: number }>(`/giveaways/${giveaway.id}/enter`);
      setEntered(true);
      setEntrantCount(res.entrantCount);
      onEntered?.(giveaway.id);
    } catch (err: any) {
      setError(err.message ?? "Failed to enter");
    } finally {
      setEntering(false);
    }
  }

  const pledge = giveaway.pledge;
  const hasCurrency = pledge.dc > 0 || pledge.uc > 0 || pledge.keys > 0;

  return (
    <div
      style={{
        background: "#0a0a12",
        border: "1px solid #2a1a3e",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 0 16px rgba(168,85,247,0.08)",
      }}
    >
      {/* Collapsed header — always visible */}
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ cursor: "pointer", display: "flex", gap: 12, padding: "10px 14px", alignItems: "center" }}
      >
        {giveaway.cardImageUrl ? (
          <img
            src={giveaway.cardImageUrl}
            alt="Giveaway"
            style={{ width: 64, height: 25, objectFit: "cover", borderRadius: 4, border: "1px solid #3a2a4e", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 64, height: 25, borderRadius: 4, flexShrink: 0,
              background: "linear-gradient(135deg, #1a0a2e, #2a1a3e)",
              border: "1px solid #3a2a4e",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}
          >
            🎁
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-mono"
              style={{ fontSize: 9, fontWeight: 700, color: "#a855f7", background: "#a855f718", border: "1px solid #a855f740", borderRadius: 3, padding: "2px 5px", letterSpacing: "0.05em" }}
            >
              🎁 GIVEAWAY
            </span>
            <span
              onClick={(e) => { if (canClickHost) { e.stopPropagation(); onInspectPlayer?.(giveaway.host.userId!); } }}
              className="font-mono truncate"
              style={{ fontSize: 12, color: giveaway.isAnonymous ? "#64748b" : "#e2e8f0", cursor: canClickHost ? "pointer" : "default", fontStyle: giveaway.isAnonymous ? "italic" : "normal" }}
            >
              {giveaway.host.name}
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
            {countdown} · {entrantCount}/{giveaway.maxEntrants} entered
          </div>
        </div>

        <span className="font-mono flex-shrink-0" style={{ fontSize: 10, color: "#64748b" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded — pledge contents + Try Your Luck */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 14px 14px", borderTop: "1px solid #1e1e2e" }}>
              <div className="pt-3 space-y-1.5">
                {hasCurrency && pledge.dc > 0 && <PledgeLine label="💵 DC" value={pledge.dc.toLocaleString()} />}
                {hasCurrency && pledge.uc > 0 && <PledgeLine label="💎 NC" value={pledge.uc.toLocaleString()} />}
                {hasCurrency && pledge.keys > 0 && <PledgeLine label="🔑 Keys" value={pledge.keys.toLocaleString()} />}
                {pledge.items.map((it) => (
                  <PledgeLine key={it.itemId} label={it.name} value={`×${it.quantity}`} />
                ))}
                {!hasCurrency && pledge.items.length === 0 && (
                  <div className="font-mono" style={{ fontSize: 11, color: "#475569" }}>Empty pledge</div>
                )}
              </div>

              <div className="pt-3">
                {isHost ? (
                  <div className="font-mono text-center" style={{ fontSize: 11, color: "#475569" }}>
                    You're hosting this giveaway
                  </div>
                ) : entered ? (
                  <div className="font-mono text-center" style={{ fontSize: 11, color: "#39d353" }}>
                    ✓ You're entered — good luck!
                  </div>
                ) : (
                  <CyberButton
                    variant="purple"
                    size="sm"
                    loading={entering}
                    disabled={entering}
                    onClick={enter}
                    className="w-full"
                  >
                    🤞 Try your luck
                  </CyberButton>
                )}
                {error && (
                  <div className="font-mono text-center pt-1.5" style={{ fontSize: 10, color: "#ff2d55" }}>
                    {error}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
