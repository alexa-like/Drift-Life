import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PageTransitionProps {
  pageKey: string;
  children: ReactNode;
}

const variants = {
  initial: { 
    opacity: 0, 
    x: 40,
  },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1] as const,
    }
  },
  exit: { 
    opacity: 0,
    x: -20,
    transition: { 
      duration: 0.15,
      ease: [0.55, 0, 1, 0.45] as const,
    }
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
          {/* Scanline flash overlay on enter */}
          <motion.div
            initial={{ opacity: 1, height: "10px", top: 0 }}
            animate={{ opacity: 0, height: "2px", top: "100%" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute left-0 right-0 z-50 pointer-events-none"
            style={{
              background: "#00d4ff",
              boxShadow: "0 0 20px 4px #00d4ff"
            }}
          />
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
