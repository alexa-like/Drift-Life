import { useState, useEffect } from "react";

const TIER_COLORS: Record<string, string> = { common:"#9ca3af", uncommon:"#22c55e", rare:"#3b82f6", epic:"#a855f7", legendary:"#f59e0b" };

interface Listing { itemId: string; itemName: string; itemTier: string; price: number; quantity: number; itemType: string; }
interface StoreData { storeId: string; storeName: string; keeper: string; tagline: string; faqs: { q: string; a: string }[]; listings: Listing[]; restocksAt: string; }

interface Props {
  storeId: string;
  onBack: () => void;
}

export default function NpcStorePage({ storeId, onBack }: Props) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/npc-stores/" + storeId, { credentials: "include" })
      .then(r => r.json())
      .then(data => { setStore(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [storeId]);

  useEffect(() => {
    if (!store?.restocksAt) return;
    const tick = () => {
      const diff = new Date(store.restocksAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Restocking..."); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(h + "h " + m + "m");
    };
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [store?.restocksAt]);

  async function handleBuy(itemId: string) {
    setBuying(itemId);
    setMessage(null);
    try {
      const res = await fetch("/api/npc-stores/" + storeId + "/buy", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ itemId })
      });
      const data = await res.json();
      setMessage(res.ok ? "✓ " + data.message : "✗ " + (data.message ?? "Failed"));
      if (res.ok) {
        const r2 = await fetch("/api/npc-stores/" + storeId, { credentials: "include" });
        const d2 = await r2.json();
        setStore(d2);
      }
    } catch { setMessage("Network error"); }
    setBuying(null);
  }

  if (loading) return <div style={{ color: "#aaa", padding: "2rem" }}>Loading...</div>;
  if (!store) return <div style={{ color: "#ef4444", padding: "2rem" }}>Store not found</div>;

  return (
    <div style={{ padding: "1rem", maxWidth: "700px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ marginBottom: "1rem", padding: "0.3rem 0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "0.8rem" }}>
        ← Back to Shops
      </button>
      <h1 style={{ color: "#00E0FF", fontFamily: "monospace" }}>{store.storeName}</h1>
      <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>{store.keeper}</div>
      <div style={{ color: "#666", fontStyle: "italic", marginBottom: "1.5rem" }}>"{store.tagline}"</div>

      {/* FAQ */}
      {store.faqs?.length > 0 && (
        <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ color: "#9ca3af", fontSize: "0.8rem", marginBottom: "0.5rem" }}>FAQ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {store.faqs.map((faq, i) => (
              <button key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ padding: "0.3rem 0.75rem", background: openFaq === i ? "#374151" : "#1f2937", border: "1px solid #374151", borderRadius: "4px", color: "#d1d5db", cursor: "pointer", fontSize: "0.8rem" }}>
                {faq.q}
              </button>
            ))}
          </div>
          {openFaq !== null && (
            <div style={{ color: "#9ca3af", fontSize: "0.85rem", background: "#1f2937", padding: "0.75rem", borderRadius: "4px" }}>
              "{store.faqs[openFaq].a}"
            </div>
          )}
        </div>
      )}

      {/* Listings */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ color: "#fff", margin: 0 }}>IN STOCK</h3>
        <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>Restocks in: {timeLeft}</span>
      </div>

      {message && (
        <div style={{ padding: "0.5rem", background: message.startsWith("✓") ? "#064e3b" : "#7f1d1d", borderRadius: "4px", color: "#fff", marginBottom: "1rem", fontSize: "0.9rem" }}>
          {message}
        </div>
      )}

      {store.listings.length === 0 ? (
        <div style={{ color: "#6b7280", textAlign: "center", padding: "2rem" }}>Out of stock — check back in {timeLeft}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: "1rem" }}>
          {store.listings.map((listing, i) => (
            <div key={i} style={{ background: "#1a1a2e", border: "1px solid #374151", borderRadius: "8px", padding: "1rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📦</div>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}>{listing.itemName}</div>
              <div style={{ color: TIER_COLORS[listing.itemTier] ?? "#aaa", fontSize: "0.75rem", textTransform: "capitalize", marginBottom: "0.25rem" }}>{listing.itemTier}</div>
              <div style={{ color: "#d1d5db", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{listing.price.toLocaleString()} DC</div>
              <div style={{ color: "#6b7280", fontSize: "0.75rem", marginBottom: "0.75rem" }}>Qty: {listing.quantity}</div>
              <button
                onClick={() => handleBuy(listing.itemId)}
                disabled={buying === listing.itemId}
                style={{ width: "100%", padding: "0.4rem", background: "#1e3a5f", border: "1px solid #3b82f6", color: "#60a5fa", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>
                {buying === listing.itemId ? "..." : "BUY"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
