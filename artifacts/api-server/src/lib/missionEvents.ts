/**
 * missionEvents — shared mission catalog + event firing utility.
 * Import fireMissionEvent from here in any route that produces mission-trackable actions.
 * This avoids HTTP round-trips and circular imports.
 */
import User from "../models/User";
import { logger } from "./logger";

export interface MissionDef {
  id:          string;
  label:       string;
  description: string;
  type:        string;
  target:      number;
  rewards:     { dc: number; xp: number; keyShards: number };
}

export const MISSION_CATALOG: MissionDef[] = [
  // Combat
  { id: "win_2_combat",     label: "Fighter",       description: "Win 2 combat matches",            type: "combat_win",  target: 2,   rewards: { dc: 200,  xp: 300,  keyShards: 0 } },
  { id: "play_5_combat",    label: "Brawler",        description: "Play 5 combat matches",            type: "combat_play", target: 5,   rewards: { dc: 150,  xp: 200,  keyShards: 0 } },
  { id: "use_consumable",   label: "Medic",          description: "Use a consumable in combat",        type: "consumable",  target: 1,   rewards: { dc: 100,  xp: 150,  keyShards: 1 } },
  // Racing
  { id: "complete_3_races", label: "Racer",          description: "Complete 3 races",                  type: "race_play",   target: 3,   rewards: { dc: 200,  xp: 250,  keyShards: 0 } },
  { id: "win_race",         label: "Pole Position",  description: "Finish 1st in a race",              type: "race_win",    target: 1,   rewards: { dc: 300,  xp: 400,  keyShards: 1 } },
  { id: "nitro_10",         label: "Full Throttle",  description: "Use nitro 10 times across races",   type: "nitro_use",   target: 10,  rewards: { dc: 150,  xp: 200,  keyShards: 0 } },
  // Royale
  { id: "open_1_spin",      label: "Gambler",        description: "Open 1 royale spin",                type: "royale_spin", target: 1,   rewards: { dc: 100,  xp: 120,  keyShards: 0 } },
  { id: "open_5_spins",     label: "High Roller",    description: "Open 5 royale spins",               type: "royale_spin", target: 5,   rewards: { dc: 400,  xp: 500,  keyShards: 1 } },
  // General
  { id: "login_today",      label: "Present",        description: "Log in today",                      type: "login",       target: 1,   rewards: { dc: 50,   xp: 50,   keyShards: 0 } },
  { id: "earn_500_dc",      label: "Money Moves",    description: "Earn 500 DC from matches",           type: "dc_earned",   target: 500, rewards: { dc: 250,  xp: 300,  keyShards: 0 } },
  { id: "daily_nc",         label: "Subscriber",     description: "Claim daily NC (subscribers only)", type: "nc_claim",    target: 1,   rewards: { dc: 100,  xp: 100,  keyShards: 0 } },
  { id: "complete_5_crimes",label: "Operator",       description: "Complete 5 crime attempts",          type: "crime_play",  target: 5,   rewards: { dc: 150,  xp: 200,  keyShards: 0 } },
];

function getTodayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function getTodaySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export function getDailyMissions(seed: number): MissionDef[] {
  const shuffled = [...MISSION_CATALOG];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed * (i + 1) * 1_234_567) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 6);
}

/**
 * Fire a mission progress event for a player.
 * Silently ignores errors — mission events are non-fatal.
 */
export async function fireMissionEvent(userId: string, type: string, amount = 1): Promise<void> {
  try {
    const todayKey = getTodayKey();
    const missions = getDailyMissions(getTodaySeed());

    const user = await User.findById(userId);
    if (!user) return;

    const storedKey = (user as any).dailyMissionDate as string | undefined;
    let progress: Record<string, any> = {};
    if (storedKey !== todayKey) {
      progress = {};
      (user as any).dailyMissionDate = todayKey;
    } else {
      progress = (user as any).dailyMissionProgress ?? {};
    }

    let changed = false;
    for (const m of missions) {
      if (m.type !== type) continue;
      if (progress[m.id]?.completed) continue;
      const current = progress[m.id]?.progress ?? 0;
      const newProg = Math.min(m.target, current + amount);
      progress[m.id] = {
        progress: newProg,
        completed: newProg >= m.target,
        claimedAt: progress[m.id]?.claimedAt ?? null,
      };
      changed = true;
    }

    if (changed) {
      (user as any).dailyMissionProgress = progress;
      await user.save();
    }
  } catch (err) {
    logger.warn({ err, userId, type }, "fireMissionEvent failed (non-fatal)");
  }
}
