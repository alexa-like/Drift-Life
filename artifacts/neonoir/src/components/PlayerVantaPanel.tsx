/**
 * PlayerVantaPanel — floating "?" help button + slide-in AI tutor panel.
 * Visible to all authenticated players (non-owner). Talks to /api/player-vanta/chat via SSE.
 * Has its own 50-message history per player, scales intelligence by player level.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../shared/api";
import type { User } from "../shared/types";

interface PlayerMsg {
  role: "user" | "vanta" | "error";
  text: string;
}

interface PlayerVantaPanelProps {
  user: User;
  addToast: (message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function PlayerVantaPanel({ user }: PlayerVantaPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PlayerMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Load history once when panel is opened for the first time
  useEffect(() => {
    if (open && !historyLoaded) {
      setHistoryLoaded(true);
      api.get<{ messages: Array<{ role: string; content: string }> }>("/player-vanta/session")
        .then(r => {
          if (r.messages.length > 0) {
            setMessages(r.messages
              .filter(m => m.role === "user" || m.role === "assistant")
              .map(m => m.role === "user"
                ? { role: "user" as const, text: m.content }
                : { role: "vanta" as const, text: m.content }
              ));
          }
        }).catch(() => {});
    }
  }, [open, historyLoaded]);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);
    setMessages(prev => [...prev, { role: "user", text: msg }]);

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/player-vanta/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ message: "Network error" })) as { message?: string };
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as { type: string; text?: string };
            if (data.type === "message" && data.text) {
              setMessages(prev => [...prev, { role: "vanta", text: data.text! }]);
            } else if (data.type === "error" && data.text) {
              setMessages(prev => [...prev, { role: "error", text: data.text! }]);
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: "error", text: msg }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const clearHistory = useCallback(async () => {
    await api.delete("/player-vanta/session").catch(() => {});
    setMessages([]);
    setHistoryLoaded(false);
  }, []);

  // Suggestion chips — adapted to player level
  const suggestions = user.level <= 10
    ? ["What should I do first?", "How do I earn DC?", "Explain crimes", "How do I level up?"]
    : user.level <= 30
    ? ["Best crime strategy for my level?", "Arena tips", "How does the market work?", "What's the best district?"]
    : user.level <= 60
    ? ["How to maximize XP grinding?", "Best arena loadout?", "Explain gang wars", "NC investment tips"]
    : ["Event meta strategy", "How to lead a gang war?", "Corp hacking cycles", "Prestige planning"];

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed z-[9990]"
        style={{
          bottom: 24,
          right: 20,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: open ? "#1e0a2e" : "linear-gradient(135deg, #a855f730, #00d4ff20)",
          border: `2px solid ${open ? "#a855f7" : "#a855f760"}`,
          color: "#a855f7",
          fontSize: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: open
            ? "0 0 20px #a855f780, 0 4px 24px rgba(0,0,0,0.4)"
            : "0 0 12px #a855f740, 0 4px 16px rgba(0,0,0,0.3)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        aria-label={open ? "Close Vanta tutor" : "Open Vanta AI tutor"}
        title="Ask Vanta — your AI guide"
      >
        {open ? "✕" : "⬡"}
      </motion.button>

      {/* Slide-in panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 320, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 320, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed z-[9980]"
            style={{
              bottom: 84,
              right: 16,
              width: Math.min(360, window.innerWidth - 32),
              height: 520,
              background: "#07070f",
              border: "1px solid #a855f740",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 0 40px rgba(168,85,247,0.15), 0 16px 48px rgba(0,0,0,0.5)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "10px 14px",
              background: "#0a0a14",
              borderBottom: "1px solid #a855f730",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div>
                <div className="font-mono font-bold" style={{ color: "#a855f7", fontSize: 13, letterSpacing: 1.5 }}>⬡ VANTA</div>
                <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                  AI Tutor · Lv {user.level} Operative
                </div>
              </div>
              <button
                onClick={clearHistory}
                style={{
                  background: "#ff2d5512",
                  color: "#ff2d55",
                  border: "1px solid #ff2d5530",
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontFamily: "monospace",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>

            {/* Messages */}
            <div
              ref={chatRef}
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "10px 12px",
              }}
            >
              {messages.length === 0 && !loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                  <div style={{ fontSize: 32, filter: "drop-shadow(0 0 16px #a855f760)" }}>⬡</div>
                  <div className="font-mono text-xs" style={{ color: "#a855f7", textAlign: "center" }}>
                    {user.level <= 10
                      ? "Need help getting started in New Vanta?"
                      : user.level <= 30
                      ? "Ask me for strategies and tips."
                      : user.level <= 60
                      ? "Let's talk optimization."
                      : "What's the play, veteran?"}
                  </div>
                  {/* Suggestion chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", maxWidth: 290 }}>
                    {suggestions.map(q => (
                      <button key={q} onClick={() => setInput(q)}
                        style={{
                          background: "#a855f712",
                          color: "#a855f7",
                          border: "1px solid #a855f730",
                          borderRadius: 4,
                          padding: "3px 8px",
                          fontSize: 10,
                          fontFamily: "monospace",
                          cursor: "pointer",
                        }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => {
                  if (msg.role === "user") return (
                    <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div style={{
                        maxWidth: "78%",
                        background: "#00d4ff14",
                        border: "1px solid #00d4ff35",
                        borderRadius: "10px 10px 0 10px",
                        padding: "6px 10px",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: "#e2e8f0",
                        lineHeight: 1.5,
                      }}>{msg.text}</div>
                    </div>
                  );
                  if (msg.role === "error") return (
                    <div key={i} style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "#ff2d55",
                      padding: "4px 8px",
                      border: "1px solid #ff2d5530",
                      borderRadius: 4,
                    }}>✗ {msg.text}</div>
                  );
                  // vanta message
                  return (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#a855f718",
                        border: "1px solid #a855f740",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        flexShrink: 0,
                        marginTop: 2,
                      }}>⬡</div>
                      <div style={{
                        maxWidth: "82%",
                        background: "#0a0a14",
                        border: "1px solid #a855f725",
                        borderRadius: "0 10px 10px 10px",
                        padding: "6px 10px",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: "#e2e8f0",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}>{msg.text}</div>
                    </div>
                  );
                })
              )}
              {loading && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "#a855f718", border: "1px solid #a855f740",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                  }}>⬡</div>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#a855f780" }}>
                    thinking<span style={{ animation: "blink 1s step-end infinite" }}>…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{
              display: "flex",
              gap: 6,
              padding: "8px 10px",
              borderTop: "1px solid #a855f725",
              flexShrink: 0,
              background: "#0a0a14",
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask Vanta anything..."
                disabled={loading}
                style={{
                  flex: 1,
                  background: "#111118",
                  color: "#e2e8f0",
                  border: "1px solid #a855f730",
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontFamily: "monospace",
                  fontSize: 11,
                  outline: "none",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                style={{
                  background: loading || !input.trim() ? "#1e293b" : "#a855f720",
                  color: loading || !input.trim() ? "#475569" : "#a855f7",
                  border: "1px solid #a855f740",
                  borderRadius: 4,
                  padding: "6px 12px",
                  fontFamily: "monospace",
                  fontSize: 11,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {loading ? "◌" : "→"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
