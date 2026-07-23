import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "../shared/types";
import { api } from "../shared/api";
import { CyberButton } from "./CyberButton";

interface Props {
  user: User;
  onNav: (page: string) => void;
  refreshUser: () => void;
  addToast: (msg: string, type?: string) => void;
}

// Tracks which stage-advancement toasts have been shown this session
const shownToasts = new Set<number>();

export default function OnboardingModal({ user, onNav, refreshUser, addToast }: Props) {
  const [visible, setVisible] = useState(false);
  const [skipping, setSkipping] = useState(false);
  // Track previous stage so we can show advancement toasts
  const [prevStage, setPrevStage] = useState<number>(user.onboardingStage ?? 0);

  const stage = user.onboardingStage ?? 0;

  // Show welcome modal when stage is 0
  useEffect(() => {
    if (stage === 0) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [stage]);

  // Show stage advancement toasts
  useEffect(() => {
    if (stage === prevStage) return;

    if (stage === 1 && !shownToasts.has(1)) {
      shownToasts.add(1);
      addToast("Crime pays. Well, sometimes. You've earned 1,000 DC! Now get some wheels — head to the Market.", "success");
    }
    if (stage === 2 && !shownToasts.has(2)) {
      shownToasts.add(2);
      addToast("Wheels acquired! 500 DC bonus. Steady income matters — find a job.", "success");
    }
    if (stage === 3 && !shownToasts.has(3)) {
      shownToasts.add(3);
      addToast("First paycheck! 500 DC bonus. Reach level 5 to fully unlock the city.", "success");
    }
    if (stage === 4 && !shownToasts.has(4)) {
      shownToasts.add(4);
      addToast("🏙️ New Vanta Citizen! The full city is yours. 2,000 DC + 'New Vanta Citizen' title awarded.", "success");
    }

    setPrevStage(stage);
  }, [stage, prevStage, addToast]);

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await api.post("/user/skip-onboarding", {});
      setVisible(false);
      await refreshUser();
      addToast("Tutorial skipped. The city is yours.", "info");
    } catch {
      addToast("Something went wrong.", "error");
    } finally {
      setSkipping(false);
    }
  };

  const handleStart = () => {
    setVisible(false);
    onNav("crimes");
  };

  if (stage !== 0) {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(5,5,10,0.92)", backdropFilter: "blur(8px)" }}
        >
          {/* Animated scanlines */}
          <div className="absolute inset-0 pointer-events-none scanlines opacity-30" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative max-w-md w-full mx-4 rounded-lg overflow-hidden"
            style={{
              background: "#0a0a0f",
              border: "1px solid #00d4ff40",
              boxShadow: "0 0 60px #00d4ff20, 0 0 120px #00d4ff08",
            }}
          >
            {/* Top accent bar */}
            <motion.div
              className="h-0.5 w-full"
              style={{ background: "linear-gradient(90deg, transparent, #00d4ff, transparent)" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            <div className="p-8">
              {/* Header */}
              <div className="mb-6">
                <motion.div
                  className="font-display font-black text-2xl tracking-widest uppercase mb-1"
                  style={{ color: "#00d4ff", textShadow: "0 0 20px #00d4ff80" }}
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  WELCOME TO NEW VANTA
                </motion.div>
                <div className="font-mono text-xs" style={{ color: "#475569", letterSpacing: "0.1em" }}>
                  CITIZEN REGISTRATION COMPLETE
                </div>
              </div>

              {/* Message */}
              <div className="mb-6 space-y-3">
                <p className="font-mono text-sm" style={{ color: "#94a3b8", lineHeight: 1.7 }}>
                  Welcome to{" "}
                  <span className="font-bold" style={{ color: "#00d4ff" }}>
                    {user.username}
                  </span>
                  . The city doesn't care about you yet.
                </p>
                <p className="font-mono text-sm" style={{ color: "#94a3b8", lineHeight: 1.7 }}>
                  Start by committing your first crime. Get some{" "}
                  <span style={{ color: "#f59e0b" }}>DC</span>, build your rep,
                  survive long enough to matter.
                </p>

                {/* Reward preview */}
                <div
                  className="rounded p-3 mt-2"
                  style={{ background: "#00d4ff08", border: "1px solid #00d4ff20" }}
                >
                  <div className="font-mono text-xs font-bold mb-1" style={{ color: "#00d4ff", letterSpacing: "0.08em" }}>
                    STARTER REWARD
                  </div>
                  <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                    Complete your first crime → earn{" "}
                    <span style={{ color: "#f59e0b" }}>1,000 DC</span> starter grant
                  </div>
                </div>
              </div>

              {/* Callout arrow pointing down → (to the nav) */}
              <div className="flex justify-center mb-6">
                <motion.div
                  className="flex flex-col items-center gap-1"
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <div className="font-mono text-xs" style={{ color: "#39d353", letterSpacing: "0.1em" }}>
                    HEAD TO CRIMES
                  </div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4v16M5 14l7 7 7-7" stroke="#39d353" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <CyberButton
                  variant="primary"
                  onClick={handleStart}
                  className="flex-1"
                >
                  Start Committing Crimes
                </CyberButton>
              </div>

              <button
                onClick={handleSkip}
                disabled={skipping}
                className="w-full mt-3 font-mono text-xs py-2 rounded transition-colors"
                style={{ color: "#334155", background: "transparent" }}
              >
                {skipping ? "Skipping…" : "I know what I'm doing — skip tutorial"}
              </button>
            </div>

            {/* Bottom accent bar */}
            <motion.div
              className="h-0.5 w-full"
              style={{ background: "linear-gradient(90deg, transparent, #39d35340, transparent)" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
