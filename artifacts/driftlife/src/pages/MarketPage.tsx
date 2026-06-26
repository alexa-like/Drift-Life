import { useState, useEffect } from "react";
import { User, Item } from "../lib/types";
import { api } from "../lib/api";

interface ShopItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  damage: number;
  defense: number;
  slot: string | null;
  price: number;
  description: string;
  effect?: string;
}

interface Listing {
  id: string;
  name: string;
  type: string;
  rarity: string;
  damage: number;
  defense: number;
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

  function ItemCard({ name, type, rarity, damage, defense, description, price, onBuy, busy, canAfford }: any) {
    return (
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{name}</span>
              <span className="text-xs font-mono" style={{ color: RARITY_COLORS[rarity] ?? "#94a3b8" }}>
                [{rarity}]
              </span>
            </div>
            <p className="text-xs font-mono mt-0.5" style={{ color: "#475569" }}>{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-3 text-xs font-mono">
            {damage > 0 && <span style={{ color: "#ff6b35" }}>ATK +{damage}</span>}
            {defense > 0 && <span style={{ color: "#00d4ff" }}>DEF +{defense}</span>}
            <span style={{ color: "#f59e0b" }}>{price.toLocaleString()} DC</span>
          </div>
          <button
            onClick={onBuy}
            disabled={busy || !canAfford}
            className="px-3 py-1.5 rounded text-xs font-mono font-bold"
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
            <ItemCard
              key={item.id}
              {...item}
              canAfford={user.dc >= item.price}
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
              <ItemCard
                key={listing.id}
                {...listing}
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
