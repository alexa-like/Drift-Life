import { useState } from "react";
import { api } from "../lib/api";

interface Props {
  onRefresh: () => void;
  addToast: (msg: string, t?: string) => void;
}

export function DevToolbar({ onRefresh, addToast }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function action(path: string, body?: object) {
    setLoading(true);
    try {
      await api.post(path, body);
      onRefresh();
      addToast("Dev action applied", "success");
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 80, right: 12, zIndex: 9999 }}>
      {open && (
        <div
          style={{
            background: "#0d0d15",
            border: "1px solid #ff6b3540",
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
            width: 190,
            boxShadow: "0 0 20px #ff6b3520",
          }}
        >
          <div className="font-mono text-xs mb-3" style={{ color: "#ff6b35", borderBottom: "1px solid #1e1e2e", paddingBottom: 6 }}>
            ⚙ DEV (staff only)
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => action("/dev/heal")}
              disabled={loading}
              className="px-2.5 py-1.5 font-mono rounded"
              style={{ fontSize: 10, background: "#39d35320", color: "#39d353", border: "1px solid #39d35340" }}
            >
              🏥 Heal
            </button>
            <button
              onClick={() => action("/dev/clear-wanted")}
              disabled={loading}
              className="px-2.5 py-1.5 font-mono rounded"
              style={{ fontSize: 10, background: "#a855f720", color: "#a855f7", border: "1px solid #a855f740" }}
            >
              🚨 Clear Wanted
            </button>
          </div>
          <div className="font-mono mt-3" style={{ fontSize: 9, color: "#334155" }}>
            Economy adjustments via Owner Panel
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: open ? "#ff6b3520" : "#0d0d15",
          border: "1px solid #ff6b3550",
          color: "#ff6b35",
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: open ? "0 0 12px #ff6b3530" : "none",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        ⚙
      </button>
    </div>
  );
}
