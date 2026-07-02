import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface AuctionItem {
  id: string;
  seller: { id: string; name: string };
  item: { name: string; type: string; rarity: string; description: string };
  startingPrice: number;
  currentBid: number;
  currentBidder: string | null;
  buyoutPrice: number | null;
  endsAt: string;
  bidCount: number;
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8", uncommon: "#39d353", rare: "#00d4ff",
  epic: "#a855f7", legendary: "#f59e0b", mythic: "#ff2d55", event: "#ff6b35",
};

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export function AuctionPage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});

  const { data: listings = [], isLoading } = useQuery<AuctionItem[]>({
    queryKey: ["auction"],
    queryFn: () => api.get("/auction"),
    refetchInterval: 30000,
  });

  const { data: mine } = useQuery<{ listings: AuctionItem[]; won: unknown[] }>({
    queryKey: ["auction-mine"],
    queryFn: () => api.get("/auction/mine"),
    enabled: tab === "mine",
  });

  const placeBid = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.post(`/auction/${id}/bid`, { amount }),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["auction"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const cancelListing = useMutation({
    mutationFn: (id: string) => api.post(`/auction/${id}/cancel`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["auction", "auction-mine"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  if (user.level < 25) {
    return (
      <div className="rounded-lg p-8 text-center" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="font-mono font-bold text-lg mb-2" style={{ color: "#ff6b35" }}>AUCTION HOUSE</div>
        <div className="font-mono text-sm" style={{ color: "#64748b" }}>Unlocks at Level 25</div>
        <div className="font-mono text-xs mt-2" style={{ color: "#334155" }}>You are level {user.level}. Keep grinding.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <h2 className="font-mono font-bold text-lg" style={{ color: "#ff6b35" }}>AUCTION HOUSE</h2>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Live bidding on rare items. Snipe protection: bids in last 5 min extend the timer. 5% seller fee.
        </p>
      </div>

      <div className="flex gap-2">
        {(["browse", "mine"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="font-mono text-xs px-3 py-1 rounded capitalize"
            style={{ background: tab === t ? "#ff6b3522" : "#111118", color: tab === t ? "#ff6b35" : "#64748b", border: `1px solid ${tab === t ? "#ff6b3540" : "#1e1e2e"}`, cursor: "pointer" }}
          >
            {t === "browse" ? "Browse" : "My Auctions"}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        isLoading ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading auctions...</div>
        ) : listings.length === 0 ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>No active auctions. List items from your inventory.</div>
        ) : (
          <div className="space-y-3">
            {listings.map((l) => {
              const isOwn = l.seller.id === user.id;
              const minBid = l.currentBid > 0 ? l.currentBid + 1 : l.startingPrice;
              return (
                <div key={l.id} className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold" style={{ color: RARITY_COLORS[l.item.rarity] ?? "#94a3b8" }}>{l.item.name}</span>
                        <span className="font-mono text-xs px-1 rounded" style={{ background: "#1e1e2e", color: "#64748b" }}>{l.item.type}</span>
                      </div>
                      <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                        Seller: {l.seller.name} · {l.bidCount} bid{l.bidCount !== 1 ? "s" : ""} · Ends in {timeLeft(l.endsAt)}
                      </div>
                      <div className="font-mono text-xs mt-1" style={{ color: "#94a3b8" }}>
                        {l.currentBid > 0 ? (
                          <span>Current bid: <span style={{ color: "#f59e0b" }}>{l.currentBid.toLocaleString()} DC</span> by {l.currentBidder}</span>
                        ) : (
                          <span>Starting: <span style={{ color: "#f59e0b" }}>{l.startingPrice.toLocaleString()} DC</span></span>
                        )}
                        {l.buyoutPrice && <span className="ml-3">Buyout: <span style={{ color: "#39d353" }}>{l.buyoutPrice.toLocaleString()} DC</span></span>}
                      </div>
                    </div>
                    {!isOwn && (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          min={minBid}
                          value={bidAmounts[l.id] ?? ""}
                          onChange={(e) => setBidAmounts((p) => ({ ...p, [l.id]: e.target.value }))}
                          placeholder={`Min ${minBid.toLocaleString()}`}
                          className="font-mono text-xs px-2 py-1 rounded w-32"
                          style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
                        />
                        <button
                          onClick={() => placeBid.mutate({ id: l.id, amount: parseInt(bidAmounts[l.id] ?? "0") })}
                          disabled={placeBid.isPending || !bidAmounts[l.id]}
                          className="font-mono text-xs px-3 py-1 rounded"
                          style={{ background: "#ff6b3522", color: "#ff6b35", border: "1px solid #ff6b3540", cursor: "pointer" }}
                        >
                          Bid
                        </button>
                        {l.buyoutPrice && (
                          <button
                            onClick={() => placeBid.mutate({ id: l.id, amount: l.buyoutPrice! })}
                            disabled={placeBid.isPending}
                            className="font-mono text-xs px-3 py-1 rounded"
                            style={{ background: "#39d35322", color: "#39d353", border: "1px solid #39d35340", cursor: "pointer" }}
                          >
                            Buyout
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "mine" && (
        <div className="space-y-3">
          {mine?.listings.map((l) => (
            <div key={l.id} className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold" style={{ color: "#e2e8f0" }}>{l.item.name}</span>
                  <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                    {l.bidCount} bids · Current: {l.currentBid > 0 ? `${l.currentBid.toLocaleString()} DC` : "No bids"} · Ends {timeLeft(l.endsAt)}
                  </div>
                </div>
                {l.bidCount === 0 && (
                  <button onClick={() => cancelListing.mutate(l.id)}
                    className="font-mono text-xs px-3 py-1 rounded"
                    style={{ background: "#ff2d5522", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
          {(!mine?.listings || mine.listings.length === 0) && (
            <div className="font-mono text-xs text-center py-8" style={{ color: "#334155" }}>
              No active listings. List items from your inventory page.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
