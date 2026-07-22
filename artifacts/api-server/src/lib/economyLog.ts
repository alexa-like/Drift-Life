/**
 * Lightweight helper — fire-and-forget logging of DC/NC flows.
 * Never throws; failures are silently ignored to avoid affecting game routes.
 */
import EconomyLog from "../models/EconomyLog";

type FlowType = "dc_in" | "dc_out" | "nc_in" | "nc_out";

export function logEconomy(
  type: FlowType,
  amount: number,
  source: string,
  opts?: { userId?: string; username?: string },
): void {
  if (amount <= 0) return;
  EconomyLog.create({
    type,
    amount,
    source,
    userId:   opts?.userId   ?? undefined,
    username: opts?.username ?? undefined,
  }).catch(() => {/* non-fatal */});
}
