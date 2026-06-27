import { useState, useEffect } from "react";
import { User, Item } from "../lib/types";
import { api } from "../lib/api";
import { ItemImage } from "../components/ItemImage";

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

export function InventoryPage({ user, refreshUser, addToast }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const loadInventory = () =>
    api.get<Item[]>("/inventory").then(setItems).catch(() => {});

  useEffect(() => { loadInventory(); }, []);

  async function equip(itemId: string) {
    setActing(itemId);
    try {
      const data = await api.post<any>(`/inventory/${itemId}/equip`);
      addToast(data.message, "success");
      await loadInventory();
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  async function unequip(itemId: string) {
    setActing(itemId);
    try {
      const data = await api.post<any>(`/inventory/${itemId}/unequip`);
      addToast(data.message, "success");
      await loadInventory();
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#94a3b8" }}>Inventory</h2>
        <div className="flex gap-3 text-xs font-mono">
          <span style={{ color: "#ff6b35" }}>STR: {user.strength}</span>
          <span style={{ color: "#a855f7" }}>CHA: {user.charisma}</span>
          <span style={{ color: "#00d4ff" }}>INT: {user.intelligence}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
          No items. Visit the Market to buy gear.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(item => {
            const rarityColor = RARITY_COLORS[item.rarity] ?? "#94a3b8";
            return (
              <div
                key={item.id}
                className="rounded-lg p-4 flex items-center gap-3"
                style={{
                  background: "#111118",
                  border: `1px solid ${item.equipped ? rarityColor + "60" : rarityColor + "20"}`,
                }}
              >
                <div
                  className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden relative"
                  style={{
                    width: 60, height: 60,
                    background: `${rarityColor}08`,
                    border: `1px solid ${item.equipped ? rarityColor + "60" : rarityColor + "25"}`,
                  }}
                >
                  <ItemImage itemId={item.name.toLowerCase().replace(/ /g, "-")} size={48} />
                  {item.equipped && (
                    <div
                      className="absolute bottom-0 left-0 right-0 text-center font-mono"
                      style={{ fontSize: 8, background: `${rarityColor}90`, color: "#fff", paddingBottom: 1 }}
                    >
                      EQ
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{item.name}</span>
                    <span className="text-xs font-mono px-1 rounded" style={{ color: rarityColor, background: `${rarityColor}15` }}>
                      {item.rarity}
                    </span>
                    {item.equipped && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "#39d35320", color: "#39d353" }}>
                        equipped
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono mb-1" style={{ color: "#475569" }}>{item.description}</p>
                  <div className="flex gap-3 text-xs font-mono flex-wrap">
                    {item.strengthBonus > 0 && <span style={{ color: "#ff6b35" }}>STR +{item.strengthBonus}</span>}
                    {item.charismaBonus > 0 && <span style={{ color: "#a855f7" }}>CHA +{item.charismaBonus}</span>}
                    {item.intelligenceBonus > 0 && <span style={{ color: "#00d4ff" }}>INT +{item.intelligenceBonus}</span>}
                    {item.defenseBonus > 0 && <span style={{ color: "#39d353" }}>DEF +{item.defenseBonus}</span>}
                    {item.streetCredBonus > 0 && <span style={{ color: "#f59e0b" }}>REP +{item.streetCredBonus}</span>}
                    {item.effect && <span style={{ color: "#a855f7" }}>{item.effect}</span>}
                    {(item.type === "consumable" || item.type === "material") && item.quantity > 1 && (
                      <span style={{ color: "#64748b" }}>×{item.quantity}</span>
                    )}
                  </div>
                </div>

                {item.slot && !item.marketListed && (
                  <button
                    onClick={() => item.equipped ? unequip(item.id) : equip(item.id)}
                    disabled={acting === item.id}
                    className="px-3 py-1.5 rounded text-xs font-mono font-bold flex-shrink-0"
                    style={{
                      background: item.equipped ? "#ff2d5518" : "#39d35318",
                      color: item.equipped ? "#ff2d55" : "#39d353",
                      border: `1px solid ${item.equipped ? "#ff2d5540" : "#39d35340"}`,
                    }}
                  >
                    {acting === item.id ? "..." : item.equipped ? "Unequip" : "Equip"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
