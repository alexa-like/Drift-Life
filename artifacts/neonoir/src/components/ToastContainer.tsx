import { Toast } from "../hooks/useToast";
import { motion, AnimatePresence } from "framer-motion";

const COLORS: Record<string, string> = {
  success: "#39d353",
  error: "#ff2d55",
  info: "#00d4ff",
  warning: "#f59e0b",
};

const ICONS: Record<string, string> = {
  success: "✓",
  error: "⚠",
  info: "i",
  warning: "⚡",
};

interface Props {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 50, scale: 0.95, filter: "hue-rotate(90deg)" }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: "hue-rotate(0deg)" }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className="pointer-events-auto flex items-start gap-0 clip-card cursor-pointer overflow-hidden group animate-glitch"
            style={{
              background: "#08080c",
              border: `1px solid ${COLORS[t.type]}40`,
              boxShadow: `0 0 20px ${COLORS[t.type]}15`,
              animationIterationCount: 1,
              animationDuration: "0.2s"
            }}
            onClick={() => removeToast(t.id)}
          >
            {/* Left color bar glows */}
            <div 
              className="w-2 self-stretch flex-shrink-0 animate-pulse-glow"
              style={{ 
                background: COLORS[t.type],
                boxShadow: `0 0 15px ${COLORS[t.type]}`,
                color: COLORS[t.type]
              }}
            />
            
            <div className="flex-1 p-3 flex items-start gap-3 relative">
              {/* Icon */}
              <div 
                className="w-6 h-6 flex items-center justify-center font-bold text-xs clip-btn flex-shrink-0"
                style={{ 
                  background: `${COLORS[t.type]}20`, 
                  color: COLORS[t.type],
                  border: `1px solid ${COLORS[t.type]}60`
                }}
              >
                {ICONS[t.type]}
              </div>

              {/* Message */}
              <div className="font-mono text-sm leading-snug mt-0.5" style={{ color: "#e2e8f0" }}>
                {t.message}
              </div>

              {/* Progress bar drain */}
              <motion.div 
                className="absolute bottom-0 left-0 h-[2px]"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4, ease: "linear" }}
                style={{ 
                  background: COLORS[t.type],
                  boxShadow: `0 0 8px ${COLORS[t.type]}`
                }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
