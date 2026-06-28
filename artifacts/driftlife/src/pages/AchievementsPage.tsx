import { useState, useEffect } from "react";
import { Achievement } from "../lib/types";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  combat: "Combat",
  crime: "Crime",
  wealth: "Wealth",
  social: "Social",
  exploration: "Exploration",
  collection: "Collection",
};

const CATEGORY_COLORS: Record<string, string> = {
  combat: "#ff2d55",
  crime: "#ff6b35",
  wealth: "#f59e0b",
  social: "#39d353",
  exploration: "#00d4ff",
  collection: "#a855f7",
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: 4, background: "#1e1e2e", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
    </div>
  );
}

export function AchievementsPage({ user, refreshUser, addToast }: Props) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.get<Achievement[]>("/achievements")
      .then(a => { setAchievements(a); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCheck() {
    setChecking(true);
    try {
      await api.post<any>("/achievements/check");
      const updated = await api.get<Achievement[]>("/achievements");
      setAchievements(updated);
      await refreshUser();
      addToast("Achievements updated", "success");
    } catch {
      addToast("Failed to check achievements", "error");
    } finally {
      setChecking(false);
    }
  }

  const filtered = category === "all" ? achievements : achievements.filter(a => a.category === category);
  const completed = achievements.filter(a => a.completed).length;
  const totalMerit = achievements.filter(a => a.completed).reduce((s, a) => s + a.meritReward, 0);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 className="font-mono font-bold" style={{ color: "#00d4ff", fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Achievements
          </h1>
          <div className="font-mono" style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
            {completed}/{achievements.length} completed &nbsp;·&nbsp;
            <span style={{ color: "#39d353" }}>{totalMerit.toLocaleString()} M</span> earned
            &nbsp;·&nbsp; Balance: <span style={{ color: "#39d353" }}>{(user.merit ?? 0).toLocaleString()} M</span>
          </div>
        </div>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="font-mono text-xs"
          style={{
            background: "#111118", border: "1px solid #1e1e2e", borderRadius: 4,
            color: "#00d4ff", padding: "6px 12px", cursor: "pointer",
          }}
        >
          {checking ? "Checking..." : "Refresh"}
        </button>
      </div>

      <div style={{ height: 6, background: "#1e1e2e", borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          width: `${achievements.length ? (completed / achievements.length) * 100 : 0}%`,
          height: "100%", background: "linear-gradient(90deg,#00d4ff,#a855f7)", borderRadius: 3, transition: "width 0.5s",
        }} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {["all", ...Object.keys(CATEGORY_LABELS)].map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className="font-mono text-xs"
            style={{
              padding: "4px 10px", borderRadius: 4, cursor: "pointer",
              background: category === cat ? (cat === "all" ? "#00d4ff" : CATEGORY_COLORS[cat]) : "#111118",
              color: category === cat ? "#0a0a0f" : "#64748b",
              border: `1px solid ${category === cat ? "transparent" : "#1e1e2e"}`,
              fontWeight: category === cat ? "bold" : "normal",
            }}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>
          Loading achievements...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(a => {
            const color = CATEGORY_COLORS[a.category] || "#64748b";
            const pct = Math.min(100, (a.progress / a.target) * 100);
            return (
              <div
                key={a.id}
                style={{
                  background: "#111118",
                  border: `1px solid ${a.completed ? color + "50" : "#1e1e2e"}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  opacity: a.completed ? 1 : 0.85,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {a.completed && (
                  <div style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    fontSize: 11, fontFamily: "monospace", fontWeight: "bold",
                    color: "#39d353", border: "1px solid #39d353", padding: "2px 6px",
                    borderRadius: 4, letterSpacing: "0.1em",
                  }}>
                    CLAIMED
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginRight: a.completed ? 72 : 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: color + "20", border: `1px solid ${color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: a.completed ? color : "#1e1e2e" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span className="font-mono font-bold" style={{ color: a.completed ? color : "#e2e8f0", fontSize: 13 }}>
                        {a.name}
                      </span>
                      <span className="font-mono" style={{ fontSize: 10, color: color, background: color + "20", padding: "1px 6px", borderRadius: 4 }}>
                        +{a.meritReward} M
                      </span>
                    </div>
                    <p className="font-mono" style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>{a.description}</p>
                    {!a.completed && (
                      <>
                        <ProgressBar value={a.progress} max={a.target} color={color} />
                        <div className="font-mono" style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                          {a.progress.toLocaleString()} / {a.target.toLocaleString()}
                          &nbsp;({pct.toFixed(0)}%)
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", paddingTop: 24 }}>
              No achievements in this category
            </div>
          )}
        </div>
      )}
    </div>
  );
}
