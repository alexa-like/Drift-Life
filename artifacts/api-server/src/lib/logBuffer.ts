/**
 * In-memory circular log buffer — last 500 lines.
 * Feed entries via pushLog(); Vanta reads via getRecentLogs().
 */

const MAX = 500;
const buffer: { ts: string; level: string; msg: string; extra?: string }[] = [];

export function pushLog(level: string, msg: string, extra?: string) {
  buffer.push({ ts: new Date().toISOString(), level, msg, extra });
  if (buffer.length > MAX) buffer.shift();
}

export function getRecentLogs(lines = 100, filter?: string): string {
  const slice = buffer.slice(-Math.min(lines, MAX));
  const filtered = filter
    ? slice.filter(
        (e) =>
          e.msg.toLowerCase().includes(filter.toLowerCase()) ||
          (e.extra ?? "").toLowerCase().includes(filter.toLowerCase())
      )
    : slice;
  return filtered
    .map((e) => `[${e.ts}] ${e.level.toUpperCase()} ${e.msg}${e.extra ? " | " + e.extra : ""}`)
    .join("\n");
}
