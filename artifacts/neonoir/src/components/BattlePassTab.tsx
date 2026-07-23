import { useState, useEffect, useCallback } from "react";
import { api } from "../shared/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PassReward {
  dc: number;
  nc: number;
  title: string;
}

interface LevelRow {
  level: number;
  xpRequired: number;
  freeReward: PassReward;
  premiumReward: PassReward;
  isMilestone: boolean;
}

interface BattlePassRecord {
  _id: string;
  seasonName: string;
  status: "draft" | "active" | "ended";
  totalLevels: number;
  ncCost: number;
  eventId: string;
  startsAt: string;
  endsAt: string;
  levels: LevelRow[];
  createdAt: string;
}

interface EventOption {
  _id: string;
  name: string;
  status: string;
}

interface Props {
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

// ── Style constants ───────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#0d0d1a",
  border: "1px solid #1e1e2e",
  borderRadius: 6,
  padding: "20px 22px",
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  background: "#070710",
  border: "1px solid #1e1e2e",
  borderRadius: 4,
  color: "#e2e8f0",
  fontFamily: "monospace",
  fontSize: 12,
  padding: "6px 10px",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  color: "#475569",
  fontFamily: "monospace",
  fontSize: 11,
  marginBottom: 4,
  display: "block",
  letterSpacing: "0.05em",
};

const sectionTitle = (color: string): React.CSSProperties => ({
  color,
  fontFamily: "monospace",
  fontSize: 11,
  fontWeight: "bold",
  letterSpacing: "0.1em",
  marginBottom: 14,
});

function statusColor(status: string) {
  if (status === "active") return "#39d353";
  if (status === "draft") return "#a855f7";
  return "#475569";
}

function statusLabel(status: string) {
  if (status === "active") return "ACTIVE";
  if (status === "draft") return "DRAFT";
  return "ENDED";
}

// ── Default level builder ─────────────────────────────────────────────────────

function buildLevels(count: number): LevelRow[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      level: n,
      xpRequired: n * 1600,
      freeReward: { dc: n * 500, nc: 0, title: "" },
      premiumReward: { dc: n * 2000, nc: n, title: "" },
      isMilestone: n % 10 === 0,
    };
  });
}

// ── Sub-component: Level Editor ───────────────────────────────────────────────

function LevelEditor({
  levels,
  onChange,
}: {
  levels: LevelRow[];
  onChange: (updated: LevelRow[]) => void;
}) {
  function update(idx: number, field: string, value: string | number) {
    const next = levels.map((row, i) => {
      if (i !== idx) return row;
      if (field === "xpRequired") return { ...row, xpRequired: Number(value) };
      if (field === "freeReward.dc") return { ...row, freeReward: { ...row.freeReward, dc: Number(value) } };
      if (field === "freeReward.nc") return { ...row, freeReward: { ...row.freeReward, nc: Number(value) } };
      if (field === "freeReward.title") return { ...row, freeReward: { ...row.freeReward, title: String(value) } };
      if (field === "premiumReward.dc") return { ...row, premiumReward: { ...row.premiumReward, dc: Number(value) } };
      if (field === "premiumReward.nc") return { ...row, premiumReward: { ...row.premiumReward, nc: Number(value) } };
      if (field === "premiumReward.title") return { ...row, premiumReward: { ...row.premiumReward, title: String(value) } };
      return row;
    });
    onChange(next);
  }

  const cellInput = (idx: number, field: string, val: string | number, wide?: boolean) => (
    <input
      value={val}
      onChange={e => update(idx, field, e.target.value)}
      style={{
        ...inputStyle,
        width: wide ? 90 : 64,
        padding: "4px 6px",
      }}
    />
  );

  return (
    <div style={{ overflowX: "auto", maxHeight: 340, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 11 }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "#070710" }}>
            {["Lvl", "XP Req", "Free DC", "Free NC", "Free Title", "Prem DC", "Prem NC", "Prem Title"].map(h => (
              <th key={h} style={{ padding: "6px 8px", color: "#475569", textAlign: "left", borderBottom: "1px solid #1e1e2e", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map((row, idx) => (
            <tr key={row.level} style={{ borderBottom: "1px solid #1e1e2e11", background: row.isMilestone ? "#a855f708" : "transparent" }}>
              <td style={{ padding: "4px 8px", color: row.isMilestone ? "#a855f7" : "#64748b" }}>
                {row.level}{row.isMilestone ? " ★" : ""}
              </td>
              <td style={{ padding: "4px 8px" }}>{cellInput(idx, "xpRequired", row.xpRequired)}</td>
              <td style={{ padding: "4px 8px" }}>{cellInput(idx, "freeReward.dc", row.freeReward.dc)}</td>
              <td style={{ padding: "4px 8px" }}>{cellInput(idx, "freeReward.nc", row.freeReward.nc)}</td>
              <td style={{ padding: "4px 8px" }}>{cellInput(idx, "freeReward.title", row.freeReward.title, true)}</td>
              <td style={{ padding: "4px 8px" }}>{cellInput(idx, "premiumReward.dc", row.premiumReward.dc)}</td>
              <td style={{ padding: "4px 8px" }}>{cellInput(idx, "premiumReward.nc", row.premiumReward.nc)}</td>
              <td style={{ padding: "4px 8px" }}>{cellInput(idx, "premiumReward.title", row.premiumReward.title, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BattlePassTab({ addToast }: Props) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [seasonName, setSeasonName] = useState("");
  const [linkedEventId, setLinkedEventId] = useState("");
  const [ncCost, setNcCost] = useState(999);
  const [numLevels, setNumLevels] = useState(10);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [creating, setCreating] = useState(false);

  // ── Events for dropdown ─────────────────────────────────────────────────────
  const [events, setEvents] = useState<EventOption[]>([]);

  // ── Existing passes ─────────────────────────────────────────────────────────
  const [passes, setPasses] = useState<BattlePassRecord[]>([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editPass, setEditPass] = useState<BattlePassRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Load events ─────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<{ events?: EventOption[] } | EventOption[]>("/events").then(data => {
      const list = Array.isArray(data) ? data : (data as any).events ?? [];
      setEvents(list);
    }).catch(() => {});
  }, []);

  // ── Load passes ─────────────────────────────────────────────────────────────
  const loadPasses = useCallback(async () => {
    setLoadingPasses(true);
    try {
      const data = await api.get<BattlePassRecord[]>("/owner/battle-pass");
      setPasses(data);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoadingPasses(false);
    }
  }, [addToast]);

  useEffect(() => { loadPasses(); }, [loadPasses]);

  // ── Auto-generate levels ─────────────────────────────────────────────────────
  function handleGenerate() {
    const count = Math.min(Math.max(1, numLevels), 50);
    setLevels(buildLevels(count));
  }

  // ── Create battle pass ───────────────────────────────────────────────────────
  async function handleCreate() {
    if (!seasonName.trim()) { addToast("Season Name is required", "error"); return; }
    if (!linkedEventId) { addToast("Linked Event is required", "error"); return; }
    if (!startsAt) { addToast("Start date is required", "error"); return; }
    if (!endsAt) { addToast("End date is required", "error"); return; }
    if (levels.length === 0) { addToast("Generate levels first", "error"); return; }

    setCreating(true);
    try {
      const body = {
        seasonName: seasonName.trim(),
        eventId: linkedEventId,
        ncCost,
        totalLevels: levels.length,
        startsAt,
        endsAt,
        levels: levels.map(l => ({
          level: l.level,
          xpRequired: l.xpRequired,
          isMilestone: l.isMilestone,
          freeReward: { dc: l.freeReward.dc, nc: l.freeReward.nc, title: l.freeReward.title || null },
          premiumReward: { dc: l.premiumReward.dc, nc: l.premiumReward.nc, title: l.premiumReward.title || null },
        })),
      };
      const created = await api.post<BattlePassRecord>("/owner/battle-pass", body);
      addToast(`✅ Battle Pass created — ID: ${created._id}`, "success");
      setSeasonName("");
      setLinkedEventId("");
      setNcCost(999);
      setNumLevels(10);
      setStartsAt("");
      setEndsAt("");
      setLevels([]);
      await loadPasses();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setCreating(false);
    }
  }

  // ── Activate / Deactivate ────────────────────────────────────────────────────
  async function handleActivate(id: string) {
    setActionLoading(id + ":activate");
    try {
      await api.post(`/owner/battle-pass/${id}/activate`);
      addToast("Battle Pass activated", "success");
      await loadPasses();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeactivate(id: string) {
    setActionLoading(id + ":deactivate");
    try {
      await api.post(`/owner/battle-pass/${id}/deactivate`);
      addToast("Battle Pass deactivated", "success");
      await loadPasses();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Expand / Edit ────────────────────────────────────────────────────────────
  async function toggleExpand(pass: BattlePassRecord) {
    if (expandedId === pass._id) {
      setExpandedId(null);
      setEditPass(null);
      return;
    }
    try {
      const full = await api.get<BattlePassRecord>(`/owner/battle-pass/${pass._id}`);
      setEditPass({
        ...full,
        levels: full.levels.map(l => ({
          ...l,
          freeReward: { dc: l.freeReward?.dc ?? 0, nc: l.freeReward?.nc ?? 0, title: (l.freeReward as any)?.title ?? "" },
          premiumReward: { dc: l.premiumReward?.dc ?? 0, nc: l.premiumReward?.nc ?? 0, title: (l.premiumReward as any)?.title ?? "" },
        })),
      });
      setExpandedId(pass._id);
    } catch (e: any) {
      addToast(e.message, "error");
    }
  }

  async function handleSaveEdit() {
    if (!editPass) return;
    setSavingEdit(true);
    try {
      await api.patch(`/owner/battle-pass/${editPass._id}`, {
        seasonName: editPass.seasonName,
        ncCost: editPass.ncCost,
        startsAt: editPass.startsAt,
        endsAt: editPass.endsAt,
        levels: editPass.levels.map(l => ({
          level: l.level,
          xpRequired: l.xpRequired,
          isMilestone: l.isMilestone,
          freeReward: { dc: l.freeReward.dc, nc: l.freeReward.nc, title: l.freeReward.title || null },
          premiumReward: { dc: l.premiumReward.dc, nc: l.premiumReward.nc, title: l.premiumReward.title || null },
        })),
      });
      addToast("Battle Pass updated", "success");
      setExpandedId(null);
      setEditPass(null);
      await loadPasses();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── SECTION A — Create New Battle Pass ── */}
      <div style={card}>
        <div style={sectionTitle("#a855f7")}>🏆 CREATE NEW BATTLE PASS</div>

        <div className="grid grid-cols-2 gap-4 mb-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>SEASON NAME *</label>
            <input
              value={seasonName}
              onChange={e => setSeasonName(e.target.value)}
              placeholder="e.g. Season 3 — Neon Uprising"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>LINKED EVENT *</label>
            <select
              value={linkedEventId}
              onChange={e => setLinkedEventId(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">— Select an event —</option>
              {events.map(ev => (
                <option key={ev._id} value={ev._id}>
                  {ev.name} [{ev.status}]
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>PREMIUM PRICE (NC)</label>
            <input
              type="number"
              value={ncCost}
              min={0}
              onChange={e => setNcCost(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>NUMBER OF LEVELS (1–50)</label>
            <input
              type="number"
              value={numLevels}
              min={1}
              max={50}
              onChange={e => setNumLevels(Math.min(50, Math.max(1, Number(e.target.value))))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>STARTS AT *</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={e => setStartsAt(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>ENDS AT *</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={e => setEndsAt(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Auto-generate button */}
        <button
          onClick={handleGenerate}
          style={{
            background: "#a855f718",
            border: "1px solid #a855f740",
            color: "#a855f7",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "6px 14px",
            borderRadius: 4,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          ⚡ Auto-Generate {numLevels} Levels
        </button>

        {/* Level editor */}
        {levels.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>
              LEVEL EDITOR — {levels.length} levels &nbsp;
              <span style={{ color: "#a855f750" }}>(★ = milestone)</span>
            </div>
            <LevelEditor levels={levels} onChange={setLevels} />
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            background: creating ? "#1e1e2e" : "#a855f728",
            border: "1px solid #a855f760",
            color: creating ? "#475569" : "#a855f7",
            fontFamily: "monospace",
            fontSize: 12,
            fontWeight: "bold",
            padding: "8px 20px",
            borderRadius: 4,
            cursor: creating ? "not-allowed" : "pointer",
          }}
        >
          {creating ? "Creating…" : "Create Battle Pass"}
        </button>
      </div>

      {/* ── SECTION B — Existing Battle Passes ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={sectionTitle("#00d4ff")}>📋 EXISTING BATTLE PASSES</div>
          <button
            onClick={loadPasses}
            style={{ background: "transparent", border: "none", color: "#475569", fontFamily: "monospace", fontSize: 11, cursor: "pointer" }}
          >
            ↻ Refresh
          </button>
        </div>

        {loadingPasses && (
          <div style={{ color: "#475569", fontFamily: "monospace", fontSize: 11, textAlign: "center", padding: 24 }}>
            Loading…
          </div>
        )}

        {!loadingPasses && passes.length === 0 && (
          <div style={{ color: "#475569", fontFamily: "monospace", fontSize: 11, textAlign: "center", padding: 24 }}>
            No battle passes yet
          </div>
        )}

        {!loadingPasses && passes.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                  {["Season Name", "Status", "Levels", "NC Price", "Starts", "Ends", "Actions"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", color: "#475569", textAlign: "left", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {passes.map(pass => (
                  <>
                    <tr
                      key={pass._id}
                      style={{ borderBottom: "1px solid #1e1e2e22", background: expandedId === pass._id ? "#a855f708" : "transparent" }}
                    >
                      <td style={{ padding: "8px 10px", color: "#e2e8f0" }}>{pass.seasonName}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{
                          background: statusColor(pass.status) + "18",
                          border: `1px solid ${statusColor(pass.status)}40`,
                          color: statusColor(pass.status),
                          borderRadius: 3,
                          padding: "2px 7px",
                          fontSize: 10,
                          fontWeight: "bold",
                        }}>
                          {statusLabel(pass.status)}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>{pass.totalLevels ?? pass.levels?.length ?? "—"}</td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>{pass.ncCost} NC</td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>
                        {pass.startsAt ? new Date(pass.startsAt).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>
                        {pass.endsAt ? new Date(pass.endsAt).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                          {pass.status !== "active" && (
                            <button
                              onClick={() => handleActivate(pass._id)}
                              disabled={actionLoading === pass._id + ":activate"}
                              style={{
                                background: "#39d35318",
                                border: "1px solid #39d35340",
                                color: "#39d353",
                                fontFamily: "monospace",
                                fontSize: 10,
                                padding: "3px 8px",
                                borderRadius: 3,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {actionLoading === pass._id + ":activate" ? "…" : "Activate"}
                            </button>
                          )}
                          {pass.status === "active" && (
                            <button
                              onClick={() => handleDeactivate(pass._id)}
                              disabled={actionLoading === pass._id + ":deactivate"}
                              style={{
                                background: "#ff2d5518",
                                border: "1px solid #ff2d5540",
                                color: "#ff2d55",
                                fontFamily: "monospace",
                                fontSize: 10,
                                padding: "3px 8px",
                                borderRadius: 3,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {actionLoading === pass._id + ":deactivate" ? "…" : "Deactivate"}
                            </button>
                          )}
                          <button
                            onClick={() => toggleExpand(pass)}
                            style={{
                              background: "#00d4ff18",
                              border: "1px solid #00d4ff40",
                              color: "#00d4ff",
                              fontFamily: "monospace",
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 3,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {expandedId === pass._id ? "Close" : "View / Edit"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline Edit Panel */}
                    {expandedId === pass._id && editPass && (
                      <tr key={pass._id + "-edit"}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{
                            background: "#070710",
                            border: "1px solid #1e1e2e",
                            borderTop: "none",
                            padding: "16px 18px",
                            marginBottom: 4,
                          }}>
                            <div style={{ ...labelStyle, color: "#a855f7", fontWeight: "bold", marginBottom: 12 }}>
                              EDITING: {editPass.seasonName}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                              <div>
                                <label style={labelStyle}>SEASON NAME</label>
                                <input
                                  value={editPass.seasonName}
                                  onChange={e => setEditPass({ ...editPass, seasonName: e.target.value })}
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>NC PRICE</label>
                                <input
                                  type="number"
                                  value={editPass.ncCost}
                                  onChange={e => setEditPass({ ...editPass, ncCost: Number(e.target.value) })}
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>STARTS AT</label>
                                <input
                                  type="datetime-local"
                                  value={editPass.startsAt ? editPass.startsAt.slice(0, 16) : ""}
                                  onChange={e => setEditPass({ ...editPass, startsAt: e.target.value })}
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>ENDS AT</label>
                                <input
                                  type="datetime-local"
                                  value={editPass.endsAt ? editPass.endsAt.slice(0, 16) : ""}
                                  onChange={e => setEditPass({ ...editPass, endsAt: e.target.value })}
                                  style={inputStyle}
                                />
                              </div>
                            </div>

                            {editPass.levels.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <div style={labelStyle}>LEVEL EDITOR</div>
                                <LevelEditor
                                  levels={editPass.levels}
                                  onChange={updated => setEditPass({ ...editPass, levels: updated })}
                                />
                              </div>
                            )}

                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                                style={{
                                  background: savingEdit ? "#1e1e2e" : "#a855f728",
                                  border: "1px solid #a855f760",
                                  color: savingEdit ? "#475569" : "#a855f7",
                                  fontFamily: "monospace",
                                  fontSize: 11,
                                  fontWeight: "bold",
                                  padding: "6px 16px",
                                  borderRadius: 4,
                                  cursor: savingEdit ? "not-allowed" : "pointer",
                                }}
                              >
                                {savingEdit ? "Saving…" : "Save Changes"}
                              </button>
                              <button
                                onClick={() => { setExpandedId(null); setEditPass(null); }}
                                style={{
                                  background: "transparent",
                                  border: "1px solid #1e1e2e",
                                  color: "#475569",
                                  fontFamily: "monospace",
                                  fontSize: 11,
                                  padding: "6px 14px",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
