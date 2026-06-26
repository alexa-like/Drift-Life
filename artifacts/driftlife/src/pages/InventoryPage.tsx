import { useState, useEffect } from "react";
import { User, Item } from "../lib/types";
import { api } from "../lib/api";

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

  const TYPE_ICONS: Record<string, string> = {
    weapon: "W",
    armor: "A",
    consumable: "C",
    misc: "M",
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#94a3b8" }}>Inventory</h2>
        <div className="flex gap-3 text-xs font-mono">
          <span style={{ color: "#ff6b35" }}>STR: {user.strength}</span>
          <span style={{ color: "#00d4ff" }}>DEF: {user.defense}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
          No items. Visit the Market to buy gear.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(item => (
            <div
              key={item.id}
              className="rounded-lg p-4 flex items-center gap-4"
              style={{
                background: "#111118",
                border: `1px solid ${item.equipped ? RARITY_COLORS[item.rarity] + "40" : "#1e1e2e"}`,
              }}
            >
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-xs font-mono font-bold flex-shrink-0"
                style={{
                  background: item.equipped ? RARITY_COLORS[item.rarity] + "20" : "#0a0a0f",
                  color: RARITY_COLORS[item.rarity],
                  border: `1px solid ${RARITY_COLORS[item.rarity]}30`,
                }}
              >
                {TYPE_ICONS[item.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{item.name}</span>
                  <span className="text-xs font-mono" style={{ color: RARITY_COLORS[item.rarity] }}>
                    [{item.rarity}]
                  </span>
                  {item.equipped && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "#39d35320", color: "#39d353" }}>
                      equipped
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono" style={{ color: "#475569" }}>{item.description}</p>
                <div className="flex gap-3 mt-1 text-xs font-mono">
                  {item.damage > 0 && <span style={{ color: "#ff6b35" }}>ATK +{item.damage}</span>}
                  {item.defense > 0 && <span style={{ color: "#00d4ff" }}>DEF +{item.defense}</span>}
                  {item.effect && <span style={{ color: "#a855f7" }}>{item.effect}</span>}
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
          ))}
        </div>
      )}
    </div>
  );
}
