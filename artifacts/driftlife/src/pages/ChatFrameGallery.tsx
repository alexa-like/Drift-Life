import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { CHAT_FRAMES, FRAME_TIER_COLOR, FRAME_TIER_LABEL, getFrame } from "../lib/chatFrames";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { ChatFrameRenderer } from "../components/ChatFrameRenderer";

interface Props {
  user: User;
  refreshUser: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const TIERS = ["all", "standard", "rare", "elite", "legendary"] as const;

export function ChatFrameGallery({ user, refreshUser, addToast }: Props) {
  const [owned, setOwned] = useState<string[]>(user.ownedChatFrames || []);
  const [equipped, setEquipped] = useState<string | null>(user.equippedChatFrame || null);
  const [nc, setNc] = useState(user.nc);
  const [buying, setBuying] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ owned: string[]; equipped: string | null; nc: number }>("/chatframes")
      .then(d => { setOwned(d.owned); setEquipped(d.equipped); setNc(d.nc); })
      .catch(() => {});
  }, []);

  const filtered = tierFilter === "all" ? CHAT_FRAMES : CHAT_FRAMES.filter(f => f.tier === tierFilter);

  async function buy(frameId: string) {
    setBuying(frameId);
    try {
      const res = await api.post<{ message: string; nc: number; owned: string[] }>(`/chatframes/buy/${frameId}`);
      setOwned(res.owned);
      setNc(res.nc);
      addToast(res.message, "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message || "Purchase failed", "error");
    } finally {
      setBuying(null);
    }
  }

  async function equip(frameId: string) {
    const toEquip = equipped === frameId ? "none" : frameId;
    setEquipping(toEquip);
    try {
      const res = await api.post<{ message: string; equipped: string | null }>(`/chatframes/equip/${toEquip}`);
      setEquipped(res.equipped);
      addToast(res.message, "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message || "Failed to equip", "error");
    } finally {
      setEquipping(null);
    }
  }

  const equippedFrame = getFrame(equipped);
  const previewFrameData = getFrame(previewFrame);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <CyberSectionHeader
        title="CHAT FRAME GALLERY"
        accent="#a855f7"
        cursor
        right={
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs" style={{ color: "#a855f7" }}>
              {nc.toLocaleString()} UC
            </span>
          </div>
        }
      />

      <div className="font-mono text-xs" style={{ color: "#64748b" }}>
        Chat frames appear on your messages in Global, District, and Faction chat, as well as on your Feed posts and Profile.
      </div>

      {equipped && equippedFrame && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 }}>
          <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>CURRENTLY EQUIPPED</div>
          <div className="flex items-center gap-4 flex-wrap">
            <div style={{ flex: 1, minWidth: 200 }}>
              <ChatFrameRenderer
                frameId={equipped}
                username={user.username}
                level={user.level}
                timestamp={new Date().toISOString()}
              >
                This is how your messages look in chat!
              </ChatFrameRenderer>
            </div>
            <CyberButton size="sm" variant="ghost" onClick={() => equip(equipped)} loading={equipping === "none"}>
              Remove Frame
            </CyberButton>
          </div>
        </div>
      )}

      {previewFrameData && (
        <div style={{ background: "#111118", border: `1px solid ${FRAME_TIER_COLOR[previewFrameData.tier]}40`, borderRadius: 8, padding: 16 }}>
          <div className="flex justify-between items-center mb-3">
            <span className="font-mono text-xs" style={{ color: FRAME_TIER_COLOR[previewFrameData.tier] }}>
              PREVIEWING: {previewFrameData.name.toUpperCase()}
            </span>
            <button onClick={() => setPreviewFrame(null)} className="font-mono text-xs" style={{ color: "#475569" }}>✕ Close</button>
          </div>
          <ChatFrameRenderer
            frameId={previewFrame}
            username={user.username}
            level={user.level}
            timestamp={new Date().toISOString()}
          >
            Preview of how your messages look with this frame equipped.
          </ChatFrameRenderer>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TIERS.map(t => {
          const color = t === "all" ? "#94a3b8" : FRAME_TIER_COLOR[t];
          const isActive = tierFilter === t;
          const count = t === "all" ? CHAT_FRAMES.length : CHAT_FRAMES.filter(f => f.tier === t).length;
          return (
            <motion.button
              key={t}
              onClick={() => setTierFilter(t)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="font-mono text-xs px-3 py-1 rounded transition-colors"
              style={{
                background: isActive ? `${color}18` : "transparent",
                color: isActive ? color : "#475569",
                border: `1px solid ${isActive ? `${color}50` : "#1e1e2e"}`,
              }}
            >
              {t === "all" ? "ALL" : FRAME_TIER_LABEL[t]}
              <span style={{ marginLeft: 4, opacity: 0.6 }}>{count}</span>
            </motion.button>
          );
        })}
        <div className="flex-1" />
        <span className="font-mono text-xs self-center" style={{ color: "#64748b" }}>
          {owned.length}/{CHAT_FRAMES.length} owned
        </span>
      </div>

      <div className="space-y-3">
        {filtered.map(frame => {
          const isOwned = owned.includes(frame.id);
          const isEquipped = equipped === frame.id;
          const tierColor = FRAME_TIER_COLOR[frame.tier];
          const isBuying = buying === frame.id;
          const isEquipping = equipping === frame.id || equipping === "none";

          return (
            <motion.div
              key={frame.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "#111118",
                border: `1px solid ${isEquipped ? tierColor + "80" : "#1e1e2e"}`,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>
                      {frame.badge && <span style={{ marginRight: 4 }}>{frame.badge}</span>}
                      {frame.name}
                    </span>
                    <span
                      className="font-mono px-1.5 py-0.5 rounded"
                      style={{ fontSize: 9, background: tierColor + "20", color: tierColor, border: `1px solid ${tierColor}40` }}
                    >
                      {FRAME_TIER_LABEL[frame.tier]}
                    </span>
                    {isEquipped && (
                      <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 9, background: "#39d35320", color: "#39d353" }}>
                        EQUIPPED
                      </span>
                    )}
                    {isOwned && !isEquipped && (
                      <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 9, background: "#00d4ff20", color: "#00d4ff" }}>
                        OWNED
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>{frame.description}</div>

                  <ChatFrameRenderer
                    frameId={frame.id}
                    username={user.username}
                    level={user.level}
                    compact
                  >
                    Example chat frame of {frame.name}
                  </ChatFrameRenderer>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                  {isOwned ? (
                    <CyberButton
                      size="sm"
                      variant={isEquipped ? "ghost" : "primary"}
                      glow={!isEquipped}
                      loading={isEquipping}
                      onClick={() => equip(frame.id)}
                    >
                      {isEquipped ? "Unequip" : "Equip"}
                    </CyberButton>
                  ) : (
                    <CyberButton
                      size="sm"
                      variant="success"
                      loading={isBuying}
                      disabled={nc < frame.price}
                      onClick={() => buy(frame.id)}
                    >
                      {frame.price.toLocaleString()} UC
                    </CyberButton>
                  )}
                  <button
                    onClick={() => setPreviewFrame(previewFrame === frame.id ? null : frame.id)}
                    className="font-mono text-xs"
                    style={{ color: "#475569", background: "none", border: "none", cursor: "pointer" }}
                  >
                    {previewFrame === frame.id ? "Hide Preview" : "Preview"}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
