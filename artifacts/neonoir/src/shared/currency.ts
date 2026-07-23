import { DL } from "./theme";
import { formatDC } from "./format";

/** Format NC (NeonCoin) — same abbreviation logic as DC */
export function formatNC(n: number): string {
  return formatDC(n);
}

/** Format a currency amount by type */
export function formatCurrency(n: number, type: string): string {
  return formatDC(n);
}

export const CURRENCY_LABELS: Record<string, string> = {
  dc:        "DC",
  nc:        "NC",
  bank:      "Bank",
  keys:      "Keys",
  keyShards: "Shards",
  merit:     "Merit",
  spinTokens:"Spins",
  credits:   "Credits",
  sim:       "SIM",
} as const;

export const CURRENCY_COLORS: Record<string, string> = {
  dc:        DL.gold,
  nc:        DL.purple,
  bank:      "#10b981",
  keys:      DL.cyan,
  keyShards: DL.dim,
  merit:     "#f43f5e",
  spinTokens:"#8b5cf6",
  credits:   DL.muted,
  sim:       DL.green,
} as const;
