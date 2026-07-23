import { cn } from "@/shared/utils";

/** Individual skeleton bone element */
function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse rounded-sm", className)}
      style={{ background: "#1e1e2e", ...style }}
    />
  );
}

interface Props {
  className?: string;
  count?: number;
  type?: "list" | "card" | "feed" | "profile" | "pass";
}

/**
 * Terminal-style skeleton loader that matches the Neonoir dark aesthetic.
 * Replaces all "loading..." text while data is fetching.
 */
export function CyberSkeleton({ className, count = 5, type = "list" }: Props) {
  const items = Array.from({ length: count });

  // ── Feed skeleton (compact event rows) ──────────────────────────────────
  if (type === "feed") {
    return (
      <div className={cn("space-y-2", className)}>
        {items.map((_, i) => (
          <div
            key={i}
            style={{
              background: "#0a0a12",
              border: "1px solid #1e1e2e",
              borderRadius: 6,
              padding: "10px 14px",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <Bone style={{ width: 64, height: 14, flexShrink: 0, borderRadius: 3 }} />
            <Bone style={{ flex: 1, height: 12, width: `${55 + (i % 4) * 10}%` }} />
            <Bone style={{ width: 30, height: 10, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    );
  }

  // ── Card skeleton (Market / Auction items) ───────────────────────────────
  if (type === "card") {
    return (
      <div className={cn("space-y-3", className)}>
        {items.map((_, i) => (
          <div
            key={i}
            style={{
              background: "#0d0d14",
              border: "1px solid #1e1e2e",
              borderRadius: 4,
              padding: 16,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Bone style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 4 }} />
              <div className="flex-1 space-y-2">
                <Bone style={{ height: 13, width: `${50 + (i % 3) * 15}%` }} />
                <Bone style={{ height: 10, width: `${35 + (i % 4) * 10}%` }} />
                <Bone style={{ height: 9, width: "45%" }} />
              </div>
            </div>
            <div
              style={{ borderTop: "1px solid #1e1e2e", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <Bone style={{ height: 14, width: 80 }} />
              <Bone style={{ height: 28, width: 64, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Pass skeleton (battle pass level track) ──────────────────────────────
  if (type === "pass") {
    return (
      <div className={cn("flex gap-2 overflow-hidden", className)}>
        {items.map((_, i) => (
          <div
            key={i}
            style={{
              minWidth: i % 5 === 0 ? 110 : 88,
              flexShrink: 0,
              border: "1px solid #1e1e2e",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <Bone style={{ height: 28, borderRadius: 0, borderBottom: "1px solid #111118" }} />
            <div style={{ padding: 8 }}>
              <Bone style={{ height: 9, width: "60%", marginBottom: 6 }} />
              <Bone style={{ height: 10, width: "80%" }} />
            </div>
            <div style={{ padding: 8, background: "#05050a", borderTop: "1px solid #111118" }}>
              <Bone style={{ height: 9, width: "60%", marginBottom: 6 }} />
              <Bone style={{ height: 10, width: "70%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Default list skeleton (Leaderboard rows) ─────────────────────────────
  return (
    <div className={cn("space-y-2", className)}>
      {items.map((_, i) => (
        <div
          key={i}
          style={{
            background: "#111118",
            border: "1px solid #1e1e2e",
            borderRadius: 4,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Bone style={{ width: 24, height: 12, flexShrink: 0 }} />
          <Bone style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          <div className="flex-1 space-y-1.5">
            <Bone style={{ height: 12, width: `${48 + (i % 4) * 10}%` }} />
            <Bone style={{ height: 9, width: `${28 + (i % 3) * 12}%` }} />
          </div>
          <Bone style={{ width: 52, height: 12, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
