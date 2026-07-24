import { useState, useEffect } from "react";
import { CyberSkeleton } from "../../../shared/components/CyberSkeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../../../shared/api";
import { User } from "../../../shared/types";
import { ItemImage, nameToArenaItemId } from "../../../shared/components/ItemImage";
import { formatDC } from "../../../shared/format";
import { AnimatedCard } from "../../../shared/components/AnimatedCard";
import { CyberButton } from "../../../shared/components/CyberButton";
import { TradePage } from "../../trade/pages/TradePage";

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

interface Listing {
  id: string; name: string; type: string; rarity: string;
  strengthBonus: number; description: string;
  price: number; seller: string; imageUrl?: string | null;
}

interface BMListing {
  id: string; name: string; type: string; rarity: string;
  strengthBonus: number; charismaBonus: number; intelligenceBonus: number;
  streetCredBonus: number; description: string; price: number;
  seller: string; imageUrl?: string | null; expiresAt: string;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const TIER_COLORS: Record<string, string> = { epic: "#a855f7", legendary: "#f59e0b" };
const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8", uncommon: "#39d353", rare: "#00d4ff", epic: "#a855f7", legendary: "#f59e0b",
};

type Tab = "auction" | "listings" | "trade" | "black-market";
const TAB_LABELS: Record<Tab, string> = { auction: "Bot Auction", listings: "P2P Listings", trade: "Trades", "black-market": "☠ Dark" };

type CategoryFilter = "all" | "weapons" | "clothing" | "vehicles" | "consumables" | "materials" | "arena" | "cars";
const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All", weapons: "Weapons", clothing: "Clothing", vehicles: "Vehicles",
  consumables: "Consumables", materials: "Materials", arena: "Arena Gear", cars: "Cars & Parts",
};

function matchesCategory(listing: Listing, cat: CategoryFilter): boolean {
  if (cat === "all") return true;
  const t = listing.type?.toLowerCase() ?? "";
  if (cat === "weapons") return t === "weapon";
  if (cat === "clothing") return t === "clothing";
  if (cat === "vehicles") return t === "vehicle";
  if (cat === "consumables") return t === "consumable";
  if (cat === "materials") return t === "material";
  if (cat === "arena") return t === "arena" || t === "arena_ammo";
  if (cat === "cars") return t === "car" || t === "car_part";
  return true;
}

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

function BotAuctionTab({ addToast }: { addToast: Props["addToast"] }) {
  const qc = useQueryClient();
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [, forceTick] = useState(0);

  const { data: listings = [], isLoading } = useQuery<AuctionItem[]>({
    queryKey: ["auction"],
    queryFn: () => api.get("/auction"),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const placeBid = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.post(`/auction/${id}/bid`, { amount }),
    onSuccess: (r: { message: string }) => {
      qc.invalidateQueries({ queryKey: ["auction"] });
      addToast(r.message, "success");
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
        <CyberSkeleton type="card" count={5} />
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

function ListingsTab({ user, refreshUser, addToast }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  useEffect(() => {
    api.get<Listing[]>("/market/listings").then(setListings).catch(() => {});
  }, []);

  async function buyListing(listingId: string) {
    setBuying(listingId);
    try {
      const data = await api.post<any>(`/market/listings/${listingId}/buy`);
      addToast(data.message, "success"); await refreshUser();
      setListings(await api.get<Listing[]>("/market/listings"));
    } catch (err: any) { addToast(err.message, "error"); } finally { setBuying(null); }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="text-xs font-mono px-2.5 py-1 rounded transition-all"
            style={{
              background: activeCategory === cat ? "#00d4ff20" : "transparent",
              border: `1px solid ${activeCategory === cat ? "#00d4ff" : "#1e293b"}`,
              color: activeCategory === cat ? "#00d4ff" : "#64748b",
              cursor: "pointer",
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        {(() => {
          const filtered = listings.filter(l => matchesCategory(l, activeCategory));
          if (filtered.length === 0) {
            return (
              <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
                No listings. Sell items from your inventory.
              </div>
            );
          }
          return filtered.map((listing, idx) => {
            const rc = RARITY_COLORS[listing.rarity] ?? "#94a3b8";
            const canAfford = user.dc >= listing.price;
            return (
              <motion.div key={listing.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <AnimatedCard accent={rc} noPad>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${rc}, transparent)`, borderRadius: "8px 8px 0 0", boxShadow: `0 0 6px ${rc}50` }} />
                  <div className="p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{ width: 56, height: 56, background: `${rc}08`, border: `1px solid ${rc}25` }}>
                        <ItemImage itemId={nameToArenaItemId(listing.name)} imageUrl={listing.imageUrl} size={44} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{listing.name}</span>
                          <span className="text-xs font-mono px-1.5 rounded" style={{ color: rc, background: `${rc}14`, border: `1px solid ${rc}25` }}>{listing.rarity}</span>
                        </div>
                        <p className="text-xs font-mono" style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.description}</p>
                        <span className="text-xs font-mono" style={{ color: "#475569" }}>via {listing.seller}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: `1px solid ${rc}15` }}>
                      <span className="text-sm font-mono font-bold" style={{ color: "#f59e0b" }}>{formatDC(listing.price)} DC</span>
                      <CyberButton
                        variant="warning"
                        size="sm"
                        loading={buying === listing.id}
                        disabled={buying === listing.id || !canAfford}
                        onClick={() => buyListing(listing.id)}
                      >
                        {!canAfford ? "No funds" : "Buy"}
                      </CyberButton>
                    </div>
                  </div>
                </AnimatedCard>
              </motion.div>
            );
          });
        })()}
      </div>
    </div>
  );
}

function BlackMarketTab({ user, refreshUser, addToast }: Props) {
  const [bmListings, setBmListings] = useState<BMListing[]>([]);
  const [bmLoading, setBmLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    setBmLoading(true);
    api.get<BMListing[]>("/black-market/listings")
      .then(setBmListings).catch(() => {}).finally(() => setBmLoading(false));
  }, []);

  async function buyBmListing(listingId: string) {
    setBuying(listingId);
    try {
      const data = await api.post<any>(`/black-market/listings/${listingId}/buy`);
      addToast(data.message, "success");
      await refreshUser();
      setBmListings(prev => prev.filter(l => l.id !== listingId));
    } catch (err: any) { addToast(err.message, "error"); } finally { setBuying(null); }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-xs p-3 rounded" style={{ background: "#ff2d5510", border: "1px solid #ff2d5530", color: "#ff6b35" }}>
        ☠ Anonymous marketplace. Items carry a 5% seizure risk every 6 hours. Listings expire in 48 hours. Requires Level 20+ to list. No refunds.
      </div>
      {bmLoading ? (
        <CyberSkeleton type="card" count={3} />
      ) : bmListings.length === 0 ? (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#475569" }}>
          No listings on the dark market. Be the first to list from your inventory.
        </div>
      ) : (
        <div className="grid gap-3">
          {bmListings.map((listing, idx) => {
            const rc = RARITY_COLORS[listing.rarity] ?? "#94a3b8";
            const canAfford = user.dc >= listing.price;
            const expiresIn = Math.max(0, new Date(listing.expiresAt).getTime() - Date.now());
            const hoursLeft = Math.floor(expiresIn / 3_600_000);
            return (
              <motion.div key={String(listing.id)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <AnimatedCard accent="#ff2d55" noPad>
                  <div style={{ height: 2, background: "linear-gradient(90deg, #ff2d55, transparent)", borderRadius: "8px 8px 0 0" }} />
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{listing.name}</span>
                          <span className="text-xs font-mono px-1.5 rounded" style={{ color: rc, background: `${rc}14`, border: `1px solid ${rc}25` }}>{listing.rarity}</span>
                        </div>
                        <p className="text-xs font-mono mt-0.5" style={{ color: "#475569" }}>{listing.description}</p>
                        <div className="flex gap-2 mt-0.5 flex-wrap text-xs font-mono">
                          {listing.strengthBonus > 0 && <span style={{ color: "#ff6b35" }}>STR+{listing.strengthBonus}</span>}
                          {listing.charismaBonus > 0 && <span style={{ color: "#a855f7" }}>CHA+{listing.charismaBonus}</span>}
                          {listing.intelligenceBonus > 0 && <span style={{ color: "#00d4ff" }}>INT+{listing.intelligenceBonus}</span>}
                          {listing.streetCredBonus > 0 && <span style={{ color: "#f59e0b" }}>REP+{listing.streetCredBonus}</span>}
                        </div>
                      </div>
                      <span className="font-mono text-xs flex-shrink-0" style={{ color: "#334155" }}>
                        {hoursLeft}h left
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: "1px solid #ff2d5515" }}>
                      <div>
                        <span className="text-sm font-mono font-bold" style={{ color: "#f59e0b" }}>
                          {listing.price.toLocaleString()} DC
                        </span>
                        <span className="font-mono text-xs ml-2" style={{ color: "#334155" }}>seller: Anonymous</span>
                      </div>
                      <CyberButton variant="danger" size="sm"
                        loading={buying === String(listing.id)}
                        disabled={!canAfford || buying === String(listing.id)}
                        onClick={() => buyBmListing(String(listing.id))}>
                        {!canAfford ? "No funds" : "Buy"}
                      </CyberButton>
                    </div>
                  </div>
                </AnimatedCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AuctionPage({ user, refreshUser, addToast }: Props) {
  const [tab, setTab] = useState<Tab>("auction");

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 relative z-10">
      <div className="dl-page-bg bg-market" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <div className="flex gap-2 flex-wrap">
        {(["auction", "listings", "trade", "black-market"] as Tab[]).map(t => (
          <CyberButton key={t} variant={tab === t ? (t === "black-market" ? "danger" : "primary") : "ghost"} size="sm" onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </CyberButton>
        ))}
      </div>

      {tab === "auction" && <BotAuctionTab addToast={addToast} />}
      {tab === "listings" && <ListingsTab user={user} refreshUser={refreshUser} addToast={addToast} />}
      {tab === "trade" && <TradePage user={user} addToast={addToast} />}
      {tab === "black-market" && <BlackMarketTab user={user} refreshUser={refreshUser} addToast={addToast} />}
    </div>
  );
}
