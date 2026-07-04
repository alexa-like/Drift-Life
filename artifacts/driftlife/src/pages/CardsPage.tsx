import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "event";

interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  imageUrl: string;
}

interface OwnedCard {
  cardId: string;
  name: string;
  rarity: Rarity;
  obtainedAt: string;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RARITY_COLORS: Record<Rarity, string> = {
  common: "#94a3b8",
  uncommon: "#39d353",
  rare: "#00d4ff",
  epic: "#a855f7",
  legendary: "#f59e0b",
  event: "#ff2d55",
};

export function CardsPage({ user, refreshUser, addToast }: Props) {
  const [catalog, setCatalog] = useState<CardDef[]>([]);
  const [collection, setCollection] = useState<OwnedCard[]>([]);
  const [dc, setDc] = useState(0);
  const [packCost, setPackCost] = useState(500);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [pulled, setPulled] = useState<CardDef | null>(null);

  const load = async () => {
    try {
      const [cat, mine] = await Promise.all([
        api.get<CardDef[]>("/cards/catalog"),
        api.get<{ cards: OwnedCard[]; dc: number; packCost: number }>("/cards"),
      ]);
      setCatalog(cat);
      setCollection(mine.cards);
      setDc(mine.dc);
      setPackCost(mine.packCost);
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleBuyPack = async () => {
    setOpening(true);
    setPulled(null);
    try {
      const res = await api.post<{ message: string; card: CardDef; xpGained: number }>("/cards/buy-pack", {});
      setPulled(res.card);
      addToast(res.message, "success");
      await load();
      await refreshUser();
    } catch (e: any) {
      addToast(e.message || "Purchase failed", "error");
    } finally {
      setOpening(false);
    }
  };

  const ownedIds = new Set(collection.map(c => c.cardId));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="font-mono font-bold" style={{ color: "#00d4ff", fontSize: 18, letterSpacing: "0.12em", marginBottom: 4 }}>
        VANTA CARDS
      </div>
      <div className="font-mono" style={{ color: "#475569", fontSize: 11, marginBottom: 20 }}>
        Collect trading cards from New Vanta's underworld. {collection.length}/{catalog.length} collected.
      </div>

      <div style={{
        background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24,
      }}>
        <div>
          <div className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 14 }}>
            Card Pack
          </div>
          <div className="font-mono" style={{ color: "#475569", fontSize: 11 }}>
            {packCost.toLocaleString()} DC per pack — you have {dc.toLocaleString()} DC
          </div>
        </div>
        <button
          onClick={handleBuyPack}
          disabled={opening || dc < packCost}
          className="font-mono"
          style={{
            padding: "8px 20px", borderRadius: 4, cursor: "pointer",
            background: "#00d4ff18", border: "1px solid #00d4ff40",
            color: "#00d4ff", fontSize: 12, fontWeight: "bold",
            opacity: opening || dc < packCost ? 0.5 : 1,
            letterSpacing: "0.06em",
          }}
        >
          {opening ? "OPENING..." : "BUY PACK"}
        </button>
      </div>

      {pulled && (
        <div style={{
          background: "#111118", border: `1px solid ${RARITY_COLORS[pulled.rarity]}60`, borderRadius: 8,
          padding: 16, marginBottom: 24, display: "flex", gap: 16, alignItems: "center",
          boxShadow: `0 0 20px ${RARITY_COLORS[pulled.rarity]}30`,
        }}>
          <img src={pulled.imageUrl} alt={pulled.name} style={{ width: 96, height: 96, borderRadius: 6, objectFit: "cover", border: `1px solid ${RARITY_COLORS[pulled.rarity]}40` }} />
          <div>
            <div className="font-mono" style={{ color: RARITY_COLORS[pulled.rarity], fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {pulled.rarity} — You pulled
            </div>
            <div className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 16 }}>{pulled.name}</div>
            <div className="font-mono" style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{pulled.description}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="font-mono" style={{ color: "#334155", textAlign: "center", padding: 40 }}>
          Loading collection...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {catalog.map(c => {
            const owned = ownedIds.has(c.id);
            const col = RARITY_COLORS[c.rarity];
            return (
              <div
                key={c.id}
                style={{
                  background: "#111118",
                  border: `1px solid ${owned ? col + "50" : "#1e1e2e"}`,
                  borderRadius: 8,
                  overflow: "hidden",
                  opacity: owned ? 1 : 0.4,
                  boxShadow: owned ? `0 0 10px ${col}20` : "none",
                }}
              >
                <div style={{ position: "relative", aspectRatio: "1", background: "#0a0a0f" }}>
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", filter: owned ? "none" : "grayscale(1)" }}
                  />
                  {!owned && (
                    <div style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#0a0a0fa0", fontSize: 24,
                    }}>
                      ?
                    </div>
                  )}
                </div>
                <div style={{ padding: 8 }}>
                  <div className="font-mono font-bold" style={{ color: owned ? "#e2e8f0" : "#334155", fontSize: 11 }}>
                    {owned ? c.name : "???"}
                  </div>
                  <div className="font-mono" style={{ color: col, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {c.rarity}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
