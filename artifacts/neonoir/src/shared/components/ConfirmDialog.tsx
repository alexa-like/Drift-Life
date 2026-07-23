/**
 * ConfirmDialog — generic in-app confirmation modal.
 *
 * Native `window.confirm()` / `alert()` do not reliably render inside the
 * sandboxed preview iframe, so any destructive or spend-money action must
 * use this component instead.
 */

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const accent = danger ? "#ff2d55" : "#00E0FF";

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10000, padding: "1rem",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0d0d15", border: `2px solid ${accent}55`,
          borderRadius: 12, padding: "1.5rem", maxWidth: 380, width: "100%",
          boxShadow: `0 0 40px ${accent}22`,
        }}
      >
        <div
          className="font-mono font-bold"
          style={{ fontSize: "1rem", color: accent, marginBottom: "0.5rem", letterSpacing: "0.05em" }}
        >
          {title}
        </div>
        <div
          className="font-mono"
          style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: "1.25rem", whiteSpace: "pre-line" }}
        >
          {message}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            className="font-mono font-bold"
            style={{
              flex: 1, padding: "0.65rem", borderRadius: 8,
              background: "#1e1e2e", border: "1px solid #334155",
              color: "#94a3b8", cursor: busy ? "not-allowed" : "pointer", fontSize: "0.8rem",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="font-mono font-bold"
            style={{
              flex: 1, padding: "0.65rem", borderRadius: 8,
              background: `${accent}22`, border: `1px solid ${accent}`,
              color: accent, cursor: busy ? "not-allowed" : "pointer", fontSize: "0.8rem",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
