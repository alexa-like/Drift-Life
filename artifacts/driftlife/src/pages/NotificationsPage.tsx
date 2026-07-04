import { useState, useEffect } from "react";
import { Notification } from "../lib/types";
import { api } from "../lib/api";

interface Props {
  onUnreadChange: (count: number) => void;
}

const TYPE_META: Record<string, { label: string; color: string; priority: "urgent" | "high" | "normal" | "info" }> = {
  combat:  { label: "COMBAT",  color: "#ff6b35", priority: "urgent" },
  system:  { label: "SYSTEM",  color: "#a855f7", priority: "high"   },
  market:  { label: "MARKET",  color: "#00d4ff", priority: "normal" },
  bank:    { label: "BANK",    color: "#f59e0b", priority: "normal" },
  jail:    { label: "JAIL",    color: "#ff2d55", priority: "high"   },
  hospital:{ label: "HOSP",   color: "#39d353", priority: "normal" },
};

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, info: 3 };

function getPriority(type: string) {
  return TYPE_META[type]?.priority ?? "info";
}

function getColor(type: string) {
  return TYPE_META[type]?.color ?? "#64748b";
}

function getLabel(type: string) {
  return TYPE_META[type]?.label ?? type.toUpperCase().slice(0, 6);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsPage({ onUnreadChange }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    const data = await api.get<Notification[]>("/notifications").catch(() => [] as Notification[]);
    // Sort: unread first, then by priority, then by date
    const sorted = [...data].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      const pa = PRIORITY_ORDER[getPriority(a.type)] ?? 3;
      const pb = PRIORITY_ORDER[getPriority(b.type)] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setNotifs(sorted);
    onUnreadChange(data.filter(n => !n.read).length);
  };

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    onUnreadChange(notifs.filter(n => !n.read && n.id !== id).length);
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all").catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    onUnreadChange(0);
  }

  const types = ["all", ...Array.from(new Set(notifs.map(n => n.type)))];
  const filtered = filter === "all" ? notifs : notifs.filter(n => n.type === filter);
  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-mono font-bold" style={{ color: "#94a3b8" }}>NOTIFICATIONS</h2>
          {unreadCount > 0 && (
            <p className="font-mono text-xs" style={{ color: "#64748b" }}>{unreadCount} unread</p>
          )}
        </div>
        <button
          onClick={markAllRead}
          className="text-xs font-mono px-3 py-1.5 rounded transition-all"
          style={{ color: "#475569", border: "1px solid #1e1e2e", background: "#111118" }}
        >
          Mark all read
        </button>
      </div>

      {/* Type filter */}
      {types.length > 2 && (
        <div className="flex gap-2 flex-wrap">
          {types.map(t => {
            const color = t === "all" ? "#64748b" : getColor(t);
            const isActive = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="font-mono text-xs px-3 py-1 rounded transition-all"
                style={{
                  background: isActive ? color + "18" : "#111118",
                  color: isActive ? color : "#475569",
                  border: `1px solid ${isActive ? color + "40" : "#1e1e2e"}`,
                }}
              >
                {t === "all" ? "ALL" : getLabel(t)}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
          {filter === "all" ? "No notifications" : `No ${getLabel(filter)} notifications`}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(n => {
            const color = getColor(n.type);
            const priority = getPriority(n.type);
            const isUrgent = priority === "urgent" && !n.read;
            return (
              <div
                key={n.id}
                className="rounded-lg transition-opacity cursor-pointer"
                style={{
                  background: n.read ? "#0d0d15" : "#111118",
                  border: `1px solid ${n.read ? "#1e1e2e" : color + (isUrgent ? "50" : "28")}`,
                  opacity: n.read ? 0.55 : 1,
                  boxShadow: isUrgent ? `0 0 12px ${color}18` : "none",
                }}
                onClick={() => !n.read && markRead(n.id)}
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  {/* Priority indicator */}
                  <div className="flex-shrink-0 pt-0.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: n.read ? "#1e1e2e" : color,
                        boxShadow: isUrgent ? `0 0 6px ${color}` : "none",
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {/* Type badge */}
                      <span
                        className="font-mono rounded px-1"
                        style={{
                          fontSize: 9,
                          background: color + "18",
                          color: n.read ? "#334155" : color,
                          border: `1px solid ${color}30`,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {getLabel(n.type)}
                      </span>
                      {isUrgent && (
                        <span className="font-mono" style={{ fontSize: 9, color: "#ff2d55", letterSpacing: "0.08em" }}>
                          URGENT
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs" style={{ color: n.read ? "#475569" : "#e2e8f0" }}>
                      {n.message}
                    </p>
                    <span className="font-mono" style={{ fontSize: 10, color: "#334155" }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>

                  {!n.read && (
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
