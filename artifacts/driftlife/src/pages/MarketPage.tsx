import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { ItemImage } from "../components/ItemImage";
import { formatDC } from "../lib/format";
import { AuctionPage } from "./AuctionPage";
import { TradePage } from "./TradePage";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { StatCounter } from "../components/StatCounter";

interface ShopItem {
  id: string; name: string; type: string; rarity: string; slot: string | null;
  strengthBonus: number; charismaBonus: number; intelligenceBonus: number;
  streetCredBonus: number; basePrice: number; price: number;
  description: string; effect?: string | null; imageUrl?: string | null;
}

interface Listing {
  id: string; name: string; type: string; rarity: string;
  strengthBonus: number; description: string;
  price: number; seller: string; imageUrl?: string | null;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8", uncommon: "#39d353", rare: "#00d4ff", epic: "#a855f7", legendary: "#f59e0b",
};

type Tab = "shop" | "listings" | "auction" | "trade" | "black-market";
const TAB_LABELS: Record<Tab, string> = { shop: "Corp Shop", listings: "P2P Market", auction: "Auction", trade: "Trades", "black-market": "☠ Dark" };

interface BMListing {
  id: string; name: string; type: string; rarity: string;
  strengthBonus: number; charismaBonus: number; intelligenceBonus: number;
  streetCredBonus: number; description: string; price: number;
  seller: string; imageUrl?: string | null; expiresAt: string;
}

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

function ItemBonuses({ item }: { item: ShopItem | Listing }) {
  const s = item as ShopItem;
  return (
    <div className="flex gap-2 text-xs font-mono flex-wrap mt-0.5">
      {s.strengthBonus > 0 && <span style={{ color: "#ff6b35" }}>STR+{s.strengthBonus}</span>}
      {(s as ShopItem).charismaBonus > 0 && <span style={{ color: "#a855f7" }}>CHA+{(s as ShopItem).charismaBonus}</span>}
      {(s as ShopItem).intelligenceBonus > 0 && <span style={{ color: "#00d4ff" }}>INT+{(s as ShopItem).intelligenceBonus}</span>}
      {(item as ShopItem).streetCredBonus > 0 && <span style={{ color: "#f59e0b" }}>REP+{(item as ShopItem).streetCredBonus}</span>}
      {(item as ShopItem).effect && <span style={{ color: "#a855f7" }}>{(item as ShopItem).effect}</span>}
    </div>
  );
}

export function MarketPage({ user, refreshUser, addToast }: Props) {
  const [tab, setTab] = useState<Tab>("shop");
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [bmListings, setBmListings] = useState<BMListing[]>([]);
  const [bmLoading, setBmLoading] = useState(false);

  useEffect(() => {
    api.get<ShopItem[]>("/market/shop").then(setShopItems).catch(() => {});
    api.get<Listing[]>("/market/listings").then(setListings).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "black-market") return;
    setBmLoading(true);
    api.get<BMListing[]>("/black-market/listings")
      .then(setBmListings).catch(() => {}).finally(() => setBmLoading(false));
  }, [tab]);

  async function buyShopItem(itemId: string) {
    setBuying(itemId);
    try { const data = await api.post<any>("/market/shop/buy", { itemId }); addToast(data.message, "success"); await refreshUser(); }
    catch (err: any) { addToast(err.message, "error"); } finally { setBuying(null); }
  }

  async function buyListing(listingId: string) {
    setBuying(listingId);
    try {
      const data = await api.post<any>(`/market/listings/${listingId}/buy`);
      addToast(data.message, "success"); await refreshUser();
      setListings(await api.get<Listing[]>("/market/listings"));
    } catch (err: any) { addToast(err.message, "error"); } finally { setBuying(null); }
  }

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
    <div className="max-w-2xl mx-auto flex flex-col gap-4">

      {/* Header */}
      <div className="flex justify-between items-center">
        <CyberSectionHeader title="Black Market" accent="#00d4ff" size="lg" className="mb-0" />
        <div className="font-mono text-sm font-bold" style={{ color: "#f59e0b" }}>
          <StatCounter value={user.dc} format={formatDC} color="#f59e0b" suffix=" DC" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["shop", "listings", "auction", "trade", "black-market"] as Tab[]).map(t => (
          <CyberButton key={t} variant={tab === t ? (t === "black-market" ? "danger" : "primary") : "ghost"} size="sm" onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </CyberButton>
        ))}
      </div>

      {/* Corp Shop */}
      {tab === "shop" && (
        <div className="grid gap-3">
          {shopItems.map((item, idx) => {
            const rc = RARITY_COLORS[item.rarity] ?? "#94a3b8";
            const canAfford = user.dc >= item.price;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <AnimatedCard accent={rc} noPad>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${rc}, transparent)`, borderRadius: "8px 8px 0 0", boxShadow: `0 0 6px ${rc}50` }} />
                  <div className="p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{ width: 56, height: 56, background: `${rc}08`, border: `1px solid ${rc}25` }}>
                        <ItemImage itemId={item.id} imageUrl={item.imageUrl} size={44} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{item.name}</span>
                          <span className="text-xs font-mono px-1.5 rounded" style={{ color: rc, background: `${rc}14`, border: `1px solid ${rc}25` }}>{item.rarity}</span>
                        </div>
                        <p className="text-xs font-mono" style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</p>
                        <ItemBonuses item={item} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: `1px solid ${rc}15` }}>
                      <span className="text-sm font-mono font-bold" style={{ color: "#f59e0b", textShadow: "0 0 8px #f59e0b40" }}>
                        {formatDC(item.price)} DC
                      </span>
                      <CyberButton
                        variant="warning"
                        size="sm"
                        loading={buying === item.id}
                        disabled={buying === item.id || !canAfford}
                        onClick={() => buyShopItem(item.id)}
                      >
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

      {/* P2P Listings */}
      {tab === "listings" && (
        <div className="flex flex-col gap-3">
          {/* Category filter chips */}
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
                            <ItemImage itemId={listing.name.toLowerCase().replace(/ /g, "-")} imageUrl={listing.imageUrl} size={44} />
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
      )}

      {tab === "auction" && <AuctionPage user={user} addToast={addToast} />}
      {tab === "trade"   && <TradePage   user={user} addToast={addToast} />}

      {/* Black Market */}
      {tab === "black-market" && (
        <div className="flex flex-col gap-3">
          <div className="font-mono text-xs p-3 rounded" style={{ background: "#ff2d5510", border: "1px solid #ff2d5530", color: "#ff6b35" }}>
            ☠ Anonymous marketplace. Items carry a 5% seizure risk every 6 hours. Listings expire in 48 hours. Requires Level 20+ to list. No refunds.
          </div>
          {bmLoading ? (
            <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading dark listings…</div>
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
      )}
    </div>
  );
}
