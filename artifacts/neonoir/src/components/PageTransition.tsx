import { ReactNode } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

interface PageTransitionProps {
  pageKey: string;
  children: ReactNode;
}

/** 13.1 — Page transitions: 200ms fade+slide enter, 150ms fade exit */
const variants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.0, 0.0, 0.2, 1], // ease-out
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};

export function PageTransition({ pageKey, children }: PageTransitionProps) {
  return (
    <div className="relative w-full">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pageKey}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full relative"
        >
          {/* Scanline sweep overlay on enter — Neonoir flavour */}
          <motion.div
            initial={{ opacity: 0.9, top: 0 }}
            animate={{ opacity: 0, top: "100%" }}
            transition={{ duration: 0.35, ease: "linear" }}
            className="absolute left-0 right-0 z-50 pointer-events-none h-4"
            style={{
              background: "linear-gradient(to bottom, transparent, #00d4ff, transparent)",
              boxShadow: "0 0 20px 4px #00d4ff",
            }}
          />
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * 13.1 — Modal transition: scale 0.95→1 + fade in on open,
 *         scale 1→0.95 + fade out on close.
 * Wrap modal content with this inside an <AnimatePresence>.
 */
export function ModalTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease: [0.0, 0.0, 0.2, 1] } }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
    >
      {children}
    </motion.div>
  );
}
