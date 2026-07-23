/**
 * MentorPage — Tier 9.3
 * Mentor system: register, find, request, accept, rate, and end mentorships.
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "../shared/api";
import { User } from "../shared/types";
import { CyberSectionHeader } from "../shared/components/CyberSectionHeader";
import { CyberButton } from "../shared/components/CyberButton";
import { AnimatedCard } from "../shared/components/AnimatedCard";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface MentorStatus {
  isMentor: boolean;
  canRegister: boolean;
  mentor: { id: string; username: string; level: number; rating: number } | null;
  mentees: { id: string; username: string; level: number }[];
  rating: number;
  ratingCount: number;
  xpBonusActive: boolean;
}

interface AvailableMentor {
  id: string;
  username: string;
  level: number;
  rating: number;
  ratingCount: number;
  activeMentees: number;
  availableSlots: number;
  faction: string | null;
  district: string;
}

export default function MentorPage({ user, refreshUser, addToast }: Props) {
  const [status, setStatus] = useState<MentorStatus | null>(null);
  const [available, setAvailable] = useState<AvailableMentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [endMenteeId, setEndMenteeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, av] = await Promise.all([
        api.get<MentorStatus>("/mentor/status"),
        api.get<AvailableMentor[]>("/mentor/available").catch(() => []),
      ]);
      setStatus(st);
      setAvailable((av as AvailableMentor[]).filter(m => m.availableSlots > 0));
    } catch (err: any) {
      addToast(err.message || "Failed to load mentor data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRegister() {
    setRegistering(true);
    try {
      const data = await api.post<any>("/mentor/register", {});
      addToast(data.message, "success");
      await refreshUser();
      await load();
    } catch (err: any) {
      addToast(err.message || "Registration failed", "error");
    } finally {
      setRegistering(false);
    }
  }

  async function handleRequest(mentorId: string) {
    setRequesting(mentorId);
    try {
      const data = await api.post<any>(`/mentor/request/${mentorId}`, {});
      addToast(data.message, "success");
    } catch (err: any) {
      addToast(err.message || "Request failed", "error");
    } finally {
      setRequesting(null);
    }
  }

  async function handleEnd(menteeId?: string) {
    setEnding(true);
    try {
      const data = await api.post<any>("/mentor/end", menteeId ? { menteeId } : {});
      addToast(data.message, "success");
      await refreshUser();
      await load();
    } catch (err: any) {
      addToast(err.message || "Failed to end mentorship", "error");
    } finally {
      setEnding(false);
      setEndMenteeId(null);
    }
  }

  async function handleRate(mentorId: string) {
    if (!rating) return addToast("Select a rating first", "warning");
    setSubmittingRating(true);
    try {
      const data = await api.post<any>(`/mentor/rate/${mentorId}`, { rating });
      addToast(data.message, "success");
      await load();
    } catch (err: any) {
      addToast(err.message || "Rating failed", "error");
    } finally {
      setSubmittingRating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-[#111118] rounded-lg" />)}
        </div>
      </div>
    );
  }

  const hasMentor = !!status?.mentor;
  const isMentor = !!status?.isMentor;
  const hasMentees = (status?.mentees ?? []).length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5 relative z-10">
      <div className="dl-page-bg" style={{ background: "radial-gradient(circle at center, #0a0a1a 0%, #08080c 100%)" }} />

      <CyberSectionHeader title="MENTOR NETWORK" accent="#a855f7" cursor />

      {/* XP Bonus Banner */}
      {status?.xpBonusActive && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg border border-purple-800/60 bg-purple-950/30 font-mono text-sm"
          style={{ color: "#c084fc" }}
        >
          🎓 <span className="font-bold">+15% Battle Pass XP</span> active — mentorship bonus applied to all actions.
        </motion.div>
      )}

      {/* Current Mentorship Status */}
      {hasMentor && (
        <div className="space-y-3">
          <CyberSectionHeader title="YOUR MENTOR" accent="#a855f7" />
          <AnimatedCard accent="#a855f7">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-900/40 border border-purple-700 flex items-center justify-center text-xl">
                🎓
              </div>
              <div className="flex-1">
                <div className="font-mono font-bold text-slate-200">{status.mentor!.username}</div>
                <div className="font-mono text-xs text-slate-400">
                  Level {status.mentor!.level} · Rating {status.mentor!.rating.toFixed(1)}/5 ⭐
                </div>
              </div>
              <CyberButton
                variant="ghost"
                size="sm"
                loading={ending}
                onClick={() => handleEnd()}
              >
                End Mentorship
              </CyberButton>
            </div>

            {/* Rate mentor */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="font-mono text-xs text-slate-500 mb-2">RATE YOUR MENTOR</div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="text-2xl transition-transform hover:scale-110"
                    style={{ opacity: star <= rating ? 1 : 0.3 }}
                  >
                    ⭐
                  </button>
                ))}
                <CyberButton
                  variant="primary"
                  size="sm"
                  loading={submittingRating}
                  disabled={!rating || submittingRating}
                  onClick={() => handleRate(status.mentor!.id)}
                >
                  Submit
                </CyberButton>
              </div>
            </div>
          </AnimatedCard>
        </div>
      )}

      {/* My Mentees (if I'm a mentor) */}
      {isMentor && (
        <div className="space-y-3">
          <CyberSectionHeader title={`MY MENTEES (${(status?.mentees ?? []).length}/3)`} accent="#00d4ff" />
          {hasMentees ? (
            <div className="space-y-2">
              {(status?.mentees ?? []).map(mentee => (
                <AnimatedCard key={mentee.id} noPad>
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-900/30 border border-cyan-800 flex items-center justify-center text-sm">
                      👤
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-sm text-slate-200">{mentee.username}</div>
                      <div className="font-mono text-xs text-slate-500">Level {mentee.level}</div>
                    </div>
                    <CyberButton
                      variant="ghost"
                      size="sm"
                      loading={ending && endMenteeId === mentee.id}
                      onClick={() => { setEndMenteeId(mentee.id); handleEnd(mentee.id); }}
                    >
                      Release
                    </CyberButton>
                  </div>
                </AnimatedCard>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center border border-dashed border-slate-800 rounded-lg font-mono text-xs text-slate-600">
              No mentees yet. Players can request you from the mentor list below.
            </div>
          )}

          {/* Mentor stats */}
          <AnimatedCard noPad>
            <div className="p-4 flex items-center gap-6 font-mono">
              <div className="text-center">
                <div className="text-xl font-bold text-purple-400">{status?.rating?.toFixed(1) ?? "—"}</div>
                <div className="text-[10px] text-slate-500">RATING</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-slate-200">{status?.ratingCount ?? 0}</div>
                <div className="text-[10px] text-slate-500">REVIEWS</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-cyan-400">{(status?.mentees ?? []).length}</div>
                <div className="text-[10px] text-slate-500">ACTIVE MENTEES</div>
              </div>
            </div>
          </AnimatedCard>
        </div>
      )}

      {/* Register as Mentor */}
      {!isMentor && !hasMentor && (
        <div className="space-y-3">
          <CyberSectionHeader title="BECOME A MENTOR" accent="#39d353" />
          <AnimatedCard>
            <div className="space-y-3">
              <p className="font-mono text-xs text-slate-400">
                Registered mentors can guide up to 3 new players. Both mentor and mentee earn <span className="text-purple-400 font-bold">+15% Battle Pass XP</span> on all actions. Mentors also earn DC bonuses when mentees hit Level 10, 20, and 30.
              </p>
              <div className="flex items-center gap-4 font-mono text-xs">
                <div className="text-slate-500">Requires: <span className={user.level >= 20 ? "text-green-400" : "text-red-400"}>Level 20+</span></div>
                <div className="text-slate-500">You: <span className="text-slate-200">Level {user.level}</span></div>
              </div>
              {status?.canRegister ? (
                <CyberButton
                  variant="primary"
                  size="sm"
                  loading={registering}
                  onClick={handleRegister}
                  className="w-full"
                >
                  🎓 REGISTER AS MENTOR
                </CyberButton>
              ) : (
                <div className="p-3 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-500">
                  {user.level < 20
                    ? `Reach Level 20 to register as a mentor (${20 - user.level} levels away).`
                    : hasMentor
                      ? "End your current mentorship before registering as a mentor."
                      : "You are already registered as a mentor."}
                </div>
              )}
            </div>
          </AnimatedCard>
        </div>
      )}

      {/* Available Mentors */}
      {!hasMentor && !isMentor && available.length > 0 && (
        <div className="space-y-3">
          <CyberSectionHeader title="AVAILABLE MENTORS" accent="#f59e0b" />
          <p className="font-mono text-xs text-slate-500 px-1">
            Request a mentor — they'll be notified and can accept you. Both of you get +15% Battle Pass XP while mentorship is active.
          </p>
          <div className="space-y-2">
            {available.map(mentor => (
              <AnimatedCard key={mentor.id} noPad accent="#f59e0b">
                <div className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-full bg-amber-900/20 border border-amber-800/40 flex items-center justify-center text-lg flex-shrink-0">
                    🎓
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-slate-200">{mentor.username}</span>
                      <span className="font-mono text-xs text-slate-500">Lv.{mentor.level}</span>
                      {mentor.faction && (
                        <span className="font-mono text-xs text-slate-600">[{mentor.faction}]</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 font-mono text-xs text-slate-500">
                      <span>⭐ {mentor.rating.toFixed(1)} ({mentor.ratingCount} reviews)</span>
                      <span>Slots: {mentor.availableSlots}/3</span>
                    </div>
                  </div>
                  <CyberButton
                    variant="primary"
                    size="sm"
                    loading={requesting === mentor.id}
                    disabled={!!requesting}
                    onClick={() => handleRequest(mentor.id)}
                  >
                    Request
                  </CyberButton>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      )}

      {!hasMentor && !isMentor && available.length === 0 && !loading && (
        <div className="space-y-3">
          <CyberSectionHeader title="AVAILABLE MENTORS" accent="#475569" />
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg font-mono text-xs text-slate-600">
            No mentors with open slots right now. Check back later or become a mentor yourself.
          </div>
        </div>
      )}

      {/* Info footer */}
      <AnimatedCard noPad>
        <div className="p-4 space-y-2">
          <div className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">Mentor Milestone Bonuses</div>
          <div className="space-y-1 font-mono text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Mentee reaches Level 10</span>
              <span className="text-amber-400">+500 DC to mentor</span>
            </div>
            <div className="flex justify-between">
              <span>Mentee reaches Level 20</span>
              <span className="text-amber-400">+1,000 DC to mentor</span>
            </div>
            <div className="flex justify-between">
              <span>Mentee reaches Level 30</span>
              <span className="text-amber-400">+2,000 DC to mentor</span>
            </div>
          </div>
        </div>
      </AnimatedCard>
    </div>
  );
}
