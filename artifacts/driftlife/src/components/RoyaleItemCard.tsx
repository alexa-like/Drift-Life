import { useState } from "react";
import { CardArt } from "./CardArt";

export interface RoyaleWonItem {
  name: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
  itemType: string;
  imageCard: string;
  reward: Record<string, unknown>;
}

const TIER_STYLES: Record<string, { border: string; glow: string; label: string; bg: string }> = {
  common:    { border: "#6b7280", glow: "#6b728040", label: "#9ca3af", bg: "#1a1a1a" },
  uncommon:  { border: "#22c55e", glow: "#22c55e40", label: "#4ade80", bg: "#0f1a10" },
  rare:      { border: "#3b82f6", glow: "#3b82f660", label: "#60a5fa", bg: "#0d1525" },
  epic:      { border: "#a855f7", glow: "#a855f780", label: "#c084fc", bg: "#150e25" },
  legendary: { border: "#f59e0b", glow: "#f59e0b80", label: "#fbbf24", bg: "#1a1100" },
};

function rewardSummary(reward: Record<string, unknown>): string {
  const parts: string[] = [];
  if (reward.dc)             parts.push(`+${Number(reward.dc).toLocaleString()} DC`);
  if (reward.keys)           parts.push(`+${reward.keys} Key${Number(reward.keys) > 1 ? "s" : ""}`);
  if (reward.keyShards)      parts.push(`+${reward.keyShards} Shards`);
  if (reward.xp)             parts.push(`+${Number(reward.xp).toLocaleString()} XP`);
  if (reward.energyAmount)   parts.push(`+${reward.energyAmount} Energy`);
  if (reward.energyMaxBoost) parts.push(`+${reward.energyMaxBoost} Max Energy`);
  if (reward.spinTokens)     parts.push(`${reward.spinTokens} Spin Token${Number(reward.spinTokens) > 1 ? "s" : ""}`);
  if (reward.titleId)        parts.push("Title Unlocked");
  if (reward.badgeId)        parts.push("Badge Unlocked");
  if (reward.carId)          parts.push("Car Added");
  if (reward.carPartId)      parts.push("Car Part Added");
  if (reward.miniGameItemId) parts.push("Combat Item");
  if (reward.lootCrateTier)  parts.push(`${String(reward.lootCrateTier).charAt(0).toUpperCase() + String(reward.lootCrateTier).slice(1)} Crate`);
  return parts.join(" • ") || "Reward";
}

const TYPE_ICON: Record<string, string> = {
  currency_dc: "💰", currency_keys: "🗝️", currency_shards: "🔮",
  energy_drink: "⚡", energy_max_boost: "🔋", xp_boost: "⬆️",
  title: "🏷️", badge: "🎖️", avatar_background: "🖼️",
  spin_token: "🎰", loot_crate: "📦", weapon: "🔫",
  armor: "🛡️", consumable: "💊", ammo: "🎯", car: "🚗", car_part: "⚙️",
};

interface Props {
  item: RoyaleWonItem;
  index: number;
  revealed: boolean;
}

export function RoyaleItemCard({ item, index, revealed }: Props) {
  const [flipped, setFlipped] = useState(false);
  const styles = TIER_STYLES[item.tier] ?? TIER_STYLES.common;
  const icon = TYPE_ICON[item.itemType] ?? "🎁";

  const isLegendary = item.tier === "legendary";

  return (
    <div
      style={{
        width: 130,
        height: 180,
        perspective: 600,
        cursor: "pointer",
        animation: revealed ? `cardReveal 0.4s ${index * 0.12}s both` : undefined,
      }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
          transform: flipped ? "rotateY(180deg)" : "none",
        }}
      >
        {/* Front — card back face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: 10,
            background: "#0a0a1a",
            border: "2px solid #00d4ff30",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 36, opacity: 0.4 }}>🎰</span>
        </div>

        {/* Back — item face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 10,
            background: styles.bg,
            border: `2px solid ${styles.border}`,
            boxShadow: `0 0 16px ${styles.glow}, inset 0 0 20px ${styles.glow}20`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflow: "hidden",
            animation: isLegendary ? "legendaryPulse 2s infinite" : undefined,
          }}
        >
          {/* Card art — use imageCard if present, else programmatic art */}
          {item.imageCard ? (
            <img
              src={item.imageCard}
              alt={item.name}
              style={{ width: "100%", height: 90, objectFit: "cover" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <CardArt itemType={item.itemType} tier={item.tier} size={130} style={{ width: "100%", height: 90, objectFit: "cover" }} />
          )}
          {/* Info */}
          <div style={{ padding: "4px 6px", display: "flex", flexDirection: "column", gap: 3, alignItems: "center", flex: 1, justifyContent: "center" }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                fontWeight: "bold",
                color: styles.label,
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {item.name}
            </div>
            <div
              style={{
                fontSize: 8,
                fontFamily: "monospace",
                color: "#475569",
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {rewardSummary(item.reward)}
            </div>
            <div
              style={{
                fontSize: 8,
                fontFamily: "monospace",
                color: styles.border,
                textTransform: "uppercase",
                letterSpacing: 1,
                background: `${styles.border}18`,
                border: `1px solid ${styles.border}40`,
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {item.tier}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(20px) scale(0.8); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes legendaryPulse {
          0%, 100% { box-shadow: 0 0 16px #f59e0b80, inset 0 0 20px #f59e0b20; }
          50%       { box-shadow: 0 0 32px #f59e0bcc, inset 0 0 30px #f59e0b40; }
        }
      `}</style>
    </div>
  );
}
