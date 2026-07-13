import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Item } from "../lib/types";
import { api } from "../lib/api";
import { ItemImage, nameToArenaItemId } from "../components/ItemImage";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RARITY_COLORS: Record<string, string> = {
  common:    "#94a3b8",
  uncommon:  "#39d353",
  rare:      "#00d4ff",
  epic:      "#a855f7",
  legendary: "#f59e0b",
  mythic:    "#ff2d55",
};

type View = "inventory" | "trade" | "list";
const VIEW_LABELS: Record<View, string> = { inventory: "Inventory", trade: "Trade", list: "List" };

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
  const [salvageConfirm, setSalvageConfirm] = useState<{ itemId: string; name: string } | null>(null);
  const [salvageAllConfirm, setSalvageAllConfirm] = useState(false);

  const loadInventory = () => api.get<Item[]>("/inventory").then(setItems).catch(() => {});
  useEffect(() => { loadInventory(); }, []);

  async function equip(itemId: string) {
    setActing(itemId);
    try { const data = await api.post<any>(`/inventory/${itemId}/equip`); addToast(data.message, "success"); await loadInventory(); await refreshUser(); }
    catch (err: any) { addToast(err.message, "error"); } finally { setActing(null); }
  }
  async function unequip(itemId: string) {
    setActing(itemId);
    try { const data = await api.post<any>(`/inventory/${itemId}/unequip`); addToast(data.message, "success"); await loadInventory(); await refreshUser(); }
    catch (err: any) { addToast(err.message, "error"); } finally { setActing(null); }
  }
  async function useItem(itemId: string) {
    setActing(itemId);
    try { const data = await api.post<any>(`/inventory/${itemId}/use`); addToast(data.message, "success"); await loadInventory(); await refreshUser(); }
    catch (err: any) { addToast(err.message, "error"); } finally { setActing(null); }
  }
  async function salvage(itemId: string, name: string) {
    setActing(itemId);
    try { const data = await api.post<any>(`/inventory/${itemId}/salvage`, { confirm: true }); addToast(data.message, "success"); await loadInventory(); }
    catch (err: any) { addToast(err.message, "error"); } finally { setActing(null); }
  }
  async function salvageAllCommons() {
    const commons = items.filter(i => i.rarity === "common" && !i.equipped && !i.marketListed);
    if (!commons.length) { addToast("No common items to salvage", "info"); return; }
    setSalvagingAll(true);
    try { const data = await api.post<any>("/inventory/salvage-all-commons"); addToast(data.message, "success"); await loadInventory(); }
    catch (err: any) { addToast(err.message, "error"); } finally { setSalvagingAll(false); }
  }
  async function tradeItem() {
    if (!tradeItemId || !tradeTag) { addToast("Select an item and enter recipient tag", "error"); return; }
    setTrading(true);
    try {
      const data = await api.post<any>("/inventory/trade", { itemId: tradeItemId, targetTag: tradeTag });
      addToast(data.message, "success"); setTradeItemId(""); setTradeTag(""); await loadInventory();
    } catch (err: any) { addToast(err.message, "error"); } finally { setTrading(false); }
  }
  async function listOnMarket() {
    const price = Number(listPrice);
    if (!listItemId || !price || price <= 0) { addToast("Select an item and enter a valid price", "error"); return; }
    setListing(true);
    try {
      const data = await api.post<any>(`/inventory/${listItemId}/list`, { price });
      addToast(data.message, "success"); setListItemId(""); setListPrice(""); await loadInventory();
    } catch (err: any) { addToast(err.message, "error"); } finally { setListing(false); }
  }
  const commonCount = items.filter(i => i.rarity === "common" && !i.equipped && !i.marketListed).length;
  const tradeable = items.filter(i => !i.equipped && !i.marketListed);
  const inputCls = "w-full px-3 py-2 rounded font-mono text-xs focus:outline-none";
  const inputStyle: React.CSSProperties = { background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 relative z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <CyberSectionHeader title="Inventory" accent="#94a3b8" size="lg" className="mb-0" />
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-3 text-xs font-mono mr-2">
            <span style={{ color: "#ff6b35" }}>STR: {user.strength}</span>
            <span style={{ color: "#a855f7" }}>CHA: {user.charisma}</span>
            <span style={{ color: "#00d4ff" }}>INT: {user.intelligence}</span>
          </div>
          {commonCount > 0 && (
            <CyberButton variant="ghost" size="sm" loading={salvagingAll} onClick={() => setSalvageAllConfirm(true)}>
              Salvage Commons ({commonCount})
            </CyberButton>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["inventory", "trade", "list"] as View[]).map(v => (
          <CyberButton key={v} variant={view === v ? "primary" : "ghost"} size="sm" onClick={() => setView(v)}>
            {VIEW_LABELS[v]}
          </CyberButton>
        ))}
      </div>

      {/* Trade panel */}
      {view === "trade" && (
        <AnimatedCard accent="#00d4ff">
          <CyberSectionHeader title="Trade Item" accent="#00d4ff" />
          <div className="space-y-3">
            <select value={tradeItemId} onChange={e => setTradeItemId(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">Select item...</option>
              {tradeable.map(i => <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>)}
            </select>
            <input value={tradeTag} onChange={e => setTradeTag(e.target.value.replace(/^#/, ""))} placeholder="Recipient tag (e.g. ABC1)" className={inputCls} style={inputStyle} />
            <CyberButton variant="primary" size="md" className="w-full" loading={trading} disabled={trading || !tradeItemId || !tradeTag} onClick={tradeItem}>
              Send Item
            </CyberButton>
          </div>
        </AnimatedCard>
      )}

      {/* List panel */}
      {view === "list" && (
        <AnimatedCard accent="#a855f7">
          <CyberSectionHeader title="List on Market" accent="#a855f7" />
          <div className="space-y-3">
            <select value={listItemId} onChange={e => setListItemId(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">Select item...</option>
              {tradeable.filter(i => i.type !== "consumable").map(i => <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>)}
            </select>
            <input value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="Listing price in DC" type="number" min="1" className={inputCls} style={inputStyle} />
            <CyberButton variant="purple" size="md" className="w-full" loading={listing} disabled={listing || !listItemId || !listPrice} onClick={listOnMarket}>
              List on Market
            </CyberButton>
          </div>
        </AnimatedCard>
      )}

      {/* Inventory grid */}
      {view === "inventory" && (
        items.length === 0 ? (
          <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
            No items. Visit the Market to buy gear.
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item, idx) => {
              const rc = RARITY_COLORS[item.rarity] ?? "#94a3b8";
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <AnimatedCard accent={rc} noPad>
                    {/* Rarity accent line */}
                    <div style={{ height: 2, background: `linear-gradient(90deg, ${rc}, transparent)`, borderRadius: "8px 8px 0 0", boxShadow: `0 0 8px ${rc}60` }} />

                    <div className="p-3 flex flex-col gap-3">
                      {/* Item info row */}
                      <div className="flex items-center gap-3">
                        <div
                          className="rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden relative"
                          style={{ width: 56, height: 56, background: `${rc}08`, border: `1px solid ${item.equipped ? rc + "60" : rc + "20"}`, boxShadow: item.equipped ? `0 0 10px ${rc}30` : "none" }}
                        >
                          <ItemImage itemId={nameToArenaItemId(item.name)} imageUrl={item.imageUrl} size={44} />
                          {item.equipped && (
                            <div className="absolute bottom-0 left-0 right-0 text-center font-mono" style={{ fontSize: 7, background: `${rc}cc`, color: "#fff", paddingBottom: 2 }}>EQ</div>
                          )}
                          {item.marketListed && (
                            <div className="absolute top-0 left-0 right-0 text-center font-mono" style={{ fontSize: 7, background: "#a855f7cc", color: "#fff", paddingTop: 2 }}>LISTED</div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{item.name}</span>
                            <span className="text-xs font-mono px-1.5 rounded" style={{ color: rc, background: `${rc}14`, border: `1px solid ${rc}25` }}>{item.rarity}</span>
                            {item.equipped && <span className="text-xs px-1 rounded font-mono" style={{ background: "#39d35318", color: "#39d353" }}>equipped</span>}
                            {item.marketListed && <span className="text-xs px-1 rounded font-mono" style={{ background: "#a855f718", color: "#a855f7" }}>listed</span>}
                          </div>
                          <p className="text-xs font-mono" style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</p>
                          <div className="flex gap-2 text-xs font-mono flex-wrap mt-1">
                            {item.strengthBonus > 0 && <span style={{ color: "#ff6b35" }}>STR+{item.strengthBonus}</span>}
                            {item.charismaBonus > 0 && <span style={{ color: "#a855f7" }}>CHA+{item.charismaBonus}</span>}
                            {item.intelligenceBonus > 0 && <span style={{ color: "#00d4ff" }}>INT+{item.intelligenceBonus}</span>}
                            {item.streetCredBonus > 0 && <span style={{ color: "#f59e0b" }}>REP+{item.streetCredBonus}</span>}
                            {item.effect && <span style={{ color: "#a855f7" }}>{item.effect}</span>}
                            {(item.type === "consumable" || item.type === "material") && item.quantity > 1 && <span style={{ color: "#64748b" }}>×{item.quantity}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap pt-2" style={{ borderTop: `1px solid ${rc}15` }}>
                        {item.slot && !item.marketListed && (
                          <CyberButton
                            variant={item.equipped ? "danger" : "success"}
                            size="sm"
                            className="flex-1"
                            loading={acting === item.id}
                            disabled={acting === item.id}
                            onClick={() => item.equipped ? unequip(item.id) : equip(item.id)}
                          >
                            {item.equipped ? "Unequip" : "Equip"}
                          </CyberButton>
                        )}
                        {item.type === "consumable" && !item.equipped && !item.marketListed && (
                          <CyberButton variant="primary" size="sm" className="flex-1" loading={acting === item.id} disabled={acting === item.id} onClick={() => useItem(item.id)}>
                            Use
                          </CyberButton>
                        )}
                        {!item.equipped && !item.marketListed && item.type !== "consumable" && (
                          <CyberButton variant="ghost" size="sm" className="flex-1" loading={acting === item.id} disabled={acting === item.id} onClick={() => setSalvageConfirm({ itemId: item.id, name: item.name })}>
                            Salvage
                          </CyberButton>
                        )}
                      </div>
                    </div>
                  </AnimatedCard>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {salvageConfirm && (
        <ConfirmDialog
          title="Salvage item?"
          message={`Salvage ${salvageConfirm.name}? This cannot be undone.`}
          confirmLabel="Salvage"
          danger
          busy={acting === salvageConfirm.itemId}
          onConfirm={() => { const s = salvageConfirm; setSalvageConfirm(null); salvage(s.itemId, s.name); }}
          onCancel={() => setSalvageConfirm(null)}
        />
      )}

      {salvageAllConfirm && (
        <ConfirmDialog
          title="Salvage all commons?"
          message={`Salvage all ${commonCount} common items? This cannot be undone.`}
          confirmLabel="Salvage All"
          danger
          busy={salvagingAll}
          onConfirm={() => { setSalvageAllConfirm(false); salvageAllCommons(); }}
          onCancel={() => setSalvageAllConfirm(false)}
        />
      )}
    </div>
  );
}
