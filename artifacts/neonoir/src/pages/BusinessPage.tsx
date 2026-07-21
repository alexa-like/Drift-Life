import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { AnimatedCard } from "../components/AnimatedCard";

interface Props {
  user: User;
  refreshUser: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusinessData {
  _id?: string;
  id: string;
  ownerId: string;
  name: string;
  type: string;
  description: string;
  starLevel: number;
  isOpen: boolean;
  wagePerShift: number;
  accumulatedIncome: number;
  incomePerHour: number;
  lastIncomeAt: string | null;
  totalEverEarned: number;
  maxEmployees: number;
  activeEmployeeCount: number;
  effectiveness: number;
  popularity: number;
  environment: number;
  activeEmployees: Employee[];
}

interface Employee {
  userId: string;
  username: string;
  level: number;
  totalShifts: number;
  totalEarned: number;
  jobPoints: number;
  lastShiftAt: string | null;
  status: "active" | "pending" | "fired" | "resigned";
  jobPosition: JobPosition;
}

type JobPosition = "runner" | "lieutenant" | "ghost" | "handler" | "marketer";

interface BoardBusiness {
  id: string;
  ownerId: string;
  ownerUsername: string;
  name: string;
  type: string;
  label: string;
  icon: string;
  starLevel: number;
  isOpen: boolean;
  wagePerShift: number;
  activeEmployeeCount: number;
  maxEmployees: number;
  description: string;
  employeeBonus: string;
  shiftCooldownMin: number;
  shiftEnergyCost: number;
  myStatus: string | null;
}

interface MyJob {
  id: string;
  name: string;
  type: string;
  label: string;
  icon: string;
  starLevel: number;
  wagePerShift: number;
  description: string;
  isOpen: boolean;
  ownerUsername: string;
  myEmployee: {
    userId: string;
    jobPosition: JobPosition;
    totalShifts: number;
    totalEarned: number;
    jobPoints: number;
    lastShiftAt: string | null;
  };
  shiftEnergyCost: number;
  shiftCooldownMin: number;
  employeeBonus: string;
  onCooldown: boolean;
  cooldownUntil: string | null;
}

interface TierBizData {
  id: string;
  tier: number;
  upgradeProgress: number;
  passiveIncomePerHour: number;
  pendingTierIncome: number;
  lastCollectedAt: string | null;
  launderingCooldownHours: number;
  lastLaunderedAt: string | null;
  activeBuffs: { type: string; multiplier: number; expiresAt: string }[];
  nextTier: number | null;
  nextThreshold: number | null;
  progressToNext: number; // 0–100
}

// ── Static business type definitions (for create form) ────────────────────────
const BUSINESS_TYPES = [
  {
    type: "chop_shop",
    icon: "🔧",
    label: "Chop Shop",
    description: "Strip stolen rides for parts. The city runs on recycled metal.",
    employeeBonus: "Crime cooldowns −10%",
    createCost: 100_000,
  },
  {
    type: "data_broker",
    icon: "💾",
    label: "Data Broker",
    description: "Move information for those who can afford it. Data is the new drug.",
    employeeBonus: "Hacking cooldown −15%",
    createCost: 100_000,
  },
  {
    type: "street_pharmacy",
    icon: "💊",
    label: "Street Pharmacy",
    description: "Supply what the city craves. Keep the product moving.",
    employeeBonus: "+5 max nerve",
    createCost: 100_000,
  },
  {
    type: "fixer_office",
    icon: "🤝",
    label: "Fixer Office",
    description: "Connect runners with contracts. You are the dangerous middle.",
    employeeBonus: "Job DC rewards +10%",
    createCost: 100_000,
  },
  {
    type: "combat_gym",
    icon: "🥊",
    label: "Combat Gym",
    description: "Train fighters. Build weapons out of people.",
    employeeBonus: "Gym stat gains +10%",
    createCost: 100_000,
  },
];

function getBusinessDef(type: string) {
  return (
    BUSINESS_TYPES.find((b) => b.type === type) ?? {
      type,
      icon: "🏢",
      label: type,
      description: "",
      employeeBonus: "",
      createCost: 100_000,
    }
  );
}

// ── Position metadata ──────────────────────────────────────────────────────────
const POSITION_META: Record<
  JobPosition,
  { label: string; icon: string; color: string; desc: string }
> = {
  runner:     { label: "Runner",     icon: "🔩", color: "#64748b", desc: "Base street worker — generates income" },
  lieutenant: { label: "Lieutenant", icon: "🎖️", color: "#00d4ff", desc: "Boosts crew efficiency (max 2)" },
  ghost:      { label: "Ghost",      icon: "👻", color: "#39d353", desc: "Cleans up, boosts environment (max 2)" },
  handler:    { label: "Handler",    icon: "🗂️", color: "#a855f7", desc: "Sends daily intel reports (max 1)" },
  marketer:   { label: "Marketer",   icon: "📡", color: "#f59e0b", desc: "Amplifies ad campaigns (max 2)" },
};

// ── Star upgrade costs ─────────────────────────────────────────────────────────
const UPGRADE_BASE: Record<string, number> = {
  chop_shop:       25_000,
  data_broker:     30_000,
  street_pharmacy: 20_000,
  fixer_office:    35_000,
  combat_gym:      20_000,
};
function upgradeCost(type: string, starLevel: number): number {
  const base = UPGRADE_BASE[type] ?? 25_000;
  return Math.floor(base * Math.pow(2, starLevel - 1));
}

// ── Perks by star ─────────────────────────────────────────────────────────────
const PERKS: {
  star: number;
  label: string;
  color: string;
  key: "perk3star" | "perk5star" | "perk7star" | "perk10star";
}[] = [
  { star: 3,  label: "3★ Perk",  color: "#a855f7", key: "perk3star"  },
  { star: 5,  label: "5★ Perk",  color: "#00d4ff", key: "perk5star"  },
  { star: 7,  label: "7★ Perk",  color: "#f59e0b", key: "perk7star"  },
  { star: 10, label: "10★ Perk", color: "#ff2d55", key: "perk10star" },
];
type PerkCatalog = Record<string, Record<string, string>>;

// ── Countdown component ───────────────────────────────────────────────────────
function Cooldown({ until }: { until: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const calc = () =>
      setSecs(Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000)));
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [until]);
  if (secs === 0) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return (
    <span style={{ color: "#f59e0b" }}>
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ── Income accumulation progress ──────────────────────────────────────────────
function IncomeProgress({
  lastIncomeAt,
  incomePerHour,
}: {
  lastIncomeAt: string | null;
  incomePerHour: number;
}) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!lastIncomeAt) { setPct(0); return; }
    const calc = () => {
      const elapsed = Date.now() - new Date(lastIncomeAt).getTime();
      setPct(Math.min(100, (elapsed / 3_600_000) * 100));
    };
    calc();
    const t = setInterval(calc, 5000);
    return () => clearInterval(t);
  }, [lastIncomeAt]);
  const color = pct >= 90 ? "#39d353" : pct >= 50 ? "#f59e0b" : "#00d4ff";
  return (
    <div>
      <div className="flex justify-between font-mono text-xs mb-1" style={{ color: "#64748b" }}>
        <span>{incomePerHour.toLocaleString()} DC/hr</span>
        <span>{pct.toFixed(0)}% to next tick</span>
      </div>
      <div style={{ height: 4, background: "#1e1e2e", borderRadius: 2 }}>
        <div
          style={{
            height: 4,
            width: `${pct}%`,
            background: color,
            borderRadius: 2,
            transition: "width 5s linear",
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
      </div>
    </div>
  );
}

// ── Stat bar ──────────────────────────────────────────────────────────────────
function StatBar({
  label,
  icon,
  value,
  accent,
  hint,
}: {
  label: string;
  icon: string;
  value: number;
  accent: string;
  hint: string;
}) {
  const color =
    value >= 70 ? (accent === "#ff2d55" ? "#ff2d55" : "#39d353")
    : value >= 40 ? "#f59e0b"
    : "#ff2d55";
  return (
    <AnimatedCard accent={accent}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold" style={{ color: accent }}>
            {icon} {label}
          </span>
          <span className="font-mono text-sm font-bold" style={{ color }}>
            {value}%
          </span>
        </div>
        <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${value}%`, background: color }}
          />
        </div>
        <p className="font-mono text-xs" style={{ color: "#64748b" }}>
          {hint}
        </p>
      </div>
    </AnimatedCard>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({
  active,
  onClick,
  children,
  accent = "#00d4ff",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="font-mono text-xs px-3 py-1.5 rounded transition-all"
      style={{
        background: active ? accent + "18" : "transparent",
        color: active ? accent : "#64748b",
        border: active ? `1px solid ${accent}40` : "1px solid #1e1e2e",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export function BusinessPage({ user, refreshUser, addToast }: Props) {
  const qc = useQueryClient();
  const [mainTab, setMainTab] = useState<"my-business" | "job-board">("my-business");
  const [bizSubTab, setBizSubTab] = useState<"overview" | "crew" | "settings">("overview");

  // Create form
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createWage, setCreateWage] = useState(500);

  // Settings form
  const [settingsWage, setSettingsWage] = useState(500);
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(true);

  // Delete request form
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  // Transfer form
  const [transferTargetId, setTransferTargetId] = useState("");
  const [showTransferForm, setShowTransferForm] = useState(false);

  // Tier 10 state
  const [investAmount, setInvestAmount] = useState<number>(10_000);

  // ── Catalog query (perk descriptions) ─────────────────────────────────────
  const { data: catalog = [] } = useQuery<
    {
      type: string;
      perk3star: string;
      perk5star: string;
      perk7star: string;
      perk10star: string;
    }[]
  >({
    queryKey: ["businesses", "catalog"],
    queryFn: () => api.get("/businesses/catalog"),
  });

  const perkCatalog: PerkCatalog = Object.fromEntries(
    catalog.map((c) => [
      c.type,
      {
        perk3star: c.perk3star,
        perk5star: c.perk5star,
        perk7star: c.perk7star,
        perk10star: c.perk10star,
      },
    ])
  );

  // ── Owner: my business ────────────────────────────────────────────────────
  const { data: myBusiness, isLoading: bizLoading } = useQuery<BusinessData | null>({
    queryKey: ["businesses", "mine"],
    queryFn: (): Promise<BusinessData | null> =>
      api.get<BusinessData>("/businesses/mine").catch(() => null),
  });

  // Owner: employee roster
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["businesses", "employees", myBusiness?.id ?? myBusiness?._id],
    queryFn: (): Promise<Employee[]> =>
      api.get<Employee[]>(`/businesses/${myBusiness!.id ?? (myBusiness as any)!._id}/employees`),
    enabled: !!(myBusiness?.id ?? (myBusiness as any)?._id),
  });

  // Employee: my job (single)
  const { data: myJob } = useQuery<MyJob | null>({
    queryKey: ["businesses", "my-job"],
    queryFn: (): Promise<MyJob | null> =>
      api.get<MyJob>("/businesses/my-job").catch(() => null),
    enabled: mainTab === "job-board",
  });

  // Job board
  const { data: board = [] } = useQuery<BoardBusiness[]>({
    queryKey: ["businesses", "board"],
    queryFn: () => api.get("/businesses/board"),
    enabled: mainTab === "job-board",
  });

  // Tier 10 — tier/passive income data for owner's business
  const { data: tierBizList = [] } = useQuery<TierBizData[]>({
    queryKey: ["businesses", "tier"],
    queryFn: () => api.get<TierBizData[]>("/businesses"),
    enabled: !!myBusiness,
    refetchInterval: 60_000, // refresh every minute to update pending income
  });
  const tierBiz: TierBizData | null = tierBizList[0] ?? null;

  // Sync settings form when business loads
  useEffect(() => {
    if (myBusiness) {
      setSettingsWage(myBusiness.wagePerShift);
      setSettingsDesc(myBusiness.description ?? "");
      setSettingsOpen(myBusiness.isOpen);
    }
  }, [myBusiness?.id, myBusiness?._id]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createBiz = useMutation({
    mutationFn: () =>
      api.post<BusinessData>("/businesses", {
        name: createName,
        type: createType,
        description: createDesc,
        wagePerShift: createWage,
      }),
    onSuccess: (newBiz) => {
      addToast(`${newBiz.name} is open for business.`, "success");
      // Immediately populate cache so the UI transitions without a re-fetch round-trip
      const bizId = newBiz.id ?? (newBiz as any)._id?.toString();
      qc.setQueryData(["businesses", "mine"], { ...newBiz, id: bizId });
      qc.invalidateQueries({ queryKey: ["businesses"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const collectIncome = useMutation({
    mutationFn: () => api.post<{ collected: number; newDc: number }>("/businesses/collect", {}),
    onSuccess: (r) => {
      addToast(`+${formatDC(r.collected)} DC collected`, "success");
      qc.invalidateQueries({ queryKey: ["businesses", "mine"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const upgradeBiz = useMutation({
    mutationFn: () => api.post<{ starLevel: number; newDc: number }>("/businesses/upgrade", {}),
    onSuccess: (r) => {
      addToast(`Upgraded to ⭐${r.starLevel}`, "success");
      qc.invalidateQueries({ queryKey: ["businesses", "mine"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const fireEmployee = useMutation({
    mutationFn: ({ bizId, userId }: { bizId: string; userId: string }) =>
      api.post(`/businesses/${bizId}/fire/${userId}`, {}),
    onSuccess: () => {
      addToast("Crew member removed.", "info");
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const approveEmployee = useMutation({
    mutationFn: (userId: string) => api.post(`/businesses/approve/${userId}`, {}),
    onSuccess: () => {
      addToast("Crew member activated!", "success");
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const assignPosition = useMutation({
    mutationFn: ({ userId, position }: { userId: string; position: string }) =>
      api.post(`/businesses/employees/${userId}/position`, { position }),
    onSuccess: (r: any) => {
      addToast(r.message ?? "Role assigned", "success");
      qc.invalidateQueries({ queryKey: ["businesses", "mine"] });   // ← FIXED key
      qc.invalidateQueries({ queryKey: ["businesses", "employees"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      api.patch("/businesses/settings", {
        wagePerShift: settingsWage,
        description: settingsDesc,
        isOpen: settingsOpen,
      }),
    onSuccess: () => {
      addToast("Settings saved.", "success");
      qc.invalidateQueries({ queryKey: ["businesses", "mine"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const advertise = useMutation({
    mutationFn: () =>
      api.post<{ message: string; popularity: number; cost: number; newDc: number }>(
        "/businesses/advertise",
        {}
      ),
    onSuccess: (r) => {
      addToast(r.message ?? "Campaign launched!", "success");
      qc.invalidateQueries({ queryKey: ["businesses", "mine"] });   // ← FIXED key
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const transferOwnership = useMutation({
    mutationFn: (targetUserId: string) =>
      api.post<{ message: string }>("/businesses/transfer", { targetUserId }),
    onSuccess: (r) => {
      addToast(r.message ?? "Ownership transferred.", "info");
      qc.invalidateQueries({ queryKey: ["businesses"] });
      refreshUser();
      setShowTransferForm(false);
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const requestDelete = useMutation({
    mutationFn: (reason: string) =>
      api.post<{ message: string }>("/businesses/request-delete", { reason }),
    onSuccess: (r) => {
      addToast(r.message ?? "Request submitted.", "info");
      setShowDeleteForm(false);
      setDeleteReason("");
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const applyToBusiness = useMutation({
    mutationFn: (businessId: string) => api.post(`/businesses/apply/${businessId}`, {}),
    onSuccess: () => {
      addToast("Application submitted. Awaiting approval.", "success");
      qc.invalidateQueries({ queryKey: ["businesses", "board"] });
      qc.invalidateQueries({ queryKey: ["businesses", "my-job"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const workShift = useMutation({
    mutationFn: (businessId: string) =>
      api.post<{
        message: string;
        dcEarned: number;
        cooldownUntil: string;
        newDc: number;
        newEnergy: number;
      }>(`/businesses/${businessId}/shift`, {}),
    onSuccess: (r) => {
      addToast(`${r.message} +${formatDC(r.dcEarned)} DC`, "success"); // ← FIXED: r.dcEarned
      qc.invalidateQueries({ queryKey: ["businesses", "my-job"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const resignJob = useMutation({
    mutationFn: () => api.post<{ message: string }>("/businesses/resign", {}),
    onSuccess: (r) => {
      addToast(r.message ?? "You've resigned.", "info");
      qc.invalidateQueries({ queryKey: ["businesses"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  // ── Tier 10 mutations ─────────────────────────────────────────────────────

  const collectTierIncome = useMutation({
    mutationFn: (bizId: string) =>
      api.post<{ collected: number; newDc: number }>(`/businesses/${bizId}/collect`, {}),
    onSuccess: (r) => {
      addToast(`+${formatDC(r.collected)} DC tier income collected`, "success");
      qc.invalidateQueries({ queryKey: ["businesses", "tier"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const investInTier = useMutation({
    mutationFn: ({ bizId, dcAmount }: { bizId: string; dcAmount: number }) =>
      api.post<{ invested: number; newProgress: number; tier: number; tierAdvanced: boolean; passiveIncomePerHour: number; newDc: number }>(
        `/businesses/${bizId}/upgrade`,
        { dcAmount }
      ),
    onSuccess: (r) => {
      if (r.tierAdvanced) {
        addToast(`🔥 Tier ${r.tier} reached! Income: ${r.passiveIncomePerHour.toLocaleString()} DC/hr`, "success");
      } else {
        addToast(`Invested ${formatDC(r.invested)} DC toward Tier ${r.tier + 1}`, "success");
      }
      qc.invalidateQueries({ queryKey: ["businesses", "tier"] });
      qc.invalidateQueries({ queryKey: ["businesses", "mine"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const launderDC = useMutation({
    mutationFn: (bizId: string) =>
      api.post<{ laundered: number; received: number; fee: number; newDc: number }>(
        `/businesses/${bizId}/launder`,
        {}
      ),
    onSuccess: (r) => {
      addToast(`Laundered ${formatDC(r.laundered)} DC → received ${formatDC(r.received)} DC (fee: ${formatDC(r.fee)})`, "success");
      qc.invalidateQueries({ queryKey: ["businesses", "tier"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const skipLaunder = useMutation({
    mutationFn: (bizId: string) =>
      api.post<{ ncSpent: number; remainingMinsSkipped: number; newNc: number }>(
        `/businesses/${bizId}/skip-launder`,
        {}
      ),
    onSuccess: (r) => {
      addToast(`Cooldown skipped for ${r.ncSpent} NC`, "success");
      qc.invalidateQueries({ queryKey: ["businesses", "tier"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeEmployees  = employees.filter((e) => e.status === "active");
  const pendingApps      = employees.filter((e) => e.status === "pending");

  // ── Render: create form ───────────────────────────────────────────────────
  function renderCreateForm() {
    const canCreate = user.level >= 20 && user.dc >= 100_000;
    return (
      <div className="space-y-4">
        <AnimatedCard accent="#a855f7">
          <CyberSectionHeader title="Open a Business" accent="#a855f7" />
          <p className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>
            Requires Level 20 · Costs 100,000 DC · You can only own one operation at a time.
          </p>

          {user.level < 20 && (
            <div
              className="mb-4 p-3 rounded font-mono text-xs"
              style={{
                background: "#ff2d5510",
                border: "1px solid #ff2d5540",
                color: "#ff2d55",
              }}
            >
              You need to reach Level 20 to open a business.
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>
                Operation Name
              </label>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Chrome & Shadows Inc."
                className="w-full px-3 py-2 rounded font-mono text-sm"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#e2e8f0",
                  outline: "none",
                }}
              />
            </div>

            {/* Type selector */}
            <div>
              <label className="font-mono text-xs mb-2 block" style={{ color: "#94a3b8" }}>
                Business Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BUSINESS_TYPES.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => setCreateType(bt.type)}
                    className="text-left p-3 rounded transition-all"
                    style={{
                      background: createType === bt.type ? "#a855f718" : "#0a0a0f",
                      border: `1px solid ${createType === bt.type ? "#a855f760" : "#1e1e2e"}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{bt.icon}</span>
                      <span
                        className="font-mono text-sm font-bold"
                        style={{ color: createType === bt.type ? "#a855f7" : "#e2e8f0" }}
                      >
                        {bt.label}
                      </span>
                    </div>
                    <p className="font-mono text-xs" style={{ color: "#64748b" }}>
                      {bt.description}
                    </p>
                    <p className="font-mono text-xs mt-1" style={{ color: "#00d4ff" }}>
                      Employee bonus: {bt.employeeBonus}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>
                Description{" "}
                <span style={{ color: "#334155" }}>(optional, max 200 chars)</span>
              </label>
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value.slice(0, 200))}
                rows={2}
                placeholder="Describe your operation..."
                className="w-full px-3 py-2 rounded font-mono text-xs resize-none"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#e2e8f0",
                  outline: "none",
                }}
              />
              <div className="text-right font-mono text-xs" style={{ color: "#334155" }}>
                {createDesc.length}/200
              </div>
            </div>

            {/* Wage */}
            <div>
              <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>
                Starting Wage Per Shift (100–50,000 DC)
              </label>
              <input
                type="number"
                value={createWage}
                onChange={(e) =>
                  setCreateWage(Math.min(50_000, Math.max(100, Number(e.target.value))))
                }
                min={100}
                max={50_000}
                className="w-full px-3 py-2 rounded font-mono text-sm"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#f59e0b",
                  outline: "none",
                }}
              />
            </div>

            <CyberButton
              variant="purple"
              size="md"
              disabled={
                !canCreate || !createName.trim() || !createType || createBiz.isPending
              }
              loading={createBiz.isPending}
              onClick={() => createBiz.mutate()}
              className="w-full"
            >
              Open for Business — 100,000 DC
            </CyberButton>
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // ── Render: overview tab ──────────────────────────────────────────────────
  function renderOverview(biz: BusinessData) {
    const def      = getBusinessDef(biz.type);
    const bizId    = biz.id ?? (biz as any)._id;
    const nextCost = upgradeCost(biz.type, biz.starLevel);
    const canUpgrade = biz.starLevel < 10 && user.dc >= nextCost;
    const perks    = perkCatalog[biz.type] ?? {};

    const effMult  = (0.5 + biz.effectiveness / 200).toFixed(2);
    const popMult  = (1 + biz.popularity / 200).toFixed(2);
    const envMult  = (0.67 + (biz.environment / 100) * 0.33).toFixed(2);

    return (
      <div className="space-y-4">
        {/* Business header card */}
        <AnimatedCard accent="#f59e0b" noPad>
          <div className="p-4 flex items-center gap-3">
            <span className="text-3xl">{def.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-lg" style={{ color: "#e2e8f0" }}>
                  {biz.name}
                </span>
                <span
                  className="font-mono text-xs px-2 py-0.5 rounded"
                  style={{
                    background: "#f59e0b18",
                    color: "#f59e0b",
                    border: "1px solid #f59e0b40",
                  }}
                >
                  {def.label}
                </span>
              </div>
              <div className="font-mono text-sm mt-1" style={{ color: "#f59e0b" }}>
                {"⭐".repeat(biz.starLevel)}
                <span style={{ color: "#334155" }}>{"☆".repeat(10 - biz.starLevel)}</span>
                <span className="ml-2 text-xs" style={{ color: "#64748b" }}>
                  {biz.starLevel}/10
                </span>
              </div>
              {biz.description && (
                <p className="font-mono text-xs mt-1" style={{ color: "#475569" }}>
                  {biz.description}
                </p>
              )}
            </div>
            <span
              className="font-mono text-xs px-2 py-1 rounded"
              style={{
                background: biz.isOpen ? "#39d35318" : "#1e1e2e",
                color: biz.isOpen ? "#39d353" : "#64748b",
                border: `1px solid ${biz.isOpen ? "#39d35340" : "#1e1e2e"}`,
              }}
            >
              {biz.isOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
        </AnimatedCard>

        {/* Income card */}
        <AnimatedCard accent="#39d353">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                  Accumulated Income
                </div>
                <div className="font-mono text-2xl font-bold" style={{ color: "#39d353" }}>
                  {formatDC(biz.accumulatedIncome)} DC
                </div>
              </div>
              <CyberButton
                variant="success"
                size="sm"
                disabled={biz.accumulatedIncome < 1 || collectIncome.isPending}
                loading={collectIncome.isPending}
                onClick={() => collectIncome.mutate()}
              >
                Collect
              </CyberButton>
            </div>
            <IncomeProgress
              lastIncomeAt={biz.lastIncomeAt}
              incomePerHour={biz.incomePerHour}
            />
            <p className="font-mono text-xs" style={{ color: "#475569" }}>
              {biz.incomePerHour.toLocaleString()} DC/hr with {biz.activeEmployeeCount} active runner
              {biz.activeEmployeeCount !== 1 ? "s" : ""}
            </p>
          </div>
        </AnimatedCard>

        {/* Performance gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatBar
            label="Efficiency"
            icon="⚙️"
            value={biz.effectiveness}
            accent="#00d4ff"
            hint={`×${effMult} income mult. Lieutenants boost this.`}
          />
          <div>
            <StatBar
              label="Reputation"
              icon="📣"
              value={biz.popularity}
              accent="#a855f7"
              hint={`×${popMult} mult. Decays ~3%/hr. Marketers amp campaigns.`}
            />
            <div className="mt-2">
              <CyberButton
                variant="primary"
                size="sm"
                loading={advertise.isPending}
                disabled={user.dc < 25_000 || advertise.isPending}
                onClick={() => advertise.mutate()}
                className="w-full"
              >
                📡 Broadcast — 25k DC
              </CyberButton>
            </div>
          </div>
          <StatBar
            label="Environment"
            icon="🌿"
            value={biz.environment}
            accent="#39d353"
            hint={`×${envMult} mult. Ghosts keep it clean.`}
          />
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Star Level", value: `${biz.starLevel}/10`,          color: "#f59e0b" },
            { label: "Crew",       value: `${biz.activeEmployeeCount}/${biz.maxEmployees}`, color: "#00d4ff" },
            { label: "Total Earned", value: `${formatDC(biz.totalEverEarned)} DC`, color: "#39d353" },
            { label: "Wage/Shift", value: `${formatDC(biz.wagePerShift)} DC`, color: "#a855f7" },
          ].map((s) => (
            <div
              key={s.label}
              className="p-3 rounded text-center"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
            >
              <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>
                {s.label}
              </div>
              <div className="font-mono font-bold text-sm" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade */}
        {biz.starLevel < 10 && (
          <AnimatedCard accent="#00d4ff">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-mono text-sm font-bold" style={{ color: "#00d4ff" }}>
                  Upgrade to ⭐{biz.starLevel + 1}
                </div>
                <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
                  Cost: {nextCost.toLocaleString()} DC · +2 crew slots
                </div>
              </div>
              <CyberButton
                variant="primary"
                size="sm"
                disabled={!canUpgrade || upgradeBiz.isPending}
                loading={upgradeBiz.isPending}
                onClick={() => upgradeBiz.mutate()}
              >
                Upgrade ({formatDC(nextCost)} DC)
              </CyberButton>
            </div>
          </AnimatedCard>
        )}

        {/* Perks grid */}
        <div>
          <CyberSectionHeader title="Operation Perks" accent="#f59e0b" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERKS.map((p) => {
              const desc = perks[p.key] ?? "—";
              const unlocked = biz.starLevel >= p.star;
              return (
                <div
                  key={p.star}
                  className="p-3 rounded"
                  style={{
                    background: unlocked ? p.color + "10" : "#0a0a0f",
                    border: `1px solid ${unlocked ? p.color + "40" : "#1e1e2e"}`,
                    opacity: unlocked ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold" style={{ color: p.color }}>
                      {p.label}
                    </span>
                    {unlocked ? (
                      <span className="font-mono text-xs" style={{ color: "#39d353" }}>
                        ✓ ACTIVE
                      </span>
                    ) : (
                      <span className="font-mono text-xs" style={{ color: "#334155" }}>
                        🔒 Locked
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs" style={{ color: "#64748b" }}>
                    {desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tier 10: Passive Income ───────────────────────────────────────── */}
        {tierBiz && (
          <AnimatedCard accent="#a855f7">
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                    Tier {tierBiz.tier} Passive Income
                    {tierBiz.activeBuffs.some(
                      (b) => b.type === "event_income" && new Date(b.expiresAt) > new Date()
                    ) && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded font-mono text-xs"
                        style={{
                          background: "#f59e0b18",
                          border: "1px solid #f59e0b40",
                          color: "#f59e0b",
                        }}
                      >
                        ⚡ +25% EVENT
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-2xl font-bold" style={{ color: "#a855f7" }}>
                    {formatDC(tierBiz.pendingTierIncome)} DC
                  </div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: "#475569" }}>
                    {tierBiz.passiveIncomePerHour.toLocaleString()} DC/hr (capped 24h)
                  </div>
                </div>
                <CyberButton
                  variant="purple"
                  size="sm"
                  disabled={tierBiz.pendingTierIncome < 1 || collectTierIncome.isPending}
                  loading={collectTierIncome.isPending}
                  onClick={() => collectTierIncome.mutate(tierBiz.id)}
                >
                  Collect Tier Income
                </CyberButton>
              </div>

              {/* Tier progress bar */}
              <div>
                <div className="flex justify-between font-mono text-xs mb-1" style={{ color: "#64748b" }}>
                  <span>Tier {tierBiz.tier}{tierBiz.tier < 5 ? ` → ${tierBiz.tier + 1}` : " (MAX)"}</span>
                  {tierBiz.nextThreshold && (
                    <span>
                      {formatDC(tierBiz.upgradeProgress)} / {formatDC(tierBiz.nextThreshold)} DC
                    </span>
                  )}
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "#1e1e2e", border: "1px solid #2d2d3e" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${tierBiz.tier >= 5 ? 100 : tierBiz.progressToNext}%`,
                      background: "linear-gradient(90deg, #a855f7, #7c3aed)",
                    }}
                  />
                </div>
                <div className="font-mono text-xs mt-0.5 text-right" style={{ color: "#475569" }}>
                  {tierBiz.tier >= 5 ? "Maximum tier reached" : `${tierBiz.progressToNext}%`}
                </div>
              </div>

              {/* Invest in tier */}
              {tierBiz.tier < 5 && (
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="number"
                    value={investAmount}
                    min={1000}
                    step={1000}
                    onChange={(e) => setInvestAmount(Math.max(1, Number(e.target.value)))}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded font-mono text-sm"
                    style={{
                      background: "#0a0a0f",
                      border: "1px solid #2d2d3e",
                      color: "#a855f7",
                      outline: "none",
                    }}
                  />
                  <CyberButton
                    variant="purple"
                    size="sm"
                    disabled={
                      investAmount < 1 ||
                      user.dc < investAmount ||
                      investInTier.isPending
                    }
                    loading={investInTier.isPending}
                    onClick={() =>
                      investInTier.mutate({ bizId: tierBiz.id, dcAmount: investAmount })
                    }
                  >
                    Invest DC → T{tierBiz.tier + 1}
                  </CyberButton>
                </div>
              )}
            </div>
          </AnimatedCard>
        )}

        {/* ── Tier 10: Laundering ──────────────────────────────────────────── */}
        {tierBiz && user.dirtyDc > 0 && (
          <AnimatedCard accent="#ff6b35">
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                    Dirty DC
                  </div>
                  <div className="font-mono text-xl font-bold" style={{ color: "#ff6b35" }}>
                    {formatDC(user.dirtyDc)} DC
                  </div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: "#475569" }}>
                    15% fee · cooldown {tierBiz.launderingCooldownHours}h
                  </div>
                </div>
                {(() => {
                  const now = Date.now();
                  const lastL = tierBiz.lastLaunderedAt
                    ? new Date(tierBiz.lastLaunderedAt).getTime()
                    : 0;
                  const cooldownMs = tierBiz.launderingCooldownHours * 3_600_000;
                  const remainingMs = Math.max(0, lastL + cooldownMs - now);
                  const remainingMins = Math.ceil(remainingMs / 60_000);
                  const onCooldown = remainingMs > 0;
                  return (
                    <div className="flex flex-col gap-2">
                      <CyberButton
                        variant="warning"
                        size="sm"
                        disabled={onCooldown || launderDC.isPending}
                        loading={launderDC.isPending}
                        onClick={() => launderDC.mutate(tierBiz.id)}
                      >
                        Launder
                        {onCooldown ? ` (${remainingMins}m)` : ""}
                      </CyberButton>
                      {onCooldown && (
                        <CyberButton
                          variant="danger"
                          size="sm"
                          disabled={skipLaunder.isPending}
                          loading={skipLaunder.isPending}
                          onClick={() => skipLaunder.mutate(tierBiz.id)}
                        >
                          Skip ({Math.max(5, remainingMins)} NC)
                        </CyberButton>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </AnimatedCard>
        )}

        {/* Roles legend */}
        <AnimatedCard accent="#1e1e2e">
          <div className="font-mono text-xs" style={{ color: "#475569" }}>
            <div className="font-bold mb-2" style={{ color: "#64748b" }}>
              Crew Roles
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {(Object.entries(POSITION_META) as [JobPosition, typeof POSITION_META[JobPosition]][]).map(
                ([key, meta]) => (
                  <div key={key} className="flex items-start gap-2">
                    <span>{meta.icon}</span>
                    <div>
                      <span style={{ color: meta.color }}>{meta.label}</span>
                      <span style={{ color: "#334155" }}> — {meta.desc}</span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // ── Render: crew tab ──────────────────────────────────────────────────────
  function renderCrew(biz: BusinessData) {
    const bizId = biz.id ?? (biz as any)._id;
    return (
      <div className="space-y-4">
        {/* Active crew */}
        <div>
          <CyberSectionHeader
            title={`Active Crew (${activeEmployees.length}/${biz.maxEmployees})`}
            accent="#39d353"
          />
          {activeEmployees.length === 0 ? (
            <div
              className="p-4 rounded font-mono text-xs text-center"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#334155" }}
            >
              No crew yet. Open the job board so runners can apply.
            </div>
          ) : (
            <div className="space-y-2">
              {activeEmployees.map((emp) => {
                const meta = POSITION_META[emp.jobPosition] ?? POSITION_META.runner;
                return (
                  <div
                    key={emp.userId}
                    className="p-3 rounded space-y-2"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>
                            {emp.username}
                          </span>
                          <span
                            className="font-mono text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: "#00d4ff12",
                              color: "#00d4ff",
                              border: "1px solid #00d4ff30",
                            }}
                          >
                            Lv.{emp.level}
                          </span>
                          <span
                            className="font-mono text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: `${meta.color}12`,
                              color: meta.color,
                              border: `1px solid ${meta.color}30`,
                            }}
                          >
                            {meta.icon} {meta.label}
                          </span>
                        </div>
                        <div
                          className="flex gap-3 font-mono text-xs mt-1 flex-wrap"
                          style={{ color: "#64748b" }}
                        >
                          <span>{emp.totalShifts} shifts</span>
                          <span style={{ color: "#f59e0b" }}>
                            {formatDC(emp.totalEarned)} DC earned
                          </span>
                          <span style={{ color: "#a855f7" }}>
                            {(emp as any).jobPoints ?? 0} job pts
                          </span>
                          {emp.lastShiftAt && (
                            <span>
                              last shift {new Date(emp.lastShiftAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => fireEmployee.mutate({ bizId, userId: emp.userId })}
                        disabled={fireEmployee.isPending}
                        className="font-mono text-xs px-3 py-1 rounded transition-all"
                        style={{
                          background: "#ff2d5510",
                          color: "#ff2d55",
                          border: "1px solid #ff2d5540",
                        }}
                      >
                        Fire
                      </button>
                    </div>

                    {/* Role selector */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs" style={{ color: "#475569" }}>
                        Role:
                      </span>
                      {(
                        ["runner", "lieutenant", "ghost", "handler", "marketer"] as JobPosition[]
                      ).map((pos) => {
                        const pm  = POSITION_META[pos];
                        const cur = emp.jobPosition === pos;
                        return (
                          <button
                            key={pos}
                            onClick={() =>
                              assignPosition.mutate({ userId: emp.userId, position: pos })
                            }
                            disabled={assignPosition.isPending || cur}
                            className="font-mono text-xs px-2 py-0.5 rounded transition-all"
                            style={{
                              background: cur ? `${pm.color}20` : "#111118",
                              color: cur ? pm.color : "#475569",
                              border: `1px solid ${cur ? pm.color + "60" : "#1e1e2e"}`,
                              opacity: assignPosition.isPending ? 0.6 : 1,
                            }}
                            title={pm.desc}
                          >
                            {pm.icon} {pm.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending applications */}
        {pendingApps.length > 0 && (
          <div>
            <CyberSectionHeader
              title={`Pending Applications (${pendingApps.length})`}
              accent="#f59e0b"
            />
            <div className="space-y-2">
              {pendingApps.map((emp) => (
                <div
                  key={emp.userId}
                  className="flex items-center justify-between gap-3 p-3 rounded"
                  style={{ background: "#0a0a0f", border: "1px solid #f59e0b30" }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>
                      {emp.username}
                    </span>
                    <span
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: "#00d4ff12",
                        color: "#00d4ff",
                        border: "1px solid #00d4ff30",
                      }}
                    >
                      Lv.{emp.level}
                    </span>
                    <span
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: "#f59e0b10",
                        color: "#f59e0b",
                        border: "1px solid #f59e0b30",
                      }}
                    >
                      Pending
                    </span>
                  </div>
                  <button
                    onClick={() => approveEmployee.mutate(emp.userId)}
                    disabled={approveEmployee.isPending}
                    className="font-mono text-xs px-3 py-1 rounded transition-all"
                    style={{
                      background: "#39d35318",
                      color: "#39d353",
                      border: "1px solid #39d35340",
                    }}
                  >
                    Accept
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: settings tab ──────────────────────────────────────────────────
  function renderSettings(biz: BusinessData) {
    return (
      <div className="space-y-4">
        <AnimatedCard accent="#ff6b35">
          <CyberSectionHeader title="Operation Settings" accent="#ff6b35" />
          <div className="space-y-4">
            {/* Open toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>
                  Accepting Applications
                </div>
                <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                  Allow new runners to apply
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className="w-12 h-6 rounded-full transition-all relative"
                style={{
                  background: settingsOpen ? "#39d353" : "#1e1e2e",
                  border: `1px solid ${settingsOpen ? "#39d35340" : "#334155"}`,
                }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                  style={{
                    background: "#e2e8f0",
                    left: settingsOpen ? "calc(100% - 22px)" : "2px",
                  }}
                />
              </button>
            </div>

            {/* Wage */}
            <div>
              <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>
                Wage Per Shift (100–50,000 DC)
              </label>
              <input
                type="number"
                value={settingsWage}
                onChange={(e) =>
                  setSettingsWage(Math.min(50_000, Math.max(100, Number(e.target.value))))
                }
                min={100}
                max={50_000}
                className="w-full px-3 py-2 rounded font-mono text-sm"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#f59e0b",
                  outline: "none",
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>
                Description{" "}
                <span style={{ color: "#334155" }}>(max 200 chars)</span>
              </label>
              <textarea
                value={settingsDesc}
                onChange={(e) => setSettingsDesc(e.target.value.slice(0, 200))}
                rows={3}
                className="w-full px-3 py-2 rounded font-mono text-xs resize-none"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#e2e8f0",
                  outline: "none",
                }}
              />
              <div className="text-right font-mono text-xs" style={{ color: "#334155" }}>
                {settingsDesc.length}/200
              </div>
            </div>

            <CyberButton
              variant="warning"
              size="sm"
              loading={saveSettings.isPending}
              onClick={() => saveSettings.mutate()}
            >
              Save Settings
            </CyberButton>
          </div>
        </AnimatedCard>

        {/* Transfer ownership */}
        <AnimatedCard accent="#00d4ff">
          <CyberSectionHeader title="Transfer Ownership" accent="#00d4ff" />
          <p className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>
            Hand the operation to an active crew member. You will lose Director status and become a civilian.
          </p>
          {!showTransferForm ? (
            <CyberButton
              variant="primary"
              size="sm"
              onClick={() => setShowTransferForm(true)}
            >
              Initiate Transfer
            </CyberButton>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>
                  Select Crew Member (must be active)
                </label>
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded font-mono text-sm"
                  style={{
                    background: "#0a0a0f",
                    border: "1px solid #1e1e2e",
                    color: "#e2e8f0",
                    outline: "none",
                  }}
                >
                  <option value="">— select —</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.userId} value={emp.userId}>
                      {emp.username} (Lv.{emp.level})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <CyberButton
                  variant="primary"
                  size="sm"
                  disabled={!transferTargetId || transferOwnership.isPending}
                  loading={transferOwnership.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        "Are you sure? You will no longer be Director of this business."
                      )
                    ) {
                      transferOwnership.mutate(transferTargetId);
                    }
                  }}
                >
                  Confirm Transfer
                </CyberButton>
                <button
                  onClick={() => setShowTransferForm(false)}
                  className="font-mono text-xs px-3 py-1 rounded"
                  style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </AnimatedCard>

        {/* Request deletion */}
        <AnimatedCard accent="#ff2d55">
          <CyberSectionHeader title="Close Operation" accent="#ff2d55" />
          <p className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>
            Permanently shutting down requires admin approval. Submit a request with your reason.
            Your business stays active until staff processes it.
          </p>
          {!showDeleteForm ? (
            <CyberButton
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteForm(true)}
            >
              Submit Closure Request
            </CyberButton>
          ) : (
            <div className="space-y-3">
              <div
                className="p-3 rounded font-mono text-xs"
                style={{
                  background: "#ff2d5510",
                  border: "1px solid #ff2d5530",
                  color: "#ff2d55",
                }}
              >
                Your request will include: Business name ({biz.name}), type, star level, crew count,
                total earned. Admins will contact you before proceeding.
              </div>
              <div>
                <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>
                  Reason for closing (min 20 chars)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  placeholder="Why do you want to permanently close this operation?"
                  className="w-full px-3 py-2 rounded font-mono text-xs resize-none"
                  style={{
                    background: "#0a0a0f",
                    border: "1px solid #ff2d5530",
                    color: "#e2e8f0",
                    outline: "none",
                  }}
                />
                <div
                  className="text-right font-mono text-xs"
                  style={{ color: deleteReason.length < 20 ? "#ff2d55" : "#334155" }}
                >
                  {deleteReason.length} chars (min 20)
                </div>
              </div>
              <div className="flex gap-2">
                <CyberButton
                  variant="danger"
                  size="sm"
                  disabled={
                    deleteReason.trim().length < 20 || requestDelete.isPending
                  }
                  loading={requestDelete.isPending}
                  onClick={() => requestDelete.mutate(deleteReason.trim())}
                >
                  Send Request
                </CyberButton>
                <button
                  onClick={() => {
                    setShowDeleteForm(false);
                    setDeleteReason("");
                  }}
                  className="font-mono text-xs px-3 py-1 rounded"
                  style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </AnimatedCard>
      </div>
    );
  }

  // ── Render: my business section ───────────────────────────────────────────
  function renderMyBusiness() {
    if (bizLoading) {
      return (
        <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>
          Accessing business records...
        </div>
      );
    }

    if (!myBusiness) {
      return renderCreateForm();
    }

    const bizId = myBusiness.id ?? (myBusiness as any)._id;

    return (
      <div className="space-y-4">
        {/* Sub-tab switcher */}
        <div className="flex gap-2 flex-wrap">
          {(["overview", "crew", "settings"] as const).map((tab) => (
            <TabBtn
              key={tab}
              active={bizSubTab === tab}
              onClick={() => setBizSubTab(tab)}
              accent="#f59e0b"
            >
              {tab === "overview" && "📊 Overview"}
              {tab === "crew"     && `👥 Crew (${activeEmployees.length})`}
              {tab === "settings" && "⚙️ Settings"}
            </TabBtn>
          ))}
        </div>

        {bizSubTab === "overview"  && renderOverview(myBusiness)}
        {bizSubTab === "crew"      && renderCrew(myBusiness)}
        {bizSubTab === "settings"  && renderSettings(myBusiness)}
      </div>
    );
  }

  // ── Render: job board ─────────────────────────────────────────────────────
  function renderJobBoard() {
    // If employed, show current job prominently
    if (myJob) {
      const def = getBusinessDef(myJob.type);
      const myEmp = myJob.myEmployee;
      const meta = POSITION_META[myEmp.jobPosition] ?? POSITION_META.runner;
      return (
        <div className="space-y-4">
          {/* Current job card */}
          <AnimatedCard accent="#39d353">
            <CyberSectionHeader title="Current Employment" accent="#39d353" />
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{myJob.icon ?? def.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
                    {myJob.name}
                  </span>
                  <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>
                    {"⭐".repeat(myJob.starLevel)}
                  </span>
                  <span
                    className="font-mono text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: "#00d4ff12",
                      color: "#00d4ff",
                      border: "1px solid #00d4ff30",
                    }}
                  >
                    {myJob.label ?? def.label}
                  </span>
                </div>
                <div className="flex gap-3 font-mono text-xs flex-wrap" style={{ color: "#64748b" }}>
                  <span style={{ color: "#f59e0b" }}>{formatDC(myJob.wagePerShift)} DC/shift</span>
                  <span>⚡ {myJob.shiftEnergyCost} energy</span>
                  <span>Director: {myJob.ownerUsername}</span>
                </div>
              </div>
            </div>

            {/* Employee stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                { label: "My Role",    value: `${meta.icon} ${meta.label}`,           color: meta.color },
                { label: "Shifts",     value: String(myEmp.totalShifts),               color: "#00d4ff" },
                { label: "Earned",     value: `${formatDC(myEmp.totalEarned)} DC`,     color: "#39d353" },
                { label: "Job Points", value: String(myEmp.jobPoints ?? 0),            color: "#a855f7" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="p-2 rounded text-center"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
                >
                  <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>
                    {s.label}
                  </div>
                  <div className="font-mono font-bold text-xs" style={{ color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Bonus tag */}
            {myJob.employeeBonus && (
              <div
                className="mb-4 inline-block font-mono text-xs px-2 py-1 rounded"
                style={{
                  background: "#00d4ff10",
                  color: "#00d4ff",
                  border: "1px solid #00d4ff30",
                }}
              >
                ✦ {myJob.employeeBonus}
              </div>
            )}

            {/* Shift cooldown & action */}
            <div className="flex items-center gap-3 flex-wrap">
              <CyberButton
                variant="success"
                size="md"
                disabled={myJob.onCooldown || !myJob.isOpen || workShift.isPending}
                loading={workShift.isPending}
                onClick={() => workShift.mutate(myJob.id)}
              >
                {myJob.onCooldown ? "On Cooldown" : !myJob.isOpen ? "Closed" : "Work Shift"}
              </CyberButton>
              {myJob.onCooldown && myJob.cooldownUntil && (
                <span className="font-mono text-xs" style={{ color: "#64748b" }}>
                  Ready in <Cooldown until={myJob.cooldownUntil} />
                </span>
              )}
              {!myJob.isOpen && (
                <span className="font-mono text-xs" style={{ color: "#ff2d55" }}>
                  Operation is shut down
                </span>
              )}
            </div>

            {/* Resign */}
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid #1e1e2e" }}>
              <CyberButton
                variant="danger"
                size="sm"
                loading={resignJob.isPending}
                onClick={() => {
                  if (confirm("Resign from this job? You can apply elsewhere after.")) {
                    resignJob.mutate();
                  }
                }}
              >
                Resign from {myJob.name}
              </CyberButton>
              <p className="font-mono text-xs mt-1" style={{ color: "#334155" }}>
                You can only work one job at a time.
              </p>
            </div>
          </AnimatedCard>
        </div>
      );
    }

    // Not employed — show board
    const pendingBids = board.filter((b) => b.myStatus === "pending");
    const available   = board.filter((b) => b.myStatus === null && b.isOpen);

    return (
      <div className="space-y-4">
        {/* Pending applications */}
        {pendingBids.length > 0 && (
          <AnimatedCard accent="#f59e0b">
            <div className="font-mono text-xs" style={{ color: "#f59e0b" }}>
              ⏳ You have {pendingBids.length} pending application
              {pendingBids.length > 1 ? "s" : ""}.{" "}
              Awaiting Director approval:{" "}
              {pendingBids.map((b) => b.name).join(", ")}
            </div>
          </AnimatedCard>
        )}

        <CyberSectionHeader
          title={`Available Operations (${available.length})`}
          accent="#00d4ff"
        />

        {available.length === 0 ? (
          <div
            className="p-6 rounded font-mono text-xs text-center"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#334155" }}
          >
            No open positions right now. Check back when the city wakes up.
          </div>
        ) : (
          <div className="space-y-2">
            {available.map((biz) => {
              const slotsLeft = biz.maxEmployees - biz.activeEmployeeCount;
              return (
                <AnimatedCard key={biz.id} accent="#00d4ff" noPad>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{biz.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className="font-mono font-bold text-sm"
                            style={{ color: "#e2e8f0" }}
                          >
                            {biz.name}
                          </span>
                          <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>
                            {"⭐".repeat(biz.starLevel)}
                          </span>
                          <span
                            className="font-mono text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: "#a855f712",
                              color: "#a855f7",
                              border: "1px solid #a855f730",
                            }}
                          >
                            {biz.label}
                          </span>
                        </div>
                        <div
                          className="flex gap-3 font-mono text-xs flex-wrap mb-1"
                          style={{ color: "#64748b" }}
                        >
                          <span style={{ color: "#f59e0b" }}>
                            {formatDC(biz.wagePerShift)} DC/shift
                          </span>
                          <span>⚡ {biz.shiftEnergyCost} energy</span>
                          <span>⏱ {biz.shiftCooldownMin}m cooldown</span>
                          <span
                            style={{ color: slotsLeft > 0 ? "#39d353" : "#ff2d55" }}
                          >
                            {biz.activeEmployeeCount}/{biz.maxEmployees} slots
                          </span>
                          <span>by {biz.ownerUsername}</span>
                        </div>
                        {biz.description && (
                          <p
                            className="font-mono text-xs mb-1"
                            style={{ color: "#475569" }}
                          >
                            {biz.description}
                          </p>
                        )}
                        {biz.employeeBonus && (
                          <span
                            className="inline-block font-mono text-xs px-2 py-0.5 rounded"
                            style={{
                              background: "#00d4ff10",
                              color: "#00d4ff",
                              border: "1px solid #00d4ff30",
                            }}
                          >
                            ✦ {biz.employeeBonus}
                          </span>
                        )}
                      </div>
                      <CyberButton
                        variant="primary"
                        size="sm"
                        disabled={slotsLeft === 0 || applyToBusiness.isPending}
                        loading={applyToBusiness.isPending}
                        onClick={() => applyToBusiness.mutate(biz.id)}
                      >
                        Apply
                      </CyberButton>
                    </div>
                  </div>
                </AnimatedCard>
              );
            })}
          </div>
        )}

        <p className="font-mono text-xs text-center" style={{ color: "#334155" }}>
          You can only hold one job at a time. Choose carefully.
        </p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  const isEmployed = !!myJob;

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {/* Page header */}
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <CyberSectionHeader
          title="Businesses"
          accent="#a855f7"
          size="lg"
          right={
            <span className="font-mono text-xs" style={{ color: "#64748b" }}>
              Balance:{" "}
              <span style={{ color: "#f59e0b" }}>{formatDC(user.dc)} DC</span>
            </span>
          }
        />
        <p className="font-mono text-xs" style={{ color: "#64748b" }}>
          Own and operate a player-run underground business, or find employment in Neonoir's shadow economy.
        </p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-2">
        <TabBtn
          active={mainTab === "my-business"}
          onClick={() => setMainTab("my-business")}
          accent="#a855f7"
        >
          🏢 My Business
        </TabBtn>
        <TabBtn
          active={mainTab === "job-board"}
          onClick={() => setMainTab("job-board")}
          accent="#00d4ff"
        >
          📋 Job Board
          {isEmployed && (
            <span
              className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full font-mono text-xs"
              style={{ background: "#39d353", color: "#000", fontSize: "0.6rem" }}
            >
              1
            </span>
          )}
        </TabBtn>
      </div>

      {mainTab === "my-business" && renderMyBusiness()}
      {mainTab === "job-board"   && renderJobBoard()}
    </div>
  );
}
