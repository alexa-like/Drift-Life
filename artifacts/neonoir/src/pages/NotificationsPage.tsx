import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Notification } from "../lib/types";
import { api } from "../lib/api";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { AnimatedCard } from "../components/AnimatedCard";

interface Props {
  onUnreadChange: (count: number) => void;
  onInspectPlayer?: (id: string) => void;
}

const TYPE_META: Record<string, { label: string; color: string; priority: "urgent" | "high" | "normal" | "info" }> = {
  combat:   { label: "COMBAT",   color: "#ff6b35", priority: "urgent" },
  mention:  { label: "MENTION",  color: "#00d4ff", priority: "high"   },
  system:   { label: "SYSTEM",   color: "#a855f7", priority: "high"   },
  market:   { label: "MARKET",   color: "#00d4ff", priority: "normal" },
  bank:     { label: "BANK",     color: "#f59e0b", priority: "normal" },
  jail:     { label: "JAIL",     color: "#ff2d55", priority: "high"   },
  hospital: { label: "HOSP",     color: "#39d353", priority: "normal" },
};

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, info: 3 };

function getPriority(type: string) { return TYPE_META[type]?.priority ?? "info"; }
function getColor(type: string)    { return TYPE_META[type]?.color ?? "#64748b"; }
function getLabel(type: string)    { return TYPE_META[type]?.label ?? type.toUpperCase().slice(0, 7); }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Parse a notification `link` field and return a handler function.
 * Formats:
 *   "page:{pageName}"    → navigate to that page
 *   "profile:{userId}"  → open player inspect modal
 */
function resolveLinkHandler(
  link: string | null | undefined,
  onInspectPlayer?: (id: string) => void
): (() => void) | undefined {
  if (!link) return undefined;
  if (link.startsWith("page:")) {
    const page = link.slice(5);
    return () => (window as any).__setPage?.(page);
  }
  if (link.startsWith("profile:")) {
    const userId = link.slice(8);
    return onInspectPlayer ? () => onInspectPlayer(userId) : undefined;
  }
  return undefined;
}

export function NotificationsPage({ onUnreadChange, onInspectPlayer }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    const data = await api.get<Notification[]>("/notifications").catch(() => [] as Notification[]);
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

  const types       = ["all", ...Array.from(new Set(notifs.map(n => n.type)))];
  const filtered    = filter === "all" ? notifs : notifs.filter(n => n.type === filter);
  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 relative z-10">
      <div className="dl-page-bg bg-terminal" />
      
      {/* Radar scanning background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-10 fixed" style={{
        backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0, 212, 255, 0.1) 0%, transparent 60%), repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 20px, rgba(0, 212, 255, 0.05) 20px, rgba(0, 212, 255, 0.05) 21px)"
      }} />

      <CyberSectionHeader
        title={unreadCount > 0 ? `NOTIFICATIONS — ${unreadCount} UNREAD` : "NOTIFICATIONS"}
        accent="#a855f7"
        cursor
        right={
          <CyberButton variant="ghost" size="sm" onClick={markAllRead}>
            Mark all read
          </CyberButton>
        }
      />

      {/* Type filter */}
      {types.length > 2 && (
        <div className="flex gap-2 flex-wrap">
          {types.map(t => {
            const color    = t === "all" ? "#64748b" : getColor(t);
            const isActive = filter === t;
            return (
              <motion.button
                key={t}
                onClick={() => setFilter(t)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="font-mono text-xs px-3 py-1 rounded transition-colors"
                style={{
                  background: isActive ? `${color}18` : "transparent",
                  color:      isActive ? color : "#475569",
                  border:     `1px solid ${isActive ? `${color}40` : "#1e1e2e"}`,
                }}
              >
                {t === "all" ? "ALL" : getLabel(t)}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
          {filter === "all" ? "No notifications" : `No ${getLabel(filter)} notifications`}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((n, i) => {
            const color      = getColor(n.type);
            const priority   = getPriority(n.type);
            const isUrgent   = priority === "urgent" && !n.read;
            const linkAction = resolveLinkHandler((n as any).link, onInspectPlayer);
            const isMention  = n.type === "mention";

            return (
              <AnimatedCard
                key={n.id}
                accent={n.read ? "#1e1e2e" : color}
                shimmer={!n.read}
                noPad
                onClick={() => {
                  if (!n.read) markRead(n.id);
                  linkAction?.();
                }}
                className="cursor-pointer"
                style={{
                  opacity:   n.read ? 0.55 : 1,
                  boxShadow: isUrgent ? `0 0 16px ${color}18` : "none",
                }}
              >
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  {/* Dot */}
                  <div className="flex-shrink-0 pt-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: n.read ? "#1e1e2e" : color,
                        boxShadow:  (isUrgent || (isMention && !n.read)) ? `0 0 6px ${color}` : "none",
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span
                        className="font-mono rounded px-1"
                        style={{
                          fontSize:      9,
                          background:    `${color}18`,
                          color:         n.read ? "#334155" : color,
                          border:        `1px solid ${color}30`,
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
                      {isMention && !n.read && (
                        <span className="font-mono" style={{ fontSize: 9, color: "#00d4ff", letterSpacing: "0.05em" }}>
                          @ you
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs" style={{ color: n.read ? "#475569" : "#e2e8f0" }}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono" style={{ fontSize: 10, color: "#334155" }}>
                        {timeAgo(n.createdAt)}
                      </span>
                      {linkAction && !n.read && (
                        <span className="font-mono" style={{ fontSize: 9, color: color, opacity: 0.7 }}>
                          · tap to go →
                        </span>
                      )}
                      {linkAction && n.read && (
                        <span className="font-mono" style={{ fontSize: 9, color: "#334155" }}>
                          · tap to go →
                        </span>
                      )}
                    </div>
                  </div>

                  {!n.read && (
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
                  )}
                </motion.div>
              </AnimatedCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
