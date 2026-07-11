/**
 * CreateGiveawayModal — player-facing "Host a Giveaway" flow (Feed).
 *
 * Two-step handshake matching the backend contract exactly:
 *   1) POST /giveaways/draft  — build a pledge, get back a draft + any
 *      coverage shortfall (paid via UC top-up) before anything is escrowed.
 *   2) POST /giveaways/:id/confirm — actually deduct assets and go live.
 *
 * Nothing is ever escrowed by step 1 — the user can freely cancel a draft
 * (it silently expires) without losing anything.
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { User, Item } from "../lib/types";
import { CyberButton } from "./CyberButton";
import { ItemImage } from "./ItemImage";

interface Props {
  user: User;
  onClose: () => void;
  onCreated: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface DraftPledgeItem { itemId: string; quantity: number }

interface DraftResponse {
  // The draft/confirm endpoints return the raw Mongoose document (unlike
  // /giveaways/live and /giveaways/:id, which map to a public `id` field) —
  // so the identifier here is `_id`, not `id`.
  giveaway: { _id: string; pledgeValueDc: number };
  coverage: { shortfallDc: number } | null;
  ucTopUpCost: number;
  totalNcNeeded: number;
  draftExpiresAt: string;
}

interface DraftError {
  message: string;
  itemErrors?: Array<{ itemId: string; reason: string }>;
  frameErrors?: Array<{ frameId: string; reason: string }>;
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
const LABEL: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 };

interface FrameOwned { id: string; rarity: string }

export function CreateGiveawayModal({ user, onClose, onCreated, addToast }: Props) {
  const [step, setStep] = useState<"compose" | "review">("compose");

  const [items, setItems] = useState<Item[]>([]);
  const [ownedFrames, setOwnedFrames] = useState<FrameOwned[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const [dc, setDc] = useState("0");
  const [uc, setUc] = useState("0");
  const [keys, setKeys] = useState("0");
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [durationMs, setDurationMs] = useState(DURATIONS[3].ms);
  const [maxEntrants, setMaxEntrants] = useState("25");

  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [frameErrors, setFrameErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoadingAssets(true);
    Promise.all([
      api.get<Item[]>("/inventory"),
      api.get<{ catalog: Array<{ id: string; rarity: string }>; owned: string[]; equipped: string | null }>("/chatframes"),
    ])
      .then(([inv, frames]) => {
        setItems(inv.filter(i => !i.equipped && !i.marketListed));
        const catalogById = new Map(frames.catalog.map(f => [f.id, f]));
        setOwnedFrames(
          frames.owned
            .filter(id => id !== frames.equipped)
            .map(id => ({ id, rarity: catalogById.get(id)?.rarity ?? "elite" })),
        );
      })
      .catch(() => addToast("Failed to load your inventory/frames", "error"))
      .finally(() => setLoadingAssets(false));
  }, []);

  function toggleItem(itemId: string, quantity: number) {
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

  function toggleFrame(frameId: string) {
    setSelectedFrames(prev => prev.includes(frameId) ? prev.filter(f => f !== frameId) : [...prev, frameId]);
  }

  const dcN = Math.max(0, Math.floor(Number(dc) || 0));
  const ucN = Math.max(0, Math.floor(Number(uc) || 0));
  const keysN = Math.max(0, Math.floor(Number(keys) || 0));
  const maxEntrantsN = Math.max(1, Math.min(MAX_ENTRANT_CAP, Math.floor(Number(maxEntrants) || 1)));

  const hasAnyPledge = dcN > 0 || ucN > 0 || keysN > 0 || Object.keys(selectedItems).length > 0 || selectedFrames.length > 0;
  const overBudget = dcN > user.dc || ucN > user.nc || keysN > user.keys;

  async function submitDraft() {
    if (!hasAnyPledge) { addToast("Pledge something before hosting a giveaway", "error"); return; }
    if (overBudget) { addToast("You don't have that much DC / UC / keys", "error"); return; }
    setSubmitting(true);
    setItemErrors({});
    setFrameErrors({});
    try {
      const pledgeItems: DraftPledgeItem[] = Object.entries(selectedItems).map(([itemId, quantity]) => ({ itemId, quantity }));
      const res = await api.post<DraftResponse>("/giveaways/draft", {
        pledge: { dc: dcN, uc: ucN, keys: keysN, items: pledgeItems, frames: selectedFrames },
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
      if (data?.frameErrors?.length) {
        setFrameErrors(Object.fromEntries(data.frameErrors.map(e => [e.frameId, e.reason])));
      }
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDraft() {
    if (!draft) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>(`/giveaways/${draft.giveaway._id}/confirm`);
      addToast(res.message, "success");
      onCreated();
      onClose();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#0a0a12", border: "1px solid #a855f740", borderRadius: 10,
        padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 0 40px #a855f720",
      }}>
        <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#a855f7", letterSpacing: "0.08em", marginBottom: 4 }}>
          🎁 HOST A GIVEAWAY
        </div>

        {step === "compose" && (
          <>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              Pledge DC, UC, keys, items, and/or frames. Total value must be worth at least 1,000 DC.
            </div>

            {loadingAssets ? (
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#475569", textAlign: "center", padding: 20 }}>
                Loading your inventory...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label style={LABEL}>DC <span style={{ color: "#334155" }}>(have {user.dc})</span></label>
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

                <div>
                  <label style={LABEL}>Items <span style={{ color: "#334155" }}>(unequipped, unlisted only)</span></label>
                  {items.length === 0 ? (
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "#334155" }}>No eligible items in your inventory.</div>
                  ) : (
                    <div className="space-y-1" style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #1e1e2e", borderRadius: 6, padding: 6 }}>
                      {items.map(item => {
                        const selected = item.id in selectedItems;
                        const err = itemErrors[item.id];
                        return (
                          <div key={item.id} className="flex items-center gap-2" style={{ padding: "3px 2px" }}>
                            <input type="checkbox" checked={selected} onChange={() => toggleItem(item.id, item.quantity)} />
                            <ItemImage itemId={item.name.toLowerCase().replace(/ /g, "-")} imageUrl={item.imageUrl} size={20} />
                            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#e2e8f0", flex: 1 }}>
                              {item.name} <span style={{ color: "#475569" }}>({item.rarity})</span>
                            </span>
                            {selected && item.quantity > 1 && (
                              <input
                                type="number" min={1} max={item.quantity} value={selectedItems[item.id]}
                                onChange={e => setItemQty(item.id, Number(e.target.value), item.quantity)}
                                style={{ ...INPUT, width: 56, padding: "3px 6px" }}
                              />
                            )}
                            {err && <span style={{ fontFamily: "monospace", fontSize: 10, color: "#ff2d55" }}>{err}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label style={LABEL}>Chat Frames <span style={{ color: "#334155" }}>(owned, not equipped)</span></label>
                  {ownedFrames.length === 0 ? (
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "#334155" }}>No spare frames to give away.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ownedFrames.map(f => {
                        const selected = selectedFrames.includes(f.id);
                        const err = frameErrors[f.id];
                        return (
                          <label key={f.id} className="flex items-center gap-1.5" style={{
                            fontFamily: "monospace", fontSize: 11, padding: "4px 8px", borderRadius: 6,
                            border: `1px solid ${selected ? "#a855f7" : "#1e1e2e"}`,
                            color: err ? "#ff2d55" : selected ? "#a855f7" : "#94a3b8",
                            cursor: "pointer",
                          }}>
                            <input type="checkbox" checked={selected} onChange={() => toggleFrame(f.id)} />
                            {f.id}
                            {err && <span> — {err}</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} id="anon" />
                  <label htmlFor="anon" style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>
                    Host anonymously (shown as "??? Anonymous Benefactor")
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label style={LABEL}>Duration</label>
                    <select value={durationMs} onChange={e => setDurationMs(Number(e.target.value))} style={INPUT}>
                      {DURATIONS.map(d => <option key={d.ms} value={d.ms}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Max Entrants <span style={{ color: "#334155" }}>(1–{MAX_ENTRANT_CAP})</span></label>
                    <input type="number" min={1} max={MAX_ENTRANT_CAP} value={maxEntrants} onChange={e => setMaxEntrants(e.target.value)} style={INPUT} />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <CyberButton variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancel</CyberButton>
                  <CyberButton variant="purple" size="sm" loading={submitting} disabled={submitting || !hasAnyPledge || overBudget} onClick={submitDraft}>
                    Preview Giveaway
                  </CyberButton>
                </div>
              </div>
            )}
          </>
        )}

        {step === "review" && draft && (
          <div className="space-y-3">
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>
              Pledge value: <span style={{ color: "#39d353" }}>{draft.giveaway.pledgeValueDc.toLocaleString()} DC</span>
            </div>
            {draft.coverage && (
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#f59e0b", background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 6, padding: 10 }}>
                Your pledge is below the 1,000 DC minimum. A top-up of{" "}
                <span style={{ color: "#e2e8f0" }}>{draft.ucTopUpCost} UC</span> will be charged on confirm to cover the{" "}
                {draft.coverage.shortfallDc.toLocaleString()} DC shortfall.
              </div>
            )}
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>
              Total UC needed to go live: <span style={{ color: "#e2e8f0" }}>{draft.totalNcNeeded}</span>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#334155" }}>
              This draft expires at {new Date(draft.draftExpiresAt).toLocaleTimeString()} if not confirmed.
              Nothing has been deducted yet — confirming will escrow your pledge and go live immediately.
            </div>
            <div className="flex gap-2 pt-2">
              <CyberButton variant="ghost" size="sm" onClick={() => setStep("compose")} disabled={submitting}>Back</CyberButton>
              <CyberButton variant="success" size="sm" loading={submitting} disabled={submitting} onClick={confirmDraft}>
                Confirm & Go Live
              </CyberButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
