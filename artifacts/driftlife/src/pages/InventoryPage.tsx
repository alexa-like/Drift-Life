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
  mythic: "#ff2d55",
};

type View = "inventory" | "trade" | "list";

export function InventoryPage({ user, refreshUser, addToast }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [salvagingAll, setSalvagingAll] = useState(false);
  const [view, setView] = useState<View>("inventory");
  const [tradeItemId, setTradeItemId] = useState<string>("");
  const [tradeTag, setTradeTag] = useState<string>("");
  const [trading, setTrading] = useState(false);
  const [listItemId, setListItemId] = useState<string>("");
  const [listPrice, setListPrice] = useState<string>("");
  const [listing, setListing] = useState(false);

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

  async function useItem(itemId: string) {
    setActing(itemId);
    try {
      const data = await api.post<any>(`/inventory/${itemId}/use`);
      addToast(data.message, "success");
      await loadInventory();
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  async function salvage(itemId: string, name: string) {
    if (!confirm(`Salvage ${name}? This cannot be undone.`)) return;
    setActing(itemId);
    try {
      const data = await api.post<any>(`/inventory/${itemId}/salvage`, { confirm: true });
      addToast(data.message, "success");
      await loadInventory();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  async function salvageAllCommons() {
    const commons = items.filter(i => i.rarity === "common" && !i.equipped && !i.marketListed);
    if (!commons.length) { addToast("No common items to salvage", "info"); return; }
    if (!confirm(`Salvage all ${commons.length} common items?`)) return;
    setSalvagingAll(true);
    try {
      const data = await api.post<any>("/inventory/salvage-all-commons");
      addToast(data.message, "success");
      await loadInventory();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSalvagingAll(false);
    }
  }

  async function tradeItem() {
    if (!tradeItemId || !tradeTag) { addToast("Select an item and enter recipient tag", "error"); return; }
    setTrading(true);
    try {
      const data = await api.post<any>("/inventory/trade", { itemId: tradeItemId, targetTag: tradeTag });
      addToast(data.message, "success");
      setTradeItemId("");
      setTradeTag("");
      await loadInventory();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setTrading(false);
    }
  }

  async function listOnMarket() {
    const price = Number(listPrice);
    if (!listItemId || !price || price <= 0) { addToast("Select an item and enter a valid price", "error"); return; }
    setListing(true);
    try {
      const data = await api.post<any>(`/inventory/${listItemId}/list`, { price });
      addToast(data.message, "success");
      setListItemId("");
      setListPrice("");
      await loadInventory();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setListing(false);
    }
  }

  const commonCount = items.filter(i => i.rarity === "common" && !i.equipped && !i.marketListed).length;
  const tradeable = items.filter(i => !i.equipped && !i.marketListed);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#94a3b8" }}>Inventory</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-3 text-xs font-mono mr-2">
            <span style={{ color: "#ff6b35" }}>STR: {user.strength}</span>
            <span style={{ color: "#a855f7" }}>CHA: {user.charisma}</span>
            <span style={{ color: "#00d4ff" }}>INT: {user.intelligence}</span>
          </div>
          {commonCount > 0 && (
            <button
              onClick={salvageAllCommons}
              disabled={salvagingAll}
              className="px-2 py-1 rounded font-mono text-xs"
              style={{ background: "#94a3b818", color: "#94a3b8", border: "1px solid #94a3b840" }}
            >
              {salvagingAll ? "..." : `Salvage Commons (${commonCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["inventory", "trade", "list"] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-3 py-1.5 rounded text-xs font-mono capitalize"
            style={{
              background: view === v ? "#111118" : "transparent",
              color: view === v ? "#00d4ff" : "#475569",
              border: `1px solid ${view === v ? "#00d4ff40" : "#1e1e2e"}`,
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "trade" && (
        <div className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="text-xs font-mono font-bold" style={{ color: "#00d4ff" }}>TRADE ITEM</div>
          <select
            value={tradeItemId}
            onChange={e => setTradeItemId(e.target.value)}
            className="w-full px-3 py-2 rounded font-mono text-xs"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
          >
            <option value="">Select item...</option>
            {tradeable.map(i => <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>)}
          </select>
          <input
            value={tradeTag}
            onChange={e => setTradeTag(e.target.value.replace(/^#/, ""))}
            placeholder="Recipient tag (e.g. ABC1)"
            className="w-full px-3 py-2 rounded font-mono text-xs"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
          />
          <button
            onClick={tradeItem}
            disabled={trading || !tradeItemId || !tradeTag}
            className="w-full py-2 rounded font-mono text-xs font-bold"
            style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}
          >
            {trading ? "..." : "Send Item"}
          </button>
        </div>
      )}

      {view === "list" && (
        <div className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="text-xs font-mono font-bold" style={{ color: "#a855f7" }}>LIST ON MARKET</div>
          <select
            value={listItemId}
            onChange={e => setListItemId(e.target.value)}
            className="w-full px-3 py-2 rounded font-mono text-xs"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
          >
            <option value="">Select item...</option>
            {tradeable.filter(i => i.type !== "consumable").map(i => <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>)}
          </select>
          <input
            value={listPrice}
            onChange={e => setListPrice(e.target.value)}
            placeholder="Listing price in DC"
            type="number"
            min="1"
            className="w-full px-3 py-2 rounded font-mono text-xs"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
          />
          <button
            onClick={listOnMarket}
            disabled={listing || !listItemId || !listPrice}
            className="w-full py-2 rounded font-mono text-xs font-bold"
            style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740" }}
          >
            {listing ? "..." : "List on Market"}
          </button>
        </div>
      )}

      {view === "inventory" && (
        items.length === 0 ? (
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
                  className="rounded-lg p-3 flex flex-col gap-2"
                  style={{
                    background: "#111118",
                    border: `1px solid ${item.equipped ? rarityColor + "60" : rarityColor + "20"}`,
                  }}
                >
                  {/* Top row: image + info */}
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden relative"
                      style={{
                        width: 52, height: 52,
                        background: `${rarityColor}08`,
                        border: `1px solid ${item.equipped ? rarityColor + "60" : rarityColor + "25"}`,
                      }}
                    >
                      <ItemImage itemId={item.name.toLowerCase().replace(/ /g, "-")} size={44} />
                      {item.equipped && (
                        <div
                          className="absolute bottom-0 left-0 right-0 text-center font-mono"
                          style={{ fontSize: 8, background: `${rarityColor}90`, color: "#fff", paddingBottom: 1 }}
                        >
                          EQ
                        </div>
                      )}
                      {item.marketListed && (
                        <div
                          className="absolute top-0 left-0 right-0 text-center font-mono"
                          style={{ fontSize: 7, background: "#a855f790", color: "#fff", paddingTop: 1 }}
                        >
                          LISTED
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{item.name}</span>
                        <span className="text-xs font-mono px-1 rounded" style={{ color: rarityColor, background: `${rarityColor}15` }}>
                          {item.rarity}
                        </span>
                        {item.equipped && (
                          <span className="text-xs px-1 rounded font-mono" style={{ background: "#39d35320", color: "#39d353" }}>eq</span>
                        )}
                        {item.marketListed && (
                          <span className="text-xs px-1 rounded font-mono" style={{ background: "#a855f720", color: "#a855f7" }}>listed</span>
                        )}
                      </div>
                      <p className="text-xs font-mono" style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</p>
                      <div className="flex gap-2 text-xs font-mono flex-wrap mt-0.5">
                        {item.strengthBonus > 0 && <span style={{ color: "#ff6b35" }}>STR+{item.strengthBonus}</span>}
                        {item.charismaBonus > 0 && <span style={{ color: "#a855f7" }}>CHA+{item.charismaBonus}</span>}
                        {item.intelligenceBonus > 0 && <span style={{ color: "#00d4ff" }}>INT+{item.intelligenceBonus}</span>}
                        {item.defenseBonus > 0 && <span style={{ color: "#39d353" }}>DEF+{item.defenseBonus}</span>}
                        {item.streetCredBonus > 0 && <span style={{ color: "#f59e0b" }}>REP+{item.streetCredBonus}</span>}
                        {item.effect && <span style={{ color: "#a855f7" }}>{item.effect}</span>}
                        {(item.type === "consumable" || item.type === "material") && item.quantity > 1 && (
                          <span style={{ color: "#64748b" }}>×{item.quantity}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {item.slot && !item.marketListed && (
                      <button
                        onClick={() => item.equipped ? unequip(item.id) : equip(item.id)}
                        disabled={acting === item.id}
                        className="flex-1 py-1.5 rounded text-xs font-mono font-bold"
                        style={{
                          background: item.equipped ? "#ff2d5518" : "#39d35318",
                          color: item.equipped ? "#ff2d55" : "#39d353",
                          border: `1px solid ${item.equipped ? "#ff2d5540" : "#39d35340"}`,
                        }}
                      >
                        {acting === item.id ? "..." : item.equipped ? "Unequip" : "Equip"}
                      </button>
                    )}
                    {item.type === "consumable" && !item.equipped && !item.marketListed && (
                      <button
                        onClick={() => useItem(item.id)}
                        disabled={acting === item.id}
                        className="flex-1 py-1.5 rounded text-xs font-mono font-bold"
                        style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}
                      >
                        {acting === item.id ? "..." : "Use"}
                      </button>
                    )}
                    {!item.equipped && !item.marketListed && item.type !== "consumable" && (
                      <button
                        onClick={() => salvage(item.id, item.name)}
                        disabled={acting === item.id}
                        className="flex-1 py-1.5 rounded text-xs font-mono"
                        style={{ background: "#1e1e2e", color: "#475569", border: "1px solid #1e1e2e" }}
                      >
                        {acting === item.id ? "..." : "Salvage"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
