import { useState, useEffect } from "react";
import { User, Frame, ChatMessage } from "../lib/types";
import { api } from "../lib/api";
import { getFrame, RARITY_COLORS } from "../lib/frames";
import { formatDC } from "../lib/format";
import { PlayerFrame } from "../components/PlayerFrame";
import { FrameRectBubble } from "../components/FrameRectBubble";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const CURRENCY_LABELS: Record<string, string> = { dc: "DC", merit: "M", nc: "NC" };
const CURRENCY_COLORS: Record<string, string> = { dc: "#f59e0b", merit: "#39d353", nc: "#a855f7" };

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];

/** Builds a fake ChatMessage so FrameRectBubble can render a live frame preview */
function fakeMsg(frame: Frame, colorOverride?: string | null): ChatMessage {
  return {
    id: `preview-${frame.frameId}`,
    userId: "preview",
    username: "RUNNER",
    faction: null,
    frame: frame.frameId,
    frameColor: colorOverride ?? null,
    title: null,
    content: "You see the city from above, neon bleeding into rain...",
    at: "2047-01-01T00:47:00.000Z",
  };
}

export function FramesStorePage({ user, refreshUser, addToast }: Props) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [filterCurrency, setFilterCurrency] = useState<string>("all");
  const [filterOwned, setFilterOwned] = useState<"all" | "owned" | "not-owned">("all");
  const [searchQ, setSearchQ] = useState("");
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [customColor, setCustomColor] = useState("");
  const [savingColor, setSavingColor] = useState(false);

  const PRESET_COLORS = ["#00d4ff", "#ff6b35", "#ff2d55", "#39d353", "#a855f7", "#f59e0b", "#e879f9", "#22d3ee", "#fde047", "#e2e8f0", "#64748b", "#dc2626"];

  useEffect(() => {
    api.get<Frame[]>("/frames")
      .then(f => { setFrames(f); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function purchase(f: Frame) {
    const cost = f.price;
    const currency = f.currency;
    const bal = currency === "nc" ? user.nc : currency === "merit" ? (user.merit ?? 0) : user.dc;
    if (bal < cost) { addToast(`Not enough ${CURRENCY_LABELS[currency]}`, "error"); return; }
    if (!confirm(`Purchase ${f.displayName} for ${formatDC(cost)} ${CURRENCY_LABELS[currency]}?`)) return;
    setActing(f.frameId);
    try {
      const data = await api.post<any>(`/frames/purchase/${f.frameId}`);
      addToast(data.message, "success");
      setFrames(prev => prev.map(fr => fr.frameId === f.frameId ? { ...fr, owned: true } : fr));
      if (selectedFrame?.frameId === f.frameId) setSelectedFrame(prev => prev ? { ...prev, owned: true } : prev);
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  async function equip(frameId: string, surface?: "avatar" | "chat" | "feed") {
    setActing(frameId);
    try {
      if (surface) {
        await api.patch<any>("/user/me", { equippedFrames: { [surface]: frameId } });
        addToast(`${frameId === "ghostFrame" ? "Cleared" : "Equipped"} frame for ${surface}`, "success");
      } else {
        await api.post<any>(`/frames/equip/${frameId}`);
        addToast("Frame equipped on all surfaces", "success");
      }
      setFrames(prev => prev.map(f => ({
        ...f,
        equipped: surface ? f.equipped : f.frameId === frameId,
        equippedOn: surface
          ? f.frameId === frameId
            ? [...(f.equippedOn || []).filter(s => s !== surface), surface] as ("avatar" | "chat" | "feed")[]
            : (f.equippedOn || []).filter(s => s !== surface)
          : (f.frameId === frameId ? ["avatar", "chat", "feed"] as ("avatar" | "chat" | "feed")[] : []),
      })));
      if (selectedFrame) setSelectedFrame(prev => prev ? {
        ...prev,
        equipped: surface ? prev.equipped : prev.frameId === frameId,
      } : prev);
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  async function saveColor(color: string | null) {
    setSavingColor(true);
    try {
      await api.post<any>("/frames/color", { color });
      await refreshUser();
      addToast("Color saved", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSavingColor(false);
    }
  }

  const weeklyFree = frames.find(f => f.isWeeklyFree);

  let filtered = frames.filter(f => {
    if (filterRarity !== "all" && f.rarity !== filterRarity) return false;
    if (filterCurrency !== "all" && f.currency !== filterCurrency) return false;
    if (filterOwned === "owned" && !f.owned) return false;
    if (filterOwned === "not-owned" && f.owned) return false;
    if (searchQ && !f.displayName.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  filtered = filtered.sort((a, b) => {
    const ai = RARITY_ORDER.indexOf(a.rarity);
    const bi = RARITY_ORDER.indexOf(b.rarity);
    if (ai !== bi) return ai - bi;
    return a.price - b.price;
  });

  const owned = frames.filter(f => f.owned).length;
  const total = frames.filter(f => !f.mythicAliasOf).length;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 className="font-mono font-bold" style={{ color: "#00d4ff", fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Frame Store
        </h1>
        <div className="font-mono" style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>
          {owned}/{total} frames owned &nbsp;·&nbsp;
          <span style={{ color: "#f59e0b" }}>{formatDC(user.dc)} DC</span> &nbsp;
          <span style={{ color: "#39d353" }}>{(user.merit ?? 0).toLocaleString()} M</span> &nbsp;
          <span style={{ color: "#a855f7" }}>{user.nc} NC</span>
        </div>
      </div>

      {weeklyFree && !weeklyFree.owned && (
        <div style={{
          background: "#39d35315", border: "1px solid #39d35360", borderRadius: 8,
          padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div className="font-mono font-bold" style={{ color: "#39d353", fontSize: 12, letterSpacing: "0.08em" }}>
              FREE THIS WEEK: {weeklyFree.displayName}
            </div>
            <div className="font-mono text-xs" style={{ color: "#39d353", opacity: 0.7 }}>Claim your free frame</div>
          </div>
          <button
            onClick={() => equip(weeklyFree.frameId)}
            className="font-mono text-xs font-bold"
            style={{
              background: "#39d35320", border: "1px solid #39d353", borderRadius: 6,
              color: "#39d353", padding: "6px 14px", cursor: "pointer",
            }}
          >
            Equip Free
          </button>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Search frames..."
          className="font-mono text-xs"
          style={{
            width: "100%", background: "#111118", border: "1px solid #1e1e2e", borderRadius: 6,
            color: "#e2e8f0", padding: "8px 12px", outline: "none", boxSizing: "border-box", marginBottom: 8,
          }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...RARITY_ORDER].map(r => (
            <button key={r} onClick={() => setFilterRarity(r)} className="font-mono" style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
              background: filterRarity === r ? (RARITY_COLORS as any)[r] || "#00d4ff" : "#111118",
              color: filterRarity === r ? "#0a0a0f" : "#64748b",
              border: `1px solid ${filterRarity === r ? "transparent" : "#1e1e2e"}`,
              fontWeight: filterRarity === r ? "bold" : "normal", textTransform: "capitalize",
            }}>
              {r === "all" ? "All Rarities" : r}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {[["all", "All Currency"], ["dc", "DC"], ["merit", "Merit"], ["nc", "NC"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilterCurrency(val)} className="font-mono" style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
              background: filterCurrency === val ? CURRENCY_COLORS[val] || "#00d4ff" : "#111118",
              color: filterCurrency === val ? "#0a0a0f" : "#64748b",
              border: `1px solid ${filterCurrency === val ? "transparent" : "#1e1e2e"}`,
              fontWeight: filterCurrency === val ? "bold" : "normal",
            }}>{label}</button>
          ))}
          {[["all", "All"], ["owned", "Owned"], ["not-owned", "Not Owned"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilterOwned(val as any)} className="font-mono" style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
              background: filterOwned === val ? "#00d4ff" : "#111118",
              color: filterOwned === val ? "#0a0a0f" : "#64748b",
              border: `1px solid ${filterOwned === val ? "transparent" : "#1e1e2e"}`,
              fontWeight: filterOwned === val ? "bold" : "normal",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading frames...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {filtered.map(f => {
            const rarityColor = RARITY_COLORS[f.rarity] || "#94a3b8";
            const currencyColor = CURRENCY_COLORS[f.currency] || "#f59e0b";
            const isActing = acting === f.frameId;

            return (
              <div
                key={f.frameId}
                onClick={() => setSelectedFrame(prev => prev?.frameId === f.frameId ? null : f)}
                style={{
                  background: "#111118",
                  border: `1px solid ${selectedFrame?.frameId === f.frameId ? rarityColor + "80" : f.equipped ? "#00d4ff50" : "#1e1e2e"}`,
                  borderRadius: 8, overflow: "hidden", cursor: "pointer",
                  boxShadow: f.equipped ? "0 0 8px #00d4ff20" : "none",
                  transition: "border-color 0.2s",
                }}
              >
                <div style={{ position: "relative", padding: "4px 4px 0" }}>
                  <FrameRectBubble message={fakeMsg(f)} />
                  {/* NEW badge */}
                  {f.createdAt && (Date.now() - new Date(f.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000 && (
                    <span className="font-mono" style={{
                      position: "absolute", top: 6, right: 8, fontSize: 8, fontWeight: "bold",
                      background: "#00d4ff", color: "#0a0a0f",
                      padding: "1px 5px", borderRadius: 3, letterSpacing: "0.08em",
                      pointerEvents: "none",
                    }}>NEW</span>
                  )}
                </div>

                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 12 }}>{f.displayName}</span>
                    <span className="font-mono" style={{ color: rarityColor, fontSize: 9, textTransform: "capitalize", fontWeight: "bold" }}>
                      {f.rarity}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: currencyColor, fontSize: 11, fontWeight: "bold" }}>
                      {f.isFree ? "FREE" : f.isOnSale ? (
                        <>
                          <span style={{ textDecoration: "line-through", color: "#475569", marginRight: 4 }}>
                            {formatDC(f.originalPrice || f.price)}
                          </span>
                          {formatDC(f.price)} {CURRENCY_LABELS[f.currency]}
                        </>
                      ) : `${formatDC(f.price)} ${CURRENCY_LABELS[f.currency]}`}
                    </span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {f.isWeeklyFree && <span className="font-mono" style={{ fontSize: 8, color: "#39d353", background: "#39d35320", padding: "1px 4px", borderRadius: 3 }}>FREE</span>}
                      {f.isLimited && <span className="font-mono" style={{ fontSize: 8, color: "#ff6b35", background: "#ff6b3520", padding: "1px 4px", borderRadius: 3 }}>LIMITED</span>}
                      {f.isOnSale && <span className="font-mono" style={{ fontSize: 8, color: "#ff2d55", background: "#ff2d5520", padding: "1px 4px", borderRadius: 3 }}>SALE</span>}
                      {f.owned && <span className="font-mono" style={{ fontSize: 8, color: "#00d4ff", background: "#00d4ff15", padding: "1px 4px", borderRadius: 3 }}>OWNED</span>}
                      {f.equipped && <span className="font-mono" style={{ fontSize: 8, color: "#39d353", background: "#39d35315", padding: "1px 4px", borderRadius: 3 }}>EQUIPPED</span>}
                    </div>
                  </div>
                  {/* Countdown timer for limited-time frames */}
                  {f.isLimited && f.availableUntil && (() => {
                    const ms = new Date(f.availableUntil).getTime() - Date.now();
                    if (ms <= 0) return null;
                    const h = Math.floor(ms / 3600000);
                    const m = Math.floor((ms % 3600000) / 60000);
                    const d = Math.floor(h / 24);
                    const label = d > 0 ? `${d}d ${h % 24}h left` : `${h}h ${m}m left`;
                    return (
                      <div className="font-mono mt-1" style={{ fontSize: 9, color: "#ff6b35" }}>
                        {label}
                      </div>
                    );
                  })()}
                </div>

                {selectedFrame?.frameId === f.frameId && (
                  <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${rarityColor}20` }}>

                    {/* ── Live previews: AVATAR + CHAT ── */}
                    <div style={{ display: "flex", gap: 10, marginTop: 10, marginBottom: 10 }}>
                      {/* Avatar preview */}
                      <div style={{ flexShrink: 0 }}>
                        <div className="font-mono" style={{ fontSize: 9, color: "#334155", marginBottom: 4, letterSpacing: "0.08em" }}>AVATAR</div>
                        <PlayerFrame frameId={f.frameId} size="xl">
                          <div style={{ width: "100%", height: "100%", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="8" r="4" fill={(f.glowColor || rarityColor) + "50"} />
                              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={(f.glowColor || rarityColor) + "50"} strokeWidth="1.5" strokeLinecap="round" fill="none" />
                            </svg>
                          </div>
                        </PlayerFrame>
                      </div>

                      {/* Chat + about */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-mono" style={{ fontSize: 9, color: "#334155", marginBottom: 4, letterSpacing: "0.08em" }}>CHAT PREVIEW</div>
                        <FrameRectBubble message={fakeMsg(f)} />
                        <div className="font-mono" style={{ fontSize: 9, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                          {f.description}
                        </div>
                      </div>
                    </div>

                    {f.owned ? (
                      <>
                        {/* ── Per-surface equip ── */}
                        <div className="font-mono" style={{ fontSize: 9, color: "#475569", marginBottom: 5, letterSpacing: "0.08em" }}>EQUIP ON SURFACE</div>
                        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                          {(["avatar", "chat", "feed"] as const).map(surface => {
                            const isOn = (f.equippedOn || []).includes(surface);
                            return (
                              <button
                                key={surface}
                                onClick={e => { e.stopPropagation(); equip(f.frameId, surface); }}
                                disabled={!!isActing}
                                className="font-mono"
                                style={{
                                  flex: 1, padding: "5px 0", borderRadius: 5, fontSize: 9, fontWeight: "bold",
                                  cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
                                  background: isOn ? rarityColor + "25" : "#111118",
                                  border: `1px solid ${isOn ? rarityColor + "70" : "#1e1e2e"}`,
                                  color: isOn ? rarityColor : "#475569",
                                }}
                              >
                                {isActing ? "…" : (isOn ? "✓ " : "") + surface}
                              </button>
                            );
                          })}
                        </div>

                        {/* ── Frame color (shown when frame is equipped on any surface) ── */}
                        {(f.equippedOn || []).length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div className="font-mono" style={{ color: "#475569", fontSize: 9, marginBottom: 5, letterSpacing: "0.06em" }}>FRAME COLOR</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 5 }}>
                              {PRESET_COLORS.map(c => (
                                <button
                                  key={c}
                                  onClick={e => { e.stopPropagation(); saveColor(c); }}
                                  style={{
                                    width: 18, height: 18, borderRadius: 3, background: c, cursor: "pointer",
                                    border: user.equippedFrameColor === c ? "2px solid #fff" : "1px solid transparent",
                                  }}
                                />
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: 5 }}>
                              <input
                                value={customColor}
                                onChange={e => setCustomColor(e.target.value)}
                                placeholder="#RRGGBB"
                                onClick={e => e.stopPropagation()}
                                className="font-mono text-xs"
                                style={{
                                  flex: 1, background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 4,
                                  color: "#e2e8f0", padding: "4px 8px", outline: "none",
                                }}
                              />
                              <button
                                onClick={e => { e.stopPropagation(); if (/^#[0-9a-fA-F]{3,8}$/.test(customColor)) saveColor(customColor); }}
                                disabled={savingColor}
                                className="font-mono text-xs"
                                style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 4, color: "#e2e8f0", padding: "4px 10px", cursor: "pointer" }}
                              >
                                {savingColor ? "…" : "Set"}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); saveColor(null); }}
                                className="font-mono text-xs"
                                style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 4, color: "#475569", padding: "4px 8px", cursor: "pointer" }}
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); purchase(f); }}
                        disabled={isActing}
                        className="font-mono text-xs font-bold"
                        style={{
                          width: "100%", padding: "7px 0", borderRadius: 6, cursor: "pointer",
                          background: currencyColor + "20", border: `1px solid ${currencyColor}50`, color: currencyColor,
                        }}
                      >
                        {isActing ? "..." : f.isFree ? "Equip Free" : `Buy — ${formatDC(f.price)} ${CURRENCY_LABELS[f.currency]}`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>
          No frames match your filters
        </div>
      )}
    </div>
  );
}
