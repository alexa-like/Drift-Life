/**
 * StorePage — UC packs + subscription tier selection via Telegram Stars.
 *
 * Two tabs: UC Packs / Subscriptions
 * Handles: Telegram link flow (inline modal), daily claim widget, tier cards.
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreStatus {
  uc: number;
  subscriptionTier: string | null;
  subscriptionExpiresAt: string | null;
  subDaysLeft: number;
  claimedToday: boolean;
  ucClaimStreak: number;
  ucRolloverDays: number;
  nextClaimAmount: number;
  telegramLinked: boolean;
  telegramUsername: string | null;
  ucPacks: UcPack[];
  tiers: TierInfo[];
}

interface UcPack {
  id: string;
  uc: number;
  stars: number;
  bonusPct: number;
  label: string;
}

interface TierInfo {
  id: string;
  name: string;
  starsPerMonth: number;
  ucPrice: number;
  dailyUc: number;
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
  const [tab, setTab] = useState<"uc" | "subs">("uc");
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);

  // Telegram link modal state
  const [linkData, setLinkData] = useState<LinkInitResponse | null>(null);
  const [linkPollActive, setLinkPollActive] = useState(false);

  // UC subscription payment state
  // ucConfirm = tierId that is pending confirmation, ucBuying = tierId currently processing
  const [ucConfirm, setUcConfirm] = useState<string | null>(null);
  const [ucBuying, setUcBuying] = useState<string | null>(null);
  const [ucBuyResult, setUcBuyResult] = useState<{ tierId: string; msg: string; ok: boolean } | null>(null);

  // Gift UC modal
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

  async function handleBuyWithUC(tierId: string) {
    setUcBuying(tierId);
    setUcBuyResult(null);
    try {
      const r = await api.post<{ message: string }>("/store/buy-subscription-uc", { tierId });
      setUcBuyResult({ tierId, msg: r.message, ok: true });
      onUserUpdate?.();
      await loadStatus();
    } catch (e: any) {
      setUcBuyResult({ tierId, msg: e.message || "Purchase failed", ok: false });
    } finally {
      setUcBuying(null);
      setUcConfirm(null);
    }
  }

  async function handleClaimDaily() {
    setClaiming(true);
    setClaimResult(null);
    try {
      const r = await api.post<{ message: string }>("/store/claim-daily-uc");
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
      const r = await api.post<{ message: string }>("/store/gift-uc", { recipientUsername: giftRecipient, amount: giftAmount });
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
  const uc = status?.uc ?? (user?.uc ?? 0);

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-mono" style={{ color: "#00E0FF" }}>STORE</h1>
          <p className="text-xs font-mono" style={{ color: "#475569" }}>New Vanta · Premium Shop</p>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-lg" style={{ color: "#FFD700" }}>
            ⭐ {uc.toLocaleString()} UC
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
            DriftLife uses Telegram Stars for payments. Link your account to buy UC or subscribe.
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
                {status.subDaysLeft} days remaining · Streak: {status.ucClaimStreak} days
                {status.ucRolloverDays > 0 && ` · ${status.ucRolloverDays}d rollover`}
              </div>
            </div>
            {status.ucClaimStreak > 0 && (
              <div className="font-mono text-xl font-black" title="Claim streak">
                {'🔥'.repeat(Math.min(status.ucClaimStreak, 7))}
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
             status.claimedToday ? `✓ Claimed today (${activeTierInfo.dailyUc} UC)` :
             `Claim ${status.nextClaimAmount} UC ${status.ucClaimStreak % 6 === 5 ? '🔥 Streak bonus tomorrow!' : ''}`}
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
          { key: "uc",   label: "⭐ UC Packs"      },
          { key: "subs", label: "💎 Subscriptions"  },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "uc" | "subs")}
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

      {/* ── UC Packs tab ─────────────────────────────────────────────────────── */}
      {!loading && tab === "uc" && status && (
        <div className="space-y-3">
          <div className="font-mono text-xs" style={{ color: "#475569" }}>
            UC (UltraCredits) are used to buy premium chat frames in the Frame Store.
            Purchased via Telegram Stars ⭐.
          </div>

          <div className="grid grid-cols-2 gap-3">
            {status.ucPacks.map(pack => (
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
                    background: "#00E0FF", color: "#000",
                    fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                    padding: "2px 6px", borderRadius: 4,
                  }}>
                    +{pack.bonusPct}% BONUS
                  </div>
                )}
                <div className="font-mono font-black text-lg" style={{ color: "#FFD700" }}>
                  {pack.uc.toLocaleString()} UC
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

          {/* UC Gifting */}
          <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 10, padding: 14 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-bold" style={{ color: "#a0a0c0" }}>Gift UC to a player</div>
                <div className="font-mono text-xs" style={{ color: "#475569" }}>100–10,000 UC · 10% fee applies</div>
              </div>
              <button
                onClick={() => setGiftModal(!giftModal)}
                className="font-mono text-xs px-3 py-1 rounded"
                style={{ background: "#1e1e2e", color: "#00E0FF", border: "1px solid #00E0FF40" }}
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
                    UC (fee: {Math.ceil(giftAmount * 0.1)})
                  </span>
                </div>
                {giftMsg && (
                  <div className="font-mono text-xs" style={{ color: giftMsg.includes("Gift") ? "#00E0FF" : "#FF4FA3" }}>
                    {giftMsg}
                  </div>
                )}
                <button
                  onClick={handleGift}
                  disabled={gifting || !giftRecipient || giftAmount < 100}
                  className="font-mono text-xs font-bold px-4 py-2 rounded"
                  style={{ background: gifting ? "#1e1e2e" : "#00E0FF20", color: "#00E0FF", border: "1px solid #00E0FF40" }}
                >
                  {gifting ? "Sending…" : `Send ${giftAmount} UC`}
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
                <span style={{ color: "#FFD700" }}>💰 UC</span> — spend in-game UltraCredits
              </div>
            </div>
            <div className="font-mono text-xs mt-1" style={{ color: "#334155" }}>
              You have <span style={{ color: "#FFD700", fontWeight: 700 }}>{uc.toLocaleString()} UC</span> available.
            </div>
          </div>

          {TIER_ORDER.map(tierId => {
            const tier = status.tiers.find(t => t.id === tierId);
            if (!tier) return null;
            const isActive = activeTier === tierId;
            const color = TIER_COLOR[tierId];
            const badge = TIER_BADGE[tierId];
            const canAffordUc = uc >= tier.ucPrice;
            const isUcConfirming = ucConfirm === tierId;
            const isUcBuying = ucBuying === tierId;
            const ucResult = ucBuyResult?.tierId === tierId ? ucBuyResult : null;

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
                      💰 {tier.ucPrice.toLocaleString()} UC /month ·{" "}
                      <span style={{ color: "#22c55e" }}>{tier.dailyUc * 30} UC/month value</span>
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
                    { label: `${tier.dailyUc} UC/day`, icon: "⭐" },
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
                  💡 Daily UC value ({tier.dailyUc * 30} UC/month) exceeds the subscription cost — you get more than you pay for.
                </div>

                {/* UC buy result banner */}
                {ucResult && (
                  <div
                    className="font-mono text-xs mb-2 p-2 rounded"
                    style={{ background: ucResult.ok ? "#00E0FF15" : "#FF4FA315", color: ucResult.ok ? "#00E0FF" : "#FF4FA3", border: `1px solid ${ucResult.ok ? "#00E0FF30" : "#FF4FA330"}` }}
                  >
                    {ucResult.msg}
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

                    {/* UC payment — confirm → buy flow */}
                    {isUcConfirming ? (
                      <div
                        className="p-3 rounded"
                        style={{ background: "#FFD70015", border: "1px solid #FFD70040" }}
                      >
                        <div className="font-mono text-xs mb-2" style={{ color: "#FFD700" }}>
                          Spend <b>{tier.ucPrice.toLocaleString()} UC</b> on {tier.name}?
                          <br />
                          <span style={{ color: "#475569" }}>Your balance: {uc.toLocaleString()} UC → {(uc - tier.ucPrice).toLocaleString()} UC after</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleBuyWithUC(tierId)}
                            disabled={isUcBuying}
                            className="flex-1 font-mono text-xs font-bold py-2 rounded"
                            style={{ background: "#FFD700", color: "#000", opacity: isUcBuying ? 0.6 : 1 }}
                          >
                            {isUcBuying ? "Processing…" : "✓ Confirm"}
                          </button>
                          <button
                            onClick={() => setUcConfirm(null)}
                            disabled={isUcBuying}
                            className="font-mono text-xs px-4 py-2 rounded"
                            style={{ background: "#1e1e2e", color: "#475569", border: "1px solid #2a2a3e" }}
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => canAffordUc ? setUcConfirm(tierId) : undefined}
                        disabled={!canAffordUc || !!ucBuying}
                        className="w-full font-mono text-sm font-bold py-2 rounded transition-opacity"
                        style={{
                          background: canAffordUc ? "#FFD70020" : "#1e1e2e",
                          color: canAffordUc ? "#FFD700" : "#334155",
                          border: `1px solid ${canAffordUc ? "#FFD70040" : "#1e1e2e"}`,
                          cursor: canAffordUc ? "pointer" : "default",
                        }}
                        title={canAffordUc ? undefined : `Need ${tier.ucPrice.toLocaleString()} UC — you have ${uc.toLocaleString()}`}
                      >
                        {canAffordUc
                          ? `💰 ${tier.ucPrice.toLocaleString()} UC (in-game)`
                          : `💰 ${tier.ucPrice.toLocaleString()} UC needed (have ${uc.toLocaleString()})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}

          <div className="font-mono text-xs text-center" style={{ color: "#334155" }}>
            ⭐ Stars payments processed by Telegram — no refunds per Telegram policy<br />
            💰 UC purchases are instant and final · Subscriptions do not auto-renew
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
