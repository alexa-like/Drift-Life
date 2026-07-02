import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { User, Car } from "../lib/types";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

interface CarCatalogEntry { make: string; model: string; year: number; power: number; handling: number; grip: number; nitro: number; price: number; description: string; index: number }
interface PartEntry { id: string; type: string; quality: string; stat: string; baseCost: number; description: string }

const STAT_ICONS: Record<string, string> = { power: "⚡", handling: "🎮", grip: "🔒", nitro: "🚀", durability: "🛡️" };
const QUALITY_COLORS: Record<string, string> = { common: "text-zinc-300", rare: "text-blue-400", legendary: "text-yellow-400" };

export default function GaragePage({ user, onUserUpdate }: Props) {
  const [cars, setCars] = useState<Car[]>([]);
  const [catalog, setCatalog] = useState<CarCatalogEntry[]>([]);
  const [parts, setParts] = useState<PartEntry[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [tab, setTab] = useState<"garage" | "buy" | "tune" | "races">("garage");
  const [tuneStat, setTuneStat] = useState<string>("power");
  const [tunePartId, setTunePartId] = useState<string>("");
  const [tuneEnergy, setTuneEnergy] = useState(3);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [raceMode, setRaceMode] = useState<"drag" | "circuit" | "drift">("drag");
  const [opponentId, setOpponentId] = useState("");
  const [pinkSlip, setPinkSlip] = useState(false);
  const [buyName, setBuyName] = useState("");

  useEffect(() => {
    refreshCars();
    api.get("/garage/catalog").then(r => setCatalog(r.data)).catch(() => {});
    api.get("/garage/parts").then(r => setParts(r.data)).catch(() => {});
  }, []);

  async function refreshCars() {
    try {
      const r = await api.get("/garage");
      setCars(r.data);
      setSelectedCar(prev => r.data.find((c: Car) => c.id === prev?.id) ?? r.data[0] ?? null);
    } catch { /* ignore */ }
  }

  async function buyCar(idx: number) {
    if (loading) return;
    setLoading(true);
    try {
      const r = await api.post("/garage/buy", { carIndex: idx, name: buyName || undefined });
      setMessage({ text: r.data.message, type: "success" });
      await refreshCars();
      onUserUpdate({ ...user, dc: user.dc - catalog[idx].price });
      setTab("garage");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  async function tuneCar() {
    if (!selectedCar || loading) return;
    setLoading(true);
    try {
      const r = await api.post(`/garage/${selectedCar.id}/tune`, {
        stat: tuneStat, partId: tunePartId || undefined, energyToSpend: tuneEnergy,
      });
      setMessage({ text: `+${r.data.gain.toFixed(3)} ${tuneStat} — ${selectedCar.name}`, type: "success" });
      await refreshCars();
      onUserUpdate({ ...user, dc: r.data.dc, energy: r.data.energy });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  async function setActive(carId: string) {
    try {
      await api.post("/garage/set-active", { carId });
      setCars(prev => prev.map(c => ({ ...c, isActive: c.id === carId })));
      onUserUpdate({ ...user, activeCar: carId });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function chopCar(carId: string) {
    if (!confirm("Chop this car for parts? This is irreversible.")) return;
    try {
      const r = await api.post(`/garage/${carId}/chop`, {});
      setMessage({ text: r.data.message, type: "success" });
      await refreshCars();
      onUserUpdate({ ...user, dirtyDc: r.data.dirtyDc });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function startRace() {
    if (!opponentId.trim()) return;
    setLoading(true);
    try {
      const r = await api.post("/races/start", {
        defenderId: opponentId.trim(), raceType: raceMode, isPinkSlip: pinkSlip,
      });
      const d = r.data;
      if (d.raceId) {
        setMessage({ text: `Pink-slip challenge sent (ID: ${d.raceId})`, type: "success" });
      } else {
        const result = d.raceType === "drift"
          ? `${d.winner} wins! ${d.challengerScore} vs ${d.defenderScore} points`
          : `${d.winner} wins! ${d.challengerTime}s vs ${d.defenderTime}s`;
        setMessage({ text: `${result} | +${d.prize?.toLocaleString()} DC`, type: d.challengerWins ? "success" : "error" });
        onUserUpdate({ ...user, dc: d.challengerWins ? user.dc + d.prize : user.dc - d.prize });
      }
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  const StatBar = ({ label, value, max = 100, icon }: { label: string; value: number; max?: number; icon: string }) => (
    <div>
      <div className="flex justify-between text-xs text-zinc-400 mb-0.5">
        <span>{icon} {label}</span>
        <span className="font-mono text-white">{value.toFixed ? value.toFixed(1) : value}</span>
      </div>
      <div className="h-2 bg-zinc-700 rounded-full">
        <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Garage</h1>
          <p className="text-zinc-400 text-sm">Cars. Tuning. Street racing.</p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          DC: <span className="text-green-400 font-mono">{user.dc.toLocaleString()}</span>
          <br />Energy: <span className="text-blue-300">{user.energy}/{user.maxEnergy}</span>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-900/50 border border-green-600 text-green-300" : "bg-red-900/50 border border-red-600 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["garage", "buy", "tune", "races"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {t === "garage" ? "My Cars" : t === "buy" ? "Buy Car" : t === "tune" ? "Tune" : "Race"}
          </button>
        ))}
      </div>

      {/* MY CARS */}
      {tab === "garage" && (
        <div className="space-y-3">
          {cars.length === 0 && (
            <div className="text-center py-10">
              <p className="text-zinc-400">No cars yet.</p>
              <button onClick={() => setTab("buy")} className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold">Browse Cars</button>
            </div>
          )}
          {cars.map(car => (
            <div key={car.id} className={`bg-zinc-900 border rounded-xl p-4 space-y-3 ${car.isActive ? "border-blue-500" : "border-zinc-700"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏎️</span>
                    <div>
                      <p className="font-bold text-white">{car.name}</p>
                      <p className="text-xs text-zinc-500">{car.year} {car.make} {car.model}</p>
                    </div>
                    {car.isActive && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Active</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>🏁 {car.raceWins}W / {car.raceLosses}L</p>
                  {car.impoundedUntil && new Date(car.impoundedUntil) > new Date() && (
                    <p className="text-red-400">Impounded</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatBar label="Power"    value={car.power}    max={50} icon="⚡" />
                <StatBar label="Handling" value={car.handling} max={50} icon="🎮" />
                <StatBar label="Grip"     value={car.grip}     max={50} icon="🔒" />
                <StatBar label="Nitro"    value={car.nitro}    max={50} icon="🚀" />
              </div>
              <StatBar label="Durability" value={car.durability} max={car.maxDurability} icon="🛡️" />

              <div className="flex gap-2 flex-wrap">
                {!car.isActive && (
                  <button onClick={() => setActive(car.id)} className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs font-bold text-white">Set Active</button>
                )}
                <button onClick={() => { setSelectedCar(car); setTab("tune"); }} className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-white">Tune</button>
                <button onClick={() => chopCar(car.id)} className="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-xs text-red-300">Chop</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BUY CAR */}
      {tab === "buy" && (
        <div className="space-y-3">
          <input value={buyName} onChange={e => setBuyName(e.target.value)} placeholder="Custom name (optional)"
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-2" />
          {catalog.map(c => (
            <div key={c.index} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">{c.make} {c.model}</p>
                  <p className="text-zinc-500 text-xs">{c.year} — {c.description}</p>
                </div>
                <span className="text-green-400 font-bold text-sm">{c.price.toLocaleString()} DC</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-zinc-400">
                <span>⚡ {c.power}</span>
                <span>🎮 {c.handling}</span>
                <span>🔒 {c.grip}</span>
                <span>🚀 {c.nitro}</span>
              </div>
              <button onClick={() => buyCar(c.index)} disabled={user.dc < c.price || loading || cars.length >= 5}
                className={`w-full py-2 rounded-lg text-sm font-bold ${user.dc >= c.price && !loading && cars.length < 5 ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                {cars.length >= 5 ? "Garage Full" : user.dc < c.price ? "Not enough DC" : "Buy"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TUNE */}
      {tab === "tune" && (
        <div className="space-y-4">
          {/* Car selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cars.map(c => (
              <button key={c.id} onClick={() => setSelectedCar(c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm border ${selectedCar?.id === c.id ? "border-blue-500 bg-zinc-800 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`}>
                {c.name}
              </button>
            ))}
          </div>

          {selectedCar && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-4">
              <h2 className="font-bold text-white">{selectedCar.name}</h2>

              <div>
                <p className="text-zinc-400 text-sm mb-2">Stat to tune:</p>
                <div className="grid grid-cols-5 gap-2">
                  {["power","handling","grip","nitro","durability"].map(s => (
                    <button key={s} onClick={() => setTuneStat(s)}
                      className={`p-2 rounded-lg text-xs font-bold border transition-all ${tuneStat === s ? "border-blue-500 bg-zinc-700 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
                      {STAT_ICONS[s]} {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-zinc-400 text-sm mb-2">Install part (optional — improves gain rate):</p>
                <select value={tunePartId} onChange={e => setTunePartId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="">No part (manual tuning)</option>
                  {parts.filter(p => {
                    const statMap: Record<string, string[]> = {
                      power: ["turbo_kit"], handling: ["sport_suspension"], grip: ["racing_slicks"], nitro: ["nos_canister"]
                    };
                    return (statMap[tuneStat] ?? []).includes(p.type);
                  }).map(p => (
                    <option key={p.id} value={p.id}>{p.quality.toUpperCase()} {p.type.replace(/_/g," ")} — {p.baseCost.toLocaleString()} DC</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-zinc-400 text-sm mb-1">Energy to spend: <span className="text-blue-300">{tuneEnergy}</span></p>
                <input type="range" min={1} max={10} value={tuneEnergy} onChange={e => setTuneEnergy(Number(e.target.value))}
                  className="w-full" />
              </div>

              <button onClick={tuneCar} disabled={loading || user.energy < tuneEnergy}
                className={`w-full py-3 rounded-xl font-bold ${!loading && user.energy >= tuneEnergy ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                {loading ? "Tuning…" : `Tune ${STAT_ICONS[tuneStat]} ${tuneStat}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* RACES */}
      {tab === "races" && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-white text-lg">Street Race</h2>
          {!selectedCar && (
            <p className="text-zinc-400 text-sm">Get a car from the Garage tab first.</p>
          )}
          {selectedCar && (
            <>
              <p className="text-zinc-400 text-sm">Active car: <span className="text-white font-bold">{cars.find(c => c.isActive)?.name ?? selectedCar.name}</span></p>

              <div>
                <p className="text-zinc-400 text-sm mb-2">Race type:</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["drag","circuit","drift"] as const).map(rt => (
                    <button key={rt} onClick={() => setRaceMode(rt)}
                      className={`py-2 rounded-lg text-sm font-bold border capitalize ${raceMode === rt ? "border-blue-500 bg-zinc-700 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
                      {rt === "drag" ? "🏁 Drag" : rt === "circuit" ? "🔄 Circuit" : "💨 Drift"}
                    </button>
                  ))}
                </div>
              </div>

              <input value={opponentId} onChange={e => setOpponentId(e.target.value)} placeholder="Opponent player ID"
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />

              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={pinkSlip} onChange={e => setPinkSlip(e.target.checked)} className="accent-red-500" />
                <span>Pink-Slip race <span className="text-red-400">(winner takes loser's car)</span></span>
              </label>

              <button onClick={startRace} disabled={loading || !opponentId.trim()}
                className={`w-full py-3 rounded-xl font-bold text-lg ${!loading && opponentId.trim() ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                {loading ? "Racing…" : pinkSlip ? "🏆 Issue Pink-Slip Challenge" : "🏎️ Race Now"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
