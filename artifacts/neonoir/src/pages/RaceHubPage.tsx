import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../shared/api";
import { User } from "../shared/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigate: (page: string) => void;
}

interface QueueStatus {
  inQueue: boolean;
  mode: "2player" | "4player" | null;
  queueSize: number;
  activeMatch: { matchId: string; status: string; mode: string } | null;
}

const CAR_STATS: Record<string, { topSpeed: number; accel: number; handling: number; nitro: number; name: string; tier: string }> = {
  rustbucket_common:       { topSpeed: 40,  accel: 30,  handling: 30,  nitro: 20, name: "Rustbucket",        tier: "common" },
  scooter_common:          { topSpeed: 35,  accel: 45,  handling: 50,  nitro: 15, name: "Scooter",           tier: "common" },
  city_bike_common:        { topSpeed: 38,  accel: 42,  handling: 48,  nitro: 18, name: "City Bike",         tier: "common" },
  hatchback_uncommon:      { topSpeed: 55,  accel: 45,  handling: 55,  nitro: 30, name: "Hatchback",         tier: "uncommon" },
  muscle_car_uncommon:     { topSpeed: 65,  accel: 60,  handling: 40,  nitro: 40, name: "Muscle Car",        tier: "uncommon" },
  sport_bike_uncommon:     { topSpeed: 60,  accel: 55,  handling: 50,  nitro: 35, name: "Sport Bike",        tier: "uncommon" },
  sports_car_rare:         { topSpeed: 75,  accel: 70,  handling: 65,  nitro: 50, name: "Sports Car",        tier: "rare" },
  drift_coupe_rare:        { topSpeed: 70,  accel: 65,  handling: 80,  nitro: 55, name: "Drift Coupe",       tier: "rare" },
  racing_motorcycle_rare:  { topSpeed: 72,  accel: 68,  handling: 72,  nitro: 52, name: "Racing Moto",       tier: "rare" },
  supercar_epic:           { topSpeed: 88,  accel: 82,  handling: 75,  nitro: 65, name: "Supercar",          tier: "epic" },
  hyperbike_epic:          { topSpeed: 92,  accel: 88,  handling: 70,  nitro: 60, name: "Hyperbike",         tier: "epic" },
  cyberjet_legendary:      { topSpeed: 100, accel: 95,  handling: 90,  nitro: 85, name: "Cyberjet",          tier: "legendary" },
  neon_beast_legendary:    { topSpeed: 98,  accel: 92,  handling: 95,  nitro: 80, name: "Neon Beast",        tier: "legendary" },
  hovercar_legendary:      { topSpeed: 95,  accel: 90,  handling: 100, nitro: 90, name: "Hovercar",          tier: "legendary" },
};

const TIER_COLORS: Record<string, string> = {
  common: "#6b7280", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};

const RACE_CSS = `
@keyframes queuePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(0.97)} }
@keyframes raceRing { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
@keyframes countIn { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
@keyframes dotBlink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
`;

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>{label}</span>
        <span style={{ fontFamily: "monospace", fontSize: 10, color }}>{value}</span>
      </div>
      <div style={{ background: "#1e293b", borderRadius: 3, height: 5, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

export default function RaceHubPage({ user, addToast, onNavigate }: Props) {
  const [selectedMode, setSelectedMode] = useState<"2player" | "4player">("2player");
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [joining, setJoining] = useState(false);
  const [activeCar, setActiveCar] = useState<{ carId: string; condition: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<QueueStatus>("/race/queue/status");
      setQueueStatus(data);
      if (data.activeMatch) {
        onNavigate("race-match");
      }
    } catch { /* ignore */ }
  }, [onNavigate]);

  useEffect(() => {
    fetchStatus();
    // Also fetch active car from garage (including condition for sidelined check)
    api.get<{ garage: { activeCar?: string; cars?: Array<{ carId: string; condition?: number }> } }>("/garage").catch(() => null).then(d => {
      if (d?.garage?.activeCar) {
        const carEntry = d.garage.cars?.find(c => c.carId === d.garage.activeCar);
        setActiveCar({ carId: d.garage.activeCar, condition: carEntry?.condition ?? 100 });
      }
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (queueStatus?.inQueue) {
      pollRef.current = setInterval(fetchStatus, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [queueStatus?.inQueue, fetchStatus]);

  const joinQueue = async () => {
    setJoining(true);
    try {
      const data = await api.post<{ matchId?: string; status: string }>("/race/queue/join", { mode: selectedMode });
      if (data.matchId) {
        onNavigate("race-match");
      } else {
        await fetchStatus();
        addToast("Joined queue — searching for opponents…", "info");
      }
    } catch (err: any) {
      addToast(err.message ?? "Failed to join queue", "error");
    } finally {
      setJoining(false);
    }
  };

  const leaveQueue = async () => {
    try {
      await api.post("/race/queue/leave", {});
      await fetchStatus();
      addToast("Left queue — energy refunded", "info");
    } catch (err: any) {
      addToast(err.message ?? "Failed to leave queue", "error");
    }
  };

  const isQueued = queueStatus?.inQueue ?? false;
  const queueMode = queueStatus?.mode ?? selectedMode;
  const queueSize = queueStatus?.queueSize ?? 0;
  const needed = queueMode === "2player" ? 2 : 4;
  const carStats = activeCar ? CAR_STATS[activeCar.carId] : CAR_STATS["rustbucket_common"];
  const tierColor = TIER_COLORS[carStats?.tier ?? "common"] ?? "#6b7280";

  const energyCost = selectedMode === "2player" ? 15 : 25;
  const canAfford = user.energy >= energyCost;
  const carSidelined = (activeCar?.condition ?? 100) === 0;
  const canEnterRace = canAfford && !carSidelined;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }} className="relative z-10">
      <div className="dl-page-bg bg-race" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <style>{RACE_CSS}</style>

      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "monospace", fontSize: 20, color: "#00d4ff", fontWeight: "bold", letterSpacing: 2 }}>🏎 RACE HUB</h1>
          <p style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>Choose your mode and hit the track</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}>races: <span style={{ color: "#e2e8f0" }}>{user.totalRaces ?? 0}</span></div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}>wins: <span style={{ color: "#22c55e" }}>{user.raceWins ?? 0}</span></div>
        </div>
      </div>

      {/* Energy bar */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 10, padding: 12, marginBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#f59e0b" }}>⚡ Energy</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#fbbf24" }}>{user.energy} / {user.maxEnergy}</div>
        </div>
        <div style={{ flex: 1, background: "#1e293b", borderRadius: 4, height: 6 }}>
          <div style={{ background: "#f59e0b", height: "100%", borderRadius: 4, width: `${Math.min(100, (user.energy / user.maxEnergy) * 100)}%`, transition: "width 0.5s" }} />
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: canAfford ? "#475569" : "#ef4444" }}>
          {energyCost} EN / race
        </div>
      </div>

      {/* Active car */}
      <div style={{ background: "#0d0d1a", border: `1px solid ${tierColor}30`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginBottom: 8 }}>ACTIVE CAR</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          {/* Car icon */}
          <div style={{
            width: 64, height: 40, borderRadius: 8,
            background: `linear-gradient(135deg, ${tierColor}20, ${tierColor}08)`,
            border: `1px solid ${tierColor}40`, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, flexShrink: 0,
          }}>
            🏎
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: tierColor, marginBottom: 8 }}>
              {carStats?.name ?? "Rustbucket"}
              <span style={{ fontSize: 9, color: tierColor, marginLeft: 6, opacity: 0.7, textTransform: "uppercase" }}>
                [{carStats?.tier ?? "common"}]
              </span>
            </div>
            <StatBar label="TOP SPEED"   value={carStats?.topSpeed  ?? 40} color="#00d4ff" />
            <StatBar label="ACCEL"       value={carStats?.accel     ?? 30} color="#22c55e" />
            <StatBar label="HANDLING"    value={carStats?.handling  ?? 30} color="#f59e0b" />
            <StatBar label="NITRO"       value={carStats?.nitro     ?? 20} color="#ff6b35" />
          </div>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#334155", marginTop: 8 }}>
          Change your active car in Garage
        </div>
      </div>

      {/* Mode select */}
      {!isQueued && (
        <>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginBottom: 8 }}>SELECT MODE</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {(["2player", "4player"] as const).map(mode => {
              const cost = mode === "2player" ? 15 : 25;
              const sel = selectedMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  style={{
                    flex: 1, padding: "14px 12px", borderRadius: 10, cursor: "pointer",
                    fontFamily: "monospace", fontSize: 12, fontWeight: "bold",
                    background: sel ? "#00d4ff18" : "#0a0a14",
                    border: `1px solid ${sel ? "#00d4ff60" : "#1e293b"}`,
                    color: sel ? "#00d4ff" : "#475569",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{mode === "2player" ? "👥" : "👥👥"}</div>
                  <div>{mode === "2player" ? "2-Player" : "4-Player"}</div>
                  <div style={{ fontSize: 10, color: sel ? "#00d4ff90" : "#334155", marginTop: 4 }}>
                    ⚡ {cost} energy
                  </div>
                  <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>
                    {mode === "2player" ? "1v1 race" : "4-way race"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Rewards preview */}
          <div style={{ background: "#0a0a14", border: "1px solid #1e293b", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginBottom: 8 }}>REWARDS</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { place: "🥇 1st", reward: "+300 DC · +300 XP · +1 Shard · 10% Key" },
                { place: "🥈 2nd", reward: "+150 DC · +180 XP" },
                { place: "🥉 3rd", reward: "+80 DC · +100 XP" },
                { place: "4th",   reward: "+40 DC · +60 XP" },
              ].slice(0, selectedMode === "2player" ? 2 : 4).map(r => (
                <div key={r.place} style={{ fontFamily: "monospace", fontSize: 9, color: "#334155" }}>
                  <span style={{ color: "#64748b" }}>{r.place}:</span> {r.reward}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={joinQueue}
            disabled={joining || !canEnterRace}
            title={carSidelined ? "Your car is sidelined — service it before racing" : undefined}
            style={{
              width: "100%", padding: "14px", borderRadius: 10, cursor: canEnterRace ? "pointer" : "not-allowed",
              fontFamily: "monospace", fontSize: 14, fontWeight: "bold", letterSpacing: 2,
              background: canEnterRace ? "linear-gradient(135deg, #00d4ff20, #00d4ff10)" : "#0a0a14",
              border: `1px solid ${canEnterRace ? "#00d4ff60" : "#1e293b"}`,
              color: canEnterRace ? "#00d4ff" : "#334155",
              boxShadow: canEnterRace ? "0 0 16px #00d4ff30" : "none",
              transition: "all 0.2s",
            }}
          >
            {joining ? "JOINING…" : carSidelined ? "⛔ CAR SIDELINED — Service Required" : !canAfford ? `NOT ENOUGH ENERGY (need ${energyCost})` : `▶ JOIN QUEUE — ${selectedMode === "2player" ? "2 PLAYER" : "4 PLAYER"}`}
          </button>
        </>
      )}

      {/* Queue waiting UI */}
      {isQueued && (
        <div style={{ background: "#0a0a14", border: "1px solid #00d4ff30", borderRadius: 12, padding: 28, textAlign: "center" }}>
          {/* Spinner */}
          <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 20px" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              border: "3px solid #1e293b", borderTopColor: "#00d4ff",
              animation: "raceRing 1s linear infinite",
            }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              fontFamily: "monospace", fontSize: 22,
            }}>
              🏎
            </div>
          </div>

          {/* Counter */}
          <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: "bold", color: "#00d4ff", marginBottom: 4,
            animation: "countIn 0.3s ease" }}>
            {queueSize} / {needed}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#475569", marginBottom: 6 }}>
            {queueMode === "2player" ? "2-Player Race" : "4-Player Race"}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#334155", marginBottom: 20, animation: "queuePulse 1.5s ease infinite" }}>
            Searching for opponents
            <span style={{ animation: "dotBlink 1.4s infinite 0s" }}>.</span>
            <span style={{ animation: "dotBlink 1.4s infinite 0.2s" }}>.</span>
            <span style={{ animation: "dotBlink 1.4s infinite 0.4s" }}>.</span>
            {" "}(fills automatically after 30s)
          </div>

          <button
            onClick={leaveQueue}
            style={{
              padding: "10px 24px", borderRadius: 8, cursor: "pointer",
              fontFamily: "monospace", fontSize: 12, fontWeight: "bold",
              background: "#1e293b", border: "1px solid #ef444430", color: "#ef4444",
            }}
          >
            ✕ Cancel — Refund Energy
          </button>
        </div>
      )}
    </div>
  );
}
