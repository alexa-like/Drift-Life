/** Neonoir design tokens — JS side. Always prefer CSS variables in components;
 *  use these only for canvas/svg or places where inline style strings are required. */

export const DL = {
  // Surfaces
  bg:        "#0a0a0f",
  surface:   "#111118",
  surface2:  "#16161f",
  border:    "#1e1e2e",
  borderHi:  "#2a2a3e",

  // Accents
  cyan:      "#00d4ff",
  orange:    "#ff6b35",
  red:       "#ff2d55",
  green:     "#39d353",
  purple:    "#a855f7",
  gold:      "#f59e0b",

  // Text
  text:      "#e2e8f0",
  muted:     "#94a3b8",
  dim:       "#475569",
} as const;

export const GLOWS = {
  cyan:   "0 0 8px #00d4ff, 0 0 24px #00d4ff40",
  red:    "0 0 8px #ff2d55, 0 0 24px #ff2d5540",
  green:  "0 0 8px #39d353, 0 0 24px #39d35340",
  orange: "0 0 8px #ff6b35, 0 0 24px #ff6b3540",
  gold:   "0 0 8px #f59e0b, 0 0 24px #f59e0b40",
  purple: "0 0 8px #a855f7, 0 0 24px #a855f740",
} as const;

export type AccentColor = keyof typeof GLOWS;
