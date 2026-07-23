import { useState, useEffect, useCallback } from "react";
import { api } from "../shared/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CosmeticItem {
  _id: string;
  id: string;
  name: string;
  type: "name_flair" | "message_card";
  color: string;
  animation: "none" | "pulse" | "glow" | "rainbow" | "glitch" | "gradient";
  cssKey: string;
  priceNC: number;
  purchasable: boolean;
  eventRewardable: boolean;
  rarity: "common" | "rare" | "epic" | "legendary" | "event";
  previewDescription: string;
  seasonExclusive: boolean;
}

interface Props {
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: CosmeticItem["type"][] = ["name_flair", "message_card"];
const ANIMATION_OPTIONS: CosmeticItem["animation"][] = ["none", "pulse", "glow", "rainbow", "glitch", "gradient"];
const RARITY_OPTIONS: CosmeticItem["rarity"][] = ["common", "rare", "epic", "legendary", "event"];

const TYPE_LABELS: Record<string, string> = {
  name_flair: "Name Flair",
  message_card: "Message Card",
};

const RARITY_COLORS: Record<string, string> = {
  common:    "#64748b",
  rare:      "#3b82f6",
  epic:      "#a855f7",
  legendary: "#f59e0b",
  event:     "#00d4ff",
};

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#0d0d1a",
  border: "1px solid #1e1e2e",
  borderRadius: 6,
  padding: "18px 20px",
  marginBottom: 14,
};

const inp: React.CSSProperties = {
  background: "#070710",
  border: "1px solid #1e1e2e",
  borderRadius: 4,
  color: "#e2e8f0",
  fontFamily: "monospace",
  fontSize: 12,
  padding: "7px 10px",
  width: "100%",
  boxSizing: "border-box",
};

const lbl: React.CSSProperties = {
  color: "#475569",
  fontFamily: "monospace",
  fontSize: 10,
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
};

const sectionHead = (color: string): React.CSSProperties => ({
  color,
  fontFamily: "monospace",
  fontSize: 10,
  fontWeight: "bold",
  letterSpacing: "0.12em",
  marginBottom: 14,
  paddingBottom: 6,
  borderBottom: `1px solid ${color}20`,
});

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={lbl}>
        {label}
        {hint && <span style={{ color: "#334155", marginLeft: 6 }}>{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function RarityBadge({ rarity }: { rarity: string }) {
  const color = RARITY_COLORS[rarity] ?? "#64748b";
  return (
    <span style={{
      background: color + "20",
      border: `1px solid ${color}50`,
      color,
      fontFamily: "monospace",
      fontSize: 9,
      fontWeight: "bold",
      padding: "2px 7px",
      borderRadius: 3,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {rarity}
    </span>
  );
}

// ── Default create form state ──────────────────────────────────────────────────

function emptyForm() {
  return {
    id: "",
    name: "",
    type: "name_flair" as CosmeticItem["type"],
    color: "#00d4ff",
    animation: "none" as CosmeticItem["animation"],
    cssKey: "",
    priceNC: 0,
    purchasable: false,
    eventRewardable: false,
    rarity: "common" as CosmeticItem["rarity"],
    previewDescription: "",
    seasonExclusive: false,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CosmeticsTab({ addToast }: Props) {
  // ── Catalog state ────────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState<CosmeticItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // ── Create form state ────────────────────────────────────────────────────────
  const [form, setForm] = useState(emptyForm());
  const [creating, setCreating] = useState(false);

  // ── Grant state ──────────────────────────────────────────────────────────────
  const [grantCosmeticId, setGrantCosmeticId] = useState("");
  const [grantUsername, setGrantUsername] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantSearch, setGrantSearch] = useState("");

  // ── Inline edit state ────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CosmeticItem>>({});
  const [saving, setSaving] = useState(false);

  // ── Collapsed categories ─────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // ── Delete confirm ───────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load catalog ─────────────────────────────────────────────────────────────
  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const data = await api.get<CosmeticItem[]>("/owner/cosmetics");
      setCatalog(data);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoadingCatalog(false);
    }
  }, [addToast]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // ── Auto-slug ID from name ────────────────────────────────────────────────────
  function handleNameChange(name: string) {
    setForm(f => ({
      ...f,
      name,
      id: f.id === autoSlug(f.name) || f.id === ""
        ? autoSlug(name)
        : f.id,
    }));
  }

  function autoSlug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // ── Create cosmetic ───────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.name.trim()) { addToast("Name is required", "error"); return; }
    if (!form.id.trim()) { addToast("ID (slug) is required", "error"); return; }
    if (!form.cssKey.trim()) { addToast("CSS Key is required", "error"); return; }
    setCreating(true);
    try {
      await api.post("/owner/cosmetics/catalog", {
        id: form.id.trim(),
        name: form.name.trim(),
        type: form.type,
        color: form.color,
        animation: form.animation,
        cssKey: form.cssKey.trim(),
        priceNC: form.priceNC,
        purchasable: form.purchasable,
        eventRewardable: form.eventRewardable,
        rarity: form.rarity,
        previewDescription: form.previewDescription,
        seasonExclusive: form.seasonExclusive,
      });
      addToast(`✅ "${form.name}" added to catalog`, "success");
      setForm(emptyForm());
      await loadCatalog();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setCreating(false);
    }
  }

  // ── Grant cosmetic ────────────────────────────────────────────────────────────
  async function handleGrant() {
    if (!grantCosmeticId) { addToast("Select a cosmetic", "error"); return; }
    if (!grantUsername.trim()) { addToast("Enter a player username", "error"); return; }
    setGranting(true);
    try {
      const res = await api.post<{ message: string }>("/owner/cosmetics/grant-by-username", {
        cosmeticId: grantCosmeticId,
        username: grantUsername.trim(),
      });
      addToast(`✅ ${res.message}`, "success");
      setGrantCosmeticId("");
      setGrantUsername("");
      setGrantSearch("");
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setGranting(false);
    }
  }

  // ── Start inline edit ─────────────────────────────────────────────────────────
  function startEdit(item: CosmeticItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      color: item.color,
      animation: item.animation,
      cssKey: item.cssKey,
      priceNC: item.priceNC,
      purchasable: item.purchasable,
      eventRewardable: item.eventRewardable,
      rarity: item.rarity,
      previewDescription: item.previewDescription,
      seasonExclusive: item.seasonExclusive,
    });
  }

  // ── Save edit ─────────────────────────────────────────────────────────────────
  async function handleSaveEdit(cosmeticId: string) {
    setSaving(true);
    try {
      await api.patch(`/owner/cosmetics/${cosmeticId}`, editForm);
      addToast("Cosmetic updated", "success");
      setEditingId(null);
      setEditForm({});
      await loadCatalog();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function handleDelete(cosmeticId: string) {
    setDeleting(true);
    try {
      const res = await api.delete<{ message: string }>(`/owner/cosmetics/${cosmeticId}`);
      addToast(res.message, "success");
      setConfirmDelete(null);
      setEditingId(null);
      await loadCatalog();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setDeleting(false);
    }
  }

  // ── Group catalog by type ─────────────────────────────────────────────────────
  const grouped = catalog.reduce<Record<string, CosmeticItem[]>>((acc, item) => {
    const key = item.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const filteredCatalog = grantSearch.trim()
    ? catalog.filter(c => c.name.toLowerCase().includes(grantSearch.toLowerCase()) || c.id.toLowerCase().includes(grantSearch.toLowerCase()))
    : catalog;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── SECTION A — Create Cosmetic ── */}
      <div style={card}>
        <div style={sectionHead("#06b6d4")}>✨ CREATE COSMETIC ITEM</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Field label="Name *">
            <input value={form.name} onChange={e => handleNameChange(e.target.value)} style={inp} placeholder="Cyan Pulse" />
          </Field>
          <Field label="ID / Slug *" hint="auto-generated, must be unique">
            <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} style={inp} placeholder="cyan-pulse" />
          </Field>
          <Field label="Type *">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CosmeticItem["type"] }))} style={{ ...inp, cursor: "pointer" }}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </Field>
          <Field label="Rarity">
            <select value={form.rarity} onChange={e => setForm(f => ({ ...f, rarity: e.target.value as CosmeticItem["rarity"] }))} style={{ ...inp, cursor: "pointer" }}>
              {RARITY_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Animation">
            <select value={form.animation} onChange={e => setForm(f => ({ ...f, animation: e.target.value as CosmeticItem["animation"] }))} style={{ ...inp, cursor: "pointer" }}>
              {ANIMATION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Color (hex)">
            <div style={{ display: "flex", gap: 6 }}>
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 36, height: 36, border: "1px solid #1e1e2e", borderRadius: 4, background: "#070710", cursor: "pointer", padding: 2, flexShrink: 0 }} />
              <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ ...inp }} placeholder="#00d4ff" />
            </div>
          </Field>
          <Field label="CSS Key *" hint="applied to username/card element">
            <input value={form.cssKey} onChange={e => setForm(f => ({ ...f, cssKey: e.target.value }))} style={inp} placeholder="flair-pulse-cyan" />
          </Field>
          <Field label="NC Price" hint="0 = not buyable in store">
            <input type="number" value={form.priceNC} onChange={e => setForm(f => ({ ...f, priceNC: Number(e.target.value) }))} style={inp} min={0} />
          </Field>
        </div>

        <Field label="Description" hint="shown in the store card">
          <textarea value={form.previewDescription} onChange={e => setForm(f => ({ ...f, previewDescription: e.target.value }))}
            rows={2} style={{ ...inp, resize: "vertical" }} placeholder="A steady cyan heartbeat that pulses through your name." />
        </Field>

        <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
          {([ ["purchasable", "Visible in store"] , ["eventRewardable", "Can be event reward"], ["seasonExclusive", "Season exclusive"] ] as [keyof typeof form, string][]).map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>
              <input type="checkbox" checked={!!form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} style={{ accentColor: "#06b6d4" }} />
              {label}
            </label>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={handleCreate} disabled={creating} style={{
            background: creating ? "#1e1e2e" : "#06b6d418",
            border: "1px solid " + (creating ? "#1e1e2e" : "#06b6d440"),
            color: creating ? "#475569" : "#06b6d4",
            fontFamily: "monospace", fontSize: 12, fontWeight: "bold",
            padding: "8px 20px", borderRadius: 4,
            cursor: creating ? "not-allowed" : "pointer",
          }}>
            {creating ? "Creating…" : "Add to Catalog"}
          </button>
        </div>
      </div>

      {/* ── SECTION B — Grant to Player ── */}
      <div style={card}>
        <div style={sectionHead("#a855f7")}>🎁 GRANT TO PLAYER</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <Field label="Search Cosmetic">
              <input value={grantSearch} onChange={e => setGrantSearch(e.target.value)} style={inp} placeholder="Search by name or ID…" />
            </Field>
            <div style={{ marginTop: 6 }}>
              <span style={lbl}>SELECT COSMETIC</span>
              <select value={grantCosmeticId} onChange={e => setGrantCosmeticId(e.target.value)}
                size={5} style={{ ...inp, height: "auto", cursor: "pointer" }}>
                <option value="">— choose —</option>
                {filteredCatalog.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} [{TYPE_LABELS[c.type]}] [{c.rarity}]
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Field label="Player Username">
              <input value={grantUsername} onChange={e => setGrantUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGrant()}
                style={inp} placeholder="exact username" />
            </Field>
            {grantCosmeticId && (
              <div style={{ marginTop: 8, background: "#070710", border: "1px solid #1e1e2e", borderRadius: 4, padding: "8px 10px" }}>
                {(() => {
                  const item = catalog.find(c => c.id === grantCosmeticId);
                  return item ? (
                    <div style={{ fontFamily: "monospace", fontSize: 11 }}>
                      <span style={{ color: "#e2e8f0" }}>{item.name}</span>
                      <span style={{ color: "#475569", marginLeft: 8 }}>{TYPE_LABELS[item.type]}</span>
                      <span style={{ marginLeft: 8 }}><RarityBadge rarity={item.rarity} /></span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
            <button onClick={handleGrant} disabled={granting || !grantCosmeticId || !grantUsername.trim()}
              style={{
                marginTop: 12,
                background: granting || !grantCosmeticId || !grantUsername.trim() ? "#1e1e2e" : "#a855f718",
                border: "1px solid " + (granting || !grantCosmeticId || !grantUsername.trim() ? "#1e1e2e" : "#a855f740"),
                color: granting || !grantCosmeticId || !grantUsername.trim() ? "#475569" : "#a855f7",
                fontFamily: "monospace", fontSize: 12, fontWeight: "bold",
                padding: "8px 20px", borderRadius: 4,
                cursor: granting || !grantCosmeticId || !grantUsername.trim() ? "not-allowed" : "pointer",
              }}>
              {granting ? "Granting…" : "Grant Cosmetic"}
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION C — Cosmetic Catalog ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={sectionHead("#39d353")}>📦 COSMETIC CATALOG</div>
          <button onClick={loadCatalog} style={{ background: "transparent", border: "none", color: "#475569", fontFamily: "monospace", fontSize: 11, cursor: "pointer" }}>
            ↻ Refresh
          </button>
        </div>

        {loadingCatalog && (
          <div style={{ color: "#475569", fontFamily: "monospace", fontSize: 11, textAlign: "center", padding: 24 }}>Loading…</div>
        )}

        {!loadingCatalog && catalog.length === 0 && (
          <div style={{ color: "#475569", fontFamily: "monospace", fontSize: 11, textAlign: "center", padding: 24 }}>No cosmetics in catalog yet</div>
        )}

        {!loadingCatalog && Object.entries(grouped).map(([type, items]) => (
          <div key={type} style={{ marginBottom: 16 }}>
            {/* Category header */}
            <button
              onClick={() => setCollapsed(c => ({ ...c, [type]: !c[type] }))}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0", width: "100%" }}
            >
              <span style={{ color: "#06b6d4", fontFamily: "monospace", fontSize: 10, fontWeight: "bold", letterSpacing: "0.1em" }}>
                {collapsed[type] ? "▶" : "▼"} {TYPE_LABELS[type] ?? type.toUpperCase()} ({items.length})
              </span>
            </button>

            {!collapsed[type] && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                      {["Name", "ID", "Animation", "Rarity", "NC Price", "Purchasable", "Event", "Season", "Actions"].map(h => (
                        <th key={h} style={{ padding: "5px 8px", color: "#475569", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <>
                        <tr key={item.id} style={{ borderBottom: "1px solid #1e1e2e18", background: editingId === item.id ? "#06b6d408" : "transparent" }}>
                          <td style={{ padding: "7px 8px", color: "#e2e8f0" }}>{item.name}</td>
                          <td style={{ padding: "7px 8px", color: "#475569" }}>{item.id}</td>
                          <td style={{ padding: "7px 8px", color: "#64748b" }}>{item.animation}</td>
                          <td style={{ padding: "7px 8px" }}><RarityBadge rarity={item.rarity} /></td>
                          <td style={{ padding: "7px 8px", color: "#64748b" }}>{item.priceNC > 0 ? `${item.priceNC} NC` : "—"}</td>
                          <td style={{ padding: "7px 8px", color: item.purchasable ? "#39d353" : "#334155" }}>{item.purchasable ? "Yes" : "No"}</td>
                          <td style={{ padding: "7px 8px", color: item.eventRewardable ? "#39d353" : "#334155" }}>{item.eventRewardable ? "Yes" : "No"}</td>
                          <td style={{ padding: "7px 8px", color: item.seasonExclusive ? "#f59e0b" : "#334155" }}>{item.seasonExclusive ? "Yes" : "No"}</td>
                          <td style={{ padding: "7px 8px" }}>
                            <div style={{ display: "flex", gap: 5 }}>
                              <button onClick={() => editingId === item.id ? setEditingId(null) : startEdit(item)} style={{ background: "#06b6d418", border: "1px solid #06b6d440", color: "#06b6d4", fontFamily: "monospace", fontSize: 10, padding: "3px 8px", borderRadius: 3, cursor: "pointer" }}>
                                {editingId === item.id ? "Close" : "Edit"}
                              </button>
                              <button onClick={() => setConfirmDelete(item.id)} style={{ background: "#ff2d5518", border: "1px solid #ff2d5540", color: "#ff2d55", fontFamily: "monospace", fontSize: 10, padding: "3px 8px", borderRadius: 3, cursor: "pointer" }}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Inline edit row */}
                        {editingId === item.id && (
                          <tr key={item.id + "-edit"}>
                            <td colSpan={9} style={{ padding: 0 }}>
                              <div style={{ background: "#070710", border: "1px solid #06b6d430", borderTop: "none", padding: "14px 16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
                                  <Field label="Name">
                                    <input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inp} />
                                  </Field>
                                  <Field label="Color">
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <input type="color" value={editForm.color ?? "#000000"} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                                        style={{ width: 36, height: 36, border: "1px solid #1e1e2e", borderRadius: 4, background: "#070710", cursor: "pointer", padding: 2, flexShrink: 0 }} />
                                      <input value={editForm.color ?? ""} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} style={inp} />
                                    </div>
                                  </Field>
                                  <Field label="Animation">
                                    <select value={editForm.animation ?? "none"} onChange={e => setEditForm(f => ({ ...f, animation: e.target.value as CosmeticItem["animation"] }))} style={{ ...inp, cursor: "pointer" }}>
                                      {ANIMATION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="Rarity">
                                    <select value={editForm.rarity ?? "common"} onChange={e => setEditForm(f => ({ ...f, rarity: e.target.value as CosmeticItem["rarity"] }))} style={{ ...inp, cursor: "pointer" }}>
                                      {RARITY_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="CSS Key">
                                    <input value={editForm.cssKey ?? ""} onChange={e => setEditForm(f => ({ ...f, cssKey: e.target.value }))} style={inp} />
                                  </Field>
                                  <Field label="NC Price">
                                    <input type="number" value={editForm.priceNC ?? 0} onChange={e => setEditForm(f => ({ ...f, priceNC: Number(e.target.value) }))} style={inp} min={0} />
                                  </Field>
                                  <Field label="Description">
                                    <input value={editForm.previewDescription ?? ""} onChange={e => setEditForm(f => ({ ...f, previewDescription: e.target.value }))} style={inp} />
                                  </Field>
                                </div>
                                <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
                                  {([["purchasable", "Visible in store"], ["eventRewardable", "Event rewardable"], ["seasonExclusive", "Season exclusive"]] as [keyof CosmeticItem, string][]).map(([key, label]) => (
                                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>
                                      <input type="checkbox" checked={!!(editForm as any)[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.checked }))} style={{ accentColor: "#06b6d4" }} />
                                      {label}
                                    </label>
                                  ))}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => handleSaveEdit(item.id)} disabled={saving} style={{ background: saving ? "#1e1e2e" : "#06b6d418", border: "1px solid " + (saving ? "#1e1e2e" : "#06b6d440"), color: saving ? "#475569" : "#06b6d4", fontFamily: "monospace", fontSize: 11, fontWeight: "bold", padding: "6px 14px", borderRadius: 4, cursor: saving ? "not-allowed" : "pointer" }}>
                                    {saving ? "Saving…" : "Save Changes"}
                                  </button>
                                  <button onClick={() => { setEditingId(null); setEditForm({}); }} style={{ background: "transparent", border: "1px solid #1e1e2e", color: "#475569", fontFamily: "monospace", fontSize: 11, padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Delete confirm row */}
                        {confirmDelete === item.id && (
                          <tr key={item.id + "-del"}>
                            <td colSpan={9} style={{ padding: 0 }}>
                              <div style={{ background: "#ff2d5510", border: "1px solid #ff2d5530", borderTop: "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#ff2d55" }}>
                                  Delete "{item.name}"? This cannot be undone.
                                </span>
                                <button onClick={() => handleDelete(item.id)} disabled={deleting} style={{ background: "#ff2d5520", border: "1px solid #ff2d5560", color: "#ff2d55", fontFamily: "monospace", fontSize: 11, fontWeight: "bold", padding: "4px 12px", borderRadius: 3, cursor: "pointer" }}>
                                  {deleting ? "Deleting…" : "Confirm Delete"}
                                </button>
                                <button onClick={() => setConfirmDelete(null)} style={{ background: "transparent", border: "1px solid #1e1e2e", color: "#475569", fontFamily: "monospace", fontSize: 11, padding: "4px 10px", borderRadius: 3, cursor: "pointer" }}>
                                  Cancel
                                </button>
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
        ))}
      </div>
    </div>
  );
}
