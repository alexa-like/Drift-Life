/**
 * CreateGiveawayModal — player-facing "Host a Giveaway" flow (Feed).
 *
 * Two-step handshake matching the backend contract exactly:
 *   1) POST /giveaways/draft  — submit pledge; server validates eligibility,
 *      returns full pledge data + any UC shortfall. Nothing is escrowed yet.
 *   2) POST /giveaways/:id/confirm — escrow pledge, go live immediately.
 *
 * The review step shows the complete giveaway preview so the host knows exactly
 * what will go live before hitting "Post Giveaway".
 */
import { useState, useEffect } from "react";
import { api } from "../shared/api";
import { User, Item } from "../shared/types";
import { CyberButton } from "./CyberButton";
import { ItemImage } from "./ItemImage";

interface Props {
  user: User;
  onClose: () => void;
  onCreated: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface DraftPledgeItem { itemId: string; quantity: number }

// Full pledge shape returned by the draft endpoint (mirrors the Giveaway.pledge schema)
interface DraftPledge {
  dc: number;
  uc: number;
  keys: number;
  items: Array<{ itemId: string; name: string; quantity: number; iconUrl: string }>;
}

interface DraftResponse {
  giveaway: {
    _id: string;
    pledgeValueDc: number;
    pledge: DraftPledge;
    durationMs: number;
    maxEntrants: number;
    isAnonymous: boolean;
  };
  coverage: { shortfallDc: number; shortfallUc: number; shortfallKeys: number } | null;
  ucTopUpCost: number;
  totalNcNeeded: number;
  draftExpiresAt: string;
}

interface DraftError {
  message: string;
  itemErrors?: Array<{ itemId: string; reason: string }>;
}

const DURATIONS = [
  { label: "1 hour",   ms: 60 * 60 * 1000 },
  { label: "6 hours",  ms: 6 * 60 * 60 * 1000 },
  { label: "12 hours", ms: 12 * 60 * 60 * 1000 },
  { label: "1 day",    ms: 24 * 60 * 60 * 1000 },
  { label: "2 days",   ms: 2 * 24 * 60 * 60 * 1000 },
  { label: "3 days",   ms: 3 * 24 * 60 * 60 * 1000 },
];

const MAX_ENTRANT_CAP = 500;

const INPUT: React.CSSProperties = {
  background: "#0d1117", border: "1px solid #21262d", borderRadius: 6,
  color: "#e2e8f0", padding: "7px 10px", width: "100%", fontFamily: "monospace", fontSize: 12,
  outline: "none",
};
const LABEL: React.CSSProperties = {
  fontFamily: "monospace", fontSize: 11, color: "#64748b", display: "block", marginBottom: 4,
};

function PrizeLine({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #0d0d1a" }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: accent ?? "#e2e8f0", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export function CreateGiveawayModal({ user, onClose, onCreated, addToast }: Props) {
  const [step, setStep] = useState<"compose" | "review">("compose");

  const [items, setItems] = useState<Item[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const [dc, setDc] = useState("0");
  const [uc, setUc] = useState("0");
  const [keys, setKeys] = useState("0");
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [durationMs, setDurationMs] = useState(DURATIONS[3].ms);
  const [maxEntrants, setMaxEntrants] = useState("25");

  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoadingAssets(true);
    api.get<Item[]>("/inventory")
      .then(inv => setItems(inv.filter(i => !i.equipped && !i.marketListed)))
      .catch(() => addToast("Failed to load your inventory", "error"))
      .finally(() => setLoadingAssets(false));
  }, []);

  function toggleItem(itemId: string) {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[itemId]) delete next[itemId];
      else next[itemId] = 1;
      return next;
    });
  }

  function setItemQty(itemId: string, qty: number, max: number) {
    const clamped = Math.max(1, Math.min(qty, max));
    setSelectedItems(prev => ({ ...prev, [itemId]: clamped }));
  }

  const dcN = Math.max(0, Math.floor(Number(dc) || 0));
  const ucN = Math.max(0, Math.floor(Number(uc) || 0));
  const keysN = Math.max(0, Math.floor(Number(keys) || 0));
  const maxEntrantsN = Math.max(1, Math.min(MAX_ENTRANT_CAP, Math.floor(Number(maxEntrants) || 1)));

  const hasAnyPledge =
    dcN > 0 || ucN > 0 || keysN > 0 ||
    Object.keys(selectedItems).length > 0;
  const overBudget = dcN > user.dc || ucN > user.nc || keysN > user.keys;

  async function submitDraft() {
    if (!hasAnyPledge) { addToast("Pledge something before hosting a giveaway", "error"); return; }
    if (overBudget)    { addToast("You don't have that much DC / UC / keys", "error"); return; }
    setSubmitting(true);
    setItemErrors({});
    try {
      const pledgeItems: DraftPledgeItem[] = Object.entries(selectedItems).map(
        ([itemId, quantity]) => ({ itemId, quantity }),
      );
      const res = await api.post<DraftResponse>("/giveaways/draft", {
        pledge: { dc: dcN, uc: ucN, keys: keysN, items: pledgeItems, frames: [] },
        isAnonymous,
        durationMs,
        maxEntrants: maxEntrantsN,
      });
      setDraft(res);
      setStep("review");
    } catch (err: any) {
      const data: DraftError | undefined = err.data;
      if (data?.itemErrors?.length) {
        setItemErrors(Object.fromEntries(data.itemErrors.map(e => [e.itemId, e.reason])));
      }
      addToast(err.message ?? "Failed to create draft", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDraft() {
    if (!draft) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>(`/giveaways/${draft.giveaway._id}/confirm`);
      addToast(res.message ?? "Giveaway is now live!", "success");
      onCreated();
      onClose();
    } catch (err: any) {
      addToast(err.message ?? "Failed to post giveaway", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const durationLabel = DURATIONS.find(d => d.ms === durationMs)?.label ?? "?";

  // ── Prize pool used in the review step ─────────────────────────────────────
  // Use server-confirmed pledge data (draft.giveaway.pledge) so what you see
  // is exactly what was accepted — no client-state drift.
  const reviewPledge = draft?.giveaway.pledge;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#0a0a12", border: "1px solid #a855f740", borderRadius: 10,
          padding: 24, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto",
          boxShadow: "0 0 48px #a855f720",
        }}
      >
        {/* ── Header ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#a855f7", letterSpacing: "0.08em" }}>
            🎁 HOST A GIVEAWAY
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginTop: 3 }}>
            {step === "compose"
              ? "Choose what to give away — DC, UC, keys, items, or frames."
              : "Review your giveaway. Posting will go live immediately."}
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {(["compose", "review"] as const).map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                background: step === s ? "#a855f7" : i < ["compose","review"].indexOf(step) ? "#a855f750" : "#1e1e2e",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>

        {/* ════════════════════════════════════ COMPOSE STEP ══════════════════════ */}
        {step === "compose" && (
          <>
            {loadingAssets ? (
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#475569", textAlign: "center", padding: 20 }}>
                Loading your inventory...
              </div>
            ) : (
              <div className="space-y-4">

                {/* Currency */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label style={LABEL}>DC <span style={{ color: "#334155" }}>(have {user.dc.toLocaleString()})</span></label>
                    <input type="number" min="0" value={dc} onChange={e => setDc(e.target.value)} style={INPUT} />
                  </div>
                  <div>
                    <label style={LABEL}>UC <span style={{ color: "#334155" }}>(have {user.nc})</span></label>
                    <input type="number" min="0" value={uc} onChange={e => setUc(e.target.value)} style={INPUT} />
                  </div>
                  <div>
                    <label style={LABEL}>Keys <span style={{ color: "#334155" }}>(have {user.keys})</span></label>
                    <input type="number" min="0" value={keys} onChange={e => setKeys(e.target.value)} style={INPUT} />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <label style={LABEL}>
                    Items <span style={{ color: "#334155" }}>(unequipped &amp; unlisted only)</span>
                  </label>
                  {items.length === 0 ? (
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "#334155" }}>
                      No eligible items in your inventory.
                    </div>
                  ) : (
                    <div
                      className="space-y-1"
                      style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #1e1e2e", borderRadius: 6, padding: 6 }}
                    >
                      {items.map(item => {
                        const selected = item.id in selectedItems;
                        const err = itemErrors[item.id];
                        return (
                          <div key={item.id} className="flex items-center gap-2" style={{ padding: "3px 2px" }}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleItem(item.id)}
                            />
                            <ItemImage
                              itemId={item.name.toLowerCase().replace(/ /g, "-")}
                              imageUrl={item.imageUrl}
                              size={20}
                            />
                            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#e2e8f0", flex: 1 }}>
                              {item.name} <span style={{ color: "#475569" }}>({item.rarity})</span>
                            </span>
                            {selected && item.quantity > 1 && (
                              <input
                                type="number" min={1} max={item.quantity}
                                value={selectedItems[item.id]}
                                onChange={e => setItemQty(item.id, Number(e.target.value), item.quantity)}
                                style={{ ...INPUT, width: 56, padding: "3px 6px" }}
                              />
                            )}
                            {err && (
                              <span style={{ fontFamily: "monospace", fontSize: 10, color: "#ff2d55" }}>{err}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Anonymous toggle */}
                <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={e => setIsAnonymous(e.target.checked)}
                  />
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>
                    Host anonymously — shown as "??? Anonymous Benefactor"
                  </span>
                </label>

                {/* Duration + max entrants */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label style={LABEL}>Duration</label>
                    <select
                      value={durationMs}
                      onChange={e => setDurationMs(Number(e.target.value))}
                      style={INPUT}
                    >
                      {DURATIONS.map(d => (
                        <option key={d.ms} value={d.ms}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Max Entrants <span style={{ color: "#334155" }}>(1–{MAX_ENTRANT_CAP})</span></label>
                    <input
                      type="number" min={1} max={MAX_ENTRANT_CAP}
                      value={maxEntrants}
                      onChange={e => setMaxEntrants(e.target.value)}
                      style={INPUT}
                    />
                  </div>
                </div>

                {/* Budget warning */}
                {overBudget && (
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#ff2d55", background: "#ff2d5510", border: "1px solid #ff2d5530", borderRadius: 6, padding: "8px 10px" }}>
                    ⚠ You don't have enough DC / UC / keys for what you've entered.
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                  <CyberButton variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
                    Cancel
                  </CyberButton>
                  <CyberButton
                    variant="purple" size="sm"
                    loading={submitting}
                    disabled={submitting || !hasAnyPledge || overBudget}
                    onClick={submitDraft}
                    className="flex-1"
                  >
                    Preview Giveaway →
                  </CyberButton>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════ REVIEW STEP ═══════════════════════ */}
        {step === "review" && draft && reviewPledge && (
          <div className="space-y-4">

            {/* ── Prize Pool ──────────────────────────────────────────────────── */}
            <div
              style={{
                background: "#0d0a18", border: "1px solid #3a1a5e", borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 14px", borderBottom: "1px solid #1e1e2e", background: "#100a1e",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#a855f7", letterSpacing: "0.06em" }}>
                  🎁 PRIZE POOL
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#39d353", fontWeight: 600 }}>
                  ≈ {draft.giveaway.pledgeValueDc.toLocaleString()} DC value
                </span>
              </div>

              <div style={{ padding: "10px 14px" }}>
                {reviewPledge.dc > 0 && (
                  <PrizeLine label="💵 DC" value={reviewPledge.dc.toLocaleString()} accent="#39d353" />
                )}
                {reviewPledge.uc > 0 && (
                  <PrizeLine label="💎 UC" value={reviewPledge.uc.toLocaleString()} accent="#a855f7" />
                )}
                {reviewPledge.keys > 0 && (
                  <PrizeLine label="🔑 Keys" value={reviewPledge.keys.toLocaleString()} accent="#ffd700" />
                )}
                {reviewPledge.items.map(it => (
                  <div
                    key={it.itemId}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "4px 0", borderBottom: "1px solid #0d0d1a",
                    }}
                  >
                    {it.iconUrl ? (
                      <img src={it.iconUrl} alt={it.name} style={{ width: 20, height: 20, borderRadius: 3, objectFit: "contain", flexShrink: 0 }} />
                    ) : (
                      <span style={{ fontSize: 14, flexShrink: 0 }}>📦</span>
                    )}
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#e2e8f0", flex: 1 }}>{it.name}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                      ×{it.quantity}
                    </span>
                  </div>
                ))}
                {reviewPledge.dc === 0 && reviewPledge.uc === 0 && reviewPledge.keys === 0 &&
                 reviewPledge.items.length === 0 && (
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", textAlign: "center", padding: "6px 0" }}>
                    Empty pledge
                  </div>
                )}
              </div>
            </div>

            {/* ── Giveaway Settings ────────────────────────────────────────────── */}
            <div
              style={{
                background: "#0d0d1a", border: "1px solid #1e1e2e", borderRadius: 8, padding: "10px 14px",
              }}
            >
              <div style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 8 }}>
                ⚙ SETTINGS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 11 }}>
                  <span style={{ color: "#475569" }}>Duration</span>
                  <span style={{ color: "#e2e8f0" }}>{durationLabel}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 11 }}>
                  <span style={{ color: "#475569" }}>Max entrants</span>
                  <span style={{ color: "#e2e8f0" }}>{maxEntrantsN}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 11 }}>
                  <span style={{ color: "#475569" }}>Host shown as</span>
                  <span style={{ color: isAnonymous ? "#64748b" : "#e2e8f0", fontStyle: isAnonymous ? "italic" : "normal" }}>
                    {isAnonymous ? "??? Anonymous Benefactor" : user.username}
                  </span>
                </div>
              </div>
            </div>

            {/* ── UC top-up warning (only if shortfall) ───────────────────────── */}
            {draft.coverage && draft.ucTopUpCost > 0 && (
              <div
                style={{
                  fontFamily: "monospace", fontSize: 12, color: "#f59e0b",
                  background: "#f59e0b0d", border: "1px solid #f59e0b30", borderRadius: 6, padding: "10px 12px",
                  lineHeight: 1.55,
                }}
              >
                ⚠️ You're{" "}
                <span style={{ color: "#e2e8f0" }}>{draft.coverage.shortfallDc.toLocaleString()} DC</span> short
                on assets. A top-up of{" "}
                <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{draft.ucTopUpCost} UC</span> will be charged
                when you post.
                {draft.totalNcNeeded > draft.ucTopUpCost && (
                  <span style={{ color: "#94a3b8" }}>
                    {" "}(Total UC used: {draft.totalNcNeeded} — includes{" "}
                    {draft.totalNcNeeded - draft.ucTopUpCost} UC pledged directly)
                  </span>
                )}
              </div>
            )}

            {/* ── Escrow notice ────────────────────────────────────────────────── */}
            <div
              style={{
                fontFamily: "monospace", fontSize: 10, color: "#334155",
                background: "#0d0d15", border: "1px solid #1a1a2e", borderRadius: 6, padding: "8px 10px",
                lineHeight: 1.6,
              }}
            >
              Nothing has been deducted yet. Posting will immediately escrow your full pledge and make the
              giveaway live in the Feed.
              {" "}Draft expires at{" "}
              <span style={{ color: "#475569" }}>{new Date(draft.draftExpiresAt).toLocaleTimeString()}</span>.
            </div>

            {/* ── Action buttons ───────────────────────────────────────────────── */}
            <div className="flex gap-2 pt-1">
              <CyberButton
                variant="ghost" size="sm"
                onClick={() => setStep("compose")}
                disabled={submitting}
              >
                ← Back
              </CyberButton>
              <CyberButton
                variant="success" size="sm"
                loading={submitting}
                disabled={submitting}
                onClick={confirmDraft}
                className="flex-1"
              >
                🚀 Post Giveaway
              </CyberButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
