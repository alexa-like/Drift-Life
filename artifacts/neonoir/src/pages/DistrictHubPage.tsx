import { useState, useEffect } from "react";
import { User, District } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { ActionResult } from "../components/ActionResult";
import { ItemImage, nameToArenaItemId } from "../components/ItemImage";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface DistrictShopItem {
  id: string;
  name: string;
  price: number;
  rarity: "common" | "uncommon" | "rare";
  effect: string;
  notes?: string;
}

interface DistrictShopData {
  slug: string;
  shopName: string;
  keeper: string;
  tagline: string;
  restocksAt: string;
  items: DistrictShopItem[];
}

interface DistrictCrime {
  id: string;
  name: string;
  energyCost: number;
  dcMin: number;
  dcMax: number;
  jailChance: number;
  minLevel: number;
  available?: boolean;
}

const TIER_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

const DANGER_LABELS = ["", "Safe", "Low", "Medium", "High", "Critical"];
const DANGER_COLORS = ["", "#39d353", "#f59e0b", "#ff6b35", "#ff2d55", "#ff0000"];

export function DistrictHubPage({ user, refreshUser, addToast }: Props) {
  const [district, setDistrict] = useState<District | null>(null);
  const [shop, setShop] = useState<DistrictShopData | null>(null);
  const [crimes, setCrimes] = useState<DistrictCrime[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [committing, setCommitting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const districtId = user.currentLocation || user.district;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [dData, sData, cData] = await Promise.all([
          api.get<District>(`/districts/${districtId}`),
          api.get<DistrictShopData>(`/districts/${districtId}/shop`).catch(() => null),
          api.get<DistrictCrime[]>("/crimes/district").catch(() => []),
        ]);
        setDistrict(dData);
        setShop(sData);
        setCrimes(cData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [districtId]);

  useEffect(() => {
    if (!shop?.restocksAt) return;
    const tick = () => {
      const diff = new Date(shop.restocksAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Restocking..."); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(h + "h " + m + "m");
    };
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [shop?.restocksAt]);

  async function handleBuy(itemId: string) {
    setBuying(itemId);
    try {
      const data = await api.post<any>(`/districts/${districtId}/shop/buy`, { itemId });
      addToast(data.message, "success");
      await refreshUser();
      // Refresh shop data to get updated user DC indirectly or just trust state
    } catch (err: any) {
      addToast(err.message || "Failed to buy item", "error");
    } finally {
      setBuying(null);
    }
  }

  async function handleCommit(crimeId: string) {
    setCommitting(crimeId);
    setLastResult(null);
    try {
      const data = await api.post<any>(`/crimes/district/${crimeId}/commit`);
      setLastResult(data);
      if (data.success) {
        addToast(`Success! +${data.dcGained} DC`, "success");
      } else {
        addToast(data.jailed ? "Busted!" : "Failed", data.jailed ? "error" : "warning");
      }
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setCommitting(null);
    }
  }

  if (loading) return <div className="text-center py-20 font-mono text-cyan-400">Loading District Hub...</div>;
  if (!district) return <div className="text-center py-20 font-mono text-red-500">District not found</div>;

  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {/* Header Banner */}
      <div 
        className="relative overflow-hidden rounded-xl p-8 border"
        style={{ 
          background: "#0a0a14",
          borderColor: `${district.color}40`,
          boxShadow: `0 0 40px ${district.color}15`
        }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: district.color }} />
            <h1 className="text-3xl font-black font-mono tracking-tighter" style={{ color: district.color, textShadow: `0 0 20px ${district.color}60` }}>
              {district.name.toUpperCase()}
            </h1>
          </div>
          <p className="max-w-xl text-sm font-mono leading-relaxed mb-6" style={{ color: "#94a3b8" }}>
            {district.description}
          </p>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-black/40 border border-white/5 px-4 py-2 rounded-lg">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-mono">Danger Level</div>
              <div className="font-mono font-bold" style={{ color: DANGER_COLORS[district.dangerLevel] }}>
                {DANGER_LABELS[district.dangerLevel]}
              </div>
            </div>
            <div className="bg-black/40 border border-white/5 px-4 py-2 rounded-lg">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-mono">Primary Activity</div>
              <div className="font-mono text-sm text-slate-200">
                {district.primaryActivity}
              </div>
            </div>
          </div>
        </div>
        {/* Background Decorative element */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none" style={{ background: `radial-gradient(circle, ${district.color} 0%, transparent 70%)` }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SHOP SECTION */}
        <div className="space-y-4">
          <CyberSectionHeader title={shop?.shopName || "District Shop"} accent={district.color} />
          {shop ? (
            <div className="space-y-3">
               <div className="flex justify-between items-center px-1">
                 <div className="text-xs font-mono text-slate-500 italic">"{shop.tagline}"</div>
                 <div className="text-[10px] font-mono text-slate-500">Restock: <span style={{ color: district.color }}>{timeLeft}</span></div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {shop.items.map(item => (
                   <div 
                     key={item.id}
                     className="bg-[#111118] border border-slate-800 rounded-lg p-3 flex flex-col gap-2 hover:border-slate-700 transition-colors"
                   >
                     <div className="flex gap-3">
                       <div className="w-12 h-12 flex-shrink-0 bg-black/40 rounded flex items-center justify-center border border-white/5">
                         <ItemImage itemId={nameToArenaItemId(item.name)} size={40} />
                       </div>
                       <div className="min-w-0">
                         <div className="text-xs font-bold text-slate-200 truncate">{item.name}</div>
                         <div className="text-[10px] font-mono" style={{ color: TIER_COLORS[item.rarity] }}>{item.rarity.toUpperCase()}</div>
                       </div>
                     </div>
                     <div className="text-[10px] text-slate-500 font-mono line-clamp-2 h-8">{item.notes}</div>
                     <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-amber-500 font-mono">{item.price.toLocaleString()} DC</span>
                        <CyberButton 
                          size="sm" 
                          variant="primary" 
                          onClick={() => handleBuy(item.id)}
                          loading={buying === item.id}
                          disabled={user.dc < item.price || !!buying}
                        >
                          BUY
                        </CyberButton>
                     </div>
                   </div>
                 ))}
               </div>
               {shop.items.length === 0 && <div className="text-center py-10 text-slate-600 font-mono text-xs border border-dashed border-slate-800 rounded-lg">Out of stock</div>}
            </div>
          ) : (
            <div className="p-8 text-center bg-black/20 rounded-lg border border-slate-800 text-slate-500 font-mono text-sm">
              No shop available in this district.
            </div>
          )}
        </div>

        {/* CRIMES SECTION */}
        <div className="space-y-4">
          <CyberSectionHeader title="District Crimes" accent="#ff2d55" />
          <div className="space-y-3">
            {crimes.map(crime => {
              const available = user.level >= crime.minLevel && !isHosp && !isJailed;
              return (
                <AnimatedCard key={crime.id} noPad accent={available ? "#ff2d55" : "#475569"}>
                  <div className="flex items-center p-3 gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-200">{crime.name}</span>
                        {user.level < crime.minLevel && <span className="text-[10px] font-mono text-red-500">Lv.{crime.minLevel}</span>}
                      </div>
                      <div className="flex gap-3 mt-1 font-mono text-[10px] text-slate-500">
                        <span className="text-orange-500">Energy: {crime.energyCost}</span>
                        <span className="text-amber-500">{formatDC(crime.dcMin)} - {formatDC(crime.dcMax)} DC</span>
                        <span className="text-red-400">Jail: {Math.round(crime.jailChance * 100)}%</span>
                      </div>
                    </div>
                    <CyberButton
                      variant="danger"
                      size="sm"
                      onClick={() => handleCommit(crime.id)}
                      loading={committing === crime.id}
                      disabled={!available || !!committing}
                    >
                      EXECUTE
                    </CyberButton>
                  </div>
                </AnimatedCard>
              );
            })}
            {crimes.length === 0 && (
              <div className="p-8 text-center bg-black/20 rounded-lg border border-slate-800 text-slate-500 font-mono text-sm">
                No local crimes available here.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger Level Reminder Card */}
      <AnimatedCard accent={DANGER_COLORS[district.dangerLevel]}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-2xl">⚠️</div>
            <div>
              <div className="text-sm font-bold font-mono" style={{ color: DANGER_COLORS[district.dangerLevel] }}>
                DANGER ADVISORY: {DANGER_LABELS[district.dangerLevel].toUpperCase()}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Risk of mugging and hospitalization is {district.dangerLevel > 3 ? "EXTREME" : district.dangerLevel > 1 ? "ELEVATED" : "MINIMAL"} in this area.
              </div>
            </div>
          </div>
        </div>
      </AnimatedCard>

      <ActionResult
        visible={!!lastResult}
        type={lastResult?.success ? "success" : "fail"}
        title={lastResult?.success ? "CRIME SUCCESS" : lastResult?.jailed ? "BUSTED" : "CRIME FAILED"}
        detail={lastResult?.narrative}
        onDismiss={() => setLastResult(null)}
      />
    </div>
  );
}
