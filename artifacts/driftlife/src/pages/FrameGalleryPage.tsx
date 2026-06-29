import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { RARITY_COLORS, RARITY_ORDER, FrameRarity } from "../lib/frames";
import { PlayerFrame } from "../components/PlayerFrame";
import { FrameCardWrapper } from "../components/FrameCardWrapper";
import { User } from "../lib/types";

interface Frame {
  frameId: string;
  displayName: string;
  rarity: FrameRarity;
  glowColor: string;
  animationType: string;
  price: number;
  originalPrice: number;
  isOnSale: boolean;
  currency: string;
  isFree: boolean;
  description?: string;
  owned: boolean;
  equipped: boolean;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RARITY_LABELS: Record<FrameRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

const CURRENCY_LABELS: Record<string, string> = { dc: "DC", merit: "M", nc: "NC" };

function DummyAvatar({ color }: { color: string }) {
  return (
    <div style={{ width: "100%", height: "100%", background: "#111118", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill={color + "60"} />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color + "60"} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

function DummyCard({ color, name }: { color: string; name: string }) {
  return (
    <div style={{
      background: "#0a0a0f",
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minHeight: 64,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 2,
          background: color + "20",
          border: `1px solid ${color}40`,
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: color + "60" }} />
        </div>
        <div>
          <div className="font-mono font-bold" style={{ color, fontSize: 11 }}>RUNNER</div>
          <div className="font-mono" style={{ color: "#334155", fontSize: 9 }}>LVL 25 — NEW VANTA</div>
        </div>
      </div>
      <div className="font-mono" style={{ color: "#475569", fontSize: 9, marginTop: 2 }}>
        {name} frame preview
      </div>
    </div>
  );
}

export function FrameGalleryPage({ user, refreshUser, addToast }: Props) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRarity, setActiveRarity] = useState<FrameRarity>("common");
  const [buying, setBuying] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);

  useEffect(() => {
    api.get<Frame[]>("/frames").then(data => {
      setFrames(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleBuy = async (frameId: string, price: number, currency: string) => {
    setBuying(frameId);
    try {
      const res = await api.post<{ message: string }>(`/frames/purchase/${frameId}`, {});
      addToast(res.message, "success");
      const updated = await api.get<Frame[]>("/frames");
      setFrames(updated);
      await refreshUser();
    } catch (e: any) {
      addToast(e.message || "Purchase failed", "error");
    } finally {
      setBuying(null);
    }
  };

  const handleEquip = async (frameId: string) => {
    setEquipping(frameId);
    try {
      await api.post(`/frames/equip/${frameId}`, {});
      addToast("Frame equipped", "success");
      const updated = await api.get<Frame[]>("/frames");
      setFrames(updated);
      await refreshUser();
    } catch (e: any) {
      addToast(e.message || "Equip failed", "error");
    } finally {
      setEquipping(null);
    }
  };

  const filtered = frames.filter(f => f.rarity === activeRarity);

  const rarityTabColor = (r: FrameRarity) => RARITY_COLORS[r];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="font-mono font-bold" style={{ color: "#00d4ff", fontSize: 18, letterSpacing: "0.12em", marginBottom: 4 }}>
        FRAME GALLERY
      </div>
      <div className="font-mono" style={{ color: "#475569", fontSize: 11, marginBottom: 20 }}>
        Preview every frame before you buy. See how they look on your avatar and on stat cards.
      </div>

      {/* Rarity tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {RARITY_ORDER.map(r => {
          const active = activeRarity === r;
          const col = rarityTabColor(r);
          return (
            <button
              key={r}
              onClick={() => setActiveRarity(r)}
              className="font-mono"
              style={{
                padding: "5px 14px",
                border: `1px solid ${active ? col : col + "40"}`,
                background: active ? col + "18" : "transparent",
                color: active ? col : col + "80",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: active ? "bold" : "normal",
                letterSpacing: "0.08em",
                transition: "all 0.15s",
                boxShadow: active ? `0 0 10px ${col}30` : "none",
              }}
            >
              {RARITY_LABELS[r]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="font-mono" style={{ color: "#334155", textAlign: "center", padding: 40 }}>
          Loading frames...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map(frame => {
            const rarityColor = RARITY_COLORS[frame.rarity];
            const col = frame.glowColor;
            const isOwned = frame.owned;
            const isEquipped = frame.equipped;

            return (
              <div
                key={frame.frameId}
                style={{
                  background: "#111118",
                  border: `1px solid ${isOwned ? col + "40" : "#1e1e2e"}`,
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: isOwned ? `0 0 14px ${col}18` : "none",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header */}
                <div style={{
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: `1px solid ${col}20`,
                  background: col + "0c",
                }}>
                  <div>
                    <div className="font-mono font-bold" style={{ color: col, fontSize: 13, letterSpacing: "0.06em" }}>
                      {frame.displayName}
                    </div>
                    <div className="font-mono" style={{ color: rarityColor, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 1 }}>
                      {RARITY_LABELS[frame.rarity]}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {isOwned && (
                      <span className="font-mono" style={{
                        fontSize: 9, padding: "2px 7px", borderRadius: 3,
                        background: "#39d35318", border: "1px solid #39d35340", color: "#39d353",
                        letterSpacing: "0.08em",
                      }}>
                        OWNED
                      </span>
                    )}
                    {isEquipped && (
                      <span className="font-mono" style={{
                        fontSize: 9, padding: "2px 7px", borderRadius: 3,
                        background: "#00d4ff18", border: "1px solid #00d4ff40", color: "#00d4ff",
                        letterSpacing: "0.08em",
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>

                {/* Previews */}
                <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {/* Avatar frame preview */}
                  <div style={{ flexShrink: 0 }}>
                    <div className="font-mono" style={{ color: "#334155", fontSize: 9, marginBottom: 5, letterSpacing: "0.08em" }}>AVATAR</div>
                    <PlayerFrame frameId={frame.frameId} size="xl">
                      <DummyAvatar color={col} />
                    </PlayerFrame>
                  </div>

                  {/* Card frame preview */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-mono" style={{ color: "#334155", fontSize: 9, marginBottom: 5, letterSpacing: "0.08em" }}>STAT CARD</div>
                    <FrameCardWrapper frameId={frame.frameId} borderRadius={6}>
                      <DummyCard color={col} name={frame.displayName} />
                    </FrameCardWrapper>
                  </div>
                </div>

                {/* Price + action */}
                <div style={{
                  padding: "8px 12px",
                  borderTop: `1px solid ${col}14`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "auto",
                }}>
                  <div>
                    {frame.isFree ? (
                      <span className="font-mono" style={{ color: "#39d353", fontSize: 12, fontWeight: "bold" }}>FREE</span>
                    ) : frame.isOnSale ? (
                      <div>
                        <span className="font-mono" style={{ color: "#ff6b35", fontSize: 12, fontWeight: "bold" }}>
                          {frame.price.toLocaleString()} {CURRENCY_LABELS[frame.currency] || frame.currency}
                        </span>
                        <span className="font-mono" style={{ color: "#475569", fontSize: 10, textDecoration: "line-through", marginLeft: 5 }}>
                          {frame.originalPrice.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono" style={{ color: "#94a3b8", fontSize: 12, fontWeight: "bold" }}>
                        {frame.price.toLocaleString()} {CURRENCY_LABELS[frame.currency] || frame.currency}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    {isOwned && !isEquipped && (
                      <button
                        onClick={() => handleEquip(frame.frameId)}
                        disabled={equipping === frame.frameId}
                        className="font-mono"
                        style={{
                          padding: "4px 12px", borderRadius: 4, cursor: "pointer",
                          background: col + "20", border: `1px solid ${col}50`,
                          color: col, fontSize: 11, fontWeight: "bold",
                          opacity: equipping === frame.frameId ? 0.5 : 1,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {equipping === frame.frameId ? "..." : "EQUIP"}
                      </button>
                    )}
                    {isEquipped && (
                      <div className="font-mono" style={{
                        padding: "4px 12px", borderRadius: 4,
                        background: col + "10", border: `1px solid ${col}30`,
                        color: col + "80", fontSize: 11,
                      }}>
                        EQUIPPED
                      </div>
                    )}
                    {!isOwned && !frame.isFree && (
                      <button
                        onClick={() => handleBuy(frame.frameId, frame.price, frame.currency)}
                        disabled={buying === frame.frameId}
                        className="font-mono"
                        style={{
                          padding: "4px 12px", borderRadius: 4, cursor: "pointer",
                          background: "#00d4ff18", border: "1px solid #00d4ff40",
                          color: "#00d4ff", fontSize: 11, fontWeight: "bold",
                          opacity: buying === frame.frameId ? 0.5 : 1,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {buying === frame.frameId ? "..." : "BUY"}
                      </button>
                    )}
                    {!isOwned && frame.isFree && (
                      <button
                        onClick={() => handleEquip(frame.frameId)}
                        disabled={equipping === frame.frameId}
                        className="font-mono"
                        style={{
                          padding: "4px 12px", borderRadius: 4, cursor: "pointer",
                          background: "#39d35318", border: "1px solid #39d35340",
                          color: "#39d353", fontSize: 11, fontWeight: "bold",
                          opacity: equipping === frame.frameId ? 0.5 : 1,
                        }}
                      >
                        {equipping === frame.frameId ? "..." : "EQUIP"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div className="font-mono" style={{ color: "#334155", fontSize: 12, gridColumn: "1/-1", textAlign: "center", padding: 40 }}>
              No {activeRarity} frames available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
