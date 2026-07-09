import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ItemImage } from "../components/ItemImage";
import { User } from "../lib/types";

interface WeaponEntry {
  itemId: string;
  durability: number;
  def: { name: string; tier: string; slot: string; itemId: string } | null;
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

  const { data, isLoading } = useQuery<LoadoutData>({
    queryKey: ["loadout-combat"],
    queryFn: () => api.get("/loadout/combat"),
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

  if (isLoading || !data) {
    return (
      <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>
        Loading loadout...
      </div>
    );
  }

  const { loadout, inventory } = data;

  function getEquipped(slot: typeof SLOT_CONFIG[number]) {
    const id = loadout[slot.key];
    if (!id) return null;
    if (slot.isConsumable) {
      return inventory.consumables.find((c) => c.itemId === id) ?? null;
    }
    return (inventory[slot.invKey] as WeaponEntry[]).find((w) => w.itemId === id) ?? null;
  }

  function getPickerItems(slot: typeof SLOT_CONFIG[number]): (WeaponEntry | ConsumableEntry)[] {
    return inventory[slot.invKey] as (WeaponEntry | ConsumableEntry)[];
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <h2 className="font-mono font-bold text-lg" style={{ color: "#00d4ff" }}>COMBAT LOADOUT</h2>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Configure your gear for Arena combat. Changes take effect on your next match.
        </p>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {SLOT_CONFIG.map((slot) => {
          const equipped = getEquipped(slot);
          const isOpen = picker === slot.key;
          const pickerItems = getPickerItems(slot);

          return (
            <div key={slot.key} className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <div className="font-mono text-xs font-bold" style={{ color: "#64748b" }}>
                {slot.label.toUpperCase()}
              </div>

              {/* Currently equipped */}
              <div
                className="flex items-center gap-3 rounded p-2"
                style={{ background: "#0a0a0f", border: "1px solid #1e293b", minHeight: 56 }}
              >
                {equipped ? (
                  <>
                    <ItemImage itemId={equipped.itemId} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-bold truncate" style={{ color: "#e2e8f0" }}>
                        {equipped.def?.name ?? equipped.itemId}
                      </div>
                      <div className="font-mono text-xs" style={{ color: TIER_COLORS[equipped.def?.tier ?? ""] ?? "#475569" }}>
                        {equipped.def?.tier ?? "unknown"}
                        {"durability" in equipped && (
                          <span style={{ color: equipped.durability > 50 ? "#39d353" : equipped.durability > 20 ? "#f59e0b" : "#ff2d55", marginLeft: 6 }}>
                            {equipped.durability}% dur
                          </span>
                        )}
                        {"quantity" in equipped && (
                          <span style={{ color: "#a855f7", marginLeft: 6 }}>
                            x{equipped.quantity}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="font-mono text-xs" style={{ color: "#334155" }}>— Empty —</span>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPicker(isOpen ? null : slot.key)}
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
                <div className="space-y-1 rounded p-2" style={{ background: "#0a0a0f", border: "1px solid #1e293b", maxHeight: 200, overflowY: "auto" }}>
                  {pickerItems.length === 0 ? (
                    <div className="font-mono text-xs text-center py-3" style={{ color: "#334155" }}>
                      No items in inventory
                    </div>
                  ) : (
                    pickerItems.map((item) => {
                      const isEquipped = loadout[slot.key] === item.itemId;
                      const destroyed = "durability" in item && item.durability <= 0;
                      return (
                        <button
                          key={item.itemId}
                          disabled={destroyed || save.isPending}
                          onClick={() => save.mutate({ [slot.key]: item.itemId })}
                          className="w-full flex items-center gap-2 rounded p-1.5 text-left"
                          style={{
                            background: isEquipped ? "#00d4ff18" : "transparent",
                            border: `1px solid ${isEquipped ? "#00d4ff30" : "transparent"}`,
                            cursor: destroyed ? "not-allowed" : "pointer",
                            opacity: destroyed ? 0.4 : 1,
                          }}
                        >
                          <ItemImage itemId={item.itemId} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs truncate" style={{ color: isEquipped ? "#00d4ff" : "#e2e8f0" }}>
                              {item.def?.name ?? item.itemId}
                            </div>
                            <div className="font-mono" style={{ fontSize: 10, color: TIER_COLORS[item.def?.tier ?? ""] ?? "#475569" }}>
                              {item.def?.tier}
                              {"durability" in item && (
                                <span style={{ color: item.durability > 50 ? "#39d353" : item.durability > 20 ? "#f59e0b" : "#ff2d55", marginLeft: 4 }}>
                                  {item.durability}%
                                </span>
                              )}
                              {"quantity" in item && (
                                <span style={{ color: "#a855f7", marginLeft: 4 }}>x{item.quantity}</span>
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
    </div>
  );
}
