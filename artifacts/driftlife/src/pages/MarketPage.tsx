import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { ItemImage } from "../components/ItemImage";

interface ShopItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  slot: string | null;
  strengthBonus: number;
  charismaBonus: number;
  intelligenceBonus: number;
  streetCredBonus: number;
  defenseBonus: number;
  basePrice: number;
  description: string;
  effect?: string | null;
  imageUrl?: string | null;
}

interface Listing {
  id: string;
  name: string;
  type: string;
  rarity: string;
  strengthBonus: number;
  defenseBonus: number;
  description: string;
  price: number;
  seller: string;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8",
  uncommon: "#39d353",
  rare: "#00d4ff",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

type Tab = "shop" | "listings";

export function MarketPage({ user, refreshUser, addToast }: Props) {
  const [tab, setTab] = useState<Tab>("shop");
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    api.get<ShopItem[]>("/market/shop").then(setShopItems).catch(() => {});
    api.get<Listing[]>("/market/listings").then(setListings).catch(() => {});
  }, []);

  async function buyShopItem(itemId: string) {
    setBuying(itemId);
    try {
      const data = await api.post<any>("/market/shop/buy", { itemId });
      addToast(data.message, "success");
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setBuying(null);
    }
  }

  async function buyListing(listingId: string) {
    setBuying(listingId);
    try {
      const data = await api.post<any>(`/market/listings/${listingId}/buy`);
      addToast(data.message, "success");
      await refreshUser();
      const updated = await api.get<Listing[]>("/market/listings");
      setListings(updated);
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setBuying(null);
    }
  }

  function ShopItemCard({ item, onBuy, busy, canAfford }: { item: ShopItem; onBuy: () => void; busy: boolean; canAfford: boolean }) {
    const rarityColor = RARITY_COLORS[item.rarity] ?? "#94a3b8";
    return (
      <div
        className="rounded-lg p-3 flex flex-col gap-2"
        style={{ background: "#111118", border: `1px solid ${rarityColor}20` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ width: 52, height: 52, background: `${rarityColor}08`, border: `1px solid ${rarityColor}30` }}
          >
            <ItemImage itemId={item.id} imageUrl={item.imageUrl} size={44} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{item.name}</span>
              <span className="text-xs font-mono px-1 rounded" style={{ color: rarityColor, background: `${rarityColor}15` }}>
                {item.rarity}
              </span>
            </div>
            <p className="text-xs font-mono" style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</p>
            <div className="flex gap-2 text-xs font-mono flex-wrap mt-0.5">
              {item.strengthBonus > 0 && <span style={{ color: "#ff6b35" }}>STR+{item.strengthBonus}</span>}
              {item.charismaBonus > 0 && <span style={{ color: "#a855f7" }}>CHA+{item.charismaBonus}</span>}
              {item.intelligenceBonus > 0 && <span style={{ color: "#00d4ff" }}>INT+{item.intelligenceBonus}</span>}
              {item.defenseBonus > 0 && <span style={{ color: "#39d353" }}>DEF+{item.defenseBonus}</span>}
              {item.streetCredBonus > 0 && <span style={{ color: "#f59e0b" }}>REP+{item.streetCredBonus}</span>}
              {item.effect && <span style={{ color: "#a855f7" }}>{item.effect}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-mono font-bold" style={{ color: "#f59e0b" }}>
            {item.basePrice.toLocaleString()} DC
          </span>
          <button
            onClick={onBuy}
            disabled={busy || !canAfford}
            className="px-4 py-1.5 rounded text-xs font-mono font-bold"
            style={{
              background: canAfford ? "#f59e0b18" : "#1e1e2e",
              color: canAfford ? "#f59e0b" : "#475569",
              border: `1px solid ${canAfford ? "#f59e0b40" : "#1e1e2e"}`,
            }}
          >
            {busy ? "..." : canAfford ? "Buy" : "No funds"}
          </button>
        </div>
      </div>
    );
  }

  function ListingCard({ listing, onBuy, busy, canAfford }: { listing: Listing; onBuy: () => void; busy: boolean; canAfford: boolean }) {
    const rarityColor = RARITY_COLORS[listing.rarity] ?? "#94a3b8";
    return (
      <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "#111118", border: `1px solid ${rarityColor}20` }}>
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ width: 52, height: 52, background: `${rarityColor}08`, border: `1px solid ${rarityColor}30` }}
          >
            <ItemImage itemId={listing.name.toLowerCase().replace(/ /g, "-")} size={44} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{listing.name}</span>
              <span className="text-xs font-mono px-1 rounded" style={{ color: rarityColor, background: `${rarityColor}15` }}>{listing.rarity}</span>
            </div>
            <p className="text-xs font-mono" style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.description}</p>
            <span className="text-xs font-mono" style={{ color: "#64748b" }}>via {listing.seller}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-mono font-bold" style={{ color: "#f59e0b" }}>{listing.price.toLocaleString()} DC</span>
          <button
            onClick={onBuy}
            disabled={busy || !canAfford}
            className="px-4 py-1.5 rounded text-xs font-mono font-bold"
            style={{
              background: canAfford ? "#f59e0b18" : "#1e1e2e",
              color: canAfford ? "#f59e0b" : "#475569",
              border: `1px solid ${canAfford ? "#f59e0b40" : "#1e1e2e"}`,
            }}
          >
            {busy ? "..." : canAfford ? "Buy" : "No funds"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#00d4ff" }}>Black Market</h2>
        <span className="text-xs font-mono" style={{ color: "#f59e0b" }}>{user.dc.toLocaleString()} DC</span>
      </div>

      <div className="flex gap-2">
        {(["shop", "listings"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded text-xs font-mono uppercase"
            style={{
              background: tab === t ? "#00d4ff18" : "transparent",
              color: tab === t ? "#00d4ff" : "#475569",
              border: `1px solid ${tab === t ? "#00d4ff40" : "#1e1e2e"}`,
            }}
          >
            {t === "shop" ? "Corp Shop" : "Player Market"}
          </button>
        ))}
      </div>

      {tab === "shop" && (
        <div className="grid gap-3">
          {shopItems.map(item => (
            <ShopItemCard
              key={item.id}
              item={item}
              canAfford={user.dc >= item.basePrice}
              busy={buying === item.id}
              onBuy={() => buyShopItem(item.id)}
            />
          ))}
        </div>
      )}

      {tab === "listings" && (
        <div className="grid gap-3">
          {listings.length === 0 ? (
            <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
              No listings. Sell items from your inventory.
            </div>
          ) : (
            listings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                canAfford={user.dc >= listing.price}
                busy={buying === listing.id}
                onBuy={() => buyListing(listing.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
