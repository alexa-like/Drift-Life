import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { User, PlayerGarage, OwnedCar, OwnedCarPartStack, CarPartDef, CarStats, CarPartType } from "../lib/types";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

const TIER_COLORS: Record<string, string> = {
  common: "#6b7280", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};

const PART_SLOTS: { key: CarPartType; label: string }[] = [
  { key: "engine",  label: "Engine" },
  { key: "tires",   label: "Tires" },
  { key: "nitro",   label: "Nitro" },
  { key: "bodyKit", label: "Body Kit" },
  { key: "spoiler", label: "Spoiler" },
];

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 10, color: "#64748b", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color }}>{Math.round(value)}</span>
      </div>
      <div style={{ background: "#1e293b", borderRadius: 4, height: 5 }}>
        <div style={{ background: color, height: "100%", borderRadius: 4, width: `${Math.min(100, value)}%`, transition: "width 0.2s" }} />
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, confirmColor, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; confirmColor: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000a0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 12, padding: 20, width: 300, boxShadow: "0 0 24px #000" }}
      >
        <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#e2e8f0", marginBottom: 8 }}>{title}</div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", marginBottom: 16, lineHeight: 1.5 }}>{body}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "8px", borderRadius: 8, fontFamily: "monospace", fontSize: 11, cursor: "pointer", background: "#0a0a14", border: "1px solid #1e293b", color: "#94a3b8" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "8px", borderRadius: 8, fontFamily: "monospace", fontSize: 11, fontWeight: "bold", cursor: "pointer", background: `${confirmColor}20`, border: `1px solid ${confirmColor}60`, color: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GaragePage({ user, onUserUpdate }: Props) {
  const [garage, setGarage]         = useState<PlayerGarage>({ cars: [], parts: [], activeCar: null });
  const [loading, setLoading]       = useState(true);
  const [selectedCar, setSelectedCar] = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [confirmAction, setConfirmAction] = useState<"sell" | "scrap" | null>(null);
  const [busy, setBusy]             = useState(false);
  // Pending part selections for the currently-open car (before saving tune)
  const [pendingParts, setPendingParts] = useState<Record<string, string | null>>({});

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const loadGarage = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ garage: PlayerGarage }>("/garage");
      setGarage(data.garage);
      if (!selectedCar && data.garage.activeCar) setSelectedCar(data.garage.activeCar);
    } catch (err: any) {
      showToast(err.message ?? "Failed to load garage", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadGarage(); }, [loadGarage]);

  const activeCarObj = garage.cars.find(c => c.carId === selectedCar) ?? null;

  useEffect(() => {
    if (activeCarObj) {
      setPendingParts({ ...activeCarObj.equippedParts });
    }
  }, [selectedCar]); // eslint-disable-line react-hooks/exhaustive-deps

  async function selectActiveCar(carId: string) {
    setBusy(true);
    try {
      await api.post("/garage/select", { carId });
      setGarage(prev => ({ ...prev, activeCar: carId }));
      showToast("Active car updated!");
    } catch (err: any) {
      showToast(err.message ?? "Failed to select car", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveTune() {
    if (!activeCarObj) return;
    setBusy(true);
    try {
      const data = await api.post<{ car: OwnedCar }>("/garage/tune", { carId: activeCarObj.carId, equippedParts: pendingParts });
      await loadGarage();
      showToast("Car tuned!");
    } catch (err: any) {
      showToast(err.message ?? "Failed to tune car", "error");
    } finally {
      setBusy(false);
    }
  }

  async function setCustomization(field: "paint" | "underglow" | "decals" | "rims", value: string) {
    if (!activeCarObj) return;
    setBusy(true);
    try {
      await api.post("/garage/tune", { carId: activeCarObj.carId, customization: { [field]: value } });
      await loadGarage();
      showToast("Customization updated!");
    } catch (err: any) {
      showToast(err.message ?? "Failed to customize car", "error");
    } finally {
      setBusy(false);
    }
  }

  async function sellCar() {
    if (!activeCarObj) return;
    setBusy(true);
    try {
      const data = await api.post<{ message: string; dcGained: number }>("/garage/sell", { carId: activeCarObj.carId });
      showToast(data.message);
      setSelectedCar(null);
      await loadGarage();
      onUserUpdate({ ...user, dc: user.dc + data.dcGained });
    } catch (err: any) {
      showToast(err.message ?? "Failed to sell car", "error");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  async function scrapCar() {
    if (!activeCarObj) return;
    setBusy(true);
    try {
      const data = await api.post<{ message: string }>("/garage/scrap", { carId: activeCarObj.carId });
      showToast(data.message);
      setSelectedCar(null);
      await loadGarage();
    } catch (err: any) {
      showToast(err.message ?? "Failed to scrap car", "error");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  // Preview stats with pending (unsaved) part selections applied
  function previewStats(): CarStats | null {
    if (!activeCarObj?.def) return null;
    const base = activeCarObj.def.baseStats;
    const total = { ...base };
    for (const slot of PART_SLOTS) {
      const partId = pendingParts[slot.key];
      if (!partId) continue;
      const stack = garage.parts.find(p => p.partId === partId);
      const boost = stack?.def?.statBoost;
      if (!boost) continue;
      total.topSpeed     = Math.min(100, total.topSpeed     + (boost.topSpeed ?? 0));
      total.acceleration = Math.min(100, total.acceleration + (boost.acceleration ?? 0));
      total.handling     = Math.min(100, total.handling     + (boost.handling ?? 0));
      total.nitro        = Math.min(100, total.nitro        + (boost.nitro ?? 0));
    }
    return total;
  }

  const preview = previewStats();
  const dirty = activeCarObj && JSON.stringify(pendingParts) !== JSON.stringify(activeCarObj.equippedParts);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "monospace", fontSize: 20, color: "#00d4ff", fontWeight: "bold", letterSpacing: 2 }}>🏎 GARAGE</h1>
        <p style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>Manage your cars, tune parts, and get ready to race</p>
      </div>

      {toast && (
        <div style={{
          marginBottom: 16, padding: "8px 12px", borderRadius: 8, fontFamily: "monospace", fontSize: 11,
          background: toast.type === "success" ? "#22c55e18" : "#ef444418",
          border: `1px solid ${toast.type === "success" ? "#22c55e60" : "#ef444460"}`,
          color: toast.type === "success" ? "#22c55e" : "#ef4444",
        }}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, fontFamily: "monospace", color: "#475569" }}>Loading...</div>
      ) : garage.cars.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🚗</div>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: "#475569" }}>No cars yet</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#374151", marginTop: 8 }}>Spin the Racing Royale to win your first car</div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {/* Car list */}
          <div style={{ flex: "1 1 220px", minWidth: 220 }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Your Cars ({garage.cars.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {garage.cars.map(car => {
                const def = car.def;
                const color = def ? TIER_COLORS[def.tier] ?? "#6b7280" : "#6b7280";
                const isSelected = selectedCar === car.carId;
                const isActive = garage.activeCar === car.carId;
                return (
                  <button
                    key={car.carId}
                    onClick={() => setSelectedCar(car.carId)}
                    style={{
                      textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      background: isSelected ? `${color}18` : "#0a0a14",
                      border: `1px solid ${isSelected ? color : "#1e293b"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: isSelected ? color : "#e2e8f0" }}>
                        {def?.name ?? car.carId}
                      </span>
                      {isActive && <span style={{ fontFamily: "monospace", fontSize: 9, color: "#22c55e" }}>● ACTIVE</span>}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color }}>{def?.tier.toUpperCase() ?? ""}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Car detail */}
          {activeCarObj && (
            <div style={{ flex: "2 1 380px", minWidth: 300 }}>
              <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#e2e8f0" }}>{activeCarObj.def?.name ?? activeCarObj.carId}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", marginTop: 2 }}>{activeCarObj.def?.flavorText}</div>
                  </div>
                  {garage.activeCar !== activeCarObj.carId ? (
                    <button
                      disabled={busy}
                      onClick={() => selectActiveCar(activeCarObj.carId)}
                      style={{ padding: "6px 12px", borderRadius: 8, fontFamily: "monospace", fontSize: 10, fontWeight: "bold", cursor: "pointer", background: "#00d4ff18", border: "1px solid #00d4ff60", color: "#00d4ff", whiteSpace: "nowrap" }}
                    >
                      Set Active
                    </button>
                  ) : (
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#22c55e", whiteSpace: "nowrap" }}>● Active</span>
                  )}
                </div>

                {/* Stats preview */}
                {preview && (
                  <div style={{ marginBottom: 8 }}>
                    <StatBar label="Top Speed"     value={preview.topSpeed}     color="#00d4ff" />
                    <StatBar label="Acceleration"  value={preview.acceleration} color="#f59e0b" />
                    <StatBar label="Handling"      value={preview.handling}     color="#a855f7" />
                    <StatBar label="Nitro"         value={preview.nitro}        color="#ef4444" />
                  </div>
                )}
              </div>

              {/* Tuning */}
              <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Tuning</div>
                {PART_SLOTS.map(slot => {
                  const owned = garage.parts.filter(p => p.def?.partType === slot.key && p.quantity > 0);
                  const equippedId = pendingParts[slot.key] ?? null;
                  return (
                    <div key={slot.key} style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginBottom: 4 }}>{slot.label}</div>
                      <select
                        value={equippedId ?? ""}
                        onChange={e => setPendingParts(prev => ({ ...prev, [slot.key]: e.target.value || null }))}
                        style={{
                          width: "100%", padding: "6px 8px", borderRadius: 6, fontFamily: "monospace", fontSize: 11,
                          background: "#0a0a14", border: "1px solid #1e293b", color: "#e2e8f0",
                        }}
                      >
                        <option value="">— None —</option>
                        {owned.map(p => (
                          <option key={p.partId} value={p.partId}>
                            {p.def?.name ?? p.partId} {p.quantity > 1 ? `×${p.quantity}` : ""}
                          </option>
                        ))}
                      </select>
                      {owned.length === 0 && (
                        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#374151", marginTop: 2 }}>No {slot.label.toLowerCase()} parts owned</div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={saveTune}
                  disabled={busy || !dirty}
                  style={{
                    width: "100%", marginTop: 6, padding: "10px", borderRadius: 8, fontFamily: "monospace", fontSize: 12,
                    fontWeight: "bold", cursor: dirty ? "pointer" : "default", opacity: dirty ? 1 : 0.4,
                    background: "#00d4ff18", border: "1px solid #00d4ff60", color: "#00d4ff",
                  }}
                >
                  💾 Save Tune
                </button>
              </div>

              {/* Customization */}
              <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Customization</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginBottom: 4 }}>Paint</div>
                    <input type="color" defaultValue={activeCarObj.customization.paint} onBlur={e => setCustomization("paint", e.target.value)} style={{ width: "100%", height: 30, borderRadius: 6, border: "1px solid #1e293b", background: "#0a0a14" }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginBottom: 4 }}>Underglow</div>
                    <input type="color" defaultValue={activeCarObj.customization.underglow} onBlur={e => setCustomization("underglow", e.target.value)} style={{ width: "100%", height: 30, borderRadius: 6, border: "1px solid #1e293b", background: "#0a0a14" }} />
                  </div>
                </div>
              </div>

              {/* Sell / Scrap */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setConfirmAction("sell")}
                  disabled={busy}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, fontFamily: "monospace", fontSize: 11, fontWeight: "bold", cursor: "pointer", background: "#f59e0b18", border: "1px solid #f59e0b60", color: "#f59e0b" }}
                >
                  💰 Sell
                </button>
                <button
                  onClick={() => setConfirmAction("scrap")}
                  disabled={busy}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, fontFamily: "monospace", fontSize: 11, fontWeight: "bold", cursor: "pointer", background: "#ef444418", border: "1px solid #ef444460", color: "#ef4444" }}
                >
                  🔧 Scrap
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {confirmAction === "sell" && activeCarObj && (
        <ConfirmModal
          title="Sell this car?"
          body={`Sell ${activeCarObj.def?.name ?? activeCarObj.carId} for DC. This cannot be undone.`}
          confirmLabel="Sell"
          confirmColor="#f59e0b"
          onConfirm={sellCar}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "scrap" && activeCarObj && (
        <ConfirmModal
          title="Scrap this car?"
          body={`Break down ${activeCarObj.def?.name ?? activeCarObj.carId} into tuning parts. This cannot be undone.`}
          confirmLabel="Scrap"
          confirmColor="#ef4444"
          onConfirm={scrapCar}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
