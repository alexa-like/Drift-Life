import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface GuildSummary {
  id: string;
  name: string;
  tag: string;
  description: string;
  faction: string | null;
  level: number;
  treasury: number;
  memberCount: number;
  maxMembers: number;
}

interface MyGuild {
  id: string;
  name: string;
  tag: string;
  description: string;
  level: number;
  xp: number;
  treasury: number;
  maxMembers: number;
  myRole: string;
  members: Array<{ id: string; username: string; level: number; avatar: string; role: string }>;
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const ROLE_COLORS: Record<string, string> = {
  leader: "#f59e0b",
  officer: "#00d4ff",
  member: "#94a3b8",
  recruit: "#64748b",
};

export function GuildsPage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"mine" | "browse" | "create">("mine");
  const [createForm, setCreateForm] = useState({ name: "", tag: "", description: "" });
  const [donateAmount, setDonateAmount] = useState("");

  const { data: myGuild, isLoading: myGuildLoading } = useQuery<MyGuild | null>({
    queryKey: ["guild-mine"],
    queryFn: () => api.get("/guilds/mine"),
  });

  const { data: allGuilds = [], isLoading: guildsLoading } = useQuery<GuildSummary[]>({
    queryKey: ["guilds"],
    queryFn: () => api.get("/guilds"),
    enabled: tab === "browse",
  });

  const createGuild = useMutation({
    mutationFn: (body: typeof createForm) => api.post("/guilds", body),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["guild-mine"] });
      setTab("mine");
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const joinGuild = useMutation({
    mutationFn: (id: string) => api.post(`/guilds/${id}/join`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["guild-mine", "guilds"] });
      setTab("mine");
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const leaveGuild = useMutation({
    mutationFn: () => api.post("/guilds/leave", {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["guild-mine"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const donate = useMutation({
    mutationFn: (amount: number) => api.post("/guilds/treasury/donate", { amount }),
    onSuccess: (r: { message: string; treasury: number; guildLevel: number; leveledUp: boolean }) => {
      addToast(r.message + (r.leveledUp ? " Guild leveled up!" : ""), "success");
      setDonateAmount("");
      qc.invalidateQueries({ queryKey: ["guild-mine"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const TABS = myGuild ? ["mine", "browse"] : ["mine", "browse", "create"];

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <h2 className="font-mono font-bold text-lg" style={{ color: "#a855f7" }}>GUILDS</h2>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Form crews, build a treasury, and claim territory across New Vanta. Level 15 required to create.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className="font-mono text-xs px-3 py-1 rounded capitalize"
            style={{
              background: tab === t ? "#a855f722" : "#111118",
              color: tab === t ? "#a855f7" : "#64748b",
              border: `1px solid ${tab === t ? "#a855f7" : "#1e1e2e"}`,
              cursor: "pointer",
            }}
          >
            {t === "mine" ? "My Guild" : t}
          </button>
        ))}
        {!myGuild && (
          <button
            onClick={() => setTab("create")}
            className="font-mono text-xs px-3 py-1 rounded"
            style={{ background: "#111118", color: "#64748b", border: "1px solid #1e1e2e", cursor: "pointer" }}
          >
            + Create
          </button>
        )}
      </div>

      {tab === "mine" && (
        myGuildLoading ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading...</div>
        ) : myGuild ? (
          <div className="space-y-4">
            <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #a855f740" }}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-mono font-bold text-xl" style={{ color: "#a855f7" }}>
                    [{myGuild.tag}] {myGuild.name}
                  </div>
                  <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>{myGuild.description || "No description."}</div>
                  <div className="flex gap-4 mt-2">
                    <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>Level {myGuild.level}</span>
                    <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{myGuild.members.length}/{myGuild.maxMembers} members</span>
                    <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>{myGuild.treasury.toLocaleString()} DC treasury</span>
                    <span className="font-mono text-xs" style={{ color: ROLE_COLORS[myGuild.myRole] }}>Role: {myGuild.myRole}</span>
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm("Leave this guild?")) leaveGuild.mutate(); }}
                  className="font-mono text-xs px-3 py-1 rounded"
                  style={{ background: "#ff2d5522", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}
                >
                  Leave
                </button>
              </div>

              <div className="mt-4 pt-3" style={{ borderTop: "1px solid #1e1e2e" }}>
                <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>Donate to treasury</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={donateAmount}
                    onChange={(e) => setDonateAmount(e.target.value)}
                    placeholder="Amount DC"
                    className="font-mono text-xs px-3 py-1 rounded flex-1"
                    style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
                  />
                  <button
                    onClick={() => donate.mutate(parseInt(donateAmount))}
                    disabled={!donateAmount || donate.isPending}
                    className="font-mono text-xs px-4 py-1 rounded"
                    style={{ background: "#a855f722", color: "#a855f7", border: "1px solid #a855f740", cursor: "pointer" }}
                  >
                    Donate
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <div className="font-mono text-xs font-bold mb-3" style={{ color: "#94a3b8" }}>MEMBERS</div>
              <div className="space-y-2">
                {myGuild.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>{m.username}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs" style={{ color: "#64748b" }}>Lv.{m.level}</span>
                      <span className="font-mono text-xs" style={{ color: ROLE_COLORS[m.role] }}>{m.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-8 text-center" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <div className="font-mono text-sm mb-2" style={{ color: "#64748b" }}>You are not in a guild.</div>
            <div className="font-mono text-xs" style={{ color: "#334155" }}>Browse existing guilds or create your own (Level 15 + 10,000 DC).</div>
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setTab("browse")} className="font-mono text-xs px-4 py-2 rounded" style={{ background: "#a855f722", color: "#a855f7", border: "1px solid #a855f740", cursor: "pointer" }}>Browse Guilds</button>
              {user.level >= 15 && <button onClick={() => setTab("create")} className="font-mono text-xs px-4 py-2 rounded" style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}>Create Guild</button>}
            </div>
          </div>
        )
      )}

      {tab === "browse" && (
        <div className="space-y-2">
          {guildsLoading ? (
            <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading guilds...</div>
          ) : allGuilds.length === 0 ? (
            <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>No guilds found. Be the first to create one.</div>
          ) : allGuilds.map((g) => (
            <div key={g.id} className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold" style={{ color: "#a855f7" }}>[{g.tag}] {g.name}</span>
                  <span className="font-mono text-xs ml-2" style={{ color: "#64748b" }}>Lv.{g.level}</span>
                  <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>{g.description || "No description."}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{g.memberCount}/{g.maxMembers}</span>
                  {!myGuild && (
                    <button
                      onClick={() => joinGuild.mutate(g.id)}
                      disabled={joinGuild.isPending}
                      className="font-mono text-xs px-3 py-0.5 rounded"
                      style={{ background: "#a855f722", color: "#a855f7", border: "1px solid #a855f740", cursor: "pointer" }}
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "create" && !myGuild && (
        <div className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="font-mono text-sm font-bold" style={{ color: "#a855f7" }}>Create a Guild</div>
          <div className="font-mono text-xs" style={{ color: "#64748b" }}>Cost: 10,000 DC · Requires Level 15</div>
          {[
            { key: "name", label: "Guild Name", placeholder: "Crimson Circuit, etc." },
            { key: "tag", label: "Tag (2-5 chars)", placeholder: "CC" },
            { key: "description", label: "Description", placeholder: "What your crew is about..." },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>{label}</div>
              <input
                value={createForm[key as keyof typeof createForm]}
                onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                maxLength={key === "tag" ? 5 : key === "name" ? 30 : 300}
                className="w-full font-mono text-xs px-3 py-2 rounded"
                style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
              />
            </div>
          ))}
          <button
            onClick={() => createGuild.mutate(createForm)}
            disabled={createGuild.isPending || !createForm.name || !createForm.tag}
            className="w-full font-mono text-sm py-2 rounded font-bold"
            style={{ background: "#a855f722", color: "#a855f7", border: "1px solid #a855f740", cursor: "pointer" }}
          >
            {createGuild.isPending ? "Creating..." : "Create Guild — 10,000 DC"}
          </button>
        </div>
      )}
    </div>
  );
}
