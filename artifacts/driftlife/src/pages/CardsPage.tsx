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
  legendary: "0 0 12px #f59e0b60",
  epic: "0 0 12px #a855f760",
  event: "0 0 12px #ff6b3560",
};

interface Props {
  user: User;
  refreshUser: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function CardsPage({ user, refreshUser, addToast }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"collection" | "catalog">("collection");
  const [lastPull, setLastPull] = useState<{ name: string; rarity: string; description: string } | null>(null);

  const { data, isLoading } = useQuery<{ cards: Card[]; dc: number; packCost: number }>({
    queryKey: ["cards"],
    queryFn: () => api.get("/cards"),
  });

  const { data: catalog = [] } = useQuery<CatalogCard[]>({
    queryKey: ["cards-catalog"],
    queryFn: () => api.get("/cards/catalog"),
    enabled: tab === "catalog",
  });

  const buyPack = useMutation({
    mutationFn: () => api.post("/cards/buy-pack", {}),
    onSuccess: (r: { message: string; card: { name: string; rarity: string; description: string } }) => {
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

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-mono font-bold text-lg" style={{ color: "#f59e0b" }}>TRADING CARDS</h2>
            <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
              Collectible cards from the streets of New Vanta. Pull packs, trade, collect.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs" style={{ color: "#64748b" }}>{data?.cards.length ?? 0} cards owned</span>
            <button
              onClick={() => buyPack.mutate()}
              disabled={buyPack.isPending || (data?.dc ?? 0) < (data?.packCost ?? 500)}
              className="font-mono text-sm px-4 py-1 rounded font-bold"
              style={{
                background: (data?.dc ?? 0) >= (data?.packCost ?? 500) ? "#f59e0b22" : "#1e1e2e",
                color: (data?.dc ?? 0) >= (data?.packCost ?? 500) ? "#f59e0b" : "#334155",
                border: `1px solid ${(data?.dc ?? 0) >= (data?.packCost ?? 500) ? "#f59e0b40" : "#1e1e2e"}`,
                cursor: (data?.dc ?? 0) >= (data?.packCost ?? 500) ? "pointer" : "not-allowed",
              }}
            >
              {buyPack.isPending ? "Opening..." : `Open Pack — ${data?.packCost ?? 500} DC`}
            </button>
          </div>
        </div>

        {Object.keys(cardsByRarity).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(cardsByRarity).map(([rarity, count]) => (
              <span key={rarity} className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "#0a0a0f", color: RARITY_COLORS[rarity] ?? "#94a3b8", border: `1px solid ${RARITY_COLORS[rarity] ?? "#1e1e2e"}30` }}>
                {count}x {rarity}
              </span>
            ))}
          </div>
        )}
      </div>

      {lastPull && (
        <div className="rounded-lg p-4" style={{ background: "#111118", border: `1px solid ${RARITY_COLORS[lastPull.rarity] ?? "#1e1e2e"}60`, boxShadow: RARITY_GLOW[lastPull.rarity] ?? "none" }}>
          <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>LAST PULL</div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded flex items-center justify-center font-bold text-lg" style={{ background: RARITY_COLORS[lastPull.rarity] + "22", color: RARITY_COLORS[lastPull.rarity], border: `1px solid ${RARITY_COLORS[lastPull.rarity]}40` }}>
              {lastPull.name[0]}
            </div>
            <div>
              <div className="font-mono font-bold" style={{ color: RARITY_COLORS[lastPull.rarity] }}>{lastPull.name}</div>
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>{lastPull.description}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(["collection", "catalog"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="font-mono text-xs px-3 py-1 rounded capitalize"
            style={{ background: tab === t ? "#f59e0b22" : "#111118", color: tab === t ? "#f59e0b" : "#64748b", border: `1px solid ${tab === t ? "#f59e0b40" : "#1e1e2e"}`, cursor: "pointer" }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "collection" && (
        isLoading ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading collection...</div>
        ) : (data?.cards.length ?? 0) === 0 ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>No cards yet. Buy a pack to start collecting.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data?.cards.map((card, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: "#111118", border: `1px solid ${RARITY_COLORS[card.rarity] ?? "#1e1e2e"}40`, boxShadow: RARITY_GLOW[card.rarity] ?? "none" }}>
                <div className="w-8 h-8 rounded mb-2 flex items-center justify-center font-bold" style={{ background: RARITY_COLORS[card.rarity] + "22", color: RARITY_COLORS[card.rarity] }}>
                  {card.name[0]}
                </div>
                <div className="font-mono text-xs font-bold" style={{ color: RARITY_COLORS[card.rarity] }}>{card.name}</div>
                <div className="font-mono text-xs" style={{ color: "#64748b" }}>{card.rarity}</div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "catalog" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {catalog.map((card) => {
            const owned = ownedIds.has(card.id);
            return (
              <div key={card.id} className="rounded-lg p-3" style={{ background: "#111118", border: `1px solid ${owned ? RARITY_COLORS[card.rarity] + "40" : "#1e1e2e"}`, opacity: owned ? 1 : 0.4 }}>
                <div className="w-8 h-8 rounded mb-2 flex items-center justify-center font-bold" style={{ background: RARITY_COLORS[card.rarity] + "22", color: owned ? RARITY_COLORS[card.rarity] : "#334155" }}>
                  {owned ? card.name[0] : "?"}
                </div>
                <div className="font-mono text-xs font-bold" style={{ color: owned ? RARITY_COLORS[card.rarity] : "#334155" }}>{owned ? card.name : "Unknown"}</div>
                <div className="font-mono text-xs" style={{ color: "#334155" }}>{card.rarity}</div>
                {owned && <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>{card.description}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
