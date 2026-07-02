import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface SkillNode {
  id: string;
  name: string;
  effect: string;
  cost: number;
  apex: boolean;
}
interface Tree {
  name: string;
  theme: string;
  nodes: SkillNode[];
}
interface SkillsData {
  skillPoints: number;
  skillTree: string | null;
  secondarySkill: string | null;
  unlockedSkills: string[];
  catalog: Record<string, Tree>;
  canSelectPrimary: boolean;
  canSelectSecondary: boolean;
}

const TREE_COLORS: Record<string, string> = {
  hustler: "#f59e0b",
  fighter: "#ff2d55",
  ghost: "#a855f7",
  connector: "#00d4ff",
};

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function SkillsPage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const [selectedTree, setSelectedTree] = useState<string | null>(null);

  const { data, isLoading } = useQuery<SkillsData>({
    queryKey: ["skills"],
    queryFn: () => api.get("/skills"),
  });

  const selectTree = useMutation({
    mutationFn: (body: { tree: string; type: "primary" | "secondary" }) =>
      api.post(body.type === "primary" ? "/skills/tree" : "/skills/secondary", { tree: body.tree }),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const unlockSkill = useMutation({
    mutationFn: (nodeId: string) => api.post("/skills/unlock", { nodeId }),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  if (isLoading || !data) {
    return <div className="font-mono text-center py-20" style={{ color: "#334155" }}>Loading skill trees...</div>;
  }

  const treeKeys = Object.keys(data.catalog);

  return (
    <div className="space-y-6">
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-mono font-bold text-lg" style={{ color: "#00d4ff" }}>SKILL TREES</h2>
            <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
              Spend skill points to unlock passive bonuses. Choose your path wisely.
            </p>
          </div>
          <div className="font-mono text-sm px-3 py-1 rounded" style={{ background: "#0a0a0f", color: "#f59e0b", border: "1px solid #f59e0b30" }}>
            {data.skillPoints} SP available
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs font-mono" style={{ color: "#64748b" }}>
          {data.skillTree && (
            <span>Primary: <span style={{ color: TREE_COLORS[data.skillTree] }}>{data.catalog[data.skillTree]?.name}</span></span>
          )}
          {data.secondarySkill && (
            <span>Secondary: <span style={{ color: TREE_COLORS[data.secondarySkill] }}>{data.catalog[data.secondarySkill]?.name}</span></span>
          )}
          {!data.skillTree && (
            <span style={{ color: user.level >= 10 ? "#39d353" : "#64748b" }}>
              {user.level >= 10 ? "Ready to choose primary tree" : `Primary tree unlocks at level 10 (you are ${user.level})`}
            </span>
          )}
          {data.skillTree && !data.secondarySkill && (
            <span style={{ color: user.level >= 50 ? "#39d353" : "#64748b" }}>
              {user.level >= 50 ? "Ready to choose secondary tree" : `Secondary tree unlocks at level 50`}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {treeKeys.map((key) => {
          const tree = data.catalog[key];
          const isPrimary = data.skillTree === key;
          const isSecondary = data.secondarySkill === key;
          const isSelected = isPrimary || isSecondary;
          const color = TREE_COLORS[key] ?? "#00d4ff";
          const canSelect = (data.canSelectPrimary && !isSelected) || (data.canSelectSecondary && !isSelected && key !== data.skillTree);

          return (
            <div
              key={key}
              className="rounded-lg p-4"
              style={{
                background: "#111118",
                border: `1px solid ${isSelected ? color : "#1e1e2e"}`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-mono font-bold" style={{ color }}>
                    {tree.name}
                    {isPrimary && <span className="ml-2 text-xs px-1 py-0.5 rounded" style={{ background: color + "22", color }}>PRIMARY</span>}
                    {isSecondary && <span className="ml-2 text-xs px-1 py-0.5 rounded" style={{ background: color + "22", color }}>SECONDARY</span>}
                  </h3>
                  <p className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{tree.theme}</p>
                </div>
                {canSelect && (
                  <button
                    onClick={() => selectTree.mutate({ tree: key, type: data.canSelectPrimary && !data.skillTree ? "primary" : "secondary" })}
                    disabled={selectTree.isPending}
                    className="font-mono text-xs px-3 py-1 rounded transition-opacity"
                    style={{ background: color + "22", color, border: `1px solid ${color}50`, cursor: "pointer" }}
                  >
                    Choose
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {tree.nodes.map((node) => {
                  const unlocked = data.unlockedSkills.includes(node.id);
                  const canUnlock = isSelected && !unlocked && data.skillPoints >= node.cost;

                  return (
                    <div
                      key={node.id}
                      className="flex items-center justify-between rounded p-2 gap-2"
                      style={{
                        background: unlocked ? color + "12" : "#0a0a0f",
                        border: `1px solid ${unlocked ? color + "40" : "#1e1e2e"}`,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold" style={{ color: unlocked ? color : "#94a3b8" }}>
                            {node.name}
                          </span>
                          {node.apex && (
                            <span className="font-mono text-xs px-1 rounded" style={{ background: "#f59e0b22", color: "#f59e0b" }}>APEX</span>
                          )}
                          {unlocked && (
                            <span className="font-mono text-xs" style={{ color: "#39d353" }}>✓</span>
                          )}
                        </div>
                        <p className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{node.effect}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs" style={{ color: "#64748b" }}>{node.cost} SP</span>
                        {canUnlock && (
                          <button
                            onClick={() => unlockSkill.mutate(node.id)}
                            disabled={unlockSkill.isPending}
                            className="font-mono text-xs px-2 py-0.5 rounded"
                            style={{ background: color + "22", color, border: `1px solid ${color}40`, cursor: "pointer" }}
                          >
                            Unlock
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
