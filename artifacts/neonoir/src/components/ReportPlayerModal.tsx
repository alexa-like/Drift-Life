/**
 * ReportPlayerModal — reusable modal for reporting any player.
 * Accepts targetId + targetName; submits to POST /reports.
 */
import { useState } from "react";
import { api } from "../lib/api";
import { CyberButton } from "./CyberButton";

interface Props {
  targetId: string;
  targetName: string;
  onClose: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const CATEGORIES = [
  { value: "cheating",       label: "Cheating / Exploiting" },
  { value: "harassment",     label: "Harassment" },
  { value: "hate_speech",    label: "Hate Speech" },
  { value: "spam",           label: "Spam" },
  { value: "multi_account",  label: "Multiple Accounts (Alt)" },
  { value: "impersonation",  label: "Impersonating Staff / Player" },
  { value: "nsfw",           label: "Inappropriate / NSFW Content" },
  { value: "other",          label: "Other" },
];

const INPUT: React.CSSProperties = {
  background: "#0d1117", border: "1px solid #21262d", borderRadius: 6,
  color: "#e2e8f0", padding: "7px 10px", width: "100%", fontFamily: "monospace", fontSize: 12,
  outline: "none",
};
const TEXTAREA: React.CSSProperties = { ...INPUT, resize: "vertical", minHeight: 80 };

export function ReportPlayerModal({ targetId, targetName, onClose, addToast }: Props) {
  const [category,    setCategory]    = useState("harassment");
  const [description, setDescription] = useState("");
  const [evidence,    setEvidence]    = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  async function submit() {
    if (!description.trim()) return addToast("Please describe the issue", "error");
    setSubmitting(true);
    try {
      const r = await api.post<{ message: string }>("/reports", {
        targetId,
        category,
        description: description.trim(),
        evidence: evidence.trim() || undefined,
      });
      addToast(r.message, "success");
      onClose();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#0d1117", border: "1px solid #ff2d5540", borderRadius: 10,
        padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 0 40px #ff2d5520",
      }}>
        <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#ff2d55", letterSpacing: "0.08em", marginBottom: 4 }}>
          ⚠ REPORT PLAYER
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b", marginBottom: 20 }}>
          Reporting: <span style={{ color: "#e2e8f0" }}>{targetName}</span>
        </div>

        <div className="space-y-3">
          <div>
            <label style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>
              Category
            </label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={INPUT}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>
              Description <span style={{ color: "#334155" }}>(max 1000 chars)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={1000}
              placeholder="Describe what happened. Include when it occurred and any relevant details."
              style={TEXTAREA}
            />
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#334155", textAlign: "right", marginTop: 2 }}>
              {description.length}/1000
            </div>
          </div>

          <div>
            <label style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>
              Evidence <span style={{ color: "#334155" }}>(optional — paste a chat log snippet or note)</span>
            </label>
            <textarea
              value={evidence}
              onChange={e => setEvidence(e.target.value)}
              maxLength={500}
              placeholder="Optional: paste relevant chat snippet or note"
              style={{ ...TEXTAREA, minHeight: 48 }}
            />
          </div>

          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#334155", padding: "8px 0", borderTop: "1px solid #1e1e2e" }}>
            False reports waste staff time and may result in action against your account. Our moderation team reviews all reports.
          </div>

          <div className="flex gap-2">
            <CyberButton variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancel</CyberButton>
            <CyberButton variant="danger" size="sm" loading={submitting}
              disabled={!description.trim()} onClick={submit}>
              Submit Report
            </CyberButton>
          </div>
        </div>
      </div>
    </div>
  );
}
