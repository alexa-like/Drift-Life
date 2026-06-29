/** Format a large number as an abbreviated string: 1k, 1.2m, 5b, 1.2t, etc. */
export function formatDC(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "0";
  const capped = Math.min(Math.max(n, -1e18), 1e18);
  const abs = Math.abs(capped);
  const sign = capped < 0 ? "-" : "";
  let val: number, suffix: string;
  if (abs >= 1e18)      { val = abs / 1e18; suffix = "E"; }
  else if (abs >= 1e15) { val = abs / 1e15; suffix = "q"; }
  else if (abs >= 1e12) { val = abs / 1e12; suffix = "t"; }
  else if (abs >= 1e9)  { val = abs / 1e9;  suffix = "b"; }
  else if (abs >= 1e6)  { val = abs / 1e6;  suffix = "m"; }
  else if (abs >= 1e3)  { val = abs / 1e3;  suffix = "k"; }
  else { return sign + Math.round(abs).toLocaleString(); }
  const str = val >= 100 ? Math.round(val).toString()
             : val >= 10  ? val.toFixed(1).replace(/\.0$/, "")
             :               val.toFixed(2).replace(/\.?0+$/, "");
  return sign + str + suffix;
}
