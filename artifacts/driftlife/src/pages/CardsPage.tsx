import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Card {
  cardId: string;
  name: string;
  rarity: string;
  obtainedAt: string;
}

interface CatalogCard {
  id: string;
  name: string;
  rarity: string;
  description: string;
  imageUrl: string;
}

interface PullResult {
  message: string;
  card: {
    cardId: string;
    name: string;
    rarity: string;
    description: string;
    imageUrl: string;
  };
  xpGained: number;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8",
  uncommon: "#39d353",
  rare: "#00d4ff",
  epic: "#a855f7",
  legendary: "#f59e0b",
  event: "#ff6b35",
};

const RARITY_GLOW: Record<string, string> = {
  rare:      "0 0 8px #00d4ff30",
  epic:      "0 0 14px #a855f760",
  legendary: "0 0 18px #f59e0b80",
  event:     "0 0 14px #ff6b3560",
};

interface Props {
  user: User;
  refreshUser: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

function CardImage({ imageUrl, name, rarity, size = 64 }: { imageUrl?: string; name: string; rarity: string; size?: number }) {
  const color = RARITY_COLORS[rarity] ?? "#94a3b8";
  if (imageUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: 6, overflow: "hidden", background: "#0a0a0f", flexShrink: 0 }}>
        <img
          src={imageUrl}
          alt={name}
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: "cover", display: "block" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: `${color}18`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: size * 0.45, color }}>{name[0]}</span>
    </div>
  );
}

export function CardsPage({ user: _user, refreshUser, addToast }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"collection" | "catalog">("collection");
  const [lastPull, setLastPull] = useState<PullResult["card"] | null>(null);

  const { data, isLoading } = useQuery<{ cards: Card[]; dc: number; packCost: number }>({
    queryKey: ["cards"],
    queryFn: () => api.get("/cards"),
  });

  const { data: catalog = [] } = useQuery<CatalogCard[]>({
    queryKey: ["cards-catalog"],
    queryFn: () => api.get("/cards/catalog"),
    staleTime: 60_000,
  });

  const catalogById = Object.fromEntries(catalog.map((c) => [c.id, c]));

  const buyPack = useMutation({
    mutationFn: (): Promise<PullResult> => api.post("/cards/buy-pack", {}),
    onSuccess: (r) => {
      addToast(r.message, r.card.rarity === "legendary" || r.card.rarity === "epic" ? "success" : "info");
      setLastPull(r.card);
      qc.invalidateQueries({ queryKey: ["cards"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const ownedIds = new Set(data?.cards.map((c) => c.cardId) ?? []);
  const cardsByRarity = (data?.cards ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.rarity] = (acc[c.rarity] ?? 0) + 1;
    return acc;
  }, {});

  const canAfford = (data?.dc ?? 0) >= (data?.packCost ?? 500);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-mono font-bold text-lg" style={{ color: "#f59e0b" }}>TRADING CARDS</h2>
            <p className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
              Collectible cards from the streets of New Vanta.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs" style={{ color: "#64748b" }}>
              {data?.cards.length ?? 0} / {catalog.length} collected
            </span>
            <button
              onClick={() => buyPack.mutate()}
              disabled={buyPack.isPending || !canAfford}
              className="font-mono text-sm px-4 py-1.5 rounded font-bold"
              style={{
                background: canAfford ? "#f59e0b22" : "#1e1e2e",
                color: canAfford ? "#f59e0b" : "#334155",
                border: `1px solid ${canAfford ? "#f59e0b40" : "#1e1e2e"}`,
                cursor: canAfford ? "pointer" : "not-allowed",
              }}
            >
              {buyPack.isPending ? "Opening..." : `Open Pack — ${(data?.packCost ?? 500).toLocaleString()} DC`}
            </button>
          </div>
        </div>

        {Object.keys(cardsByRarity).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {(["common","uncommon","rare","epic","legendary","event"] as const)
              .filter((r) => cardsByRarity[r])
              .map((rarity) => (
                <span key={rarity} className="font-mono text-xs px-2 py-0.5 rounded"
                  style={{ background: "#0a0a0f", color: RARITY_COLORS[rarity], border: `1px solid ${RARITY_COLORS[rarity]}30` }}
                >
                  {cardsByRarity[rarity]}x {rarity}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Last pull spotlight */}
      {lastPull && (
        <div className="rounded-lg p-4" style={{
          background: "#111118",
          border: `1px solid ${RARITY_COLORS[lastPull.rarity] ?? "#1e1e2e"}60`,
          boxShadow: RARITY_GLOW[lastPull.rarity] ?? "none",
        }}>
          <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>LAST PULL</div>
          <div className="flex items-center gap-3">
            <CardImage imageUrl={lastPull.imageUrl} name={lastPull.name} rarity={lastPull.rarity} size={72} />
            <div>
              <div className="font-mono font-bold text-sm" style={{ color: RARITY_COLORS[lastPull.rarity] }}>{lastPull.name}</div>
              <div className="font-mono text-xs mt-0.5" style={{ color: RARITY_COLORS[lastPull.rarity] + "80" }}>{lastPull.rarity.toUpperCase()}</div>
              <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>{lastPull.description}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["collection", "catalog"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="font-mono text-xs px-3 py-1 rounded capitalize"
            style={{
              background: tab === t ? "#f59e0b22" : "#111118",
              color: tab === t ? "#f59e0b" : "#64748b",
              border: `1px solid ${tab === t ? "#f59e0b40" : "#1e1e2e"}`,
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Collection grid */}
      {tab === "collection" && (
        isLoading ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading collection...</div>
        ) : (data?.cards.length ?? 0) === 0 ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>No cards yet. Open a pack to start collecting.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data?.cards.map((card, i) => {
              const def = catalogById[card.cardId];
              return (
                <div key={i} className="rounded-lg overflow-hidden"
                  style={{
                    background: "#111118",
                    border: `1px solid ${RARITY_COLORS[card.rarity] ?? "#1e1e2e"}40`,
                    boxShadow: RARITY_GLOW[card.rarity] ?? "none",
                  }}
                >
                  {/* Card image */}
                  <div style={{ width: "100%", aspectRatio: "1/1", background: "#0a0a0f", overflow: "hidden" }}>
                    {def?.imageUrl ? (
                      <img
                        src={def.imageUrl}
                        alt={card.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 32, color: RARITY_COLORS[card.rarity] }}>{card.name[0]}</span>
                      </div>
                    )}
                  </div>
                  {/* Card info */}
                  <div className="p-2">
                    <div className="font-mono text-xs font-bold truncate" style={{ color: RARITY_COLORS[card.rarity] }}>{card.name}</div>
                    <div className="font-mono text-xs" style={{ color: RARITY_COLORS[card.rarity] + "70" }}>{card.rarity}</div>
                    {def?.description && (
                      <div className="font-mono text-xs mt-1 leading-tight" style={{ color: "#475569", fontSize: 10 }}>{def.description}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Catalog grid */}
      {tab === "catalog" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {catalog.map((card) => {
            const owned = ownedIds.has(card.id);
            return (
              <div key={card.id} className="rounded-lg overflow-hidden"
                style={{
                  background: "#111118",
                  border: `1px solid ${owned ? RARITY_COLORS[card.rarity] + "40" : "#1e1e2e"}`,
                  opacity: owned ? 1 : 0.45,
                }}
              >
                {/* Card image */}
                <div style={{ width: "100%", aspectRatio: "1/1", background: "#0a0a0f", overflow: "hidden", position: "relative" }}>
                  {owned ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 28, color: "#334155" }}>?</span>
                    </div>
                  )}
                </div>
                {/* Card info */}
                <div className="p-2">
                  <div className="font-mono text-xs font-bold truncate"
                    style={{ color: owned ? RARITY_COLORS[card.rarity] : "#334155" }}
                  >
                    {owned ? card.name : "Unknown"}
                  </div>
                  <div className="font-mono text-xs" style={{ color: owned ? RARITY_COLORS[card.rarity] + "70" : "#1e1e2e" }}>{card.rarity}</div>
                  {owned && (
                    <div className="font-mono mt-1 leading-tight" style={{ color: "#475569", fontSize: 10 }}>{card.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
