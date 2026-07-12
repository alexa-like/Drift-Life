/**
 * SupportPage — Players open and track support tickets.
 * POST /support            → create ticket
 * GET  /support/mine       → my tickets with replies
 * POST /support/:id/reply  → add a reply to a ticket
 */
import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";

const INPUT: React.CSSProperties = {
  background: "#0d1117", border: "1px solid #21262d", borderRadius: 6,
  color: "#e2e8f0", padding: "7px 10px", width: "100%", fontFamily: "monospace", fontSize: 12,
  outline: "none",
};
const TEXTAREA: React.CSSProperties = { ...INPUT, resize: "vertical", minHeight: 80 };

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

interface TicketReply {
  authorName: string;
  isStaff: boolean;
  content: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  replies: TicketReply[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: "bug",        label: "Bug Report" },
  { value: "account",    label: "Account Issue" },
  { value: "appeal",     label: "Ban / Mute Appeal" },
  { value: "payment",    label: "Payment / NC" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other",      label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  open:        "#39d353",
  in_progress: "#f59e0b",
  resolved:    "#00d4ff",
  closed:      "#334155",
};

export function SupportPage({ user, addToast }: Props) {
  const [view, setView]       = useState<"new" | "mine">("mine");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId]   = useState<string | null>(null);

  // New ticket form
  const [category, setCategory] = useState("bug");
  const [subject,  setSubject]  = useState("");
  const [body,     setBody]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reply
  const [replyContent, setReplyContent] = useState("");
  const [replying, setReplying] = useState(false);

  async function loadTickets() {
    setLoading(true);
    try { setTickets(await api.get<Ticket[]>("/support/mine")); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTickets(); }, []);

  async function submitTicket() {
    if (!subject.trim() || !body.trim()) return addToast("Subject and message are required", "error");
    setSubmitting(true);
    try {
      const r = await api.post<{ message: string }>("/support", { category, subject: subject.trim(), body: body.trim() });
      addToast(r.message, "success");
      setSubject(""); setBody("");
      setView("mine");
      await loadTickets();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSubmitting(false); }
  }

  async function sendReply(ticketId: string) {
    if (!replyContent.trim()) return;
    setReplying(true);
    try {
      await api.post(`/support/${ticketId}/reply`, { content: replyContent.trim() });
      addToast("Reply sent", "success");
      setReplyContent("");
      await loadTickets();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setReplying(false); }
  }

  const openTicket = tickets.find(t => t.id === openId);

  return (
    <div className="space-y-4 max-w-2xl mx-auto relative z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      <AnimatedCard accent="#00d4ff">
        <CyberSectionHeader title="SUPPORT CENTER" accent="#00d4ff" cursor />
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Contact our staff team for account issues, bug reports, ban appeals, or general questions.
        </p>
      </AnimatedCard>

      {/* Nav */}
      <div className="flex gap-2">
        <CyberButton variant={view === "mine" ? "primary" : "ghost"} size="sm" onClick={() => { setView("mine"); setOpenId(null); }}>
          My Tickets ({tickets.filter(t => t.status !== "closed").length} open)
        </CyberButton>
        <CyberButton variant={view === "new" ? "primary" : "ghost"} size="sm" onClick={() => setView("new")}>
          + New Ticket
        </CyberButton>
      </div>

      {/* New ticket form */}
      {view === "new" && (
        <AnimatedCard>
          <CyberSectionHeader title="OPEN A TICKET" accent="#f59e0b" size="sm" />
          <div className="space-y-3 mt-3">
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={INPUT}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Subject <span style={{ color: "#334155" }}>(max 120 chars)</span></label>
              <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={120}
                placeholder="Brief description of your issue" style={INPUT} />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Message <span style={{ color: "#334155" }}>(max 2000 chars)</span></label>
              <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000}
                placeholder="Describe your issue in detail. Include your username, what happened, and any relevant information." style={TEXTAREA} />
              <div className="font-mono text-xs text-right mt-0.5" style={{ color: "#334155" }}>{body.length}/2000</div>
            </div>
            <CyberButton variant="warning" loading={submitting} disabled={!subject.trim() || !body.trim()}
              onClick={submitTicket}>
              Submit Ticket
            </CyberButton>
          </div>
        </AnimatedCard>
      )}

      {/* Ticket detail view */}
      {view === "mine" && openTicket && (
        <AnimatedCard>
          <div className="flex items-center gap-2 mb-3">
            <CyberButton variant="ghost" size="sm" onClick={() => setOpenId(null)}>← Back</CyberButton>
            <span className="font-mono text-xs px-2 py-0.5 rounded" style={{
              background: `${STATUS_COLORS[openTicket.status]}15`,
              color: STATUS_COLORS[openTicket.status],
              border: `1px solid ${STATUS_COLORS[openTicket.status]}30`,
            }}>
              {openTicket.status.replace("_", " ").toUpperCase()}
            </span>
          </div>
          <div className="font-mono font-bold text-sm mb-1" style={{ color: "#e2e8f0" }}>{openTicket.subject}</div>
          <div className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>
            {CATEGORIES.find(c => c.value === openTicket.category)?.label} · {new Date(openTicket.createdAt).toLocaleDateString()}
          </div>

          {/* Original message */}
          <div className="p-3 rounded mb-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="font-mono text-xs mb-1" style={{ color: "#f59e0b" }}>{user.username} (you)</div>
            <div className="font-mono text-xs" style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}>{openTicket.body}</div>
          </div>

          {/* Replies */}
          {openTicket.replies.map((reply, i) => (
            <div key={i} className="p-3 rounded mb-2" style={{
              background: reply.isStaff ? "#00d4ff08" : "#0d1117",
              border: `1px solid ${reply.isStaff ? "#00d4ff30" : "#21262d"}`,
            }}>
              <div className="font-mono text-xs mb-1" style={{ color: reply.isStaff ? "#00d4ff" : "#f59e0b" }}>
                {reply.authorName} {reply.isStaff && "⚡ Staff"} · {new Date(reply.createdAt).toLocaleDateString()}
              </div>
              <div className="font-mono text-xs" style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}>{reply.content}</div>
            </div>
          ))}

          {/* Reply box — only if not closed */}
          {openTicket.status !== "closed" && (
            <div className="mt-3 space-y-2">
              <textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} maxLength={2000}
                placeholder="Add a reply…" style={TEXTAREA} />
              <CyberButton variant="primary" size="sm" loading={replying}
                disabled={!replyContent.trim()} onClick={() => sendReply(openTicket.id)}>
                Send Reply
              </CyberButton>
            </div>
          )}
          {openTicket.status === "closed" && (
            <div className="font-mono text-xs text-center py-2" style={{ color: "#334155" }}>
              This ticket is closed. Open a new ticket if you need further help.
            </div>
          )}
        </AnimatedCard>
      )}

      {/* Ticket list */}
      {view === "mine" && !openTicket && (
        loading ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading…</div>
        ) : tickets.length === 0 ? (
          <AnimatedCard>
            <div className="font-mono text-xs text-center py-6" style={{ color: "#475569" }}>
              No tickets yet. Click "New Ticket" to contact the team.
            </div>
          </AnimatedCard>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => (
              <AnimatedCard key={t.id} onClick={() => setOpenId(t.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-sm truncate" style={{ color: "#e2e8f0" }}>{t.subject}</div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
                      {CATEGORIES.find(c => c.value === t.category)?.label} · {t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{
                      background: `${STATUS_COLORS[t.status]}15`,
                      color: STATUS_COLORS[t.status],
                      border: `1px solid ${STATUS_COLORS[t.status]}30`,
                    }}>
                      {t.status.replace("_", " ")}
                    </span>
                    <span className="font-mono text-xs" style={{ color: "#334155" }}>{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </AnimatedCard>
            ))}
          </div>
        )
      )}
    </div>
  );
}
