import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { User, District } from "../lib/types";
import { api } from "../lib/api";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { AnimatedCard } from "../components/AnimatedCard";
import { formatDC } from "../lib/format";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigate: (page: string) => void;
}

const DANGER_LABELS = ["", "Safe", "Low", "Medium", "High", "Critical"];
const DANGER_COLORS = ["", "#39d353", "#f59e0b", "#ff6b35", "#ff2d55", "#ef4444"];

function useTravelCountdown(travelArrivesAt: string | null | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!travelArrivesAt) { setLabel(null); return; }
    function calc() {
      const ms = new Date(travelArrivesAt!).getTime() - Date.now();
      if (ms <= 0) { setLabel("Arrived!"); return; }
      const s = Math.ceil(ms / 1000);
      const m = Math.floor(s / 60);
      const rem = s % 60;
      setLabel(m > 0 ? `${m}m ${rem}s` : `${rem}s`);
    }
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [travelArrivesAt]);

  return label;
}

export function TravelPage({ user, refreshUser, addToast, onNavigate }: Props) {
  const [districts, setDistricts]   = useState<District[]>([]);
  const [loading, setLoading]       = useState(true);
  const [departing, setDeparting]   = useState<string | null>(null);
  const [returning, setReturning]   = useState(false);

  const countdown = useTravelCountdown(user.travelArrivesAt);
  const isTraveling = user.status === "traveling";
  const isAbroad    = user.status === "abroad";
  const isNormal    = !user.status || user.status === "normal";

  const load = useCallback(() => {
    setLoading(true);
    api.get<District[]>("/districts")
      .then(setDistricts)
      .catch(() => addToast("Failed to load districts", "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh user when traveling so UI updates when they arrive
  useEffect(() => {
    if (!isTraveling) return;
    const ms = user.travelArrivesAt
      ? Math.max(0, new Date(user.travelArrivesAt).getTime() - Date.now())
      : 5000;
    const t = setTimeout(async () => {
      const updated = await refreshUser();
      if (updated?.status !== "traveling") {
        const dest = updated?.travelingTo;
        if (dest && dest !== "downtown") {
          addToast(`Arrived at ${updated?.currentLocation ?? dest}!`, "success");
          onNavigate("district-hub");
        } else if (dest === "downtown") {
          addToast("Back in Downtown.", "success");
        }
      }
    }, ms + 500);
    return () => clearTimeout(t);
  }, [isTraveling, user.travelArrivesAt]);

  async function handleTravel(districtId: string) {
    setDeparting(districtId);
    try {
      const data = await api.post<any>(`/districts/${districtId}/travel`, {});
      addToast(data.message, "info");
      await refreshUser();
    } catch (err: any) {
      addToast(err.message || "Travel failed", "error");
    } finally {
      setDeparting(null);
    }
  }

  async function handleReturn() {
    setReturning(true);
    try {
      const data = await api.post<any>("/districts/return-home", {});
      addToast(data.message, "info");
      await refreshUser();
    } catch (err: any) {
      addToast(err.message || "Return failed", "error");
    } finally {
      setReturning(false);
    }
  }

  const currentLoc = user.currentLocation || user.district || "downtown";

  return (
    <div className="max-w-3xl mx-auto space-y-4 relative z-10">
      <div className="dl-page-bg" style={{ background: "radial-gradient(circle at center, #001a33 0%, #08080c 100%)" }} />
      {/* Coordinate grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] fixed" style={{
        backgroundImage: "linear-gradient(rgba(56, 189, 248, 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.8) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }} />

      <CyberSectionHeader title="TRAVEL" accent="#38bdf8" cursor />

      {/* Status banner */}
      {isTraveling && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "#0a1a2e",
            border: "1px solid #1e3a5f",
            borderRadius: 8,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>✈️</span>
          <div>
            <p className="font-mono font-bold" style={{ fontSize: 13, color: "#38bdf8" }}>
              En route to {user.travelingTo === "downtown" ? "Downtown" : user.travelingTo?.replace("_", " ")}
            </p>
            <p className="font-mono" style={{ fontSize: 11, color: "#475569" }}>
              Arriving in <span style={{ color: "#f59e0b" }}>{countdown ?? "..."}</span>
            </p>
          </div>
          <div className="flex-1" />
          <div
            style={{
              width: 32, height: 32,
              border: "2px solid #1e3a5f",
              borderTop: "2px solid #38bdf8",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        </motion.div>
      )}

      {/* Abroad banner */}
      {isAbroad && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "#0f0a1a",
            border: "1px solid #4c1d95",
            borderRadius: 8,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>🌐</span>
          <div>
            <p className="font-mono font-bold" style={{ fontSize: 13, color: "#a855f7" }}>
              ABROAD — {currentLoc.replace("_", " ").toUpperCase()}
            </p>
            <p className="font-mono" style={{ fontSize: 11, color: "#475569" }}>
              You're operating outside Downtown. <span
                style={{ color: "#38bdf8", cursor: "pointer" }}
                onClick={() => onNavigate("district-hub")}
              >
                Open District Hub →
              </span>
            </p>
          </div>
          <div className="flex-1" />
          <CyberButton
            variant="ghost"
            size="sm"
            loading={returning}
            onClick={handleReturn}
          >
            ← Return Home
          </CyberButton>
        </motion.div>
      )}

      {/* Energy display */}
      <div className="flex items-center gap-2 px-1">
        <span className="font-mono text-xs" style={{ color: "#475569" }}>
          Your energy: <span style={{ color: "#f59e0b", fontWeight: "bold" }}>
            {user.energy}/{user.maxEnergy}
          </span>
        </span>
        <span className="font-mono text-xs" style={{ color: "#475569" }}>·</span>
        <span className="font-mono text-xs" style={{ color: "#475569" }}>
          Level <span style={{ color: "#e2e8f0", fontWeight: "bold" }}>{user.level}</span>
        </span>
        {isNormal && (
          <>
            <span className="font-mono text-xs" style={{ color: "#475569" }}>·</span>
            <span className="font-mono text-xs" style={{ color: "#475569" }}>
              Currently in <span style={{ color: "#38bdf8" }}>Downtown</span>
            </span>
          </>
        )}
      </div>

      {/* District list */}
      {loading ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#475569" }}>
          Loading districts...
        </div>
      ) : (
        <div className="space-y-3">
          {districts.map((district, i) => {
            const isCurrentLocation = currentLoc === district.id;
            const meetsLevel   = user.level >= district.minLevel;
            const hasEnergy    = user.energy >= district.travelEnergyCost;
            const canTravel    = isNormal && meetsLevel && hasEnergy && !isTraveling;
            const isDestination = isTraveling && user.travelingTo === district.id;

            return (
              <motion.div
                key={district.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
              >
                <AnimatedCard
                  noPad
                  accent={isCurrentLocation ? district.color : isDestination ? "#38bdf8" : "#1e1e2e"}
                >
                  <div className="flex items-stretch gap-0">
                    {/* Color stripe */}
                    <div
                      style={{
                        width: 4,
                        borderRadius: "6px 0 0 6px",
                        background: district.color,
                        opacity: isCurrentLocation || canTravel ? 1 : 0.35,
                        flexShrink: 0,
                      }}
                    />

                    <div className="flex-1 p-4 flex items-center gap-4">
                      {/* District info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-mono font-bold"
                            style={{
                              fontSize: 14,
                              color: meetsLevel ? district.color : "#334155",
                            }}
                          >
                            {district.name}
                          </span>
                          {isCurrentLocation && (
                            <span
                              className="font-mono"
                              style={{
                                fontSize: 9,
                                color: district.color,
                                background: `${district.color}18`,
                                border: `1px solid ${district.color}40`,
                                borderRadius: 3,
                                padding: "1px 5px",
                              }}
                            >
                              HERE
                            </span>
                          )}
                          {isDestination && (
                            <span
                              className="font-mono"
                              style={{
                                fontSize: 9,
                                color: "#38bdf8",
                                background: "#38bdf818",
                                border: "1px solid #38bdf840",
                                borderRadius: 3,
                                padding: "1px 5px",
                              }}
                            >
                              ✈ EN ROUTE
                            </span>
                          )}
                        </div>

                        <p
                          className="font-mono mt-0.5"
                          style={{ fontSize: 10, color: "#475569", lineHeight: 1.4, maxWidth: 400 }}
                        >
                          {district.description}
                        </p>

                        <div className="flex flex-wrap gap-3 mt-2">
                          <span className="font-mono" style={{ fontSize: 10 }}>
                            <span style={{ color: "#475569" }}>Danger: </span>
                            <span style={{ color: DANGER_COLORS[district.dangerLevel], fontWeight: "bold" }}>
                              {DANGER_LABELS[district.dangerLevel]}
                            </span>
                          </span>
                          <span className="font-mono" style={{ fontSize: 10 }}>
                            <span style={{ color: "#475569" }}>Energy: </span>
                            <span style={{ color: hasEnergy ? "#f59e0b" : "#ef4444", fontWeight: "bold" }}>
                              ⚡{district.travelEnergyCost}
                            </span>
                          </span>
                          <span className="font-mono" style={{ fontSize: 10 }}>
                            <span style={{ color: "#475569" }}>Min Level: </span>
                            <span style={{ color: meetsLevel ? "#39d353" : "#ef4444", fontWeight: "bold" }}>
                              {district.minLevel}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex-shrink-0">
                        {isCurrentLocation && isAbroad ? (
                          <CyberButton
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate("district-hub")}
                          >
                            Open Hub
                          </CyberButton>
                        ) : isDestination ? (
                          <span className="font-mono text-xs" style={{ color: "#38bdf8" }}>
                            {countdown ?? "..."}
                          </span>
                        ) : !meetsLevel ? (
                          <span className="font-mono text-xs" style={{ color: "#334155" }}>
                            Need Lv.{district.minLevel}
                          </span>
                        ) : !hasEnergy ? (
                          <span className="font-mono text-xs" style={{ color: "#ef4444" }}>
                            Low energy
                          </span>
                        ) : (
                          <CyberButton
                            variant="primary"
                            size="sm"
                            loading={departing === district.id}
                            disabled={!canTravel || !!departing}
                            onClick={() => handleTravel(district.id)}
                          >
                            Travel →
                          </CyberButton>
                        )}
                      </div>
                    </div>
                  </div>
                </AnimatedCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
