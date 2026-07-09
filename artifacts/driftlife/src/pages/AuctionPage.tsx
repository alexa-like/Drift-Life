import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { ItemImage } from "../components/ItemImage";

interface AuctionItem {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemTier: "epic" | "legendary";
  itemImage: string | null;
  currentBid: number;
  currentBidder: string | null;
  minimumBid: number;
  nextMinBid: number;
  bidIncrement: number;
  expiresAt: string;
  bidCount: number;
  isWinning: boolean;
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const TIER_COLORS: Record<string, string> = { epic: "#a855f7", legendary: "#f59e0b" };

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

export function AuctionPage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [, forceTick] = useState(0);

  const { data: listings = [], isLoading } = useQuery<AuctionItem[]>({
    queryKey: ["auction"],
    queryFn: () => api.get("/auction"),
    refetchInterval: 15000,
  });

  // Tick every second so countdowns stay live between refetches.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const placeBid = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.post(`/auction/${id}/bid`, { amount }),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["auction"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <h2 className="font-mono font-bold text-lg" style={{ color: "#ff6b35" }}>AUCTION HOUSE</h2>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Bot-operated black-market drops of Epic and Legendary gear. New lots appear on a rolling schedule —
          bid to win. Snipe protection: bids in the final 5 minutes extend the timer.
        </p>
      </div>

      {isLoading ? (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading auctions...</div>
      ) : listings.length === 0 ? (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>
          No active auctions right now. Check back soon — new lots drop regularly.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {listings.map((l) => {
            const isLegendary = l.itemTier === "legendary";
            const color = TIER_COLORS[l.itemTier] ?? "#94a3b8";
            return (
              <div
                key={l.id}
                className="rounded-lg p-4 flex flex-col gap-3"
                style={{
                  background: "#111118",
                  border: `1px solid ${color}40`,
                  boxShadow: isLegendary ? `0 0 16px ${color}30` : undefined,
                  animation: isLegendary ? "auction-legendary-pulse 2.4s ease-in-out infinite" : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded shrink-0" style={{ border: `1px solid ${color}40`, background: "#0a0a0f" }}>
                    <ItemImage itemId={l.itemId} imageUrl={l.itemImage} size={56} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold truncate" style={{ color }}>{l.itemName}</span>
                      <span
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded uppercase"
                        style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}
                      >
                        {l.itemTier}
                      </span>
                    </div>
                    <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                      {l.bidCount} bid{l.bidCount !== 1 ? "s" : ""} · Ends in {timeLeft(l.expiresAt)}
                    </div>
                  </div>
                </div>

                <div className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                  {l.currentBid > 0 ? (
                    <span>Current bid: <span style={{ color: "#f59e0b" }}>{l.currentBid.toLocaleString()} DC</span> by {l.currentBidder}</span>
                  ) : (
                    <span>No bids yet — minimum <span style={{ color: "#f59e0b" }}>{l.minimumBid.toLocaleString()} DC</span></span>
                  )}
                  {l.isWinning && (
                    <span className="ml-2 font-bold" style={{ color: "#39d353" }}>You're winning!</span>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={l.nextMinBid}
                    value={bidAmounts[l.id] ?? ""}
                    onChange={(e) => setBidAmounts((p) => ({ ...p, [l.id]: e.target.value }))}
                    placeholder={`Min ${l.nextMinBid.toLocaleString()}`}
                    className="font-mono text-xs px-2 py-1 rounded flex-1 min-w-0"
                    style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
                  />
                  <button
                    onClick={() => placeBid.mutate({ id: l.id, amount: parseInt(bidAmounts[l.id] ?? "0") })}
                    disabled={placeBid.isPending || !bidAmounts[l.id] || l.isWinning}
                    className="font-mono text-xs px-3 py-1 rounded shrink-0"
                    style={{ background: "#ff6b3522", color: "#ff6b35", border: "1px solid #ff6b3540", cursor: "pointer" }}
                  >
                    Bid
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes auction-legendary-pulse {
          0%, 100% { box-shadow: 0 0 12px #f59e0b30; }
          50% { box-shadow: 0 0 24px #f59e0b55; }
        }
      `}</style>
    </div>
  );
}
