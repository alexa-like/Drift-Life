import User, { IUser } from "../models/User";

const ENERGY_PER_MIN = 5;
const NERVE_PER_MIN = 3;

export function applyRegen(user: IUser): void {
  const now = new Date();

  const energyMinutes = (now.getTime() - user.lastEnergyRegen.getTime()) / 60000;
  if (energyMinutes >= 1 && user.energy < user.maxEnergy) {
    const gained = Math.floor(energyMinutes) * ENERGY_PER_MIN;
    user.energy = Math.min(user.maxEnergy, user.energy + gained);
    user.lastEnergyRegen = now;
  }

  const nerveMinutes = (now.getTime() - user.lastNerveRegen.getTime()) / 60000;
  if (nerveMinutes >= 1 && user.nerve < user.maxNerve) {
    const gained = Math.floor(nerveMinutes) * NERVE_PER_MIN;
    user.nerve = Math.min(user.maxNerve, user.nerve + gained);
    user.lastNerveRegen = now;
  }
}

export async function applyRegenAndSave(user: IUser): Promise<void> {
  applyRegen(user);
  await user.save();
}

export function isHospitalized(user: IUser): boolean {
  return user.hospitalizedUntil !== null && user.hospitalizedUntil > new Date();
}

export function isJailed(user: IUser): boolean {
  return user.jailUntil !== null && user.jailUntil > new Date();
}

export function hospitalTimeRemaining(user: IUser): number {
  if (!isHospitalized(user)) return 0;
  return Math.ceil((user.hospitalizedUntil!.getTime() - Date.now()) / 1000);
}

export function levelUp(user: IUser): boolean {
  const { xpForLevel } = require("../models/User");
  let leveled = false;
  while (user.xp >= user.xpToNext) {
    user.xp -= user.xpToNext;
    user.level += 1;
    user.xpToNext = xpForLevel(user.level + 1);
    user.maxHealth = Math.floor(100 + user.level * 5);
    user.health = user.maxHealth;
    user.maxEnergy = Math.floor(100 + user.level * 2);
    user.maxNerve = Math.floor(50 + user.level);
    leveled = true;
  }
  return leveled;
}
