import { PlayerFrame, FrameSize } from "./PlayerFrame";
import { avatarDataUrl } from "../lib/avatar";

interface Props {
  username: string;
  avatarUrl?: string | null;
  frameId?: string | null;
  size?: FrameSize;
  onClick?: () => void;
  className?: string;
}

const SIZE_PX: Record<FrameSize, number> = {
  xs: 28, sm: 36, md: 48, lg: 64, xl: 96,
};

export function AvatarWithFrame({ username, avatarUrl, frameId, size = "md", onClick, className }: Props) {
  const px = SIZE_PX[size];
  const src = avatarUrl || avatarDataUrl(username, px);

  return (
    <PlayerFrame frameId={frameId} size={size} className={className} style={{ cursor: onClick ? "pointer" : "default" }}>
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
  );
}
