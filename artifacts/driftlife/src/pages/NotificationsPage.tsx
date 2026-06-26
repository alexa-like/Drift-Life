import { useState, useEffect } from "react";
import { Notification } from "../lib/types";
import { api } from "../lib/api";

interface Props {
  onUnreadChange: (count: number) => void;
}

export function NotificationsPage({ onUnreadChange }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  const load = async () => {
    const data = await api.get<Notification[]>("/notifications").catch(() => [] as Notification[]);
    setNotifs(data);
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

  const TYPE_COLORS: Record<string, string> = {
    combat: "#ff6b35",
    system: "#a855f7",
    market: "#00d4ff",
    bank: "#f59e0b",
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#94a3b8" }}>Notifications</h2>
        <button
          onClick={markAllRead}
          className="text-xs font-mono px-2 py-1 rounded"
          style={{ color: "#475569", border: "1px solid #1e1e2e" }}
        >
          Mark all read
        </button>
      </div>

      {notifs.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
          No notifications
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifs.map(n => (
            <div
              key={n.id}
              className="rounded-lg px-4 py-3 flex items-start gap-3 cursor-pointer transition-opacity"
              style={{
                background: n.read ? "#0d0d15" : "#111118",
                border: `1px solid ${n.read ? "#1e1e2e" : (TYPE_COLORS[n.type] ?? "#94a3b8") + "30"}`,
                opacity: n.read ? 0.6 : 1,
              }}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: n.read ? "#1e1e2e" : (TYPE_COLORS[n.type] ?? "#94a3b8") }}
              />
              <div className="flex-1">
                <p className="text-xs font-mono" style={{ color: n.read ? "#475569" : "#e2e8f0" }}>
                  {n.message}
                </p>
                <span className="text-xs font-mono" style={{ color: "#334155" }}>
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              {!n.read && (
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#00d4ff" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
