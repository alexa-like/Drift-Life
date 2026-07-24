import { useState } from "react";
import { User } from "../../../shared/types";
import { api } from "../../../shared/api";
import { formatDC } from "../../../shared/format";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

type Tab = "deposit" | "withdraw" | "transfer";

export function BankPage({ user, refreshUser, addToast }: Props) {
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [bankData, setBankData] = useState({ wallet: user.dc, bank: user.bankBalance });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return addToast("Invalid amount", "error");
    setLoading(true);
    try {
      let data: any;
      if (tab === "deposit") {
        data = await api.post("/bank/deposit", { amount: amt });
      } else if (tab === "withdraw") {
        data = await api.post("/bank/withdraw", { amount: amt });
      } else {
        if (!target) return addToast("Target username required", "error");
        data = await api.post("/bank/transfer", { targetUsername: target, amount: amt });
      }
      setBankData({ wallet: data.wallet, bank: data.bank });
      addToast(data.message, "success");
      setAmount("");
      setTarget("");
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const TABS: { id: Tab; label: string; color: string }[] = [
    { id: "deposit", label: "Deposit", color: "#39d353" },
    { id: "withdraw", label: "Withdraw", color: "#ff6b35" },
    { id: "transfer", label: "Transfer", color: "#00d4ff" },
  ];

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <h2 className="text-lg font-mono font-bold" style={{ color: "#f59e0b" }}>Bank of New Vanta</h2>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="text-xs font-mono mb-1" style={{ color: "#475569" }}>Wallet</div>
          <div className="text-xl font-mono font-bold" style={{ color: "#f59e0b" }}>
            {bankData.wallet.toLocaleString()}
            <span className="text-xs ml-1" style={{ color: "#475569" }}>DC</span>
          </div>
        </div>
        <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="text-xs font-mono mb-1" style={{ color: "#475569" }}>Bank (safe)</div>
          <div className="text-xl font-mono font-bold" style={{ color: "#39d353" }}>
            {bankData.bank.toLocaleString()}
            <span className="text-xs ml-1" style={{ color: "#475569" }}>DC</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-1.5 rounded text-xs font-mono uppercase transition-all"
              style={{
                background: tab === t.id ? `${t.color}18` : "transparent",
                color: tab === t.id ? t.color : "#475569",
                border: `1px solid ${tab === t.id ? `${t.color}40` : "#1e1e2e"}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {tab === "transfer" && (
            <input
              type="text"
              placeholder="Target username"
              value={target}
              onChange={e => setTarget(e.target.value)}
              required
              className="w-full px-3 py-2 rounded font-mono text-sm outline-none"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}
            />
          )}
          <input
            type="number"
            placeholder="Amount (DC)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={1}
            required
            className="w-full px-3 py-2 rounded font-mono text-sm outline-none"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}
          />
          <button
            type="submit"
            disabled={loading}
            className="py-2 rounded font-mono text-sm font-bold uppercase"
            style={{
              background: TABS.find(t => t.id === tab)!.color + "18",
              color: TABS.find(t => t.id === tab)!.color,
              border: `1px solid ${TABS.find(t => t.id === tab)!.color}40`,
            }}
          >
            {loading ? "Processing..." : TABS.find(t => t.id === tab)!.label}
          </button>
        </form>

        {tab === "deposit" && (
          <p className="mt-3 text-xs font-mono" style={{ color: "#475569" }}>
            Deposited DC is safe from muggings and attacks.
          </p>
        )}
      </div>
    </div>
  );
}
