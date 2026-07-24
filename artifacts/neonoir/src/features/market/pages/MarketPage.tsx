import { useState, useEffect } from "react";
import { CyberSkeleton } from "../../../shared/components/CyberSkeleton";
import { motion } from "framer-motion";
import { User } from "../../../shared/types";
import { api } from "../../../shared/api";
import { ItemImage, nameToArenaItemId } from "../../../shared/components/ItemImage";
import { formatDC } from "../../../shared/format";
import { AnimatedCard } from "../../../shared/components/AnimatedCard";
import { CyberSectionHeader } from "../../../shared/components/CyberSectionHeader";
import { CyberButton } from "../../../shared/components/CyberButton";
import { StatCounter } from "../../../shared/components/StatCounter";

interface ShopItem {
  id: string; name: string; type: string; rarity: string; slot: string | null;
  strengthBonus: number; charismaBonus: number; intelligenceBonus: number;
  streetCredBonus: number; basePrice: number; price: number;
  description: string; effect?: string | null; imageUrl?: string | null;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8", uncommon: "#39d353", rare: "#00d4ff", epic: "#a855f7", legendary: "#f59e0b",
};

function ItemBonuses({ item }: { item: ShopItem }) {
  return (
    <div className="flex gap-2 text-xs font-mono flex-wrap mt-0.5">
      {item.strengthBonus > 0 && <span style={{ color: "#ff6b35" }}>STR+{item.strengthBonus}</span>}
      {item.charismaBonus > 0 && <span style={{ color: "#a855f7" }}>CHA+{item.charismaBonus}</span>}
      {item.intelligenceBonus > 0 && <span style={{ color: "#00d4ff" }}>INT+{item.intelligenceBonus}</span>}
      {item.streetCredBonus > 0 && <span style={{ color: "#f59e0b" }}>REP+{item.streetCredBonus}</span>}
      {item.effect && <span style={{ color: "#a855f7" }}>{item.effect}</span>}
    </div>
  );
}

// Market = the NPC-run Corp Shop only. Player-to-player trading (P2P listings,
// bot auctions, direct trades, black market) lives under the Auction nav page.
export function MarketPage({ user, refreshUser, addToast }: Props) {
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    api.get<ShopItem[]>("/market/shop").then(setShopItems).catch(() => {});
  }, []);

  async function buyShopItem(itemId: string) {
    setBuying(itemId);
    try { const data = await api.post<any>("/market/shop/buy", { itemId }); addToast(data.message, "success"); await refreshUser(); }
    catch (err: any) { addToast(err.message, "error"); } finally { setBuying(null); }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 relative z-10">
      <div className="dl-page-bg bg-market" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {/* Header */}
      <div className="flex justify-between items-center">
        <CyberSectionHeader title="Market" accent="#00d4ff" size="lg" className="mb-0" />
        <div className="font-mono text-sm font-bold" style={{ color: "#f59e0b" }}>
          <StatCounter value={user.dc} format={formatDC} color="#f59e0b" suffix=" DC" />
        </div>
      </div>
      <p className="font-mono text-xs" style={{ color: "#475569", marginTop: -8 }}>
        Corp-run NPC shop. Player-to-player trading, auctions, and the dark market live under Auction.
      </p>

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
                      <ItemImage itemId={nameToArenaItemId(item.name)} imageUrl={item.imageUrl} size={44} />
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
        {shopItems.length === 0 && (
          <CyberSkeleton type="card" count={5} />
        )}
      </div>
    </div>
  );
}
