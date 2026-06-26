import { useState, useEffect } from "react";
import { User, Job } from "../lib/types";
import { api } from "../lib/api";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function JobsPage({ user, refreshUser, addToast }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    api.get<Job[]>("/jobs").then(setJobs).catch(() => {});
  }, []);

  async function work(jobId: string) {
    setWorking(jobId);
    setLastResult(null);
    try {
      const data = await api.post<any>(`/jobs/${jobId}/work`);
      setLastResult(data);
      addToast(`Earned ${data.dcGained} DC${data.leveled ? ` + LEVEL UP!` : ""}`, "success");
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setWorking(null);
    }
  }

  const isHospitalized = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#39d353" }}>Jobs</h2>
        <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>
          Energy: <strong style={{ color: "#00d4ff" }}>{user.energy}/{user.maxEnergy}</strong>
        </span>
      </div>

      {(isHospitalized || isJailed) && (
        <div className="p-3 rounded text-sm font-mono" style={{
          background: "#ff2d5510", border: "1px solid #ff2d5540", color: "#ff2d55"
        }}>
          {isHospitalized ? "Hospitalized — cannot work." : "Jailed — cannot work."}
        </div>
      )}

      {lastResult && (
        <div className="p-4 rounded-lg font-mono" style={{ background: "#39d35310", border: "1px solid #39d35340" }}>
          <div className="text-sm font-bold mb-1" style={{ color: "#39d353" }}>Job Complete</div>
          <div className="flex gap-4 text-xs">
            <span style={{ color: "#f59e0b" }}>+{lastResult.dcGained} DC</span>
            <span style={{ color: "#a855f7" }}>+{lastResult.xpGained} XP</span>
            {lastResult.leveled && <span style={{ color: "#00d4ff" }}>LEVEL UP! Lv.{lastResult.newLevel}</span>}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {jobs.map(job => {
          const canAfford = user.energy >= job.energyCost;
          const meetsLevel = user.level >= job.minLevel;
          const available = canAfford && meetsLevel && !isHospitalized && !isJailed;

          return (
            <div
              key={job.id}
              className="rounded-lg p-4 flex items-center gap-4"
              style={{
                background: "#111118",
                border: "1px solid #1e1e2e",
                opacity: meetsLevel ? 1 : 0.5,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{job.name}</span>
                  {!meetsLevel && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "#ff2d5510", color: "#ff2d55" }}>
                      Lv.{job.minLevel}
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono mb-2" style={{ color: "#475569" }}>{job.description}</p>
                <div className="flex gap-4 text-xs font-mono flex-wrap">
                  <span style={{ color: "#00d4ff" }}>Energy: {job.energyCost}</span>
                  <span style={{ color: "#f59e0b" }}>DC: {job.dcMin}-{job.dcMax}</span>
                  <span style={{ color: "#a855f7" }}>XP: +{job.xp}</span>
                </div>
              </div>
              <button
                onClick={() => work(job.id)}
                disabled={!available || !!working}
                className="px-4 py-2 rounded text-xs font-mono font-bold uppercase flex-shrink-0 transition-all"
                style={{
                  background: available ? "#39d35318" : "#1e1e2e",
                  color: available ? "#39d353" : "#475569",
                  border: `1px solid ${available ? "#39d35340" : "#1e1e2e"}`,
                }}
              >
                {working === job.id ? "..." : "Work"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
