import { useState } from "react";
import { api } from "../shared/api";
import { User } from "../shared/types";

interface Props {
  user: User;
  onRefresh: () => void;
  addToast: (msg: string, t?: string) => void;
}

export function DevToolbar({ user, onRefresh, addToast }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dcAmount, setDcAmount] = useState("10000");
  const [ncAmount, setNcAmount] = useState("100");

  const isOwner = user.role === "owner";

  async function action(path: string, body?: object) {
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>(path, body);
      onRefresh();
      addToast(res.message || "Done", "success");
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
            width: 210,
            boxShadow: "0 0 20px #ff6b3520",
          }}
        >
          <div className="font-mono text-xs mb-3" style={{ color: "#ff6b35", borderBottom: "1px solid #1e1e2e", paddingBottom: 6 }}>
            ⚙ DEV ({isOwner ? "owner" : "staff"})
          </div>

          <div className="flex gap-1.5 flex-wrap mb-3">
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

          {/* Owner-only: currency injection */}
          {isOwner && (
            <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: 10 }}>
              <div className="font-mono mb-2" style={{ fontSize: 9, color: "#f59e0b", letterSpacing: "0.08em" }}>
                💰 OWNER — CURRENCY INJECT
              </div>

              {/* Add DC */}
              <div className="flex items-center gap-1 mb-2">
                <input
                  value={dcAmount}
                  onChange={e => setDcAmount(e.target.value)}
                  type="number"
                  min={1}
                  className="font-mono rounded px-1.5 py-1 flex-1 min-w-0"
                  style={{ fontSize: 10, background: "#0a0a0f", border: "1px solid #f59e0b30", color: "#f59e0b" }}
                  placeholder="DC amount"
                />
                <button
                  onClick={() => action("/dev/add-dc", { amount: Number(dcAmount) })}
                  disabled={loading || !dcAmount}
                  className="px-2 py-1 font-mono rounded flex-shrink-0"
                  style={{ fontSize: 10, background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}
                >
                  +DC
                </button>
              </div>

              {/* Add NC */}
              <div className="flex items-center gap-1">
                <input
                  value={ncAmount}
                  onChange={e => setNcAmount(e.target.value)}
                  type="number"
                  min={1}
                  className="font-mono rounded px-1.5 py-1 flex-1 min-w-0"
                  style={{ fontSize: 10, background: "#0a0a0f", border: "1px solid #a855f730", color: "#a855f7" }}
                  placeholder="NC amount"
                />
                <button
                  onClick={() => action("/dev/give-nc", { amount: Number(ncAmount) })}
                  disabled={loading || !ncAmount}
                  className="px-2 py-1 font-mono rounded flex-shrink-0"
                  style={{ fontSize: 10, background: "#a855f720", color: "#a855f7", border: "1px solid #a855f740" }}
                >
                  +NC
                </button>
              </div>
            </div>
          )}
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
