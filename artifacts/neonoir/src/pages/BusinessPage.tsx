import { useState, useEffect, useCallback } from "react";
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
  lastIncomeAt: string;
  totalEverEarned: number;
  maxEmployees: number;
  activeEmployeeCount: number;
}

interface Employee {
  userId: string;
  username: string;
  level: number;
  totalShifts: number;
  totalEarned: number;
  lastShiftAt: string | null;
  status: "active" | "pending" | "fired";
}

interface BoardBusiness {
  id: string;
  ownerId: string;
  ownerUsername: string;
  name: string;
  type: string;
  starLevel: number;
  wagePerShift: number;
  activeEmployeeCount: number;
  maxEmployees: number;
  isOpen: boolean;
}

interface MyJob {
  id: string;
  name: string;
  type: string;
  starLevel: number;
  wagePerShift: number;
  cooldownUntil: string | null;
  shiftEnergyCost: number;
  shiftCooldownMin: number;
  onCooldown: boolean;
  employeeBonus: string;
  description: string;
}

// ── Business type definitions ──────────────────────────────────────────────────

const BUSINESS_TYPES = [
  {
    type: "chop_shop",
    icon: "🔧",
    label: "Chop Shop",
    description: "Strip stolen rides for parts.",
    employeeBonus: "Crime cooldowns -10%",
  },
  {
    type: "data_broker",
    icon: "💾",
    label: "Data Broker",
    description: "Move information for those who can afford it.",
    employeeBonus: "Hacking cooldown -15%",
  },
  {
    type: "street_pharmacy",
    icon: "💊",
    label: "Street Pharmacy",
    description: "Supply what the city craves.",
    employeeBonus: "+5 max nerve",
  },
  {
    type: "fixer_office",
    icon: "🤝",
    label: "Fixer Office",
    description: "Connect runners with jobs.",
    employeeBonus: "Job DC rewards +10%",
  },
  {
    type: "combat_gym",
    icon: "🥊",
    label: "Combat Gym",
    description: "Train fighters.",
    employeeBonus: "Gym stat gains +10%",
  },
];

function getBusinessDef(type: string) {
  return BUSINESS_TYPES.find((b) => b.type === type) ?? {
    type,
    icon: "🏢",
    label: type,
    description: "",
    employeeBonus: "",
  };
}

// ── Star upgrade costs: 25k * 2^(star-1) ──────────────────────────────────────
function upgradeCost(starLevel: number): number {
  return Math.floor(25000 * Math.pow(2, starLevel - 1));
}

// ── Cooldown component ────────────────────────────────────────────────────────

function Cooldown({ until }: { until: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000));
      setSecs(diff);
    };
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

// ── Progress bar for income accumulation ──────────────────────────────────────

function IncomeProgress({ lastIncomeAt, incomePerHour }: { lastIncomeAt: string; incomePerHour: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const calc = () => {
      const elapsed = Date.now() - new Date(lastIncomeAt).getTime();
      const hourMs = 3_600_000;
      setPct(Math.min(100, (elapsed / hourMs) * 100));
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

// ── Tab button helper ─────────────────────────────────────────────────────────

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function BusinessPage({ user, refreshUser, addToast }: Props) {
  const qc = useQueryClient();
  const [mainTab, setMainTab] = useState<"my-business" | "job-board">("my-business");
  const [bizSubTab, setBizSubTab] = useState<"overview" | "employees" | "settings">("overview");

  // ── Create business form state ─────────────────────────────────────────────
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createWage, setCreateWage] = useState(500);

  // ── Settings form state ───────────────────────────────────────────────────
  const [settingsWage, setSettingsWage] = useState(500);
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(true);

  // ── Data queries ──────────────────────────────────────────────────────────

  const {
    data: myBusiness,
    isLoading: bizLoading,
  } = useQuery<BusinessData | null>({
    queryKey: ["businesses", "mine"],
    queryFn: (): Promise<BusinessData | null> => api.get<BusinessData>("/businesses/mine").catch(() => null),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["businesses", "employees", myBusiness?.id],
    queryFn: (): Promise<Employee[]> => api.get<Employee[]>(`/businesses/${myBusiness!.id}/employees`),
    enabled: !!myBusiness?.id,
  });

  const { data: board = [] } = useQuery<BoardBusiness[]>({
    queryKey: ["businesses", "board"],
    queryFn: () => api.get("/businesses/board"),
    enabled: mainTab === "job-board",
  });

  const { data: myJobs = [] } = useQuery<MyJob[]>({
    queryKey: ["businesses", "my-job"],
    queryFn: () => api.get("/businesses/my-job"),
    enabled: mainTab === "job-board",
  });

  // Sync settings form when business loads
  useEffect(() => {
    if (myBusiness) {
      setSettingsWage(myBusiness.wagePerShift);
      setSettingsDesc(myBusiness.description ?? "");
      setSettingsOpen(myBusiness.isOpen);
    }
  }, [myBusiness]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createBiz = useMutation({
    mutationFn: () =>
      api.post("/businesses", {
        name: createName,
        type: createType,
        description: createDesc,
        wagePerShift: createWage,
      }),
    onSuccess: () => {
      addToast("Business opened!", "success");
      qc.invalidateQueries({ queryKey: ["businesses"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const collectIncome = useMutation({
    mutationFn: () => api.post("/businesses/collect", {}),
    onSuccess: (r: any) => {
      addToast(r.message ?? `Collected ${formatDC(r.collected ?? 0)} DC`, "success");
      qc.invalidateQueries({ queryKey: ["businesses"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const upgradeBiz = useMutation({
    mutationFn: () => api.post("/businesses/upgrade", {}),
    onSuccess: (r: any) => {
      addToast(r.message ?? "Business upgraded!", "success");
      qc.invalidateQueries({ queryKey: ["businesses"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const fireEmployee = useMutation({
    mutationFn: ({ bizId, userId }: { bizId: string; userId: string }) =>
      api.post(`/businesses/${bizId}/fire/${userId}`, {}),
    onSuccess: () => {
      addToast("Employee fired.", "info");
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const approveEmployee = useMutation({
    mutationFn: (userId: string) => api.post(`/businesses/approve/${userId}`, {}),
    onSuccess: () => {
      addToast("Application approved!", "success");
      qc.invalidateQueries({ queryKey: ["businesses"] });
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
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const applyToBusiness = useMutation({
    mutationFn: (businessId: string) => api.post(`/businesses/apply/${businessId}`, {}),
    onSuccess: () => {
      addToast("Application submitted!", "success");
      qc.invalidateQueries({ queryKey: ["businesses", "board"] });
      qc.invalidateQueries({ queryKey: ["businesses", "my-job"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const workShift = useMutation({
    mutationFn: (businessId: string) => api.post(`/businesses/${businessId}/shift`, {}),
    onSuccess: (r: any, businessId) => {
      addToast(r.message ?? `Shift complete! +${formatDC(r.earned ?? 0)} DC`, "success");
      qc.invalidateQueries({ queryKey: ["businesses", "my-job"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const myJobIds = new Set(myJobs.map((j) => j.id));
  const availableBoard = board.filter(
    (b) => b.ownerId !== user.id && !myJobIds.has(b.id) && b.isOpen
  );

  const activeEmployees = employees.filter((e) => e.status === "active");
  const pendingApplications = employees.filter((e) => e.status === "pending");

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderCreateForm() {
    const canCreate = user.level >= 20 && user.dc >= 100_000;
    return (
      <div className="space-y-4">
        <AnimatedCard accent="#a855f7">
          <CyberSectionHeader title="Open a Business" accent="#a855f7" />
          <p className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>
            Requires Level 20 · Costs 100,000 DC
          </p>

          {user.level < 20 && (
            <div
              className="mb-4 p-3 rounded font-mono text-xs"
              style={{ background: "#ff2d5510", border: "1px solid #ff2d5540", color: "#ff2d55" }}
            >
              You need to reach Level 20 to open a business.
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>
                Business Name
              </label>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={50}
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
                    <p
                      className="font-mono text-xs mt-1"
                      style={{ color: "#00d4ff" }}
                    >
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
                rows={3}
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
                Wage Per Shift (100–50,000 DC)
              </label>
              <input
                type="number"
                value={createWage}
                onChange={(e) =>
                  setCreateWage(Math.min(50000, Math.max(100, Number(e.target.value))))
                }
                min={100}
                max={50000}
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
              disabled={!canCreate || !createName.trim() || !createType || createBiz.isPending}
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

  function renderOverview(biz: BusinessData) {
    const def = getBusinessDef(biz.type);
    const nextCost = upgradeCost(biz.starLevel);
    const canUpgrade = biz.starLevel < 10 && user.dc >= nextCost;

    return (
      <div className="space-y-4">
        {/* Business header */}
        <AnimatedCard accent="#f59e0b" noPad>
          <div className="p-4 flex items-center gap-3">
            <span className="text-3xl">{def.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-lg" style={{ color: "#e2e8f0" }}>
                  {biz.name}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded" style={{
                  background: "#f59e0b18",
                  color: "#f59e0b",
                  border: "1px solid #f59e0b40",
                }}>
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
                <div className="font-mono text-xl font-bold" style={{ color: "#39d353" }}>
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
              {biz.incomePerHour.toLocaleString()} DC/hr with {biz.activeEmployeeCount} active employee
              {biz.activeEmployeeCount !== 1 ? "s" : ""}
            </p>
          </div>
        </AnimatedCard>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Star Level", value: `${biz.starLevel}/10`, color: "#f59e0b" },
            { label: "Employees", value: `${biz.activeEmployeeCount}/${biz.maxEmployees}`, color: "#00d4ff" },
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
                  Cost: {nextCost.toLocaleString()} DC
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

        {/* Perk display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { star: 3, label: "3★ Perk", desc: "Unlock premium employee slots (+2 max)", color: "#a855f7" },
            { star: 10, label: "10★ Perk", desc: "Max star empire — +50% income, prestige badge", color: "#f59e0b" },
          ].map((p) => (
            <div
              key={p.star}
              className="p-3 rounded"
              style={{
                background: biz.starLevel >= p.star ? p.color + "10" : "#0a0a0f",
                border: `1px solid ${biz.starLevel >= p.star ? p.color + "40" : "#1e1e2e"}`,
                opacity: biz.starLevel >= p.star ? 1 : 0.5,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold" style={{ color: p.color }}>
                  {p.label}
                </span>
                {biz.starLevel >= p.star ? (
                  <span className="font-mono text-xs" style={{ color: "#39d353" }}>✓ UNLOCKED</span>
                ) : (
                  <span className="font-mono text-xs" style={{ color: "#334155" }}>🔒 LOCKED</span>
                )}
              </div>
              <p className="font-mono text-xs" style={{ color: "#64748b" }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderEmployees(biz: BusinessData) {
    return (
      <div className="space-y-4">
        {/* Active employees */}
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
              No crew yet. Open the job board to get applicants.
            </div>
          ) : (
            <div className="space-y-2">
              {activeEmployees.map((emp) => (
                <div
                  key={emp.userId}
                  className="flex items-center justify-between gap-3 p-3 rounded"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>
                        {emp.username}
                      </span>
                      <span
                        className="font-mono text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "#00d4ff12", color: "#00d4ff", border: "1px solid #00d4ff30" }}
                      >
                        Lv.{emp.level}
                      </span>
                    </div>
                    <div className="flex gap-3 font-mono text-xs mt-1 flex-wrap" style={{ color: "#64748b" }}>
                      <span>{emp.totalShifts} shifts</span>
                      <span style={{ color: "#f59e0b" }}>{formatDC(emp.totalEarned)} DC earned</span>
                      {emp.lastShiftAt && (
                        <span>
                          last shift {new Date(emp.lastShiftAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => fireEmployee.mutate({ bizId: biz.id, userId: emp.userId })}
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
              ))}
            </div>
          )}
        </div>

        {/* Pending applications */}
        {pendingApplications.length > 0 && (
          <div>
            <CyberSectionHeader title={`Pending Applications (${pendingApplications.length})`} accent="#f59e0b" />
            <div className="space-y-2">
              {pendingApplications.map((emp) => (
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
                      style={{ background: "#00d4ff12", color: "#00d4ff", border: "1px solid #00d4ff30" }}
                    >
                      Lv.{emp.level}
                    </span>
                    <span
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "#f59e0b10", color: "#f59e0b", border: "1px solid #f59e0b30" }}
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

  function renderSettings() {
    return (
      <AnimatedCard accent="#ff6b35">
        <CyberSectionHeader title="Business Settings" accent="#ff6b35" />
        <div className="space-y-4">
          {/* Open/Closed toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>
                Open for Applications
              </div>
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                Allow new workers to apply
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
                setSettingsWage(Math.min(50000, Math.max(100, Number(e.target.value))))
              }
              min={100}
              max={50000}
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
    );
  }

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

    const def = getBusinessDef(myBusiness.type);

    return (
      <div className="space-y-4">
        {/* Sub-tab switcher */}
        <div className="flex gap-2 flex-wrap">
          {(["overview", "employees", "settings"] as const).map((tab) => (
            <TabBtn
              key={tab}
              active={bizSubTab === tab}
              onClick={() => setBizSubTab(tab)}
              accent="#f59e0b"
            >
              {tab === "overview" && `📊 Overview`}
              {tab === "employees" && `👥 Crew (${activeEmployees.length})`}
              {tab === "settings" && `⚙️ Settings`}
            </TabBtn>
          ))}
        </div>

        {bizSubTab === "overview" && renderOverview(myBusiness)}
        {bizSubTab === "employees" && renderEmployees(myBusiness)}
        {bizSubTab === "settings" && renderSettings()}
      </div>
    );
  }

  function renderJobBoard() {
    return (
      <div className="space-y-4">
        {/* My current jobs */}
        {myJobs.length > 0 && (
          <div>
            <CyberSectionHeader title="My Jobs" accent="#39d353" />
            <div className="space-y-2">
              {myJobs.map((job) => {
                const def = getBusinessDef(job.type);
                return (
                  <AnimatedCard key={job.id} accent="#39d353" noPad>
                    <div className="p-4 flex items-center gap-3">
                      <span className="text-2xl">{def.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
                            {job.name}
                          </span>
                          <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>
                            {"⭐".repeat(job.starLevel)}
                          </span>
                          <span
                            className="font-mono text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "#00d4ff12", color: "#00d4ff", border: "1px solid #00d4ff30" }}
                          >
                            {def.label}
                          </span>
                        </div>
                        <div className="flex gap-3 font-mono text-xs flex-wrap" style={{ color: "#64748b" }}>
                          <span style={{ color: "#f59e0b" }}>{formatDC(job.wagePerShift)} DC/shift</span>
                          <span>⚡ {job.shiftEnergyCost} energy</span>
                          {job.onCooldown && job.cooldownUntil && (
                            <span>
                              Ready in <Cooldown until={job.cooldownUntil} />
                            </span>
                          )}
                        </div>
                      </div>
                      <CyberButton
                        variant="success"
                        size="sm"
                        disabled={job.onCooldown || workShift.isPending}
                        loading={workShift.isPending}
                        onClick={() => workShift.mutate(job.id)}
                      >
                        {job.onCooldown ? "Cooldown" : "Work Shift"}
                      </CyberButton>
                    </div>
                  </AnimatedCard>
                );
              })}
            </div>
          </div>
        )}

        {/* Available businesses board */}
        <div>
          <CyberSectionHeader
            title={`Available Businesses (${availableBoard.length})`}
            accent="#00d4ff"
          />
          {availableBoard.length === 0 ? (
            <div
              className="p-6 rounded font-mono text-xs text-center"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#334155" }}
            >
              No open positions right now. Check back later.
            </div>
          ) : (
            <div className="space-y-2">
              {availableBoard.map((biz) => {
                const def = getBusinessDef(biz.type);
                const slotsAvail = biz.maxEmployees - biz.activeEmployeeCount;
                return (
                  <AnimatedCard key={biz.id} accent="#00d4ff" noPad>
                    <div className="p-4 flex items-center gap-3">
                      <span className="text-2xl">{def.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
                            {biz.name}
                          </span>
                          <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>
                            {"⭐".repeat(biz.starLevel)}
                          </span>
                        </div>
                        <div className="flex gap-3 font-mono text-xs flex-wrap mb-1" style={{ color: "#64748b" }}>
                          <span>{def.label}</span>
                          <span style={{ color: "#f59e0b" }}>{formatDC(biz.wagePerShift)} DC/shift</span>
                          <span
                            style={{ color: slotsAvail > 0 ? "#39d353" : "#ff2d55" }}
                          >
                            {biz.activeEmployeeCount}/{biz.maxEmployees} slots
                          </span>
                          <span>by {biz.ownerUsername}</span>
                        </div>
                        {/* Employee bonus tag */}
                        {def.employeeBonus && (
                          <span
                            className="inline-block font-mono text-xs px-2 py-0.5 rounded"
                            style={{
                              background: "#00d4ff10",
                              color: "#00d4ff",
                              border: "1px solid #00d4ff30",
                            }}
                          >
                            {def.employeeBonus}
                          </span>
                        )}
                      </div>
                      <CyberButton
                        variant="primary"
                        size="sm"
                        disabled={slotsAvail === 0 || applyToBusiness.isPending}
                        loading={applyToBusiness.isPending}
                        onClick={() => applyToBusiness.mutate(biz.id)}
                      >
                        Apply
                      </CyberButton>
                    </div>
                  </AnimatedCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

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
          Own and operate a player-run business, or find employment in the city's underground economy.
        </p>
      </div>

      {/* Main tab switcher */}
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
          {myJobs.length > 0 && (
            <span
              className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full font-mono text-xs"
              style={{ background: "#39d353", color: "#000", fontSize: "0.6rem" }}
            >
              {myJobs.length}
            </span>
          )}
        </TabBtn>
      </div>

      {/* Tab content */}
      {mainTab === "my-business" && renderMyBusiness()}
      {mainTab === "job-board" && renderJobBoard()}
    </div>
  );
}
