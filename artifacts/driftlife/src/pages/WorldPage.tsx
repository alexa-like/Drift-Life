import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { User, WorldState } from "../lib/types";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

interface LeaderboardEntry { rank: number; username: string; level: number; faction: string | null; seasonPoints: number; tag: string; tier: string }

export default function WorldPage({ user }: Props) {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<"world" | "season" | "companions">("world");
  const [companions, setCompanions] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    api.get<WorldState>("/world/state").then(setWorld).catch(() => {});
    api.get<LeaderboardEntry[]>("/world/season/leaderboard").then(setLeaderboard).catch(() => {});
    api.get<any[]>("/world/companions/mine").then(setCompanions).catch(() => {});
    api.get<any[]>("/world/companions/catalog").then(setCatalog).catch(() => {});
  }, []);

  async function hireCompanion(type: string) {
    try {
      const r = await api.post<any>("/world/companions/hire", { type });
      setMessage({ text: r.message, type: "success" });
      setCompanions(prev => [...prev, r.companion]);
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  const FACTION_COLORS: Record<string, string> = { suits: "text-blue-400", street: "text-orange-400", grid: "text-purple-400" };
  const TIER_COLORS: Record<string, string> = { Legend: "text-yellow-400", Circuit: "text-blue-400", Underground: "text-purple-400", Street: "text-zinc-400" };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">World</h1>
          <p className="text-zinc-400 text-sm">State · Season · Companions</p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          Season pts: <span className="text-yellow-400 font-mono">{(user.seasonPoints ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-900/50 border border-green-600 text-green-300" : "bg-red-900/50 border border-red-600 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2">
        {(["world","season","companions"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* WORLD STATE */}
      {tab === "world" && world && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-center">
              <div className="text-3xl mb-1">{world.timeOfDay === "night" ? "🌙" : "☀️"}</div>
              <div className="text-xs text-zinc-400">Time of Day</div>
              <div className="text-white font-bold capitalize">{world.timeOfDay}</div>
              {world.nightBonus && <div className="text-xs text-yellow-400 mt-1">Run payout {world.nightBonus.runPayout}</div>}
            </div>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-center">
              <div className="text-3xl mb-1">{world.weather === "rain" ? "🌧️" : "☀️"}</div>
              <div className="text-xs text-zinc-400">Weather</div>
              <div className="text-white font-bold capitalize">{world.weather}</div>
              {world.rainPenalty && <div className="text-xs text-blue-400 mt-1">Grip {world.rainPenalty.grip}</div>}
            </div>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-center">
              <div className="text-3xl mb-1">⬡</div>
              <div className="text-xs text-zinc-400">SIM Price</div>
              <div className="text-cyan-400 font-bold">{world.simPrice.toLocaleString()} DC</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-center">
              <div className="text-3xl mb-1">🌐</div>
              <div className="text-xs text-zinc-400">Season</div>
              <div className="text-white font-bold text-sm">{world.seasonName}</div>
            </div>
          </div>

          {/* Active Events */}
          {world.activeEvents.length > 0 && (
            <div className="bg-zinc-900 border border-yellow-700 rounded-xl p-4">
              <h2 className="font-bold text-yellow-400 mb-3">⚡ Active World Events</h2>
              {world.activeEvents.map(ev => (
                <div key={ev.id} className="bg-zinc-800 rounded-lg p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-white">{ev.name}</p>
                    <span className="text-xs text-zinc-400">Ends {new Date(ev.endsAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(ev.effectModifiers).map(([k, v]) => (
                      <span key={k} className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">{k}: {v}×</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Season progress */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold text-white">Season Timeline</h2>
              <span className="text-xs text-zinc-400">Ends {new Date(world.seasonEndsAt).toLocaleDateString()}</span>
            </div>
            <div className="h-2 bg-zinc-700 rounded-full">
              <div className="h-2 bg-yellow-500 rounded-full" style={{
                width: `${Math.min(100, ((Date.now() - new Date(world.seasonStartsAt).getTime()) / (new Date(world.seasonEndsAt).getTime() - new Date(world.seasonStartsAt).getTime())) * 100)}%`
              }} />
            </div>
          </div>
        </div>
      )}

      {/* SEASON LEADERBOARD */}
      {tab === "season" && (
        <div className="space-y-2">
          <p className="text-zinc-400 text-sm">Top players by season points. Resets each season.</p>
          {leaderboard.map(e => (
            <div key={e.username} className={`bg-zinc-900 border rounded-xl p-3 flex items-center gap-3 ${e.rank <= 3 ? "border-yellow-700" : "border-zinc-700"}`}>
              <span className={`w-8 text-center font-bold text-lg ${e.rank === 1 ? "text-yellow-400" : e.rank === 2 ? "text-zinc-300" : e.rank === 3 ? "text-orange-400" : "text-zinc-500"}`}>
                {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`}
              </span>
              <div className="flex-1">
                <span className="font-bold text-white">{e.username}</span>
                <span className="text-zinc-500 text-xs ml-2">Lv{e.level}</span>
                {e.faction && <span className={`text-xs ml-2 ${FACTION_COLORS[e.faction] ?? "text-zinc-400"}`}>{e.faction}</span>}
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${TIER_COLORS[e.tier] ?? "text-zinc-400"}`}>{e.tier}</p>
                <p className="text-zinc-400 text-xs">{e.seasonPoints.toLocaleString()} pts</p>
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">No season data yet.</p>}
        </div>
      )}

      {/* COMPANIONS */}
      {tab === "companions" && (
        <div className="space-y-4">
          {/* Owned companions */}
          {companions.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-zinc-300 font-bold text-sm">Your Crew</h2>
              {companions.map(c => (
                <div key={c.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl">🤖</span>
                  <div className="flex-1">
                    <p className="font-bold text-white">{c.name}</p>
                    <p className="text-zinc-500 text-xs capitalize">Level {c.level} · {c.type.replace(/_/g," ")}</p>
                  </div>
                  <span className={`text-xs ${c.isActive ? "text-green-400" : "text-zinc-500"}`}>{c.isActive ? "Active" : "Inactive"}</span>
                </div>
              ))}
            </div>
          )}

          {/* Catalog */}
          {companions.length < 3 && (
            <div className="space-y-2">
              <h2 className="text-zinc-300 font-bold text-sm">Hire Companion</h2>
              {catalog.filter(c => !companions.some(owned => owned.type === c.type)).map(c => (
                <div key={c.type} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-bold text-white">{c.name}</p>
                      <p className="text-zinc-400 text-xs">{c.description}</p>
                    </div>
                    <div className="text-right text-xs text-zinc-400">
                      <p className="text-green-400 font-bold">{c.baseCost.toLocaleString()} DC</p>
                      <p>{c.upkeepPerDay.toLocaleString()} DC/day</p>
                    </div>
                  </div>
                  <button onClick={() => hireCompanion(c.type)} disabled={user.dc < c.baseCost}
                    className={`w-full py-1.5 rounded-lg text-sm font-bold ${user.dc >= c.baseCost ? "bg-zinc-700 hover:bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                    {user.dc >= c.baseCost ? "Hire" : "Need more DC"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
