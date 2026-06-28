import { PlayerFrame, FrameSize } from "./PlayerFrame";
import { avatarDataUrl } from "../lib/avatar";
import { getFrame } from "../lib/frames";

interface Props {
  username: string;
  avatarUrl?: string | null;
  frameId?: string | null;
  frameColor?: string | null;
  size?: FrameSize;
  onClick?: () => void;
  className?: string;
}

const SIZE_PX: Record<FrameSize, number> = {
  xs: 28, sm: 36, md: 48, lg: 64, xl: 96,
};

const RARITY_DOT_COLOR: Record<string, string> = {
  common:    "#9ca3af",
  uncommon:  "#4ade80",
  rare:      "#60a5fa",
  epic:      "#c084fc",
  legendary: "#fbbf24",
  mythic:    "#00ff41",
};

export function AvatarWithFrame({ username, avatarUrl, frameId, frameColor, size = "md", onClick, className }: Props) {
  const px = SIZE_PX[size];
  const src = avatarUrl || avatarDataUrl(username, px);
  const frameDef = frameId ? getFrame(frameId) : null;
  const showRarityDot = (size === "xs" || size === "sm") && frameDef && frameDef.rarity !== "common";
  const dotColor = frameDef ? (RARITY_DOT_COLOR[frameDef.rarity] || "#9ca3af") : "#9ca3af";

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <PlayerFrame
        frameId={frameId}
        size={size}
        className={className}
        style={{ cursor: onClick ? "pointer" : "default" }}
      >
        <img
          src={src}
          alt={username}
          width={px}
          height={px}
          onClick={onClick}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => {
            (e.target as HTMLImageElement).src = avatarDataUrl(username, px);
          }}
        />
      </PlayerFrame>
      {showRarityDot && (
        <div
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 4px ${dotColor}`,
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}
