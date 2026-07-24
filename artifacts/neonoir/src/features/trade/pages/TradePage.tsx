import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api";
import { User, Item } from "../../../shared/types";

interface TradeOffer {
  dc: number;
  itemIds: string[];
  itemNames: string[];
}
interface Trade {
  id: string;
  initiator: { id: string; name: string };
  target: { id: string; name: string };
  initiatorOffer: TradeOffer;
  targetOffer: TradeOffer;
  status: string;
  expiresAt: string;
  isMine: boolean;
}

interface PlayerResult {
  id: string;
  username: string;
  level: number;
  faction: string | null;
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
  prefilledPlayer?: { id: string; username: string } | null;
  onTradeOpened?: () => void;
}

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8", uncommon: "#39d353", rare: "#00d4ff",
  epic: "#a855f7", legendary: "#f59e0b", mythic: "#ff2d55", event: "#ff6b35",
};

const INPUT_STYLE = {
  background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e",
  outline: "none", borderRadius: 6, padding: "8px 12px",
  fontFamily: "monospace", fontSize: 13, width: "100%", boxSizing: "border-box" as const,
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function TradePage({ user, addToast, prefilledPlayer, onTradeOpened }: Props) {
  const qc = useQueryClient();

  // New offer state
  const [showOffer, setShowOffer] = useState(false);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [form, setForm] = useState({
    targetId: "",
    offerDc: 0,
    requestDc: 0,
    offerItemIds: [] as string[],
  });

  // Auto-open offer form when arriving from a player's profile
  useEffect(() => {
    if (prefilledPlayer && prefilledPlayer.id !== user.id) {
      const p: PlayerResult = { id: prefilledPlayer.id, username: prefilledPlayer.username, level: 0, faction: null };
      setSelectedPlayer(p);
      setPlayerSearch(prefilledPlayer.username);
      setForm(f => ({ ...f, targetId: prefilledPlayer.id }));
      setShowOffer(true);
      onTradeOpened?.();
    }
  }, [prefilledPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counter offer state
  const [counterTradeId, setCounterTradeId] = useState<string | null>(null);
  const [counterInventory, setCounterInventory] = useState<Item[]>([]);
  const [counterForm, setCounterForm] = useState({
    offerDc: 0,
    requestDc: 0,
    offerItemIds: [] as string[],
  });

  const debouncedSearch = useDebounce(playerSearch, 350);

  // Player username search
  useEffect(() => {
    if (debouncedSearch.trim().length < 2) { setPlayerResults([]); return; }
    api.get<PlayerResult[]>(`/trade/search-player?q=${encodeURIComponent(debouncedSearch)}`)
      .then(setPlayerResults)
      .catch(() => {});
  }, [debouncedSearch]);

  // Load inventory when opening offer form or counter form
  useEffect(() => {
    if (showOffer || counterTradeId) {
      api.get<Item[]>("/inventory").then(r => {
        setInventory(r);
        setCounterInventory(r);
      }).catch(() => {});
    }
  }, [showOffer, counterTradeId]);

  function toggleOfferItem(id: string) {
    setForm(f => ({
      ...f,
      offerItemIds: f.offerItemIds.includes(id)
        ? f.offerItemIds.filter(x => x !== id)
        : [...f.offerItemIds, id],
    }));
  }

  function toggleCounterItem(id: string) {
    setCounterForm(f => ({
      ...f,
      offerItemIds: f.offerItemIds.includes(id)
        ? f.offerItemIds.filter(x => x !== id)
        : [...f.offerItemIds, id],
    }));
  }

  function selectPlayer(p: PlayerResult) {
    setSelectedPlayer(p);
    setPlayerSearch(p.username);
    setPlayerResults([]);
    setForm(f => ({ ...f, targetId: p.id }));
  }

  function resetOffer() {
    setShowOffer(false);
    setPlayerSearch("");
    setPlayerResults([]);
    setSelectedPlayer(null);
    setForm({ targetId: "", offerDc: 0, requestDc: 0, offerItemIds: [] });
  }

  const { data: trades = [], isLoading } = useQuery<Trade[]>({
    queryKey: ["trades"],
    queryFn: () => api.get("/trade/pending"),
    refetchInterval: 30_000,
  });

  const createOffer = useMutation({
    mutationFn: () => api.post("/trade/offer", {
      targetId: form.targetId,
      offerDc: form.offerDc,
      requestDc: form.requestDc,
      offerItemIds: form.offerItemIds,
    }),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      resetOffer();
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const accept = useMutation({
    mutationFn: (id: string) => api.post(`/trade/${id}/accept`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const decline = useMutation({
    mutationFn: (id: string) => api.post(`/trade/${id}/decline`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/trade/${id}/cancel`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const counter = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.post(`/trade/${id}/counter`, body),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      setCounterTradeId(null);
      setCounterForm({ offerDc: 0, requestDc: 0, offerItemIds: [] });
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const incoming = trades.filter((t) => !t.isMine);
  const outgoing = trades.filter((t) => t.isMine);

  return (
    <div className="space-y-4 relative z-10">
      <div className="dl-page-bg bg-market" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {/* Header */}
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono font-bold text-lg" style={{ color: "#00d4ff" }}>PLAYER TRADING</h2>
            <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
              Secure 1-for-1 trades. DC escrowed on offer — returned if declined.
            </p>
          </div>
          <button
            onClick={() => { setShowOffer(!showOffer); setCounterTradeId(null); }}
            className="font-mono text-xs px-3 py-1 rounded"
            style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
          >
            + New Offer
          </button>
        </div>
      </div>

      {/* Create offer panel */}
      {showOffer && (
        <div className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #00d4ff40" }}>
          <div className="font-mono text-sm font-bold" style={{ color: "#00d4ff" }}>Create Trade Offer</div>

          {/* Player search */}
          <div className="relative">
            <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Search player by username</div>
            <input
              value={playerSearch}
              onChange={(e) => { setPlayerSearch(e.target.value); setSelectedPlayer(null); setForm(f => ({ ...f, targetId: "" })); }}
              placeholder="Type username..."
              style={INPUT_STYLE}
            />
            {playerResults.length > 0 && !selectedPlayer && (
              <div className="absolute z-20 left-0 right-0 rounded-b-lg overflow-hidden" style={{ background: "#0d0d14", border: "1px solid #1e1e2e", borderTop: "none" }}>
                {playerResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPlayer(p)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderBottom: "1px solid #1e1e2e", cursor: "pointer", textAlign: "left" }}
                  >
                    <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>{p.username}</span>
                    <span className="font-mono text-xs" style={{ color: "#64748b" }}>Lv.{p.level}{p.faction ? ` · ${p.faction}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedPlayer && (
              <div className="font-mono text-xs mt-1" style={{ color: "#39d353" }}>
                ✓ Trading with: {selectedPlayer.username} (Lv.{selectedPlayer.level})
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Your offer (DC)</div>
              <input type="number" min={0} value={form.offerDc}
                onChange={(e) => setForm((f) => ({ ...f, offerDc: parseInt(e.target.value) || 0 }))}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Requesting (DC)</div>
              <input type="number" min={0} value={form.requestDc}
                onChange={(e) => setForm((f) => ({ ...f, requestDc: parseInt(e.target.value) || 0 }))}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* Item picker */}
          <ItemPicker
            items={inventory.filter(it => !it.equipped && !it.marketListed && !it.inTrade)}
            selected={form.offerItemIds}
            onToggle={toggleOfferItem}
            label="Include items to offer (optional)"
          />

          <div className="flex gap-2">
            <button
              onClick={() => createOffer.mutate()}
              disabled={createOffer.isPending || !form.targetId || (form.offerDc === 0 && form.requestDc === 0 && form.offerItemIds.length === 0)}
              className="font-mono text-sm px-6 py-2 rounded"
              style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
            >
              {createOffer.isPending ? "Sending..." : "Send Offer"}
            </button>
            <button onClick={resetOffer}
              className="font-mono text-sm px-4 py-2 rounded"
              style={{ background: "transparent", color: "#64748b", border: "1px solid #1e1e2e", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Counter offer panel */}
      {counterTradeId && (() => {
        const originalTrade = incoming.find(t => t.id === counterTradeId);
        if (!originalTrade) return null;
        return (
          <div className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #f59e0b40" }}>
            <div className="font-mono text-sm font-bold" style={{ color: "#f59e0b" }}>Counter Offer to {originalTrade.initiator.name}</div>
            <div className="font-mono text-xs px-2 py-1.5 rounded" style={{ background: "#f59e0b11", color: "#64748b", border: "1px solid #f59e0b22" }}>
              Their offer: {originalTrade.initiatorOffer.dc > 0 ? `${originalTrade.initiatorOffer.dc.toLocaleString()} DC` : ""}{originalTrade.initiatorOffer.itemNames.join(", ") || ""}
              {" · "}They want: {originalTrade.targetOffer.dc > 0 ? `${originalTrade.targetOffer.dc.toLocaleString()} DC` : ""}{originalTrade.targetOffer.itemNames.join(", ") || ""}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Your counter offer (DC)</div>
                <input type="number" min={0} value={counterForm.offerDc}
                  onChange={e => setCounterForm(f => ({ ...f, offerDc: parseInt(e.target.value) || 0 }))}
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Requesting (DC)</div>
                <input type="number" min={0} value={counterForm.requestDc}
                  onChange={e => setCounterForm(f => ({ ...f, requestDc: parseInt(e.target.value) || 0 }))}
                  style={INPUT_STYLE}
                />
              </div>
            </div>
            <ItemPicker
              items={counterInventory.filter(it => !it.equipped && !it.marketListed && !it.inTrade)}
              selected={counterForm.offerItemIds}
              onToggle={toggleCounterItem}
              label="Include items in your counter (optional)"
            />
            <div className="flex gap-2">
              <button
                onClick={() => counter.mutate({
                  id: counterTradeId,
                  body: {
                    offerDc: counterForm.offerDc,
                    requestDc: counterForm.requestDc,
                    offerItemIds: counterForm.offerItemIds,
                  },
                })}
                disabled={counter.isPending || (counterForm.offerDc === 0 && counterForm.requestDc === 0 && counterForm.offerItemIds.length === 0)}
                className="font-mono text-sm px-5 py-2 rounded"
                style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b40", cursor: "pointer" }}
              >
                {counter.isPending ? "Sending..." : "Send Counter"}
              </button>
              <button onClick={() => setCounterTradeId(null)}
                className="font-mono text-sm px-4 py-2 rounded"
                style={{ background: "transparent", color: "#64748b", border: "1px solid #1e1e2e", cursor: "pointer" }}
              >
                Back
              </button>
            </div>
          </div>
        );
      })()}

      {isLoading ? (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading trades...</div>
      ) : (
        <>
          {incoming.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-xs font-bold" style={{ color: "#39d353" }}>INCOMING ({incoming.length})</div>
              {incoming.map((t) => (
                <div key={t.id} className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #39d35330" }}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{t.initiator.name}</span>
                      <span className="font-mono text-xs ml-2" style={{ color: "#64748b" }}>wants to trade</span>
                      <div className="font-mono text-xs mt-1" style={{ color: "#94a3b8" }}>
                        Offering: <span style={{ color: "#39d353" }}>
                          {[t.initiatorOffer.dc > 0 ? `${t.initiatorOffer.dc.toLocaleString()} DC` : null, ...t.initiatorOffer.itemNames].filter(Boolean).join(", ") || "nothing"}
                        </span>
                      </div>
                      <div className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                        Wants: <span style={{ color: "#ff6b35" }}>
                          {[t.targetOffer.dc > 0 ? `${t.targetOffer.dc.toLocaleString()} DC` : null, ...t.targetOffer.itemNames].filter(Boolean).join(", ") || "nothing"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      <button onClick={() => accept.mutate(t.id)} disabled={accept.isPending}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#39d35322", color: "#39d353", border: "1px solid #39d35340", cursor: "pointer" }}
                      >Accept</button>
                      <button onClick={() => { setCounterTradeId(t.id); setShowOffer(false); setCounterForm({ offerDc: 0, requestDc: 0, offerItemIds: [] }); }}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b40", cursor: "pointer" }}
                      >Counter</button>
                      <button onClick={() => decline.mutate(t.id)} disabled={decline.isPending}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#ff2d5522", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}
                      >Decline</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {outgoing.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-xs font-bold" style={{ color: "#64748b" }}>OUTGOING ({outgoing.length})</div>
              {outgoing.map((t) => (
                <div key={t.id} className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>To: {t.target.name}</span>
                      <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                        Offering: {[t.initiatorOffer.dc > 0 ? `${t.initiatorOffer.dc.toLocaleString()} DC` : null, ...t.initiatorOffer.itemNames].filter(Boolean).join(", ") || "nothing"}
                        {" · "}Requesting: {[t.targetOffer.dc > 0 ? `${t.targetOffer.dc.toLocaleString()} DC` : null, ...t.targetOffer.itemNames].filter(Boolean).join(", ") || "nothing"}
                      </div>
                    </div>
                    <button onClick={() => cancel.mutate(t.id)} disabled={cancel.isPending}
                      className="font-mono text-xs px-3 py-1 rounded"
                      style={{ background: "#ff2d5522", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer", flexShrink: 0 }}
                    >Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {incoming.length === 0 && outgoing.length === 0 && (
            <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>
              No pending trades. Send an offer to another player to begin.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared item picker component ──────────────────────────────────────────────
function ItemPicker({
  items,
  selected,
  onToggle,
  label,
}: {
  items: Item[];
  selected: string[];
  onToggle: (id: string) => void;
  label: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>{label}</div>
      <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #1e1e2e", borderRadius: 6 }}>
        {items.map(it => {
          const sel = selected.includes(it.id);
          const rc = RARITY_COLOR[it.rarity] ?? "#94a3b8";
          return (
            <button
              key={it.id}
              onClick={() => onToggle(it.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "6px 10px", background: sel ? "#00d4ff10" : "transparent",
                border: "none", borderBottom: "1px solid #1e1e2e",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                border: `2px solid ${sel ? "#00d4ff" : "#334155"}`,
                background: sel ? "#00d4ff" : "transparent",
              }} />
              <span className="font-mono text-xs font-bold" style={{ color: rc, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.name}
              </span>
              {it.quantity > 1 && <span className="font-mono" style={{ color: "#475569", fontSize: 10 }}>×{it.quantity}</span>}
              <span className="font-mono" style={{ color: "#334155", fontSize: 10 }}>{it.type}</span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="font-mono text-xs mt-1" style={{ color: "#00d4ff" }}>
          {selected.length} item{selected.length !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  );
}
