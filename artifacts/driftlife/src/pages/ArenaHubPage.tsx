import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigate: (page: string) => void;
}

const TIER_COLORS: Record<string, string> = {
  common: "#6b7280", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
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
  if (stats.specialEffect) parts.push(stats.specialEffect);
  return parts.join(" · ") || "—";
}

function ItemCard({ stack, selected, onSelect }: { stack: InventoryStack; selected: boolean; onSelect: () => void }) {
  const def = stack.def;
  if (!def) return null;
  const color = TIER_COLORS[def.tier] ?? "#6b7280";
  return (
    <button
      onClick={onSelect}
      style={{
        background: selected ? `${color}18` : "#0a0a14",
        border: `1px solid ${selected ? color : "#1e293b"}`,
        borderRadius: 8, padding: "8px 10px", cursor: "pointer",
        textAlign: "left", width: "100%", transition: "all 0.15s",
        boxShadow: selected ? `0 0 8px ${color}30` : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: selected ? color : "#e2e8f0" }}>
          {def.name}
        </span>
        {stack.quantity > 1 && (
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#475569", background: "#1e293b", padding: "1px 5px", borderRadius: 4 }}>×{stack.quantity}</span>
        )}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: color, marginBottom: 2 }}>
        {def.tier.toUpperCase()} · {def.category.toUpperCase()}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b" }}>{statSummary(def.stats)}</div>
    </button>
  );
}

export default function ArenaHubPage({ user, addToast, onNavigate }: Props) {
  const [inventory, setInventory] = useState<Inventory>({ weapons: [], armor: [], consumables: [], ammo: [] });
  const [loadout, setLoadout]     = useState<Loadout>({ weapon: null, armor: null, consumable1: null, consumable2: null, ammoType: null });
  const [saving, setSaving]       = useState(false);
  const [tab, setTab]             = useState<"loadout" | "inventory">("loadout");
  const [loading, setLoading]     = useState(true);

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

  function findDef(itemId: string | null): ItemDef | null {
    if (!itemId) return null;
    const all = [...inventory.weapons, ...inventory.armor, ...inventory.consumables, ...inventory.ammo];
    return all.find(s => s.itemId === itemId)?.def ?? null;
  }

  const totalItems = inventory.weapons.length + inventory.armor.length + inventory.consumables.length + inventory.ammo.length;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
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
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>10 energy per match</div>
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
        <div>
          {/* Loadout slots */}
          {[
            { key: "weapon",      label: "Weapon",      items: inventory.weapons      },
            { key: "armor",       label: "Armor",        items: inventory.armor        },
            { key: "consumable1", label: "Consumable 1", items: inventory.consumables  },
            { key: "consumable2", label: "Consumable 2", items: inventory.consumables  },
            { key: "ammoType",    label: "Ammo",         items: inventory.ammo         },
          ].map(slot => {
            const equipped = (loadout as any)[slot.key] as string | null;
            const def = findDef(equipped);
            const color = equipped ? (TIER_COLORS[def?.tier ?? ""] ?? "#6b7280") : "#1e293b";
            return (
              <div key={slot.key} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{slot.label}</div>
                {/* Equipped slot */}
                <div style={{ background: equipped ? `${color}10` : "#0a0a14", border: `1px solid ${equipped ? color : "#1e293b"}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6, minHeight: 42 }}>
                  {equipped && def ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color }}>{def.name}</span>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginLeft: 8 }}>{statSummary(def.stats)}</span>
                      </div>
                      <button onClick={() => setLoadout(prev => ({ ...prev, [slot.key]: null }))} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  ) : (
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#374151" }}>— Empty slot —</span>
                  )}
                </div>
                {/* Available items */}
                {slot.items.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {slot.items.map(item => (
                      <ItemCard
                        key={item.itemId}
                        stack={item}
                        selected={equipped === item.itemId}
                        onSelect={() => setLoadout(prev => ({ ...prev, [slot.key]: equipped === item.itemId ? null : item.itemId }))}
                      />
                    ))}
                  </div>
                )}
                {slot.items.length === 0 && (
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#374151", padding: "6px 0" }}>
                    No {slot.label.toLowerCase()} owned — get them from the Royale wheel
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
        // Full inventory view
        <div>
          {[
            { label: "Weapons",     items: inventory.weapons      },
            { label: "Armor",       items: inventory.armor        },
            { label: "Consumables", items: inventory.consumables  },
            { label: "Ammo",        items: inventory.ammo         },
          ].map(section => section.items.length > 0 && (
            <div key={section.label} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{section.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {section.items.map(item => (
                  <ItemCard key={item.itemId} stack={item} selected={false} onSelect={() => {}} />
                ))}
              </div>
            </div>
          ))}
          {totalItems === 0 && (
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
          )}
        </div>
      )}
    </div>
  );
}
