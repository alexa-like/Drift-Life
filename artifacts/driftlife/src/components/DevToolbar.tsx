import { useState } from "react";
import { api } from "../lib/api";

interface Props {
  onRefresh: () => void;
  addToast: (msg: string, t?: string) => void;
}

export function DevToolbar({ onRefresh, addToast }: Props) {
  const [open, setOpen] = useState(false);
  const [dcAmount, setDcAmount] = useState("10000");
  const [levelVal, setLevelVal] = useState("10");
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
            border: "1px solid #00d4ff40",
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
            width: 220,
            boxShadow: "0 0 20px #00d4ff20",
          }}
        >
          <div className="font-mono text-xs mb-3" style={{ color: "#00d4ff", borderBottom: "1px solid #1e1e2e", paddingBottom: 6 }}>
            ⚡ DEV TOOLBAR
          </div>

          {/* Add DC */}
          <div className="flex gap-1 mb-2">
            <input
              type="number"
              value={dcAmount}
              onChange={e => setDcAmount(e.target.value)}
              className="flex-1 px-2 py-1 font-mono text-xs rounded"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none", width: 80 }}
            />
            <button
              onClick={() => action("/dev/add-dc", { amount: parseInt(dcAmount) || 10000 })}
              disabled={loading}
              className="px-2 py-1 font-mono text-xs rounded"
              style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}
            >
              +DC
            </button>
          </div>

          {/* Set Level */}
          <div className="flex gap-1 mb-2">
            <input
              type="number"
              value={levelVal}
              onChange={e => setLevelVal(e.target.value)}
              className="flex-1 px-2 py-1 font-mono text-xs rounded"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none", width: 80 }}
            />
            <button
              onClick={() => action("/dev/set-level", { level: parseInt(levelVal) || 10 })}
              disabled={loading}
              className="px-2 py-1 font-mono text-xs rounded"
              style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40" }}
            >
              Lvl Up
            </button>
          </div>

          {/* Row of quick actions */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => action("/dev/fill-resources")}
              disabled={loading}
              className="px-2 py-1 font-mono rounded"
              style={{ fontSize: 10, background: "#39d35320", color: "#39d353", border: "1px solid #39d35340" }}
            >
              ⚡ Fill
            </button>
            <button
              onClick={() => action("/dev/heal")}
              disabled={loading}
              className="px-2 py-1 font-mono rounded"
              style={{ fontSize: 10, background: "#ff2d5520", color: "#ff2d55", border: "1px solid #ff2d5540" }}
            >
              🏥 Heal
            </button>
            <button
              onClick={() => action("/dev/clear-wanted")}
              disabled={loading}
              className="px-2 py-1 font-mono rounded"
              style={{ fontSize: 10, background: "#a855f720", color: "#a855f7", border: "1px solid #a855f740" }}
            >
              🚨 Clear
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: open ? "#00d4ff20" : "#0d0d15",
          border: "1px solid #00d4ff60",
          color: "#00d4ff",
          fontSize: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: open ? "0 0 16px #00d4ff40" : "none",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        ⚙
      </button>
    </div>
  );
}
