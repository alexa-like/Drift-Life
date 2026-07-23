import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";

interface Props {
  isOffline: boolean;
  onRetry: () => void;
}

export function OfflineOverlay({ isOffline, onRetry }: Props) {
  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-center gap-3 px-4 py-2.5 border-b border-[#ff6b35]/60 shadow-[0_0_20px_rgba(255,107,53,0.25)]"
          style={{ background: "rgba(17, 17, 24, 0.95)", backdropFilter: "blur(8px)" }}
        >
          <WifiOff className="w-4 h-4 text-[#ff6b35] shrink-0" />
          <span className="font-mono text-xs sm:text-sm font-semibold text-[#ff6b35] tracking-wider">
            CONNECTION TO THE NEON GRID LOST
          </span>
          <span className="hidden sm:inline text-xs text-slate-400">
            Some actions are unavailable while offline.
          </span>
          <button
            onClick={onRetry}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-[#0d0d14] bg-[#ff6b35] hover:bg-[#ff8c5a] transition-colors clip-btn"
            aria-label="Retry connection"
          >
            <RefreshCw className="w-3 h-3" />
            RETRY
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
