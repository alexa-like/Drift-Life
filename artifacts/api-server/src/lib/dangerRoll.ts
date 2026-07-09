/**
 * Danger Roll — fires when a player arrives in a foreign district.
 * Handles mugging and hospital events based on district risk profiles.
 */
import { IUser } from "../models/User";

interface DistrictRisk {
  mugChance: number;
  hospitalChance: number;
  mugLossMin: number;  // fraction of dc
  mugLossMax: number;
  hospitalMin: number; // minutes
  hospitalMax: number;
}

const DISTRICT_RISKS: Record<string, DistrictRisk> = {
  neon_strip:  { mugChance: 0.05, hospitalChance: 0.02, mugLossMin: 0.05, mugLossMax: 0.10, hospitalMin: 5,  hospitalMax: 10 },
  docks:       { mugChance: 0.10, hospitalChance: 0.05, mugLossMin: 0.08, mugLossMax: 0.15, hospitalMin: 10, hospitalMax: 20 },
  slums:       { mugChance: 0.20, hospitalChance: 0.10, mugLossMin: 0.10, mugLossMax: 0.20, hospitalMin: 15, hospitalMax: 30 },
  corp_zone:   { mugChance: 0.08, hospitalChance: 0.06, mugLossMin: 0.10, mugLossMax: 0.18, hospitalMin: 12, hospitalMax: 25 },
  industrial:  { mugChance: 0.18, hospitalChance: 0.12, mugLossMin: 0.12, mugLossMax: 0.22, hospitalMin: 20, hospitalMax: 40 },
  outskirts:   { mugChance: 0.30, hospitalChance: 0.20, mugLossMin: 0.15, mugLossMax: 0.30, hospitalMin: 30, hospitalMax: 60 },
};

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Performs a danger roll for a user who just arrived in their currentLocation district.
 * Mutates the user document and saves it.
 */
export async function performDangerRoll(user: IUser): Promise<{ mugged?: boolean; hospitalized?: boolean; dcLost?: number; hospitalMinutes?: number }> {
  const risk = DISTRICT_RISKS[user.currentLocation];
  if (!risk) return {}; // downtown or unknown — no danger

  const now = Date.now();

  // Mugging cooldown: if mugged in last 24h, halve both chances
  const cooldownActive = user.lastMuggedAt
    ? (now - user.lastMuggedAt.getTime()) < 24 * 60 * 60 * 1000
    : false;
  const mugChance      = cooldownActive ? risk.mugChance      * 0.5 : risk.mugChance;
  const hospitalChance = cooldownActive ? risk.hospitalChance * 0.5 : risk.hospitalChance;

  let mugged       = false;
  let hospitalized = false;
  let dcLost       = 0;
  let hospitalMinutes = 0;

  // Hospital check first (independent of mugging)
  if (Math.random() < hospitalChance) {
    hospitalMinutes = Math.round(rand(risk.hospitalMin, risk.hospitalMax));
    user.hospitalizedUntil = new Date(now + hospitalMinutes * 60 * 1000);
    user.status = 'hospitalized';
    hospitalized = true;
  }

  // Mugging check
  if (Math.random() < mugChance) {
    const lossFrac = rand(risk.mugLossMin, risk.mugLossMax);
    dcLost = Math.floor(user.dc * lossFrac);
    user.dc = Math.max(0, user.dc - dcLost);
    user.lastMuggedAt = new Date(now);
    mugged = true;
  }

  if (mugged || hospitalized) {
    await user.save();
  }

  return { mugged, hospitalized, dcLost: mugged ? dcLost : undefined, hospitalMinutes: hospitalized ? hospitalMinutes : undefined };
}
