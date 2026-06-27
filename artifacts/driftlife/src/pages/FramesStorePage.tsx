import { useState, useEffect } from "react";
import { User, Frame } from "../lib/types";
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
  mythic: "#ff2d55",
};

const ANIM_LABEL: Record<string, string> = {
  static: "Static",
  shimmer: "Shimmer",
  pulse: "Pulse",
  rotate: "Rotate",
  flicker: "Flicker",
  matrix: "Matrix",
};

export function FramesStorePage({ user, refreshUser, addToast }: Props) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [filterRarity, setFilterRarity] = useState<string>("all");

  useEffect(() => {
    api.get<Frame[]>("/frames").then(f => { setFrames(f); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function purchase(frameId: string, cost: number, currency: string) {
    const bal = currency === "nc" ? user.nc : user.dc;
    if (bal < cost) { addToast(`Not enough ${currency.toUpperCase()}`, "error"); return; }
    if (!confirm(`Purchase frame for ${cost.toLocaleString()} ${currency.toUpperCase()}?`)) return;
    setActing(frameId);
    try {
      const data = await api.post<any>(`/frames/purchase/${frameId}`);
      addToast(data.message, "success");
      setFrames(prev => prev.map(f => f.frameId === frameId ? { ...f, owned: true } : f));
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  async function equip(frameId: string) {
    setActing(frameId);
    try {
      const data = await api.post<any>(`/frames/equip/${frameId}`);
      addToast(data.message, "success");
      setFrames(prev => prev.map(f => ({ ...f, equipped: f.frameId === frameId })));
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  const rarities = ["all", "common", "uncommon", "rare", "epic", "legendary", "mythic"];
  const filtered = filterRarity === "all" ? frames : frames.filter(f => f.rarity === filterRarity);
  const owned = frames.filter(f => f.owned).length;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-mono font-bold" style={{ color: "#a855f7" }}>Frame Store</h2>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#64748b" }}>
            Owned: {owned}/{frames.length} — Balance: {user.dc.toLocaleString()} DC / {user.nc.toLocaleString()} NC
          </p>
        </div>
      </div>

      {/* Rarity filter */}
      <div className="flex gap-1.5 flex-wrap">
        {rarities.map(r => {
          const color = RARITY_COLORS[r] ?? "#94a3b8";
          const active = filterRarity === r;
          return (
            <button
              key={r}
              onClick={() => setFilterRarity(r)}
              className="px-2.5 py-1 rounded font-mono capitalize"
              style={{
                fontSize: 11,
                background: active ? (r === "all" ? "#ffffff10" : color + "18") : "transparent",
                color: active ? (r === "all" ? "#e2e8f0" : color) : "#475569",
                border: `1px solid ${active ? (r === "all" ? "#ffffff30" : color + "50") : "#1e1e2e"}`,
              }}
            >
              {r}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#475569" }}>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(frame => {
            const color = RARITY_COLORS[frame.rarity] ?? "#94a3b8";
            return (
              <div
                key={frame.frameId}
                className="rounded-lg p-4 flex items-center gap-4"
                style={{
                  background: "#111118",
                  border: `1px solid ${frame.equipped ? color + "70" : frame.owned ? color + "30" : "#1e1e2e"}`,
                }}
              >
                {/* Frame preview */}
                <div
                  className="flex-shrink-0 rounded-full flex items-center justify-center font-mono font-bold"
                  style={{
                    width: 56, height: 56,
                    border: `3px solid ${color}`,
                    boxShadow: frame.equipped ? `0 0 12px ${color}60` : `0 0 4px ${color}30`,
                    background: color + "10",
                    color,
                    fontSize: 18,
                  }}
                >
                  {frame.animationType === "matrix" ? "M" :
                   frame.animationType === "flicker" ? "F" :
                   frame.animationType === "rotate" ? "R" :
                   frame.animationType === "pulse" ? "P" :
                   frame.animationType === "shimmer" ? "S" : "•"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{frame.displayName}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded capitalize" style={{ color, background: color + "15" }}>
                      {frame.rarity}
                    </span>
                    {frame.equipped && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#39d35320", color: "#39d353" }}>
                        equipped
                      </span>
                    )}
                    {frame.isFree && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#00d4ff10", color: "#00d4ff" }}>
                        free
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono" style={{ color: "#64748b" }}>
                    {ANIM_LABEL[frame.animationType]} · {frame.description}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                  {!frame.owned ? (
                    <button
                      onClick={() => purchase(frame.frameId, frame.price, frame.currency)}
                      disabled={acting === frame.frameId}
                      className="px-3 py-1.5 rounded font-mono text-xs font-bold"
                      style={{
                        background: color + "18",
                        color,
                        border: `1px solid ${color}40`,
                      }}
                    >
                      {acting === frame.frameId ? "..." : `${frame.isFree ? "Claim" : `${frame.price.toLocaleString()} ${frame.currency.toUpperCase()}`}`}
                    </button>
                  ) : !frame.equipped ? (
                    <button
                      onClick={() => equip(frame.frameId)}
                      disabled={acting === frame.frameId}
                      className="px-3 py-1.5 rounded font-mono text-xs font-bold"
                      style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}
                    >
                      {acting === frame.frameId ? "..." : "Equip"}
                    </button>
                  ) : (
                    <span className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#39d353", border: "1px solid #39d35330" }}>
                      Active
                    </span>
                  )}
                  {!frame.isFree && (
                    <div className="font-mono text-xs" style={{ color: "#334155" }}>
                      {frame.currency === "nc" ? "NC" : "DC"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
