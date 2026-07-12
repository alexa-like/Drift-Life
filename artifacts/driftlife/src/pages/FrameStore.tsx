// ─── Frame Store ──────────────────────────────────────────────────────────────
// Gallery where players browse and buy frames with NC.
// Owned frames are HIDDEN from this listing — they live in the Frame Locker.
// Equipping/unequipping happens only in the Frame Locker (Profile → Frames tab).

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { FRAMES, RARITY_COLOR, RARITY_LABEL, getFrame, enrichFrames, type FrameWithStatus } from "../lib/chatFrames";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { ChatFrame } from "../components/ChatFrame";
import { FrameProfilePreview } from "./FrameProfilePreview";

interface Props {
  user: User;
  refreshUser: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

type RarityFilter = "all" | "elite" | "legendary" | "mythic";

export function FrameStore({ user, refreshUser, addToast }: Props) {
  const [owned, setOwned]   = useState<string[]>(user.ownedChatFrames || []);
  const [equipped, setEquipped] = useState<string | null>(user.equippedChatFrame || null);
  const [nc, setNc]         = useState(user.nc);
  const [buying, setBuying] = useState<string | null>(null);
  const [filter, setFilter] = useState<RarityFilter>("all");
  const [previewProfileFor, setPreviewProfileFor] = useState<string | null>(null);
  const [previewAsOther, setPreviewAsOther] = useState(false);

  // Fetch fresh state on mount
  useEffect(() => {
    api.get<{ owned: string[]; equipped: string | null; nc: number }>("/chatframes")
      .then(d => { setOwned(d.owned); setEquipped((d as any).equipped); setNc(d.nc); })
      .catch(() => {});
  }, []);

  // Build enriched frames, filter out owned ones
  const allFrames = enrichFrames(FRAMES, owned, equipped);
  const storeFrames = allFrames.filter(f => !f.owned);
  const filtered = filter === "all" ? storeFrames : storeFrames.filter(f => f.rarity === filter);

  const eliteCount = storeFrames.filter(f => f.rarity === "elite").length;
  const legendaryCount = storeFrames.filter(f => f.rarity === "legendary").length;
  const mythicCount = storeFrames.filter(f => f.rarity === "mythic").length;
  const storeEmpty = storeFrames.length === 0;

  async function buy(frameId: string) {
    setBuying(frameId);
    try {
      const res = await api.post<{ message: string; nc: number; owned: string[] }>(
        `/chatframes/buy/${frameId}`
      );
      setOwned(res.owned);
      setNc(res.nc);
      addToast("Frame unlocked!", "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message || "Purchase failed", "error");
    } finally {
      setBuying(null);
    }
  }

  if (previewProfileFor) {
    const previewFrame = getFrame(previewProfileFor);
    if (previewFrame) {
      return (
        <FrameProfilePreview
          frame={previewFrame}
          user={user}
          nc={nc}
          onBack={() => setPreviewProfileFor(null)}
          onBuy={() => buy(previewProfileFor)}
          buying={buying === previewProfileFor}
          alreadyOwned={owned.includes(previewProfileFor)}
          canAfford={nc >= previewFrame.priceNC}
        />
      );
    }
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <CyberSectionHeader
        title="FRAME STORE"
        accent="#00E0FF"
        cursor
        right={
          !storeEmpty ? (
            <span className="font-mono text-xs" style={{ color: "#00E0FF" }}>
              {nc.toLocaleString()} NC
            </span>
          ) : undefined
        }
      />

      {/* Filter tabs — always visible, show (0) when store is empty */}
      <div className="flex items-center gap-3 flex-wrap">
        {(["all", "elite", "legendary", "mythic"] as RarityFilter[]).map(r => {
          const color = r === "all" ? "#94a3b8" : RARITY_COLOR[r as "elite" | "legendary" | "mythic"];
          const count = r === "all" ? storeFrames.length : r === "elite" ? eliteCount : r === "legendary" ? legendaryCount : mythicCount;
          const isActive = filter === r;
          return (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className="font-mono text-xs px-3 py-1 rounded transition-colors"
              style={{
                background: isActive ? `${color}18` : "transparent",
                color: isActive ? color : "#475569",
                border: `1px solid ${isActive ? `${color}50` : "#1e1e2e"}`,
              }}
            >
              {r === "all" ? "ALL" : RARITY_LABEL[r as "elite" | "legendary" | "mythic"]}
              <span style={{ marginLeft: 4, opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}

        {/* Preview toggle — only when there's something to preview */}
        {!storeEmpty && (
          <>
            <div className="flex-1" />
            <label className="flex items-center gap-2 cursor-pointer font-mono text-xs" style={{ color: "#475569" }}>
              <input
                type="checkbox"
                checked={previewAsOther}
                onChange={e => setPreviewAsOther(e.target.checked)}
                style={{ accentColor: "#00E0FF" }}
              />
              Preview as others see you
            </label>
          </>
        )}
      </div>

      {/* Empty state */}
      {storeEmpty && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 40, textAlign: "center" }}>
          <div className="font-mono text-sm mb-2" style={{ color: "#e2e8f0" }}>
            You own every frame in the store.
          </div>
          <div className="font-mono text-xs" style={{ color: "#475569" }}>
            Check back when new frames drop.
          </div>
        </div>
      )}

      {/* Frame list */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map(frame => {
            const rarityColor = RARITY_COLOR[frame.rarity];
            const isBuying = buying === frame.id;
            const canAfford = nc >= frame.priceNC;

            return (
              <motion.div
                key={frame.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{
                  background: "#111118",
                  border: `1px solid #1e1e2e`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {/* Rarity label top-right */}
                <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                  <span className="font-mono text-sm font-bold flex-1" style={{ color: "#e2e8f0" }}>
                    {frame.name}
                  </span>
                  <span
                    className="font-mono px-2 py-0.5 rounded"
                    style={{ fontSize: 10, background: `${rarityColor}18`, color: rarityColor, border: `1px solid ${rarityColor}40` }}
                  >
                    {RARITY_LABEL[frame.rarity]}
                  </span>
                </div>

                <div className="px-4 pb-1">
                  <span className="font-mono text-xs" style={{ color: "#64748b" }}>{frame.description}</span>
                </div>

                {/* Frame preview */}
                <div className="px-4 pb-3">
                  <ChatFrame
                    frame={frame}
                    username={previewAsOther ? "YourName" : user.username}
                    level={previewAsOther ? undefined : user.level}
                    size="preview"
                  >
                    {previewAsOther
                      ? "This is how their message looks to you."
                      : `Example message in the ${frame.name} frame.`}
                  </ChatFrame>
                </div>

                {/* Actions row */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: "1px solid #1e1e2e" }}
                >
                  <button
                    onClick={() => setPreviewProfileFor(frame.id)}
                    className="font-mono text-xs"
                    style={{ color: "#475569", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Preview on Profile
                  </button>
                  <div className="flex-1" />
                  {canAfford ? (
                    <CyberButton
                      size="sm"
                      variant="success"
                      loading={isBuying}
                      onClick={() => buy(frame.id)}
                    >
                      {frame.priceNC.toLocaleString()} NC
                    </CyberButton>
                  ) : (
                    <div style={{ textAlign: "right" }}>
                      <div className="font-mono text-xs" style={{ color: "#475569", opacity: 0.7 }}>
                        {frame.priceNC.toLocaleString()} NC
                      </div>
                      <div className="font-mono" style={{ fontSize: 9, color: "#ff4444" }}>Not enough NC</div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
