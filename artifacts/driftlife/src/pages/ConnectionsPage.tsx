/**
 * ConnectionsPage — Platform verification & linking hub.
 *
 * Four independent flows:
 *   Telegram Verify — one-time identity proof (nothing stored)
 *   Telegram Link   — persistent link for NC purchases
 *   Discord Verify  — one-time identity proof (nothing stored)
 *   Discord Link    — persistent link for chat access + role assignment
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformStatus {
  telegram: { linked: boolean; username: string | null };
  discord:  { linked: boolean; username: string | null };
}

interface InitResponse {
  token:       string;
  deepLink?:   string;   // Telegram only
  instructions: string;
  guildInvite?: string | null;
}

type FlowType = "verify" | "link";
type Platform = "telegram" | "discord";

interface FlowState {
  type:       FlowType;
  platform:   Platform;
  init:       InitResponse | null;
  code:       string;
  error:      string;
  success:    boolean;
  countdown:  number;      // seconds remaining for code
  attempts:   number;
  showFallback: boolean;  // 3-attempt fallback prompt
  submitting: boolean;
  resending:  boolean;
}

const EMPTY_FLOW: Omit<FlowState, "type" | "platform"> = {
  init:         null,
  code:         "",
  error:        "",
  success:      false,
  countdown:    0,
  attempts:     0,
  showFallback: false,
  submitting:   false,
  resending:    false,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  user: { username: string };
}

export function ConnectionsPage({ user }: Props) {
  const [status,  setStatus]  = useState<PlatformStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Active modal flow (one at a time)
  const [activeFlow, setActiveFlow] = useState<FlowState | null>(null);

  // Inline unlink confirmation
  const [confirmUnlink, setConfirmUnlink] = useState<Platform | null>(null);
  const [unlinkError,   setUnlinkError]   = useState<string | null>(null);

  // Inline fallback email message
  const [fallbackMsg, setFallbackMsg] = useState<string | null>(null);

  // Countdown timer ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load status ─────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.get<PlatformStatus>("/platform/status");
      setStatus(s);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ── Countdown timer ─────────────────────────────────────────────────────────

  function startCountdown() {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveFlow(prev => prev ? { ...prev, countdown: 30 } : prev);
    timerRef.current = setInterval(() => {
      setActiveFlow(prev => {
        if (!prev) return prev;
        const next = prev.countdown - 1;
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return { ...prev, countdown: 0, error: "Code expired — tap Resend for a new one." };
        }
        return { ...prev, countdown: next };
      });
    }, 1_000);
  }

  function stopCountdown() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => () => stopCountdown(), []);

  // ── Flow helpers ────────────────────────────────────────────────────────────

  async function startFlow(type: FlowType, platform: Platform) {
    stopCountdown();
    setActiveFlow({ type, platform, ...EMPTY_FLOW });
    try {
      const data = await api.post<InitResponse>(`/platform/${type}-init`, { platform });
      setActiveFlow(prev => prev ? { ...prev, init: data, error: "" } : prev);
    } catch (e: any) {
      const msg = e.message || "Failed to start session";
      if (msg.includes("already linked")) {
        setActiveFlow(null);
        await loadStatus();
      } else {
        setActiveFlow(prev => prev ? { ...prev, error: msg } : prev);
      }
    }
  }

  function onCodeReceived() {
    // Called when the user acknowledges the code was sent; starts 30s timer
    startCountdown();
    setActiveFlow(prev => prev ? { ...prev, error: "" } : prev);
  }

  async function submitCode(type: FlowType) {
    if (!activeFlow) return;
    setActiveFlow(prev => prev ? { ...prev, submitting: true, error: "" } : prev);
    try {
      await api.post(`/platform/${type}-submit`, { code: activeFlow.code.trim().toUpperCase() });
      stopCountdown();
      setActiveFlow(prev => prev ? { ...prev, success: true, submitting: false } : prev);
      await loadStatus();
    } catch (e: any) {
      const msg   = e.message || "Invalid code";
      const isTooMany = msg.toLowerCase().includes("too many");
      const newAttempts = activeFlow.attempts + 1;
      stopCountdown();
      setActiveFlow(prev => prev ? {
        ...prev,
        submitting:   false,
        error:        msg,
        attempts:     newAttempts,
        showFallback: isTooMany || newAttempts >= 3,
      } : prev);
    }
  }

  async function resendCode() {
    if (!activeFlow) return;
    setActiveFlow(prev => prev ? { ...prev, resending: true, error: "" } : prev);
    stopCountdown();
    try {
      await api.post("/platform/resend", { type: activeFlow.type, platform: activeFlow.platform });
      startCountdown();
      setActiveFlow(prev => prev ? {
        ...prev,
        resending: false,
        error:     "",
        code:      "",
        showFallback: false,
      } : prev);
    } catch (e: any) {
      const msg = e.message || "Failed to resend";
      const noSession = msg.includes("No active session") || (e as any).noSession;
      if (noSession) {
        setActiveFlow(prev => prev ? { ...prev, resending: false, error: "Session expired — please start a new session." } : prev);
      } else {
        setActiveFlow(prev => prev ? { ...prev, resending: false, error: msg } : prev);
      }
    }
  }

  async function doUnlink() {
    if (!confirmUnlink) return;
    setUnlinkError(null);
    try {
      await api.delete(`/platform/${confirmUnlink}`);
      setConfirmUnlink(null);
      await loadStatus();
    } catch (e: any) {
      setUnlinkError(e.message || "Failed to unlink");
    }
  }

  function closeFlow() {
    stopCountdown();
    setActiveFlow(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "16px 12px", maxWidth: 520, margin: "0 auto" }}>
      <h2 style={{ color: "#00d4ff", fontFamily: "monospace", fontSize: 16, letterSpacing: 2, marginBottom: 4 }}>
        CONNECTIONS_
      </h2>
      <p style={{ color: "#64748b", fontSize: 12, marginBottom: 24 }}>
        Link your Telegram or Discord account to unlock platform features.
      </p>

      {loading ? (
        <p style={{ color: "#64748b", fontSize: 13 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── Telegram ─────────────────────────────────────── */}
          <PlatformCard
            platform="telegram"
            icon="📱"
            accentColor="#00d4ff"
            linked={status?.telegram.linked ?? false}
            linkedUsername={status?.telegram.username ?? null}
            verifyPurpose="One-time identity proof (nothing stored)"
            linkPurpose="Enables NC purchases via Telegram Stars"
            onVerify={() => startFlow("verify", "telegram")}
            onLink={() => startFlow("link", "telegram")}
            onUnlink={() => { setUnlinkError(null); setConfirmUnlink("telegram"); }}
          />

          {/* ── Discord ──────────────────────────────────────── */}
          <PlatformCard
            platform="discord"
            icon="🎮"
            accentColor="#7289da"
            linked={status?.discord.linked ?? false}
            linkedUsername={status?.discord.username ?? null}
            verifyPurpose="One-time identity proof (nothing stored)"
            linkPurpose="Chat access, nickname sync, Verified role"
            onVerify={() => startFlow("verify", "discord")}
            onLink={() => startFlow("link", "discord")}
            onUnlink={() => { setUnlinkError(null); setConfirmUnlink("discord"); }}
          />

        </div>
      )}

      {/* ── Inline unlink confirmation ──────────────────────────────────────── */}
      {confirmUnlink && (
        <div style={{
          position: "fixed", inset: 0, background: "#00000099", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{ background: "#111118", border: "1px solid #ff2d5540", borderRadius: 10, padding: 24, maxWidth: 360, width: "100%" }}>
            <div style={{ color: "#ff2d55", fontFamily: "monospace", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              UNLINK {confirmUnlink.toUpperCase()}_
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>
              Are you sure? You will need to go through the link flow again to restore access.
            </div>
            {unlinkError && (
              <div style={{ color: "#ff2d55", fontSize: 12, background: "#ff2d5515", borderRadius: 4, padding: "6px 10px", marginBottom: 12 }}>
                {unlinkError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={doUnlink} style={{ ...btnStyle("#ff2d55"), flex: 1 }}>Confirm Unlink</button>
              <button onClick={() => { setConfirmUnlink(null); setUnlinkError(null); }} style={btnStyle("#64748b", true)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fallback email message ──────────────────────────────────────────── */}
      {fallbackMsg && (
        <div style={{ marginTop: 12, background: "#111118", border: "1px solid #ff6b3540", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ color: "#ff6b35", fontSize: 12, fontFamily: "monospace" }}>{fallbackMsg}</div>
          <button onClick={() => setFallbackMsg(null)} style={{ ...btnStyle("#64748b", true), marginTop: 8, fontSize: 11 }}>Dismiss</button>
        </div>
      )}

      {/* ── Flow Modal ──────────────────────────────────────────────────────── */}
      {activeFlow && (
        <FlowModal
          flow={activeFlow}
          onCodeChange={code => setActiveFlow(prev => prev ? { ...prev, code, error: "" } : prev)}
          onCodeReceived={onCodeReceived}
          onSubmit={() => submitCode(activeFlow.type)}
          onResend={resendCode}
          onClose={closeFlow}
          onFallbackEmail={() => {
            closeFlow();
            setFallbackMsg("Please use the email verification option on the Auth page to verify via Gmail.");
          }}
          onFallbackRetry={() =>
            setActiveFlow(prev => prev ? { ...prev, showFallback: false, attempts: 0, error: "" } : prev)
          }
        />
      )}
    </div>
  );
}

// ── PlatformCard ──────────────────────────────────────────────────────────────

interface CardProps {
  platform:       Platform;
  icon:           string;
  accentColor:    string;
  linked:         boolean;
  linkedUsername: string | null;
  verifyPurpose:  string;
  linkPurpose:    string;
  onVerify: () => void;
  onLink:   () => void;
  onUnlink: () => void;
}

function PlatformCard({
  platform, icon, accentColor, linked, linkedUsername,
  verifyPurpose, linkPurpose, onVerify, onLink, onUnlink,
}: CardProps) {
  const label = platform === "telegram" ? "Telegram" : "Discord";

  return (
    <div style={{
      background: "#111118",
      border: `1px solid ${accentColor}30`,
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ color: accentColor, fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>
          {label.toUpperCase()}
        </span>
        {linked && (
          <span style={{
            marginLeft: "auto",
            background: "#39d35320",
            color: "#39d353",
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            fontFamily: "monospace",
          }}>
            LINKED {linkedUsername ? `@${linkedUsername}` : ""}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Verification row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#0a0a0f", borderRadius: 6, padding: "8px 12px",
        }}>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>Verify Identity</div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{verifyPurpose}</div>
          </div>
          <button onClick={onVerify} style={btnStyle(accentColor)}>Verify</button>
        </div>

        {/* Link row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#0a0a0f", borderRadius: 6, padding: "8px 12px",
        }}>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
              {linked ? "Linked" : "Link Account"}
            </div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{linkPurpose}</div>
          </div>
          {linked ? (
            <button onClick={onUnlink} style={btnStyle("#ff2d55", true)}>Unlink</button>
          ) : (
            <button onClick={onLink} style={btnStyle(accentColor)}>Link</button>
          )}
        </div>

      </div>
    </div>
  );
}

// ── FlowModal ─────────────────────────────────────────────────────────────────

interface ModalProps {
  flow:            FlowState;
  onCodeChange:    (code: string) => void;
  onCodeReceived:  () => void;
  onSubmit:        () => void;
  onResend:        () => void;
  onClose:         () => void;
  onFallbackEmail: () => void;
  onFallbackRetry: () => void;
}

function FlowModal({
  flow, onCodeChange, onCodeReceived, onSubmit, onResend, onClose,
  onFallbackEmail, onFallbackRetry,
}: ModalProps) {
  const isTelegram = flow.platform === "telegram";
  const isVerify   = flow.type === "verify";
  const accent     = isTelegram ? "#00d4ff" : "#7289da";
  const label      = isTelegram ? "Telegram" : "Discord";

  const title = isVerify
    ? `Verify via ${label}`
    : `Link ${label}`;

  const descriptionStep = flow.init
    ? isVerify
      ? `A 6-character code will be sent to you via ${label}. Enter it below within 30 seconds.`
      : `A 6-character code will be sent to you via ${label}. Once entered, your ${label} account will be permanently linked.`
    : "Starting session…";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000099", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "#111118",
        border: `1px solid ${accent}40`,
        borderRadius: 10,
        padding: 24,
        width: "100%",
        maxWidth: 400,
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ color: accent, fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>
            {title.toUpperCase()}_
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        {/* Success state */}
        {flow.success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ color: "#39d353", fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>
              {isVerify ? "VERIFIED!" : "LINKED!"}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
              {isVerify
                ? "Identity confirmed. This session has ended — no data was stored."
                : `Your ${label} account is now linked.`}
            </div>
            <button onClick={onClose} style={{ ...btnStyle(accent), marginTop: 16 }}>Close</button>
          </div>
        ) : flow.showFallback ? (
          /* 3-attempt fallback */
          <div>
            <div style={{ color: "#ff6b35", fontSize: 13, marginBottom: 12 }}>
              Having trouble verifying?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {isVerify && (
                <button onClick={onFallbackEmail} style={btnStyle("#ff6b35")}>
                  Yes, try email instead
                </button>
              )}
              <button onClick={onFallbackRetry} style={btnStyle(accent, true)}>
                No, try again
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Description */}
            {flow.init && (
              <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
                {descriptionStep}
              </p>
            )}

            {/* Step 1: Get the code delivered */}
            {!flow.init ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>Starting session…</div>
            ) : isTelegram && flow.init.deepLink ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#e2e8f0", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
                  Step 1 — Open Telegram
                </div>
                <a
                  href={flow.init.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onCodeReceived}
                  style={{
                    display: "block",
                    background: accent + "20",
                    border: `1px solid ${accent}60`,
                    borderRadius: 6,
                    padding: "10px 14px",
                    color: accent,
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  📱 Open Telegram Bot ↗
                </a>
                <div style={{ color: "#64748b", fontSize: 11, marginTop: 6, textAlign: "center" }}>
                  The bot will send you a 6-character code
                </div>
              </div>
            ) : (
              /* Discord instructions */
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#e2e8f0", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
                  Step 1 — Go to Discord
                </div>
                <div style={{
                  background: "#0a0a0f",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#94a3b8",
                  lineHeight: 1.6,
                }}>
                  {flow.init.instructions}
                </div>
                {flow.init.guildInvite && (
                  <a
                    href={flow.init.guildInvite}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: accent, fontSize: 12, display: "block", marginTop: 6, textAlign: "center" }}
                  >
                    Join our Discord server ↗
                  </a>
                )}
                <button
                  onClick={onCodeReceived}
                  style={{ ...btnStyle(accent, true), width: "100%", marginTop: 8, fontSize: 11 }}
                >
                  ✓ I've run the command, start 30s timer
                </button>
              </div>
            )}

            {/* Step 2: Enter the code */}
            {(flow.countdown > 0 || flow.init) && (
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
                  Step 2 — Enter the code
                  {flow.countdown > 0 && (
                    <span style={{
                      marginLeft: 8,
                      color: flow.countdown <= 10 ? "#ff2d55" : "#39d353",
                      fontFamily: "monospace",
                      fontSize: 13,
                    }}>
                      {flow.countdown}s
                    </span>
                  )}
                </div>
                <input
                  value={flow.code}
                  onChange={e => onCodeChange(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6))}
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  style={{
                    width: "100%",
                    background: "#0a0a0f",
                    border: `1px solid ${accent}40`,
                    borderRadius: 6,
                    padding: "10px 12px",
                    color: "#e2e8f0",
                    fontFamily: "monospace",
                    fontSize: 20,
                    letterSpacing: 6,
                    textAlign: "center",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Error */}
            {flow.error && (
              <div style={{
                color: "#ff2d55",
                fontSize: 12,
                marginTop: 8,
                background: "#ff2d5515",
                borderRadius: 4,
                padding: "6px 10px",
              }}>
                {flow.error}
              </div>
            )}

            {/* Actions */}
            {flow.init && (
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={onSubmit}
                  disabled={flow.submitting || flow.code.length !== 6}
                  style={{
                    ...btnStyle(accent),
                    flex: 1,
                    opacity: (flow.submitting || flow.code.length !== 6) ? 0.5 : 1,
                  }}
                >
                  {flow.submitting ? "Verifying…" : "Submit"}
                </button>
                <button
                  onClick={onResend}
                  disabled={flow.resending}
                  style={{ ...btnStyle("#64748b", true), opacity: flow.resending ? 0.5 : 1 }}
                >
                  {flow.resending ? "…" : "Resend"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function btnStyle(color: string, outline = false): React.CSSProperties {
  return {
    background: outline ? "transparent" : color + "20",
    border: `1px solid ${color}60`,
    borderRadius: 6,
    color,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "monospace",
    padding: "7px 14px",
    whiteSpace: "nowrap",
  };
}
