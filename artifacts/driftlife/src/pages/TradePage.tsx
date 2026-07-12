import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User, Item } from "../lib/types";

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

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8", uncommon: "#39d353", rare: "#00d4ff",
  epic: "#a855f7", legendary: "#f59e0b", mythic: "#ff2d55", event: "#ff6b35",
};

export function TradePage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const [showOffer, setShowOffer] = useState(false);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [form, setForm] = useState({
    targetId: "",
    offerDc: 0,
    requestDc: 0,
    offerItemIds: [] as string[],
  });

  useEffect(() => {
    if (showOffer) {
      api.get<Item[]>("/inventory").then(setInventory).catch(() => {});
    }
  }, [showOffer]);

  function toggleOfferItem(id: string) {
    setForm(f => ({
      ...f,
      offerItemIds: f.offerItemIds.includes(id)
        ? f.offerItemIds.filter(x => x !== id)
        : [...f.offerItemIds, id],
    }));
  }

  const { data: trades = [], isLoading } = useQuery<Trade[]>({
    queryKey: ["trades"],
    queryFn: () => api.get("/trade/pending"),
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
      setShowOffer(false);
      setForm({ targetId: "", offerDc: 0, requestDc: 0, offerItemIds: [] });
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

  const incoming = trades.filter((t) => !t.isMine);
  const outgoing = trades.filter((t) => t.isMine);

  return (
    <div className="space-y-4 relative z-10">
      <div className="dl-page-bg bg-market" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono font-bold text-lg" style={{ color: "#00d4ff" }}>PLAYER TRADING</h2>
            <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>Secure 1-for-1 trades. Both parties must confirm before execution.</p>
          </div>
          <button
            onClick={() => setShowOffer(!showOffer)}
            className="font-mono text-xs px-3 py-1 rounded"
            style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
          >
            + New Offer
          </button>
        </div>
      </div>

      {showOffer && (
        <div className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #00d4ff40" }}>
          <div className="font-mono text-sm font-bold" style={{ color: "#00d4ff" }}>Create Trade Offer</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Target Player ID</div>
              <input
                value={form.targetId}
                onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
                placeholder="Player ID..."
                className="w-full font-mono text-xs px-3 py-2 rounded"
                style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
              />
            </div>
            <div>
              <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Your offer (DC)</div>
              <input
                type="number"
                min={0}
                value={form.offerDc}
                onChange={(e) => setForm((f) => ({ ...f, offerDc: parseInt(e.target.value) || 0 }))}
                className="w-full font-mono text-xs px-3 py-2 rounded"
                style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
              />
            </div>
            <div>
              <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Requesting (DC)</div>
              <input
                type="number"
                min={0}
                value={form.requestDc}
                onChange={(e) => setForm((f) => ({ ...f, requestDc: parseInt(e.target.value) || 0 }))}
                className="w-full font-mono text-xs px-3 py-2 rounded"
                style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
              />
            </div>
          </div>
          {/* Item picker */}
          {inventory.length > 0 && (
            <div>
              <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>
                Include items from your inventory (optional)
              </div>
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #1e1e2e", borderRadius: 6 }}>
                {inventory.filter(it => !it.equipped && !it.marketListed).map(it => {
                  const selected = form.offerItemIds.includes(it.id);
                  const rc = RARITY_COLOR[it.rarity] ?? "#94a3b8";
                  return (
                    <button
                      key={it.id}
                      onClick={() => toggleOfferItem(it.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "6px 10px", background: selected ? "#00d4ff10" : "transparent",
                        border: "none", borderBottom: "1px solid #1e1e2e",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                        border: `2px solid ${selected ? "#00d4ff" : "#334155"}`,
                        background: selected ? "#00d4ff" : "transparent",
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
              {form.offerItemIds.length > 0 && (
                <div className="font-mono text-xs mt-1" style={{ color: "#00d4ff" }}>
                  {form.offerItemIds.length} item{form.offerItemIds.length !== 1 ? "s" : ""} selected
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => createOffer.mutate()}
            disabled={createOffer.isPending || !form.targetId || (form.offerDc === 0 && form.requestDc === 0 && form.offerItemIds.length === 0)}
            className="font-mono text-sm px-6 py-2 rounded"
            style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
          >
            {createOffer.isPending ? "Sending..." : "Send Offer"}
          </button>
        </div>
      )}

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
                    <div>
                      <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{t.initiator.name}</span>
                      <span className="font-mono text-xs ml-2" style={{ color: "#64748b" }}>wants to trade</span>
                      <div className="font-mono text-xs mt-1" style={{ color: "#94a3b8" }}>
                        Offering: <span style={{ color: "#39d353" }}>{t.initiatorOffer.dc > 0 ? `${t.initiatorOffer.dc.toLocaleString()} DC` : ""}{t.initiatorOffer.itemNames.join(", ") || ""}</span>
                        {" · "}Wants: <span style={{ color: "#ff6b35" }}>{t.targetOffer.dc > 0 ? `${t.targetOffer.dc.toLocaleString()} DC` : ""}{t.targetOffer.itemNames.join(", ") || ""}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => accept.mutate(t.id)} disabled={accept.isPending}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#39d35322", color: "#39d353", border: "1px solid #39d35340", cursor: "pointer" }}
                      >
                        Accept
                      </button>
                      <button onClick={() => decline.mutate(t.id)} disabled={decline.isPending}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#ff2d5522", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}
                      >
                        Decline
                      </button>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>To: {t.target.name}</span>
                      <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                        Offering {t.initiatorOffer.dc > 0 ? `${t.initiatorOffer.dc.toLocaleString()} DC` : "items"} · Requesting {t.targetOffer.dc > 0 ? `${t.targetOffer.dc.toLocaleString()} DC` : "items"}
                      </div>
                    </div>
                    <button onClick={() => cancel.mutate(t.id)} disabled={cancel.isPending}
                      className="font-mono text-xs px-3 py-1 rounded"
                      style={{ background: "#ff2d5522", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
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
