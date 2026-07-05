import { getFrame } from "../lib/chatFrames";

interface ChatFrameRendererProps {
  frameId: string | null | undefined;
  username: string;
  level?: number;
  children: React.ReactNode;
  isOwn?: boolean;
  timestamp?: string;
  compact?: boolean;
}

export function ChatFrameRenderer({
  frameId,
  username,
  level,
  children,
  isOwn,
  timestamp,
  compact = false,
}: ChatFrameRendererProps) {
  const frame = getFrame(frameId);

  if (!frame) {
    return (
      <div className="flex flex-col mb-2" style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}>
        <div className="font-mono text-xs px-3 py-1.5 rounded" style={{
          background: isOwn ? "#00d4ff12" : "#111118",
          border: `1px solid ${isOwn ? "#00d4ff30" : "#1e1e2e"}`,
          color: "#e2e8f0",
          maxWidth: "85%",
          wordBreak: "break-word",
        }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      {frame.animationCss && (
        <style>{getAnimationCss(frame.animationCss, frame.id)}</style>
      )}
      <div
        className={`font-mono rounded overflow-hidden mb-1 ${compact ? "" : "mb-2"}`}
        style={{
          maxWidth: compact ? "100%" : "85%",
          alignSelf: isOwn ? "flex-end" : "flex-start",
          wordBreak: "break-word",
          ...(frame.messageBorderStyle as React.CSSProperties),
          ...(frame.animationCss ? { animation: `${frame.animationCss}-${frame.id} 3s ease-in-out infinite` } : {}),
        }}
      >
        <div
          className="flex items-center justify-between px-2 py-0.5"
          style={{ ...(frame.nameBarStyle as React.CSSProperties), fontSize: 11, lineHeight: 1.4 }}
        >
          <span style={{ fontWeight: "bold" }}>
            {frame.badge && <span style={{ marginRight: 4 }}>{frame.badge}</span>}
            {username}
          </span>
          <span style={{ opacity: 0.7, fontSize: 9 }}>
            {level ? `Lv.${level}` : ""}
            {timestamp && !compact ? ` · ${new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
        </div>
        <div className="px-3 py-1.5 text-xs" style={{ color: "#e2e8f0", background: "rgba(0,0,0,0.6)" }}>
          {children}
        </div>
      </div>
    </>
  );
}

function getAnimationCss(animName: string, frameId: string): string {
  const key = `${animName}-${frameId}`;
  switch (animName) {
    case "neon-pulse":
      return `
        @keyframes ${key} {
          0%, 100% { box-shadow: 0 0 8px #ec489940; border-color: #ec489960; }
          50% { box-shadow: 0 0 18px #ec4899aa, 0 0 30px #a855f750; border-color: #ec4899; }
        }
      `;
    case "shadow-lord-pulse":
      return `
        @keyframes ${key} {
          0%, 100% { box-shadow: 0 0 10px #ff2d5540; }
          50% { box-shadow: 0 0 22px #ff2d55aa, 0 0 40px #ff2d5530; }
        }
      `;
    case "galaxy-shift":
      return `
        @keyframes ${key} {
          0% { box-shadow: 0 0 12px #a855f760; border-color: #a855f7; }
          50% { box-shadow: 0 0 20px #00d4ff60; border-color: #00d4ff; }
          100% { box-shadow: 0 0 12px #a855f760; border-color: #a855f7; }
        }
      `;
    case "apex-glow":
      return `
        @keyframes ${key} {
          0%, 100% { box-shadow: 0 0 10px #f59e0b50; border-color: #f59e0b; }
          50% { box-shadow: 0 0 24px #ff2d5560, 0 0 40px #f59e0b30; border-color: #ff2d55; }
        }
      `;
    default:
      return "";
  }
}
