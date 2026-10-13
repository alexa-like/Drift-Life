import { motion } from "framer-motion";
import { BOTTOM_NAV_ROUTES } from "../registry";

interface Props {
  active: string;
  onNav: (page: string) => void;
}

/**
 * Mobile bottom navigation bar — pinned to the bottom of the screen on
 * viewports narrower than 768 px. Hidden on md+ (handled by desktop NavBar).
 * Items come from the central registry (bottomNav: true entries).
 */
export function BottomNav({ active, onNav }: Props) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ background: "#0a0a0f", borderTop: "1px solid #1e1e2e", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch">
        {BOTTOM_NAV_ROUTES.map(item => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1"
              style={{
                minHeight: 56,
                padding: "8px 4px",
                background: isActive ? "#00d4ff12" : "transparent",
                borderTop: `2px solid ${isActive ? "#00d4ff" : "transparent"}`,
              }}
            >
              <motion.div
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2 : 1.5}
                  color={isActive ? "#00d4ff" : "#475569"}
                  style={{ filter: isActive ? "drop-shadow(0 0 6px #00d4ff)" : "none" }}
                />
              </motion.div>
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: 8,
                  letterSpacing: "0.06em",
                  color: isActive ? "#00d4ff" : "#475569",
                  fontWeight: isActive ? "bold" : "normal",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
