import { ReactNode } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

interface PageTransitionProps {
  pageKey: string;
  children: ReactNode;
}

const variants: Variants = {
  initial: { 
    opacity: 0, 
    y: 20,
    filter: "brightness(2) contrast(1.5)",
  },
  animate: { 
    opacity: 1, 
    y: 0,
    filter: "brightness(1) contrast(1)",
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    }
  },
  exit: { 
    opacity: 0,
    x: -10,
    transition: { 
      duration: 0.2,
      ease: [0.55, 0, 1, 0.45],
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
          {/* Scanline sweep overlay on enter */}
          <motion.div
            initial={{ opacity: 1, top: 0 }}
            animate={{ opacity: 0, top: "100%" }}
            transition={{ duration: 0.5, ease: "linear" }}
            className="absolute left-0 right-0 z-50 pointer-events-none h-4"
            style={{
              background: "linear-gradient(to bottom, transparent, #00d4ff, transparent)",
              boxShadow: "0 0 20px 4px #00d4ff"
            }}
          />
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
