import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ItemImage } from "../components/ItemImage";
import { User } from "../lib/types";

interface WeaponEntry {
  itemId: string;
  durability: number;
  def: { name: string; tier: string; slot: string; itemId: string; ammoCategory?: string } | null;
}
interface ConsumableEntry {
  itemId: string;
  quantity: number;
  def: { name: string; tier: string; slot: string; itemId: string } | null;
}
interface Inventory {
  primaryWeapons: WeaponEntry[];
  secondaryWeapons: WeaponEntry[];
  bodyArmors: WeaponEntry[];
  consumables: ConsumableEntry[];
  ammo?: {
    pistol_rounds?: number; smg_rounds?: number; rifle_rounds?: number;
    shotgun_shells?: number; sniper_rounds?: number; lmg_rounds?: number;
    [key: string]: number | undefined;
  };
}
interface Loadout {
  primaryWeaponId: string | null;
  secondaryWeaponId: string | null;
  bodyArmorId: string | null;
  consumableItemId: string | null;
  consumableCount: number;
}
interface LoadoutData {
  loadout: Loadout;
  inventory: Inventory;
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const TIER_COLORS: Record<string, string> = {
  common: "#94a3b8", uncommon: "#39d353", rare: "#00d4ff",
  epic: "#a855f7", legendary: "#f59e0b",
};

type SlotKey = "primaryWeaponId" | "secondaryWeaponId" | "bodyArmorId" | "consumableItemId";

const SLOT_CONFIG: { key: SlotKey; label: string; invKey: keyof Inventory; isConsumable?: boolean }[] = [
  { key: "primaryWeaponId",   label: "Primary Weapon",   invKey: "primaryWeapons" },
  { key: "secondaryWeaponId", label: "Secondary Weapon",  invKey: "secondaryWeapons" },
  { key: "bodyArmorId",       label: "Body Armor",        invKey: "bodyArmors" },
  { key: "consumableItemId",  label: "Consumable",        invKey: "consumables", isConsumable: true },
];

export default function LoadoutPage({ addToast }: Props) {
  const qc = useQueryClient();
  const [picker, setPicker] = useState<SlotKey | null>(null);
  const [consQty, setConsQty] = useState(1);

  const { data, isLoading, isError, error } = useQuery<LoadoutData>({
    queryKey: ["loadout-combat"],
    queryFn: () => api.get("/loadout/combat"),
    retry: 1,
    staleTime: 0,
  });

  const save = useMutation({
    mutationFn: (patch: Partial<Loadout>) =>
      api.post("/loadout/combat", { ...(data?.loadout ?? {}), ...patch }),
    onSuccess: () => {
      addToast("Loadout saved", "success");
      qc.invalidateQueries({ queryKey: ["loadout-combat"] });
      setPicker(null);
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  if (isLoading) {
    return (
      <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>
        Loading loadout...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="font-mono text-xs text-center py-16 space-y-2">
        <div style={{ color: "#ff2d55" }}>⚠ Failed to load loadout</div>
        <div style={{ color: "#334155" }}>{(error as Error)?.message ?? "Unknown error"}</div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["loadout-combat"] })}
          className="font-mono text-xs px-4 py-2 rounded mt-2"
          style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5530" }}
        >
          Retry
        </button>
      </div>
    );
  }

  const { loadout, inventory } = data;

  // Guard: if either field is missing the API returned something unexpected
  if (!loadout || !inventory) {
    return (
      <div className="font-mono text-xs text-center py-16 space-y-2">
        <div style={{ color: "#ff2d55" }}>⚠ Loadout data missing — please retry</div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["loadout-combat"] })}
          className="font-mono text-xs px-4 py-2 rounded mt-2"
          style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5530" }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Check if inventory is completely empty — show a helpful empty state
  const hasNoItems =
    inventory.primaryWeapons.length === 0 &&
    inventory.secondaryWeapons.length === 0 &&
    inventory.bodyArmors.length === 0 &&
    inventory.consumables.length === 0;

  function getEquipped(slot: typeof SLOT_CONFIG[number]) {
    const id = loadout[slot.key];
    if (!id) return null;
    if (slot.isConsumable) {
      return inventory.consumables.find((c) => c.itemId === id) ?? null;
    }
    return (inventory[slot.invKey] as WeaponEntry[]).find((w) => w.itemId === id) ?? null;
  }

  function getPickerItems(slot: typeof SLOT_CONFIG[number]): (WeaponEntry | ConsumableEntry)[] {
    const items = inventory[slot.invKey];
    return Array.isArray(items) ? items as (WeaponEntry | ConsumableEntry)[] : [];
  }

  // ── Warnings ─────────────────────────────────────────────────────────────────
  const warnings: { key: string; msg: string }[] = [];

  if (!loadout.bodyArmorId) {
    warnings.push({ key: "no_armor", msg: "⚠️ No armor equipped — you will take full damage from round 1." });
  }

  // Check ammo for primary weapon
  if (loadout.primaryWeaponId) {
    const primaryDef = Array.isArray(inventory.primaryWeapons)
      ? inventory.primaryWeapons.find(w => w.itemId === loadout.primaryWeaponId)?.def
      : undefined;
    const ammoCategory = (primaryDef as any)?.ammoCategory ?? null;
    if (ammoCategory && inventory.ammo) {
      const ammoCount = inventory.ammo[ammoCategory] ?? 0;
      if (ammoCount === 0) {
        warnings.push({ key: "no_ammo_primary", msg: "⚠️ No ammo for primary weapon." });
      }
    }
  }

  // Check ammo for secondary weapon
  if (loadout.secondaryWeaponId) {
    const secondaryDef = Array.isArray(inventory.secondaryWeapons)
      ? inventory.secondaryWeapons.find(w => w.itemId === loadout.secondaryWeaponId)?.def
      : undefined;
    const ammoCategory = (secondaryDef as any)?.ammoCategory ?? null;
    if (ammoCategory && inventory.ammo) {
      const ammoCount = inventory.ammo[ammoCategory] ?? 0;
      if (ammoCount === 0) {
        warnings.push({ key: "no_ammo_secondary", msg: "⚠️ No ammo for secondary weapon." });
      }
    }
  }

  return (
    <div className="space-y-4 relative z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <h2 className="font-mono font-bold text-lg" style={{ color: "#00d4ff" }}>COMBAT LOADOUT</h2>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Configure your gear for Arena combat. Changes take effect on your next match.
        </p>
      </div>

      {/* Empty inventory callout */}
      {hasNoItems && (
        <div className="rounded-lg p-5 text-center space-y-3" style={{ background: "#0a0a0f", border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 32 }}>🎯</div>
          <div className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>NO COMBAT GEAR EQUIPPED</div>
          <div className="font-mono text-xs" style={{ color: "#64748b" }}>
            Your loadout is empty. Purchase weapons, armor, and consumables from the Arena Shop to gear up.
          </div>
          <button
            onClick={() => {
              const nav = (window as any).__setPage;
              if (nav) nav("arena");
            }}
            className="font-mono text-xs px-5 py-2 rounded"
            style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5530", cursor: "pointer" }}
          >
            ⚔ GO TO ARENA SHOP
          </button>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map(w => (
            <div key={w.key} className="rounded p-3 font-mono text-xs" style={{ background: "#ff2d5512", border: "1px solid #ff2d5530", color: "#ff2d55" }}>
              {w.msg}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))" }}>
        {SLOT_CONFIG.map((slot) => {
          const equipped = getEquipped(slot);
          const isOpen = picker === slot.key;
          const pickerItems = getPickerItems(slot);
          const isWeapon = slot.key === "primaryWeaponId" || slot.key === "secondaryWeaponId";
          const isArmor = slot.key === "bodyArmorId";

          // Durability warning for equipped weapon/armor
          const equippedEntry = equipped as WeaponEntry | null;
          const durabilityWarning = equippedEntry && "durability" in equippedEntry && equippedEntry.durability <= 20 && equippedEntry.durability > 0;
          const destroyed = equippedEntry && "durability" in equippedEntry && equippedEntry.durability <= 0;

          // Ammo warning for equipped weapon
          let ammoWarning = false;
          if (isWeapon && equipped) {
            const weaponDef = (equipped as WeaponEntry).def;
            const ammoCategory = (weaponDef as any)?.ammoCategory ?? null;
            if (ammoCategory && inventory.ammo) {
              ammoWarning = (inventory.ammo[ammoCategory] ?? 0) === 0;
            }
          }

          return (
            <div key={slot.key} className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <div className="font-mono text-xs font-bold" style={{ color: "#64748b" }}>
                {slot.label.toUpperCase()}
              </div>

              {/* Currently equipped */}
              <div
                className="flex items-center gap-3 rounded p-2"
                style={{
                  background: "#0a0a0f",
                  border: `1px solid ${destroyed ? "#ff2d5550" : durabilityWarning ? "#f59e0b40" : "#1e293b"}`,
                  minHeight: 56,
                }}
              >
                {equipped ? (
                  <>
                    <ItemImage itemId={equipped.itemId} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-bold truncate" style={{ color: destroyed ? "#ff2d55" : "#e2e8f0" }}>
                        {equipped.def?.name ?? equipped.itemId}
                        {destroyed && <span style={{ marginLeft: 4, color: "#ff2d55" }}>⚠</span>}
                      </div>
                      <div className="font-mono text-xs" style={{ color: TIER_COLORS[equipped.def?.tier ?? ""] ?? "#475569" }}>
                        {equipped.def?.tier ?? "unknown"}
                        {"durability" in equipped && (
                          <>
                            <span style={{
                              color: equipped.durability === 0 ? "#ff2d55" : equipped.durability > 50 ? "#39d353" : equipped.durability > 20 ? "#f59e0b" : "#ff2d55",
                              marginLeft: 6,
                            }}>
                              {equipped.durability <= 0 ? "DESTROYED" : `${equipped.durability}% dur`}
                            </span>
                            {/* Durability bar */}
                            <div style={{ marginTop: 3, background: "#1e293b", borderRadius: 2, height: 3, width: "100%" }}>
                              <div style={{
                                width: `${Math.max(0, Math.min(100, equipped.durability))}%`,
                                height: "100%",
                                background: equipped.durability > 50 ? "#39d353" : equipped.durability > 20 ? "#f59e0b" : "#ff2d55",
                                borderRadius: 2,
                              }} />
                            </div>
                          </>
                        )}
                        {"quantity" in equipped && (
                          <span style={{ color: "#a855f7", marginLeft: 6 }}>
                            x{equipped.quantity} owned
                          </span>
                        )}
                      </div>
                      {/* Inline ammo warning */}
                      {ammoWarning && (
                        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#f59e0b", marginTop: 2 }}>
                          ⚠️ No ammo in inventory
                        </div>
                      )}
                      {/* Consumable equipped count */}
                      {slot.isConsumable && loadout.consumableCount > 0 && (
                        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#a855f7", marginTop: 2 }}>
                          {loadout.consumableCount} equipped for match
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="font-mono text-xs" style={{ color: "#334155" }}>
                    — Empty —
                    {slot.key === "bodyArmorId" && <span style={{ color: "#ff2d55", marginLeft: 4 }}>⚠️</span>}
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPicker(isOpen ? null : slot.key);
                    if (!isOpen && slot.isConsumable) {
                      setConsQty(loadout.consumableCount || 1);
                    }
                  }}
                  className="flex-1 font-mono text-xs px-2 py-1 rounded"
                  style={{
                    background: isOpen ? "#00d4ff22" : "#1e293b",
                    color: isOpen ? "#00d4ff" : "#94a3b8",
                    border: `1px solid ${isOpen ? "#00d4ff40" : "#334155"}`,
                    cursor: "pointer",
                  }}
                >
                  {isOpen ? "Close" : "Change"}
                </button>
                {equipped && (
                  <button
                    onClick={() => save.mutate({ [slot.key]: null })}
                    disabled={save.isPending}
                    className="font-mono text-xs px-2 py-1 rounded"
                    style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5530", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Picker */}
              {isOpen && (
                <div className="space-y-1 rounded p-2" style={{ background: "#0a0a0f", border: "1px solid #1e293b", maxHeight: 240, overflowY: "auto" }}>
                  {/* Consumable quantity picker */}
                  {slot.isConsumable && loadout.consumableItemId && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", marginBottom: 4, borderBottom: "1px solid #1e293b" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 9, color: "#64748b" }}>QTY TO EQUIP:</span>
                      {[1, 2, 3].map(q => {
                        const maxOwned = inventory.consumables.find(c => c.itemId === loadout.consumableItemId)?.quantity ?? 0;
                        const disabled = q > maxOwned;
                        return (
                          <button
                            key={q}
                            disabled={disabled}
                            onClick={() => {
                              setConsQty(q);
                              save.mutate({ consumableCount: q });
                            }}
                            style={{
                              fontFamily: "monospace", fontSize: 10, fontWeight: "bold",
                              width: 28, height: 24, borderRadius: 4,
                              background: consQty === q ? "#a855f720" : "#111118",
                              border: `1px solid ${consQty === q ? "#a855f7" : "#334155"}`,
                              color: disabled ? "#334155" : consQty === q ? "#a855f7" : "#94a3b8",
                              cursor: disabled ? "not-allowed" : "pointer",
                              opacity: disabled ? 0.4 : 1,
                            }}
                          >
                            {q}
                          </button>
                        );
                      })}
                      <span style={{ fontFamily: "monospace", fontSize: 9, color: "#475569" }}>
                        (own {inventory.consumables.find(c => c.itemId === loadout.consumableItemId)?.quantity ?? 0})
                      </span>
                    </div>
                  )}

                  {pickerItems.length === 0 ? (
                    <div className="font-mono text-xs text-center py-3" style={{ color: "#334155" }}>
                      No items in inventory
                    </div>
                  ) : (
                    pickerItems.map((item) => {
                      const isEquipped = loadout[slot.key] === item.itemId;
                      const isDestroyed = "durability" in item && item.durability <= 0;
                      const lowDur = "durability" in item && item.durability > 0 && item.durability <= 20;
                      const ownedQty = "quantity" in item ? item.quantity : undefined;

                      return (
                        <button
                          key={item.itemId}
                          disabled={isDestroyed || save.isPending}
                          onClick={() => {
                            if (slot.isConsumable) {
                              const maxOwned = (item as ConsumableEntry).quantity ?? 1;
                              const qty = Math.min(consQty, maxOwned, 3);
                              save.mutate({ [slot.key]: item.itemId, consumableCount: qty });
                            } else {
                              save.mutate({ [slot.key]: item.itemId });
                            }
                          }}
                          className="w-full flex items-center gap-2 rounded p-1.5 text-left"
                          style={{
                            background: isEquipped ? "#00d4ff18" : "transparent",
                            border: `1px solid ${isEquipped ? "#00d4ff30" : "transparent"}`,
                            cursor: isDestroyed ? "not-allowed" : "pointer",
                            opacity: isDestroyed ? 0.4 : 1,
                          }}
                        >
                          <ItemImage itemId={item.itemId} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs truncate" style={{ color: isEquipped ? "#00d4ff" : "#e2e8f0" }}>
                              {item.def?.name ?? item.itemId}
                              {isDestroyed && <span style={{ color: "#ff2d55", marginLeft: 4, fontSize: 9 }}>DESTROYED</span>}
                            </div>
                            <div className="font-mono" style={{ fontSize: 10, color: TIER_COLORS[item.def?.tier ?? ""] ?? "#475569" }}>
                              {item.def?.tier}
                              {"durability" in item && !isDestroyed && (
                                <span style={{ color: lowDur ? "#ff2d55" : item.durability > 50 ? "#39d353" : "#f59e0b", marginLeft: 4 }}>
                                  {item.durability}%{lowDur && " ⚠"}
                                </span>
                              )}
                              {ownedQty !== undefined && (
                                <span style={{ color: "#a855f7", marginLeft: 4 }}>x{ownedQty}</span>
                              )}
                            </div>
                          </div>
                          {isEquipped && (
                            <span style={{ fontSize: 10, color: "#00d4ff" }}>✓</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ammo summary */}
      {inventory.ammo && (
        <div className="rounded-lg p-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="font-mono text-xs font-bold mb-2" style={{ color: "#64748b" }}>AMMO INVENTORY</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(inventory.ammo).map(([cat, count]) => {
              if (count === undefined) return null;
              const label = cat.replace(/_/g, " ").toUpperCase();
              const low = count < 10;
              return (
                <div key={cat} style={{
                  fontFamily: "monospace", fontSize: 10, padding: "4px 8px", borderRadius: 4,
                  background: "#0a0a0f", border: `1px solid ${low ? "#f59e0b40" : "#1e293b"}`,
                  color: low ? "#f59e0b" : "#64748b",
                }}>
                  {label}: <span style={{ color: count === 0 ? "#ff2d55" : low ? "#f59e0b" : "#94a3b8", fontWeight: "bold" }}>{count}</span>
                  {count === 0 && " ⚠️"}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
