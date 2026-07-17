// Gang upgrade catalog — static definitions only, no DB model needed.
// Purchased upgrades are stored as strings on the Guild document.

export interface IGangUpgradeDef {
  id: string;
  name: string;
  description: string;
  effect: string;
  tier: 1 | 2 | 3;           // visual tier (T1 cheapest, T3 most expensive)
  cost: number;               // DC from guild treasury
  requiredGuildLevel: number;
  maxPurchases: number;       // 1 = one-time, 2+ = stackable (id stored as "id_2", "id_3", etc.)
  category: "crime" | "combat" | "economy" | "social" | "capacity";
}

export const GANG_UPGRADES: IGangUpgradeDef[] = [
  // ── CAPACITY ────────────────────────────────────────────────────────────────
  { id: "expand_roster_1",  name: "Expand Roster I",   description: "Increase max gang members by 5.", effect: "+5 max members",              tier: 1, cost: 75_000,  requiredGuildLevel: 1, maxPurchases: 1, category: "capacity" },
  { id: "expand_roster_2",  name: "Expand Roster II",  description: "Increase max gang members by 10.", effect: "+10 max members",            tier: 2, cost: 300_000, requiredGuildLevel: 2, maxPurchases: 1, category: "capacity" },
  { id: "expand_roster_3",  name: "Expand Roster III", description: "Increase max gang members by 15.", effect: "+15 max members",            tier: 3, cost: 1_000_000, requiredGuildLevel: 4, maxPurchases: 1, category: "capacity" },

  // ── CRIME ───────────────────────────────────────────────────────────────────
  { id: "street_connect_1", name: "Street Connections I",   description: "All members earn +5% more DC from crimes.",  effect: "+5% crime DC",  tier: 1, cost: 100_000, requiredGuildLevel: 1, maxPurchases: 1, category: "crime" },
  { id: "street_connect_2", name: "Street Connections II",  description: "All members earn +10% more DC from crimes.", effect: "+10% crime DC", tier: 2, cost: 500_000, requiredGuildLevel: 2, maxPurchases: 1, category: "crime" },
  { id: "street_connect_3", name: "Street Connections III", description: "All members earn +15% more DC from crimes.", effect: "+15% crime DC", tier: 3, cost: 2_000_000, requiredGuildLevel: 4, maxPurchases: 1, category: "crime" },
  { id: "gang_crime_speed", name: "Efficient Operations",   description: "Gang crime durations reduced by 20%.",       effect: "-20% gang crime duration", tier: 2, cost: 750_000, requiredGuildLevel: 3, maxPurchases: 1, category: "crime" },

  // ── COMBAT ──────────────────────────────────────────────────────────────────
  { id: "safe_house",     name: "Safe House",      description: "Members leave hospital 20% faster.",             effect: "Hospital -20%",         tier: 1, cost: 250_000, requiredGuildLevel: 1, maxPurchases: 1, category: "combat" },
  { id: "armory",         name: "Armory",          description: "Members get 10% discount at NPC weapon stores.", effect: "NPC store -10%",         tier: 2, cost: 500_000, requiredGuildLevel: 2, maxPurchases: 1, category: "combat" },
  { id: "war_fund",       name: "War Fund",        description: "+10% DC rewards when winning gang wars.",        effect: "+10% war DC",            tier: 2, cost: 750_000, requiredGuildLevel: 2, maxPurchases: 1, category: "combat" },
  { id: "turf_claim",     name: "Turf Operations", description: "Enables your gang to claim and hold districts.", effect: "Unlock turf control",    tier: 3, cost: 1_000_000, requiredGuildLevel: 3, maxPurchases: 1, category: "combat" },

  // ── ECONOMY ─────────────────────────────────────────────────────────────────
  { id: "laundering_1",   name: "Laundering Network I",  description: "Dirty DC converts to clean DC 25% faster.",  effect: "Launder +25%",      tier: 1, cost: 200_000, requiredGuildLevel: 1, maxPurchases: 1, category: "economy" },
  { id: "laundering_2",   name: "Laundering Network II", description: "Dirty DC converts to clean DC 50% faster.",  effect: "Launder +50%",      tier: 2, cost: 800_000, requiredGuildLevel: 3, maxPurchases: 1, category: "economy" },
  { id: "treasury_bonus", name: "Treasury Interest",     description: "Gang treasury earns 1% interest per day.",   effect: "1%/day treasury interest", tier: 3, cost: 2_000_000, requiredGuildLevel: 4, maxPurchases: 1, category: "economy" },
];
