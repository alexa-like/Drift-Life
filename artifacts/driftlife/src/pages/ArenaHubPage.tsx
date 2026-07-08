import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { CardArt, inferItemType } from "../components/CardArt";

/** Shows a combat item's PNG asset; falls back to CardArt if the file doesn't load. */
function ItemPng({ itemId, itemType, tier, size }: { itemId: string; itemType: string; tier: string; size: number }) {
  // Keyed by itemId so the failure state resets whenever the displayed item changes
  // (e.g. swapping loadout slots or navigating between items in the same mounted slot).
  return <ItemPngInner key={itemId} itemId={itemId} itemType={itemType} tier={tier} size={size} />;
}

function ItemPngInner({ itemId, itemType, tier, size }: { itemId: string; itemType: string; tier: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        src={`/assets/items/${itemId}.png`}
        alt={itemId}
        width={size}
        height={size}
        style={{ objectFit: "contain", display: "block" }}
        onError={() => setFailed(true)}
      />
    );
  }
  return <CardArt itemType={itemType} tier={tier} size={size} />;
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigate: (page: string) => void;
}

const TIER_COLORS: Record<string, string> = {
  common: "#6b7280", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};

const SELL_DC: Record<string, number> = {
  common: 50, uncommon: 150, rare: 500, epic: 1500, legendary: 5000,
};

interface ItemDef {
  itemId: string; name: string; category: string; tier: string;
  stats: { damageMin?: number; damageMax?: number; accuracy?: number; defense?: number; hp?: number; healAmount?: number; damageMultiplier?: number; specialEffect?: string; specialChance?: number };
  flavorText: string;
}
interface InventoryStack { itemId: string; quantity: number; def: ItemDef | null; }
interface Inventory { weapons: InventoryStack[]; armor: InventoryStack[]; consumables: InventoryStack[]; ammo: InventoryStack[]; }
interface Loadout { weapon: string | null; armor: string | null; consumable1: string | null; consumable2: string | null; ammoType: string | null; }

function statSummary(stats: ItemDef["stats"]): string {
  const parts: string[] = [];
  if (stats.damageMin != null) parts.push(`${stats.damageMin}–${stats.damageMax} DMG`);
  if (stats.accuracy   != null) parts.push(`${stats.accuracy}% ACC`);
  if (stats.defense    != null && stats.defense > 0) parts.push(`${stats.defense} DEF`);
  if (stats.hp         != null && stats.hp > 0)      parts.push(`+${stats.hp} HP`);
  if (stats.healAmount != null && stats.healAmount > 0) parts.push(`Heals ${stats.healAmount}`);
  if (stats.damageMultiplier != null && stats.damageMultiplier > 1) parts.push(`×${stats.damageMultiplier} DMG`);
  if (stats.specialEffect) parts.push(stats.specialEffect.replace(/_/g, " "));
  return parts.join(" · ") || "—";
}

function FullItemCard({
  stack, selected, onSelect, onSell, showSell,
}: {
  stack: InventoryStack;
  selected?: boolean;
  onSelect?: () => void;
  onSell?: () => void;
  showSell?: boolean;
}) {
  const def = stack.def;
  if (!def) return null;
  const color = TIER_COLORS[def.tier] ?? "#6b7280";
  const sellPrice = SELL_DC[def.tier] ?? 50;
  const itemType = inferItemType(def.itemId, def.category);

  return (
    <div
      style={{
        background: selected ? `${color}14` : "#0a0a14",
        border: `1px solid ${selected ? color : "#1e293b"}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: selected ? `0 0 10px ${color}25` : "none",
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Art area */}
      <div
        onClick={onSelect}
        style={{
          cursor: onSelect ? "pointer" : "default",
          background: `${color}08`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          borderBottom: `1px solid ${color}20`,
          position: "relative",
        }}
      >
        <ItemPng itemId={def.itemId} itemType={itemType} tier={def.tier} size={88} />
        {selected && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            background: color, borderRadius: "50%", width: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, color: "#000", fontWeight: "bold",
          }}>✓</div>
        )}
        {stack.quantity > 1 && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            fontFamily: "monospace", fontSize: 9, color: "#475569",
            background: "#1e293b", padding: "1px 5px", borderRadius: 4,
          }}>×{stack.quantity}</div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "6px 8px", flex: 1 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: "bold", color: selected ? color : "#e2e8f0", marginBottom: 2 }}>
          {def.name}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color, marginBottom: 3 }}>
          {def.tier.toUpperCase()} {def.category.toUpperCase()}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#64748b", lineHeight: 1.4 }}>
          {statSummary(def.stats)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, padding: "4px 6px 6px" }}>
        {onSelect && (
          <button
            onClick={onSelect}
            style={{
              flex: 1, padding: "5px 0", borderRadius: 6, fontFamily: "monospace", fontSize: 9,
              fontWeight: "bold", cursor: "pointer",
              background: selected ? `${color}30` : "#1e293b",
              border: `1px solid ${selected ? color : "#334155"}`,
              color: selected ? color : "#64748b",
            }}
          >
            {selected ? "✓ Equipped" : "Equip"}
          </button>
        )}
        {showSell && onSell && (
          <button
            onClick={onSell}
            style={{
              padding: "5px 8px", borderRadius: 6, fontFamily: "monospace", fontSize: 9,
              cursor: "pointer", background: "#f59e0b10", border: "1px solid #f59e0b40", color: "#f59e0b",
              whiteSpace: "nowrap",
            }}
          >
            💰 {sellPrice.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}

interface SellConfirm { itemId: string; name: string; tier: string; dc: number; }

export default function ArenaHubPage({ user, addToast, onNavigate }: Props) {
  const [inventory, setInventory] = useState<Inventory>({ weapons: [], armor: [], consumables: [], ammo: [] });
  const [loadout, setLoadout]     = useState<Loadout>({ weapon: null, armor: null, consumable1: null, consumable2: null, ammoType: null });
  const [saving, setSaving]       = useState(false);
  const [tab, setTab]             = useState<"loadout" | "inventory">("loadout");
  const [loading, setLoading]     = useState(true);
  const [sellConfirm, setSellConfirm] = useState<SellConfirm | null>(null);
  const [selling, setSelling]     = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [invData, loadoutData] = await Promise.all([
        api.get<Inventory>("/loadout/inventory"),
        api.get<{ loadout: Loadout }>("/loadout/combat"),
      ]);
      setInventory(invData);
      setLoadout(loadoutData.loadout ?? { weapon: null, armor: null, consumable1: null, consumable2: null, ammoType: null });
    } catch (err: any) {
      addToast(err.message ?? "Failed to load arena data", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveLoadout() {
    setSaving(true);
    try {
      await api.post("/loadout/combat", loadout);
      addToast("Loadout saved!", "success");
    } catch (err: any) {
      addToast(err.message ?? "Failed to save loadout", "error");
    } finally {
      setSaving(false);
    }
  }

  async function sellItem(itemId: string) {
    setSelling(true);
    try {
      const res = await api.post<{ message: string; dcGained: number }>("/loadout/sell", { itemId });
      addToast(res.message ?? `Sold for ${res.dcGained} DC`, "success");
      // If the sold item was in loadout, clear it
      setLoadout(prev => {
        const next = { ...prev };
        if (next.weapon === itemId) next.weapon = null;
        if (next.armor === itemId) next.armor = null;
        if (next.consumable1 === itemId) next.consumable1 = null;
        if (next.consumable2 === itemId) next.consumable2 = null;
        if (next.ammoType === itemId) next.ammoType = null;
        return next;
      });
      await loadData();
    } catch (err: any) {
      addToast(err.message ?? "Failed to sell item", "error");
    } finally {
      setSelling(false);
      setSellConfirm(null);
    }
  }

  function requestSell(stack: InventoryStack) {
    if (!stack.def) return;
    setSellConfirm({
      itemId: stack.itemId,
      name: stack.def.name,
      tier: stack.def.tier,
      dc: SELL_DC[stack.def.tier] ?? 50,
    });
  }

  function findDef(itemId: string | null): ItemDef | null {
    if (!itemId) return null;
    const all = [...inventory.weapons, ...inventory.armor, ...inventory.consumables, ...inventory.ammo];
    return all.find(s => s.itemId === itemId)?.def ?? null;
  }

  const totalItems = inventory.weapons.length + inventory.armor.length + inventory.consumables.length + inventory.ammo.length;

  const SLOTS = [
    { key: "weapon",      label: "Weapon",      items: inventory.weapons      },
    { key: "armor",       label: "Armor",        items: inventory.armor        },
    { key: "consumable1", label: "Consumable 1", items: inventory.consumables  },
    { key: "consumable2", label: "Consumable 2", items: inventory.consumables  },
    { key: "ammoType",    label: "Ammo",         items: inventory.ammo         },
  ] as const;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "monospace", fontSize: 20, color: "#ff6b35", fontWeight: "bold", letterSpacing: 2 }}>⚔ ARENA HUB</h1>
          <p style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>Equip your loadout, then enter combat</p>
        </div>
        <button
          onClick={() => onNavigate("arena-combat")}
          style={{
            padding: "10px 16px", borderRadius: 8, fontFamily: "monospace", fontSize: 12,
            fontWeight: "bold", cursor: "pointer", letterSpacing: 1,
            background: "linear-gradient(135deg, #ff6b3520, #ff6b3510)",
            border: "1px solid #ff6b3560", color: "#ff6b35",
            boxShadow: "0 0 12px #ff6b3530",
          }}
        >
          ▶ ENTER COMBAT
        </button>
      </div>

      {/* Energy */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 10, padding: 12, marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#f59e0b" }}>⚡ Energy</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#fbbf24" }}>{user.energy} / {user.maxEnergy}</div>
        </div>
        <div style={{ flex: 1, background: "#1e293b", borderRadius: 4, height: 6 }}>
          <div style={{ background: "#f59e0b", height: "100%", borderRadius: 4, width: `${Math.min(100, (user.energy / user.maxEnergy) * 100)}%` }} />
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>10 EN per match</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["loadout", "inventory"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "8px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer",
              background: tab === t ? "#ff6b3518" : "#0a0a14",
              border: `1px solid ${tab === t ? "#ff6b35" : "#1e293b"}`,
              color: tab === t ? "#ff6b35" : "#475569",
            }}
          >
            {t === "loadout" ? "⚙ Loadout" : `📦 Inventory (${totalItems})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, fontFamily: "monospace", color: "#475569" }}>Loading...</div>
      ) : tab === "loadout" ? (
        /* ── LOADOUT TAB ── */
        <div>
          {SLOTS.map(slot => {
            const equipped = (loadout as any)[slot.key] as string | null;
            const def = findDef(equipped);
            const color = equipped ? (TIER_COLORS[def?.tier ?? ""] ?? "#6b7280") : "#1e293b";
            return (
              <div key={slot.key} style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{slot.label}</div>
                {/* Equipped slot display */}
                <div style={{
                  background: equipped ? `${color}10` : "#0a0a14",
                  border: `1px solid ${equipped ? color : "#1e293b"}`,
                  borderRadius: 8, padding: "8px 12px", marginBottom: 8, minHeight: 42,
                }}>
                  {equipped && def ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ItemPng itemId={def.itemId} itemType={inferItemType(def.itemId, def.category)} tier={def.tier} size={32} />
                        <div>
                          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color }}>{def.name}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginLeft: 8 }}>{statSummary(def.stats)}</span>
                        </div>
                      </div>
                      <button onClick={() => setLoadout(prev => ({ ...prev, [slot.key]: null }))}
                        style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  ) : (
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#374151" }}>— Empty slot —</span>
                  )}
                </div>
                {/* Available items grid */}
                {slot.items.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                    {slot.items.map(item => (
                      <FullItemCard
                        key={item.itemId}
                        stack={item}
                        selected={equipped === item.itemId}
                        onSelect={() => setLoadout(prev => ({ ...prev, [slot.key]: equipped === item.itemId ? null : item.itemId }))}
                        showSell={false}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#374151", padding: "4px 0" }}>
                    No {slot.label.toLowerCase()} owned — spin the Shooting Royale
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={saveLoadout}
            disabled={saving}
            style={{
              width: "100%", marginTop: 8, padding: "12px", borderRadius: 10, fontFamily: "monospace",
              fontSize: 13, fontWeight: "bold", cursor: "pointer", letterSpacing: 1,
              background: "linear-gradient(135deg, #ff6b3520, #ff6b3510)",
              border: "1px solid #ff6b3560", color: "#ff6b35",
            }}
          >
            {saving ? "Saving..." : "💾 Save Loadout"}
          </button>
        </div>
      ) : (
        /* ── INVENTORY TAB ── */
        <div>
          {totalItems === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
              <div style={{ fontFamily: "monospace", fontSize: 13, color: "#475569" }}>No combat items yet</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#374151", marginTop: 8 }}>Spin the Shooting Royale to get weapons and gear</div>
              <button
                onClick={() => onNavigate("royale")}
                style={{ marginTop: 16, padding: "10px 20px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#ff6b3518", border: "1px solid #ff6b3560", color: "#ff6b35" }}
              >
                → Go to Royale
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginBottom: 12 }}>
                Click equip on any item to add it to your loadout. Sell unwanted items for DC.
              </div>
              {[
                { label: "⚔ Weapons",    items: inventory.weapons,     slotKey: "weapon" as keyof Loadout },
                { label: "🛡 Armor",      items: inventory.armor,       slotKey: "armor" as keyof Loadout },
                { label: "💊 Consumables",items: inventory.consumables, slotKey: "consumable1" as keyof Loadout },
                { label: "🎯 Ammo",       items: inventory.ammo,        slotKey: "ammoType" as keyof Loadout },
              ].map(section => section.items.length > 0 && (
                <div key={section.label} style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, borderBottom: "1px solid #1e293b", paddingBottom: 6 }}>
                    {section.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(138px, 1fr))", gap: 10 }}>
                    {section.items.map(item => {
                      const equippedSlot = (() => {
                        if (loadout.weapon === item.itemId) return "weapon" as const;
                        if (loadout.armor === item.itemId) return "armor" as const;
                        if (loadout.consumable1 === item.itemId) return "consumable1" as const;
                        if (loadout.consumable2 === item.itemId) return "consumable2" as const;
                        if (loadout.ammoType === item.itemId) return "ammoType" as const;
                        return null;
                      })();
                      const isEquipped = equippedSlot !== null;
                      return (
                        <FullItemCard
                          key={item.itemId}
                          stack={item}
                          selected={isEquipped}
                          onSelect={() => {
                            if (isEquipped && equippedSlot) {
                              // Unequip from the actual slot holding this item
                              setLoadout(prev => ({ ...prev, [equippedSlot]: null }));
                            } else {
                              // Equip: for consumables try consumable1 first, then consumable2
                              if (section.slotKey === "consumable1") {
                                if (!loadout.consumable1) {
                                  setLoadout(prev => ({ ...prev, consumable1: item.itemId }));
                                } else if (!loadout.consumable2) {
                                  setLoadout(prev => ({ ...prev, consumable2: item.itemId }));
                                } else {
                                  // Both full — replace consumable1
                                  setLoadout(prev => ({ ...prev, consumable1: item.itemId }));
                                }
                              } else {
                                setLoadout(prev => ({ ...prev, [section.slotKey]: item.itemId }));
                              }
                            }
                          }}
                          onSell={() => requestSell(item)}
                          showSell
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Sell Confirmation Modal */}
      {sellConfirm && (
        <div
          style={{ position: "fixed", inset: 0, background: "#000000b0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={() => !selling && setSellConfirm(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#0d0d1a", border: "1px solid #f59e0b40", borderRadius: 12, padding: 24, width: 300, boxShadow: "0 0 32px #000" }}
          >
            <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#f59e0b", marginBottom: 8 }}>Sell Item?</div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#e2e8f0", marginBottom: 4 }}>{sellConfirm.name}</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", marginBottom: 16 }}>
              You'll receive <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{sellConfirm.dc.toLocaleString()} DC</span>.{"\n"}This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setSellConfirm(null)}
                disabled={selling}
                style={{ flex: 1, padding: "8px", borderRadius: 8, fontFamily: "monospace", fontSize: 11, cursor: "pointer", background: "#0a0a14", border: "1px solid #1e293b", color: "#94a3b8" }}
              >
                Cancel
              </button>
              <button
                onClick={() => sellItem(sellConfirm.itemId)}
                disabled={selling}
                style={{ flex: 1, padding: "8px", borderRadius: 8, fontFamily: "monospace", fontSize: 11, fontWeight: "bold", cursor: "pointer", background: "#f59e0b20", border: "1px solid #f59e0b60", color: "#f59e0b" }}
              >
                {selling ? "Selling..." : `Sell for ${sellConfirm.dc.toLocaleString()} DC`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
