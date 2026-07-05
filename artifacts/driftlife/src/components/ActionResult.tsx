import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ActionResultType = "success" | "fail" | "warning" | "info";

interface ActionResultProps {
  visible: boolean;
  type: ActionResultType;
  title: string;
  detail?: string;
  onDismiss?: () => void;
  /** Auto-dismiss after ms (default 2800, 0 = never) */
  autoDismiss?: number;
}

const TYPE_CONFIG: Record<ActionResultType, { color: string; border: string; glow: string; icon: string }> = {
  success: { color: "#39d353", border: "#39d35350", glow: "0 0 20px #39d35330", icon: "▲" },
  fail:    { color: "#ff2d55", border: "#ff2d5550", glow: "0 0 20px #ff2d5530", icon: "▼" },
  warning: { color: "#f59e0b", border: "#f59e0b50", glow: "0 0 20px #f59e0b30", icon: "!" },
  info:    { color: "#00d4ff", border: "#00d4ff50", glow: "0 0 20px #00d4ff30", icon: "i" },
};

/**
 * Slide-up action result banner — shows success/fail outcome for crimes, combat, jobs, etc.
 * Mount it always; drive visibility with `visible` prop.
 */
export function ActionResult({
  visible,
  type,
  title,
  detail,
  onDismiss,
  autoDismiss = 2800,
}: ActionResultProps) {
  const cfg = TYPE_CONFIG[type];

  useEffect(() => {
    if (!visible || autoDismiss === 0) return;
    const t = setTimeout(() => onDismiss?.(), autoDismiss);
    return () => clearTimeout(t);
  }, [visible, autoDismiss, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role={type === "fail" ? "alert" : "status"}
          aria-live={type === "fail" ? "assertive" : "polite"}
          tabIndex={0}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          onClick={onDismiss}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") onDismiss?.(); }}
          className="cursor-pointer select-none focus:outline-none"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            minWidth: 280,
            maxWidth: "90vw",
            background: "#111118",
            border: `1px solid ${cfg.border}`,
            boxShadow: cfg.glow,
            borderRadius: 8,
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Icon */}
          <span
            className="font-mono font-bold text-lg flex-shrink-0 w-7 h-7 flex items-center justify-center rounded"
            style={{ color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.border}` }}
          >
            {cfg.icon}
          </span>

          {/* Text */}
          <div className="flex flex-col min-w-0">
            <span className="font-mono font-semibold text-sm" style={{ color: cfg.color }}>
              {title}
            </span>
            {detail && (
              <span className="font-mono text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                {detail}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
