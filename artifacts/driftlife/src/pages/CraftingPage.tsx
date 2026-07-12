import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Recipe {
  id: string;
  name: string;
  outputName: string;
  outputType: string;
  outputQuantity: number;
  durationMinutes: number;
  craftingXpRequired: number;
  ingredients: Array<{ name: string; quantity: number }>;
  dcCost: number;
  description: string;
  locked: boolean;
}

interface CraftJob {
  id: string;
  recipeId: string;
  recipeName: string;
  outputName: string;
  outputQuantity: number;
  completesAt: string;
  ready: boolean;
  minutesRemaining: number;
}

interface RecipesData {
  mastery: { level: number; name: string; nextAt: number | null };
  craftingXp: number;
  recipes: Recipe[];
}

interface Props {
  user: User;
  refreshUser: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const OUTPUT_TYPE_COLOR: Record<string, string> = {
  consumable: "#39d353",
  weapon: "#ff2d55",
  armor: "#00d4ff",
  material: "#f59e0b",
};

export function CraftingPage({ user, refreshUser, addToast }: Props) {
  const qc = useQueryClient();

  const { data: recipesData, isLoading: recipesLoading } = useQuery<RecipesData>({
    queryKey: ["crafting-recipes"],
    queryFn: () => api.get("/crafting/recipes"),
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<CraftJob[]>({
    queryKey: ["crafting-jobs"],
    queryFn: () => api.get("/crafting/jobs"),
    refetchInterval: 30000,
  });

  const startCraft = useMutation({
    mutationFn: (recipeId: string) => api.post("/crafting/start", { recipeId }),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["crafting-jobs", "crafting-recipes"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const collect = useMutation({
    mutationFn: (id: string) => api.post(`/crafting/${id}/collect`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["crafting-jobs"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const skip = useMutation({
    mutationFn: ({ id, ncCost }: { id: string; ncCost: number }) => api.post(`/crafting/${id}/skip`, {}),
    onSuccess: (r: { message: string; ncSpent: number }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["crafting-jobs"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  return (
    <div className="space-y-4 relative z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-mono font-bold text-lg" style={{ color: "#ff6b35" }}>CRAFTING</h2>
            <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>Combine materials to forge gear and consumables. Max 3 active jobs.</p>
          </div>
          {recipesData && (
            <div className="font-mono text-xs px-3 py-1 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
              <span style={{ color: "#f59e0b" }}>{recipesData.mastery.name}</span>
              <span style={{ color: "#64748b" }}> · {recipesData.craftingXp.toLocaleString()} XP</span>
              {recipesData.mastery.nextAt && (
                <span style={{ color: "#334155" }}> / {recipesData.mastery.nextAt.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #ff6b3530" }}>
          <div className="font-mono text-xs font-bold mb-3" style={{ color: "#ff6b35" }}>ACTIVE JOBS ({jobs.length}/3)</div>
          <div className="space-y-2">
            {jobs.map((j) => {
              const ncCost = Math.max(5, j.minutesRemaining);
              return (
                <div key={j.id} className="rounded p-3 flex items-center justify-between gap-2" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
                  <div>
                    <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>{j.outputQuantity}x {j.outputName}</span>
                    <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
                      {j.ready ? <span style={{ color: "#39d353" }}>Ready to collect</span> : `${j.minutesRemaining}m remaining`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {j.ready ? (
                      <button onClick={() => collect.mutate(j.id)} disabled={collect.isPending}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#39d35322", color: "#39d353", border: "1px solid #39d35340", cursor: "pointer" }}
                      >
                        Collect
                      </button>
                    ) : user.nc >= ncCost && (
                      <button onClick={() => skip.mutate({ id: j.id, ncCost })} disabled={skip.isPending}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#a855f722", color: "#a855f7", border: "1px solid #a855f740", cursor: "pointer" }}
                      >
                        Skip ({ncCost} NC)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recipesLoading ? (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading recipes...</div>
      ) : (
        <div className="space-y-3">
          <div className="font-mono text-xs" style={{ color: "#64748b" }}>RECIPES</div>
          {recipesData?.recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="rounded-lg p-4"
              style={{ background: "#111118", border: `1px solid ${recipe.locked ? "#1e1e2e" : "#ff6b3530"}`, opacity: recipe.locked ? 0.5 : 1 }}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold" style={{ color: OUTPUT_TYPE_COLOR[recipe.outputType] ?? "#94a3b8" }}>
                      {recipe.outputQuantity > 1 ? `${recipe.outputQuantity}x ` : ""}{recipe.outputName}
                    </span>
                    <span className="font-mono text-xs px-1 rounded" style={{ background: "#1e1e2e", color: "#64748b" }}>{recipe.outputType}</span>
                  </div>
                  <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>{recipe.description}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {recipe.ingredients.map((ing, i) => (
                      <span key={i} className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "#0a0a0f", color: "#94a3b8", border: "1px solid #1e1e2e" }}>
                        {ing.quantity}x {ing.name}
                      </span>
                    ))}
                  </div>
                  <div className="font-mono text-xs mt-2" style={{ color: "#64748b" }}>
                    {recipe.dcCost.toLocaleString()} DC · {recipe.durationMinutes < 60 ? `${recipe.durationMinutes}m` : `${Math.floor(recipe.durationMinutes / 60)}h`} craft time
                    {recipe.craftingXpRequired > 0 && ` · ${recipe.craftingXpRequired} craft XP required`}
                  </div>
                </div>
                <button
                  onClick={() => startCraft.mutate(recipe.id)}
                  disabled={recipe.locked || startCraft.isPending || user.dc < recipe.dcCost || jobs.length >= 3}
                  className="font-mono text-xs px-4 py-1 rounded"
                  style={{
                    background: recipe.locked ? "#1e1e2e" : "#ff6b3522",
                    color: recipe.locked ? "#334155" : "#ff6b35",
                    border: `1px solid ${recipe.locked ? "#1e1e2e" : "#ff6b3540"}`,
                    cursor: recipe.locked ? "not-allowed" : "pointer",
                  }}
                >
                  {recipe.locked ? `Need ${recipe.craftingXpRequired} XP` : "Craft"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
