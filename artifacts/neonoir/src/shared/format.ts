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
  else {
    // Fast path: avoid expensive Intl/toLocaleString overhead for small numbers
    const rounded = Math.round(abs);
    return rounded >= 1000 ? sign + "1k" : sign + rounded.toString();
  }

  // Fast string truncation instead of regex replacements
  let str: string;
  if (val >= 100) {
    str = Math.round(val).toString();
  } else if (val >= 10) {
    const fixed = val.toFixed(1);
    str = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
  } else {
    const fixed = val.toFixed(2);
    if (fixed.endsWith(".00")) {
      str = fixed.slice(0, -3);
    } else if (fixed.endsWith("0")) {
      str = fixed.slice(0, -1);
    } else {
      str = fixed;
    }
  }

  return sign + str + suffix;
}
