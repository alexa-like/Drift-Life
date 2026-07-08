/**
 * StorePage — NC (Nova Credits) packs + subscription tier selection via Telegram Stars.
 *
 * Two tabs: NC Packs / Subscriptions
 * Handles: Telegram link flow (inline modal), daily claim widget, tier cards.
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreStatus {
  nc: number;
  subscriptionTier: string | null;
  subscriptionExpiresAt: string | null;
  subDaysLeft: number;
  claimedToday: boolean;
  ncClaimStreak: number;
  ncRolloverDays: number;
  nextClaimAmount: number;
  telegramLinked: boolean;
  telegramUsername: string | null;
  ncPacks: NcPack[];
  tiers: TierInfo[];
}

interface NcPack {
  id: string;
  nc: number;
  stars: number;
  bonusPct: number;
  label: string;
}

interface TierInfo {
  id: string;
  name: string;
  starsPerMonth: number;
  ncPrice: number;
  dailyNc: number;
  jobXpMult: number;
  crimeRewardMult: number;
  extraCrimeSlots: number;
  hospitalSpeedPct: number;
  extraGymSessions: number;
  bankInterestBonus: number;
  monthlyNc: number;
  chatColor: string;
  frameId: string;
  themes: string[];
}

interface LinkInitResponse {
  code: string;
  botDeepLink: string;
  instructions: string;
  expiresInMinutes: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_ORDER = ["street_runner", "neon_syndicate", "apex_sovereign"];
const TIER_BADGE: Record<string, string> = {
  street_runner:  "◈",
  neon_syndicate: "◉",
  apex_sovereign: "♛",
};
const TIER_COLOR: Record<string, string> = {
  street_runner:  "#00E0FF",
  neon_syndicate: "#FF4FA3",
  apex_sovereign: "#FFD700",
};
const TIER_GRADIENT: Record<string, string> = {
  street_runner:  "linear-gradient(135deg, #001a2e 0%, #003a5e 100%)",
  neon_syndicate: "linear-gradient(135deg, #1a0010 0%, #3d0030 100%)",
  apex_sovereign: "linear-gradient(135deg, #1a1500 0%, #3d3200 100%)",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  user: any;
  onUserUpdate?: () => void;
  onNavigate?: (page: string) => void;
}

export function StorePage({ user, onUserUpdate, onNavigate }: Props) {
  const [tab, setTab] = useState<"nc" | "subs">("nc");
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);

  // Telegram link modal state
  const [linkData, setLinkData] = useState<LinkInitResponse | null>(null);
  const [linkPollActive, setLinkPollActive] = useState(false);

  // NC subscription payment state
  // ncConfirm = tierId pending confirmation, ncBuying = tierId currently processing
  const [ncConfirm, setNcConfirm] = useState<string | null>(null);
  const [ncBuying, setNcBuying] = useState<string | null>(null);
  const [ncBuyResult, setNcBuyResult] = useState<{ tierId: string; msg: string; ok: boolean } | null>(null);

  // Gift NC modal
  const [giftModal, setGiftModal] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState("");
  const [giftAmount, setGiftAmount] = useState(100);
  const [giftMsg, setGiftMsg] = useState<string | null>(null);
  const [gifting, setGifting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.get<StoreStatus>("/store/status");
      setStatus(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Poll for Telegram link completion
  useEffect(() => {
    if (!linkPollActive) return;
    const interval = setInterval(async () => {
      try {
        const r = await api.get<{ linked: boolean }>("/telegram/status");
        if (r.linked) {
          setLinkPollActive(false);
          setLinkData(null);
          await loadStatus();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [linkPollActive, loadStatus]);

  async function handleLinkTelegram() {
    try {
      const data = await api.post<LinkInitResponse>("/telegram/link-init");
      setLinkData(data);
      setLinkPollActive(true);
    } catch (e: any) {
      alert(e.message || "Failed to generate link code");
    }
  }

  async function handleBuy(productId: string) {
    if (!status?.telegramLinked) {
      handleLinkTelegram();
      return;
    }
    setBuying(productId);
    try {
      const r = await api.post<{ invoiceLink?: string }>("/store/create-invoice", { productId });
      if (r.invoiceLink) {
        window.open(r.invoiceLink, "_blank");
        // Poll for balance change
        setTimeout(loadStatus, 5000);
        setTimeout(loadStatus, 15000);
        setTimeout(loadStatus, 30000);
      }
    } catch (e: any) {
      if (e.message?.includes("not configured")) {
        alert("Telegram payments are being set up. Check back soon!");
      } else {
        alert(e.message || "Failed to create invoice");
      }
    } finally {
      setBuying(null);
    }
  }

  async function handleBuyWithNC(tierId: string) {
    setNcBuying(tierId);
    setNcBuyResult(null);
    try {
      const r = await api.post<{ message: string }>("/store/buy-subscription-nc", { tierId });
      setNcBuyResult({ tierId, msg: r.message, ok: true });
      onUserUpdate?.();
      await loadStatus();
    } catch (e: any) {
      setNcBuyResult({ tierId, msg: e.message || "Purchase failed", ok: false });
    } finally {
      setNcBuying(null);
      setNcConfirm(null);
    }
  }

  async function handleClaimDaily() {
    setClaiming(true);
    setClaimResult(null);
    try {
      const r = await api.post<{ message: string }>("/store/claim-daily-nc");
      setClaimResult(r.message);
      onUserUpdate?.();
      await loadStatus();
    } catch (e: any) {
      setClaimResult(e.message || "Already claimed today");
    } finally {
      setClaiming(false);
    }
  }

  async function handleGift() {
    setGifting(true);
    setGiftMsg(null);
    try {
      const r = await api.post<{ message: string }>("/store/gift-nc", { recipientUsername: giftRecipient, amount: giftAmount });
      setGiftMsg(r.message);
      onUserUpdate?.();
      await loadStatus();
      setTimeout(() => setGiftModal(false), 2000);
    } catch (e: any) {
      setGiftMsg(e.message || "Gift failed");
    } finally {
      setGifting(false);
    }
  }

  const activeTier = status?.subscriptionTier;
  const activeTierInfo = status?.tiers.find(t => t.id === activeTier);
  const nc = status?.nc ?? (user?.nc ?? 0);

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-mono" style={{ color: "#00E0FF" }}>STORE</h1>
          <p className="text-xs font-mono" style={{ color: "#475569" }}>New Vanta · Premium Shop</p>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-lg" style={{ color: "#a855f7" }}>
            💎 {nc.toLocaleString()} NC
          </div>
          {activeTier && activeTierInfo && (
            <div className="text-xs font-mono" style={{ color: TIER_COLOR[activeTier] }}>
              {TIER_BADGE[activeTier]} {activeTierInfo.name} · {status?.subDaysLeft}d left
            </div>
          )}
        </div>
      </div>

      {/* ── Telegram not linked warning ─────────────────────────────────────── */}
      {status && !status.telegramLinked && (
        <div style={{ background: "#0a0a14", border: "1px solid #FF4FA355", borderRadius: 10, padding: 14 }}>
          <div className="font-mono text-sm font-bold mb-1" style={{ color: "#FF4FA3" }}>
            📱 Link Telegram to purchase
          </div>
          <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>
            DriftLife uses Telegram Stars for payments. Link your account to buy NC packs or subscribe.
          </div>
          <button
            onClick={handleLinkTelegram}
            className="font-mono text-xs font-bold px-4 py-2 rounded"
            style={{ background: "#0088cc", color: "#fff" }}
          >
            🔗 Link Telegram Account
          </button>
        </div>
      )}

      {/* ── Telegram link modal ──────────────────────────────────────────────── */}
      {linkData && (
        <div style={{ background: "#0a0a14", border: "1px solid #0088cc55", borderRadius: 10, padding: 16 }}>
          <div className="font-mono text-sm font-bold mb-2" style={{ color: "#0088cc" }}>
            📱 Link Your Telegram
          </div>
          <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>
            1. Tap the button below to open the bot<br/>
            2. Send your code: <span className="font-bold" style={{ color: "#00E0FF", letterSpacing: 3 }}>{linkData.code}</span><br/>
            3. Come back — this screen will update automatically
          </div>
          <div className="flex gap-2">
            <a
              href={linkData.botDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs font-bold px-4 py-2 rounded"
              style={{ background: "#0088cc", color: "#fff" }}
            >
              Open Telegram Bot ↗
            </a>
            <button
              onClick={() => { setLinkData(null); setLinkPollActive(false); }}
              className="font-mono text-xs px-3 py-2 rounded"
              style={{ background: "#1e1e2e", color: "#475569", border: "1px solid #2a2a3e" }}
            >
              Cancel
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-2 h-2 rounded-full" style={{ background: "#00E0FF", animation: "pulse 1.5s ease-in-out infinite" }} />
            <span className="font-mono text-xs" style={{ color: "#475569" }}>Waiting for confirmation…</span>
          </div>
        </div>
      )}

      {/* ── Active subscription: daily claim widget ──────────────────────────── */}
      {activeTier && activeTierInfo && status && (
        <div style={{
          background: TIER_GRADIENT[activeTier],
          border: `1px solid ${TIER_COLOR[activeTier]}40`,
          borderRadius: 12, padding: 16,
        }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-xs font-bold" style={{ color: TIER_COLOR[activeTier] }}>
                {TIER_BADGE[activeTier]} {activeTierInfo.name}
              </div>
              <div className="font-mono text-xs" style={{ color: "#475569" }}>
                {status.subDaysLeft} days remaining · Streak: {status.ncClaimStreak} days
                {status.ncRolloverDays > 0 && ` · ${status.ncRolloverDays}d rollover`}
              </div>
            </div>
            {status.ncClaimStreak > 0 && (
              <div className="font-mono text-xl font-black" title="Claim streak">
                {'🔥'.repeat(Math.min(status.ncClaimStreak, 7))}
              </div>
            )}
          </div>

          {claimResult && (
            <div className="font-mono text-xs mb-2 p-2 rounded" style={{ background: "#00000040", color: "#a0a0c0" }}>
              {claimResult}
            </div>
          )}

          <button
            onClick={handleClaimDaily}
            disabled={status.claimedToday || claiming}
            className="w-full font-mono text-sm font-bold py-2 rounded transition-opacity"
            style={{
              background: status.claimedToday ? "#1e1e2e" : TIER_COLOR[activeTier],
              color: status.claimedToday ? "#475569" : "#000",
              opacity: claiming ? 0.7 : 1,
              cursor: status.claimedToday ? "default" : "pointer",
            }}
          >
            {claiming ? "Claiming…" :
             status.claimedToday ? `✓ Claimed today (${activeTierInfo.dailyNc} NC)` :
             `Claim ${status.nextClaimAmount} NC ${status.ncClaimStreak % 6 === 5 ? '🔥 Streak bonus tomorrow!' : ''}`}
          </button>

          <div className="flex gap-2 mt-2 flex-wrap">
            <div className="font-mono text-xs py-1 px-2 rounded" style={{ background: "#00000040", color: "#64748b" }}>
              XP ×{activeTierInfo.jobXpMult}
            </div>
            <div className="font-mono text-xs py-1 px-2 rounded" style={{ background: "#00000040", color: "#64748b" }}>
              Crime ×{activeTierInfo.crimeRewardMult}
            </div>
            {activeTierInfo.hospitalSpeedPct > 0 && (
              <div className="font-mono text-xs py-1 px-2 rounded" style={{ background: "#00000040", color: "#64748b" }}>
                Hospital -{activeTierInfo.hospitalSpeedPct}%
              </div>
            )}
            {activeTierInfo.extraGymSessions > 0 && (
              <div className="font-mono text-xs py-1 px-2 rounded" style={{ background: "#00000040", color: "#64748b" }}>
                +{activeTierInfo.extraGymSessions} gym/hr
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 rounded overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
        {[
          { key: "nc",   label: "💎 NC Packs"        },
          { key: "subs", label: "⭐ Subscriptions"    },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "nc" | "subs")}
            className="flex-1 font-mono text-xs font-bold py-2 transition-colors"
            style={{
              background: tab === t.key ? "#0f0f1a" : "#070710",
              color: tab === t.key ? "#00E0FF" : "#475569",
              borderBottom: tab === t.key ? "2px solid #00E0FF" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center font-mono text-sm py-8" style={{ color: "#475569" }}>Loading store…</div>
      )}

      {/* ── NC Packs tab ─────────────────────────────────────────────────────── */}
      {!loading && tab === "nc" && status && (
        <div className="space-y-3">
          <div className="font-mono text-xs" style={{ color: "#475569" }}>
            NC (Nova Credits) are the premium currency — used for exclusive frames, premium royale spins, and gifting.
            Purchased via Telegram Stars ⭐.
          </div>

          <div className="grid grid-cols-2 gap-3">
            {status.ncPacks.map(pack => (
              <div
                key={pack.id}
                style={{
                  background: "#0a0a14",
                  border: "1px solid #1e1e2e",
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  position: "relative",
                }}
              >
                {pack.bonusPct > 0 && (
                  <div style={{
                    position: "absolute", top: -8, right: 10,
                    background: "#a855f7", color: "#fff",
                    fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                    padding: "2px 6px", borderRadius: 4,
                  }}>
                    +{pack.bonusPct}% BONUS
                  </div>
                )}
                <div className="font-mono font-black text-lg" style={{ color: "#a855f7" }}>
                  {pack.nc.toLocaleString()} NC
                </div>
                <div className="font-mono text-xs" style={{ color: "#64748b" }}>{pack.label}</div>
                <button
                  onClick={() => handleBuy(pack.id)}
                  disabled={buying === pack.id}
                  className="font-mono text-xs font-bold py-2 rounded mt-1 transition-opacity"
                  style={{
                    background: "#0088cc",
                    color: "#fff",
                    opacity: buying === pack.id ? 0.6 : 1,
                    cursor: "pointer",
                  }}
                >
                  {buying === pack.id ? "Opening…" : `⭐ ${pack.stars} Stars`}
                </button>
              </div>
            ))}
          </div>

          {/* NC Gifting */}
          <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 10, padding: 14 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-bold" style={{ color: "#a0a0c0" }}>Gift NC to a player</div>
                <div className="font-mono text-xs" style={{ color: "#475569" }}>100–10,000 NC · 10% fee applies</div>
              </div>
              <button
                onClick={() => setGiftModal(!giftModal)}
                className="font-mono text-xs px-3 py-1 rounded"
                style={{ background: "#1e1e2e", color: "#a855f7", border: "1px solid #a855f740" }}
              >
                🎁 Gift
              </button>
            </div>
            {giftModal && (
              <div className="space-y-2 mt-3">
                <input
                  type="text"
                  placeholder="Recipient username"
                  value={giftRecipient}
                  onChange={e => setGiftRecipient(e.target.value)}
                  className="w-full font-mono text-xs p-2 rounded"
                  style={{ background: "#070710", border: "1px solid #1e1e2e", color: "#e2e8f0" }}
                />
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={giftAmount}
                    onChange={e => setGiftAmount(Number(e.target.value))}
                    className="flex-1 font-mono text-xs p-2 rounded"
                    style={{ background: "#070710", border: "1px solid #1e1e2e", color: "#e2e8f0" }}
                  />
                  <span className="font-mono text-xs" style={{ color: "#475569" }}>
                    NC (fee: {Math.ceil(giftAmount * 0.1)})
                  </span>
                </div>
                {giftMsg && (
                  <div className="font-mono text-xs" style={{ color: giftMsg.includes("Gift") ? "#a855f7" : "#FF4FA3" }}>
                    {giftMsg}
                  </div>
                )}
                <button
                  onClick={handleGift}
                  disabled={gifting || !giftRecipient || giftAmount < 100}
                  className="font-mono text-xs font-bold px-4 py-2 rounded"
                  style={{ background: gifting ? "#1e1e2e" : "#a855f720", color: "#a855f7", border: "1px solid #a855f740" }}
                >
                  {gifting ? "Sending…" : `Send ${giftAmount} NC`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Subscriptions tab ───────────────────────────────────────────────── */}
      {!loading && tab === "subs" && status && (
        <div className="space-y-3">
          {/* Payment method legend */}
          <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 8, padding: "10px 14px" }}>
            <div className="font-mono text-xs font-bold mb-1" style={{ color: "#a0a0c0" }}>
              Two ways to subscribe — same perks, your choice:
            </div>
            <div className="flex gap-4">
              <div className="font-mono text-xs" style={{ color: "#475569" }}>
                <span style={{ color: "#0088cc" }}>⭐ Telegram Stars</span> — pay via Telegram (real money)
              </div>
              <div className="font-mono text-xs" style={{ color: "#475569" }}>
                <span style={{ color: "#a855f7" }}>💎 NC</span> — spend in-game Nova Credits
              </div>
            </div>
            <div className="font-mono text-xs mt-1" style={{ color: "#334155" }}>
              You have <span style={{ color: "#a855f7", fontWeight: 700 }}>{nc.toLocaleString()} NC</span> available.
            </div>
          </div>

          {TIER_ORDER.map(tierId => {
            const tier = status.tiers.find(t => t.id === tierId);
            if (!tier) return null;
            const isActive = activeTier === tierId;
            const color = TIER_COLOR[tierId];
            const badge = TIER_BADGE[tierId];
            const canAffordNc = nc >= tier.ncPrice;
            const isNcConfirming = ncConfirm === tierId;
            const isNcBuying = ncBuying === tierId;
            const ncResult = ncBuyResult?.tierId === tierId ? ncBuyResult : null;

            return (
              <div
                key={tierId}
                style={{
                  background: isActive ? TIER_GRADIENT[tierId] : "#0a0a14",
                  border: `1px solid ${isActive ? color + "60" : "#1e1e2e"}`,
                  borderRadius: 12, padding: 16,
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-mono text-base font-black" style={{ color }}>
                      {badge} {tier.name}
                    </div>
                    <div className="font-mono text-xs" style={{ color: "#475569" }}>
                      ⭐ {tier.starsPerMonth} Stars <span style={{ color: "#334155" }}>or</span>{" "}
                      💎 {tier.ncPrice.toLocaleString()} NC /month ·{" "}
                      <span style={{ color: "#22c55e" }}>{tier.dailyNc * 30} NC/month value</span>
                    </div>
                  </div>
                  {isActive && (
                    <div className="font-mono text-xs px-2 py-1 rounded" style={{ background: color + "20", color }}>
                      ACTIVE
                    </div>
                  )}
                </div>

                {/* Feature grid */}
                <div className="grid grid-cols-2 gap-1 mb-3">
                  {[
                    { label: `${tier.dailyNc} NC/day`, icon: "💎" },
                    { label: `XP ×${tier.jobXpMult}`, icon: "📈" },
                    { label: `Crime ×${tier.crimeRewardMult}`, icon: "💰" },
                    { label: `+${tier.extraCrimeSlots} crime slots/hr`, icon: "⚡" },
                    ...(tier.hospitalSpeedPct > 0 ? [{ label: `Hospital -${tier.hospitalSpeedPct}%`, icon: "🏥" }] : []),
                    ...(tier.extraGymSessions > 0 ? [{ label: `+${tier.extraGymSessions} gym/hr`, icon: "💪" }] : []),
                    ...(tier.bankInterestBonus > 0 ? [{ label: `Bank +${tier.bankInterestBonus}% interest`, icon: "🏦" }] : []),
                    ...(tier.monthlyNc > 0 ? [{ label: `${tier.monthlyNc} NC bonus`, icon: "💎" }] : []),
                    { label: "Exclusive chat frame", icon: "🖼" },
                    { label: `${tier.themes.length} theme${tier.themes.length > 1 ? "s" : ""} unlocked`, icon: "🎨" },
                    { label: "Subscriber badge", icon: "✨" },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span style={{ fontSize: 10 }}>{f.icon}</span>
                      <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{f.label}</span>
                    </div>
                  ))}
                </div>

                {/* Value callout */}
                <div className="font-mono text-xs mb-3 p-2 rounded" style={{ background: "#00000040", color: "#22c55e" }}>
                  💡 Daily NC value ({tier.dailyNc * 30} NC/month) exceeds the subscription NC cost — you get more than you spend.
                </div>

                {/* NC buy result banner */}
                {ncResult && (
                  <div
                    className="font-mono text-xs mb-2 p-2 rounded"
                    style={{ background: ncResult.ok ? "#a855f715" : "#FF4FA315", color: ncResult.ok ? "#a855f7" : "#FF4FA3", border: `1px solid ${ncResult.ok ? "#a855f730" : "#FF4FA330"}` }}
                  >
                    {ncResult.msg}
                  </div>
                )}

                {isActive ? (
                  <div
                    className="w-full font-mono text-sm font-bold py-2 rounded text-center"
                    style={{ background: "#1e1e2e", color: "#475569" }}
                  >
                    ✓ Subscribed ({status.subDaysLeft}d left)
                  </div>
                ) : (
                  <>
                    {/* Telegram Stars button */}
                    <button
                      onClick={() => handleBuy(tierId)}
                      disabled={!!buying}
                      className="w-full font-mono text-sm font-bold py-2 rounded transition-opacity mb-2"
                      style={{
                        background: color,
                        color: "#000",
                        opacity: buying === tierId ? 0.6 : 1,
                        cursor: "pointer",
                      }}
                    >
                      {buying === tierId ? "Opening Telegram…" : `⭐ ${tier.starsPerMonth} Stars via Telegram`}
                    </button>

                    {/* NC payment — confirm → buy flow */}
                    {isNcConfirming ? (
                      <div
                        className="p-3 rounded"
                        style={{ background: "#a855f715", border: "1px solid #a855f740" }}
                      >
                        <div className="font-mono text-xs mb-2" style={{ color: "#a855f7" }}>
                          Spend <b>{tier.ncPrice.toLocaleString()} NC</b> on {tier.name}?
                          <br />
                          <span style={{ color: "#475569" }}>Your balance: {nc.toLocaleString()} NC → {(nc - tier.ncPrice).toLocaleString()} NC after</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleBuyWithNC(tierId)}
                            disabled={isNcBuying}
                            className="flex-1 font-mono text-xs font-bold py-2 rounded"
                            style={{ background: "#a855f7", color: "#fff", opacity: isNcBuying ? 0.6 : 1 }}
                          >
                            {isNcBuying ? "Processing…" : "✓ Confirm"}
                          </button>
                          <button
                            onClick={() => setNcConfirm(null)}
                            disabled={isNcBuying}
                            className="font-mono text-xs px-4 py-2 rounded"
                            style={{ background: "#1e1e2e", color: "#475569", border: "1px solid #2a2a3e" }}
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => canAffordNc ? setNcConfirm(tierId) : undefined}
                        disabled={!canAffordNc || !!ncBuying}
                        className="w-full font-mono text-sm font-bold py-2 rounded transition-opacity"
                        style={{
                          background: canAffordNc ? "#a855f720" : "#1e1e2e",
                          color: canAffordNc ? "#a855f7" : "#334155",
                          border: `1px solid ${canAffordNc ? "#a855f740" : "#1e1e2e"}`,
                          cursor: canAffordNc ? "pointer" : "default",
                        }}
                        title={canAffordNc ? undefined : `Need ${tier.ncPrice.toLocaleString()} NC — you have ${nc.toLocaleString()}`}
                      >
                        {canAffordNc
                          ? `💎 ${tier.ncPrice.toLocaleString()} NC (in-game Nova Credits)`
                          : `💎 ${tier.ncPrice.toLocaleString()} NC needed (have ${nc.toLocaleString()})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}

          <div className="font-mono text-xs text-center" style={{ color: "#334155" }}>
            ⭐ Stars payments processed by Telegram — no refunds per Telegram policy<br />
            💎 NC purchases are instant and final · Subscriptions do not auto-renew
          </div>
        </div>
      )}

      {/* ── Telegram linked status ───────────────────────────────────────────── */}
      {status?.telegramLinked && (
        <div className="flex items-center justify-between p-3 rounded" style={{ background: "#0a0a14", border: "1px solid #1e1e2e" }}>
          <div className="font-mono text-xs" style={{ color: "#22c55e" }}>
            ✓ Telegram linked{status.telegramUsername ? ` (@${status.telegramUsername})` : ""}
          </div>
          <button
            onClick={async () => {
              if (confirm("Unlink your Telegram account? You'll need to re-link to make purchases.")) {
                await api.post("/telegram/unlink");
                await loadStatus();
              }
            }}
            className="font-mono text-xs"
            style={{ color: "#475569", background: "none", border: "none", cursor: "pointer" }}
          >
            Unlink
          </button>
        </div>
      )}
    </div>
  );
}
