import { useState, useEffect } from "react";
import { ItemImage } from "../components/ItemImage";
import { api } from "../lib/api";

const TIER_COLORS: Record<string, string> = {
  common: "#9ca3af", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};

interface Listing {
  itemId: string; itemName: string; itemTier: string; price: number; quantity: number; itemType: string;
}
interface StoreData {
  storeId: string; storeName: string; keeper: string; tagline: string;
  faqs: { q: string; a: string }[];
  listings: Listing[];
  restocksAt: string;
}

interface Props {
  storeId: string;
  onBack: () => void;
}

// NPC character art and personality data per store
const STORE_META: Record<string, { color: string; accentColor: string }> = {
  iron_wolf:      { color: "#ef4444", accentColor: "#ff6b35" },
  steelshield:    { color: "#8b5cf6", accentColor: "#a78bfa" },
  neon_motors:    { color: "#06b6d4", accentColor: "#22d3ee" },
  district_pharma:{ color: "#22c55e", accentColor: "#4ade80" },
  combat_zone:    { color: "#f97316", accentColor: "#fb923c" },
  chrome_garage:  { color: "#f59e0b", accentColor: "#fbbf24" },
};

const FAQ_ANSWERS: Record<string, Record<string, string>> = {
  iron_wolf: {
    "What do you sell?": "Enhancement gear — weapon mods, tactical rigs, combat upgrades. Everything you need to hit harder and survive longer in the arena.",
    "These prices negotiable?": "Ha. The prices are what they are. You want discount shopping, go cry to the street vendors.",
    "Got anything rarer?": "Rare and Epic drop through special channels. Keep checking back — restocks happen every 6 hours and the inventory rotates.",
    "How often do you restock?": "Every six hours, sharp. Timer's right there on the page. Don't miss it.",
    "What does enhancement gear do?": "Buffs your combat stats — damage, accuracy, defense. Stack the right gear with your loadout and you'll be unstoppable in the arena.",
  },
  steelshield: {
    "What does clothing do?": "Clothing boosts your stats — charisma, street cred, sometimes defense. Wear the right look and the city respects you.",
    "Fashion or function?": "Both, darling. In New Vanta, looking dangerous is half the battle. My pieces do both.",
    "How do I equip it?": "Head to your Inventory page and equip from there. Once on, the stat bonuses apply automatically.",
  },
  neon_motors: {
    "Tell me about the cars.": "Every ride here is built for the streets of New Vanta. Common runners up to Legendary beasts — each with unique speed, handling, and nitro stats.",
    "Which car should I get?": "Depends on your credits and ambition. Start with what you can afford, then upgrade parts. A tuned Common beats a neglected Rare.",
    "Can I race these cars?": "That's the whole point. Take it to the Race Hub, enter a match, burn some nitro.",
  },
  district_pharma: {
    "What do you carry?": "Medical supplies, combat drugs, service tokens. The clean stuff, the grey stuff, and the things the Corps don't want you to know about.",
    "What's a Service Token?": "Currency for premium services in the city. Untraceable, accepted everywhere that matters.",
    "Are these safe?": "Define safe. They do exactly what it says on the label. What you do with them is your business.",
  },
  combat_zone: {
    "What's in stock?": "Weapons, ammo, tactical gear. If it kills people or stops them from killing you, we stock it.",
    "Where do I get Epic or Legendary?": "Patience. Royale spins, high-tier crime runs, and rare restocks. Or outbid someone on the Auction.",
    "How do I know what I need?": "Check your arena loadout. See what's empty. Fill it. Come back when you've won a few fights.",
    "Ammo — how does it work?": "Equip ammo in your loadout to get bonus damage types — hollow point, armor-piercing, incendiary. Each changes how your attacks land.",
  },
  chrome_garage: {
    "What do you have?": "Car parts and vehicle upgrades. Engines, tires, nitro tanks, body kits, spoilers. Real racing gear, not the showroom junk.",
    "What's condition?": "Everything I sell leaves here in working order. You break it after, that's your problem.",
    "Can I sell my car here?": "I buy, sure. Bring it to the Garage page. Fair prices for good iron.",
    "Car parts vs car upgrades?": "Parts slot into your equipped car and boost its base stats. Upgrades are permanent mods. Parts you can swap; upgrades stick.",
  },
};

export default function NpcStorePage({ storeId, onBack }: Props) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [npcImgFailed, setNpcImgFailed] = useState(false);

  const meta = STORE_META[storeId] ?? { color: "#00d4ff", accentColor: "#22d3ee" };

  useEffect(() => {
    setLoading(true);
    setNpcImgFailed(false);
    api.get<StoreData>("/npc-stores/" + storeId)
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
      const data = await api.post<{ message: string }>("/npc-stores/" + storeId + "/buy", { itemId });
      setMessage("✓ " + data.message);
      const d2 = await api.get<StoreData>("/npc-stores/" + storeId);
      setStore(d2);
    } catch (err: any) {
      setMessage("✗ " + (err.message ?? "Failed"));
    }
    setBuying(null);
  }

  if (loading) return (
    <div style={{ color: "#00d4ff", padding: "2rem", fontFamily: "monospace", textAlign: "center" }}>
      Loading...
    </div>
  );
  if (!store) return (
    <div style={{ color: "#ef4444", padding: "2rem", fontFamily: "monospace" }}>Store not found</div>
  );

  // Merge FAQ answers: server-provided first, fallback to local
  const localAnswers = FAQ_ANSWERS[storeId] ?? {};
  const faqs = store.faqs?.length > 0
    ? store.faqs.map(faq => ({
        q: faq.q,
        a: faq.a || localAnswers[faq.q] || "Ask me in person.",
      }))
    : Object.entries(localAnswers).map(([q, a]) => ({ q, a }));

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 0 40px" }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          marginBottom: 16, padding: "6px 14px",
          background: "#111120", border: "1px solid #1e293b",
          color: "#64748b", borderRadius: 6, cursor: "pointer",
          fontFamily: "monospace", fontSize: 11,
        }}
      >
        ← Back to Shops
      </button>

      {/* ── HEADER: NPC art + store info ── */}
      <div style={{
        display: "flex", gap: 20, alignItems: "flex-start",
        background: "#0a0a14",
        border: `1px solid ${meta.color}30`,
        borderRadius: 12, padding: "20px 24px", marginBottom: 20,
        borderLeft: `4px solid ${meta.color}`,
      }}>
        {/* NPC Character Art */}
        <div style={{
          width: 100, height: 120, flexShrink: 0,
          borderRadius: 10, overflow: "hidden",
          border: `1px solid ${meta.color}40`,
          background: `${meta.color}10`,
        }}>
          {!npcImgFailed ? (
            <img
              src={`/assets/npcs/${storeId}.png`}
              alt={store.keeper}
              onError={() => setNpcImgFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              fontSize: 40,
            }}>
              🧑
            </div>
          )}
        </div>

        {/* Store info */}
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontFamily: "monospace", fontSize: 20, fontWeight: "bold",
            color: meta.color, margin: "0 0 4px",
            letterSpacing: 2, textShadow: `0 0 10px ${meta.color}60`,
          }}>
            {store.storeName}
          </h1>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
            {store.keeper}
          </div>
          <div style={{
            fontFamily: "monospace", fontSize: 11, color: "#64748b",
            fontStyle: "italic", borderLeft: `2px solid ${meta.color}40`,
            paddingLeft: 10,
          }}>
            "{store.tagline}"
          </div>
        </div>
      </div>

      {/* ── FAQ SECTION ── */}
      {faqs.length > 0 && (
        <div style={{
          background: "#0a0a14", border: "1px solid #1e293b",
          borderRadius: 10, padding: "16px 18px", marginBottom: 20,
        }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 12 }}>
            FAQ
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {faqs.map((faq, i) => (
              <button
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  padding: "6px 12px",
                  background: openFaq === i ? `${meta.color}20` : "#111120",
                  border: `1px solid ${openFaq === i ? meta.color : "#1e293b"}`,
                  borderRadius: 6, color: openFaq === i ? meta.color : "#94a3b8",
                  cursor: "pointer", fontSize: 11, fontFamily: "monospace",
                  transition: "all 0.15s",
                }}
              >
                {faq.q}
              </button>
            ))}
          </div>
          {openFaq !== null && faqs[openFaq] && (
            <div style={{
              background: "#111120", border: `1px solid ${meta.color}20`,
              borderRadius: 6, padding: "12px 14px",
              fontFamily: "monospace", fontSize: 11, color: "#94a3b8",
              lineHeight: 1.6, marginTop: 4,
            }}>
              <span style={{ color: meta.color, fontWeight: "bold" }}>
                {store.keeper}:{" "}
              </span>
              "{faqs[openFaq].a}"
            </div>
          )}
        </div>
      )}

      {/* ── IN STOCK ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontFamily: "monospace", fontSize: 14, color: "#e2e8f0", margin: 0, letterSpacing: 2 }}>
          IN STOCK
        </h3>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>
          Restocks in: <span style={{ color: meta.color }}>{timeLeft}</span>
        </span>
      </div>

      {message && (
        <div style={{
          padding: "10px 14px",
          background: message.startsWith("✓") ? "#064e3b" : "#7f1d1d",
          border: `1px solid ${message.startsWith("✓") ? "#065f4630" : "#991b1b40"}`,
          borderRadius: 6, color: "#fff", marginBottom: 14,
          fontFamily: "monospace", fontSize: 11,
        }}>
          {message}
        </div>
      )}

      {store.listings.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "2.5rem",
          fontFamily: "monospace", color: "#475569",
          background: "#0a0a14", border: "1px solid #1e293b", borderRadius: 10,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
          <div>OUT OF STOCK — Next restock in{" "}
            <span style={{ color: meta.color }}>{timeLeft}</span>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
          {store.listings.map((listing, i) => {
            const tierColor = TIER_COLORS[listing.itemTier] ?? "#9ca3af";
            return (
              <div key={i} style={{
                background: "#0a0a14",
                border: `1px solid ${tierColor}25`,
                borderRadius: 10, padding: 14,
                display: "flex", flexDirection: "column", gap: 8,
                transition: "border-color 0.15s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = tierColor + "60"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = tierColor + "25"; }}
              >
                {/* Item image */}
                <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
                  <ItemImage itemId={listing.itemId} size={72} />
                </div>

                {/* Item info */}
                <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: "#e2e8f0" }}>
                  {listing.itemName}
                </div>

                {/* Rarity badge */}
                <div style={{ display: "inline-block" }}>
                  <span style={{
                    fontFamily: "monospace", fontSize: 9, letterSpacing: 1,
                    color: tierColor, background: `${tierColor}18`,
                    border: `1px solid ${tierColor}40`,
                    borderRadius: 4, padding: "2px 6px",
                    textTransform: "uppercase",
                  }}>
                    {listing.itemTier}
                  </span>
                </div>

                {/* Price */}
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#f59e0b", fontWeight: "bold" }}>
                  {listing.price.toLocaleString()} DC
                </div>

                {/* Qty */}
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>
                  Qty: {listing.quantity}
                </div>

                {/* Buy button */}
                <button
                  onClick={() => handleBuy(listing.itemId)}
                  disabled={buying === listing.itemId || listing.quantity === 0}
                  style={{
                    width: "100%", padding: "8px 0",
                    background: meta.color + "18",
                    border: `1px solid ${meta.color}60`,
                    color: meta.color,
                    borderRadius: 6, cursor: "pointer",
                    fontFamily: "monospace", fontSize: 11, fontWeight: "bold",
                    letterSpacing: 1,
                    opacity: listing.quantity === 0 ? 0.4 : 1,
                    transition: "background 0.15s",
                  }}
                >
                  {buying === listing.itemId ? "..." : listing.quantity === 0 ? "SOLD OUT" : "BUY"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
