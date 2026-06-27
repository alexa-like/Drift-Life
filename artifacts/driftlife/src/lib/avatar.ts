// Procedural SVG avatar generator
// Same username always produces the same avatar

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed >> offset) % arr.length];
}

const BG_SHAPES = ["circle", "hexagon", "diamond", "square"] as const;
const BG_COLORS = [
  "#00d4ff", "#ff6b35", "#39d353", "#a855f7",
  "#f59e0b", "#ff2d55", "#06b6d4", "#8b5cf6",
  "#10b981", "#f97316", "#3b82f6", "#ec4899",
];
const SKIN_TONES = ["#FDBCB4", "#F1A179", "#D08B5B", "#AE5D29", "#694e35", "#292018"];
const EYE_STYLES = ["rect", "slash", "scanner", "dot"] as const;
const MOUTH_STYLES = ["flat", "smirk", "grill"] as const;
const HAIR_STYLES = ["spikes", "mohawk", "long", "bun", "fade", "dreads", "none"] as const;
const ACCESSORIES = ["glasses", "bandana", "mask", "visor", "none"] as const;

type EyeStyle = typeof EYE_STYLES[number];
type MouthStyle = typeof MOUTH_STYLES[number];
type HairStyle = typeof HAIR_STYLES[number];
type AccessoryStyle = typeof ACCESSORIES[number];

function renderEyes(style: EyeStyle, cx: number, cy: number, color: string): string {
  const lx = cx - 16, rx = cx + 8;
  if (style === "rect") {
    return `<rect x="${lx}" y="${cy}" width="10" height="6" rx="1" fill="${color}"/>
            <rect x="${rx}" y="${cy}" width="10" height="6" rx="1" fill="${color}"/>`;
  }
  if (style === "slash") {
    return `<line x1="${lx}" y1="${cy + 6}" x2="${lx + 10}" y2="${cy}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
            <line x1="${rx}" y1="${cy + 6}" x2="${rx + 10}" y2="${cy}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (style === "scanner") {
    return `<rect x="${lx - 2}" y="${cy - 1}" width="14" height="3" fill="${color}" opacity="0.8"/>
            <rect x="${rx - 2}" y="${cy - 1}" width="14" height="3" fill="${color}" opacity="0.8"/>`;
  }
  // dot
  return `<circle cx="${lx + 5}" cy="${cy + 3}" r="4" fill="${color}"/>
          <circle cx="${rx + 5}" cy="${cy + 3}" r="4" fill="${color}"/>`;
}

function renderMouth(style: MouthStyle, cx: number, cy: number, color: string): string {
  if (style === "flat") {
    return `<line x1="${cx - 12}" y1="${cy}" x2="${cx + 12}" y2="${cy}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  if (style === "smirk") {
    return `<path d="M${cx - 10} ${cy} Q${cx} ${cy + 8} ${cx + 10} ${cy - 4}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  // grill
  return `<rect x="${cx - 12}" y="${cy - 3}" width="24" height="7" rx="2" fill="none" stroke="${color}" stroke-width="1.5"/>
          <line x1="${cx - 6}" y1="${cy - 3}" x2="${cx - 6}" y2="${cy + 4}" stroke="${color}" stroke-width="1"/>
          <line x1="${cx}" y1="${cy - 3}" x2="${cx}" y2="${cy + 4}" stroke="${color}" stroke-width="1"/>
          <line x1="${cx + 6}" y1="${cy - 3}" x2="${cx + 6}" y2="${cy + 4}" stroke="${color}" stroke-width="1"/>`;
}

function renderHair(style: HairStyle, cx: number, cy: number, color: string): string {
  if (style === "none") return "";
  if (style === "spikes") {
    return `<polygon points="${cx - 20},${cy} ${cx - 12},${cy - 22} ${cx - 4},${cy} ${cx + 4},${cy - 22} ${cx + 12},${cy} ${cx + 20},${cy - 22} ${cx + 28},${cy}" fill="${color}"/>`;
  }
  if (style === "mohawk") {
    return `<rect x="${cx - 5}" y="${cy - 30}" width="10" height="30" rx="5" fill="${color}"/>`;
  }
  if (style === "long") {
    return `<rect x="${cx - 22}" y="${cy - 10}" width="44" height="50" rx="6" fill="${color}" opacity="0.9"/>
            <rect x="${cx - 22}" y="${cy - 10}" width="44" height="14" rx="6" fill="${color}"/>`;
  }
  if (style === "bun") {
    return `<rect x="${cx - 22}" y="${cy - 6}" width="44" height="10" rx="5" fill="${color}"/>
            <circle cx="${cx}" cy="${cy - 20}" r="12" fill="${color}"/>`;
  }
  if (style === "fade") {
    return `<rect x="${cx - 22}" y="${cy - 6}" width="44" height="10" rx="5" fill="${color}" opacity="0.5"/>
            <rect x="${cx - 18}" y="${cy - 18}" width="36" height="16" rx="8" fill="${color}"/>`;
  }
  // dreads
  let d = "";
  for (let i = -3; i <= 3; i++) {
    d += `<rect x="${cx + i * 7 - 2}" y="${cy - 8}" width="4" height="${24 + Math.abs(i) * 4}" rx="2" fill="${color}" opacity="0.9"/>`;
  }
  return d;
}

function renderAccessory(style: AccessoryStyle, cx: number, cy: number, color: string): string {
  if (style === "none") return "";
  if (style === "glasses") {
    return `<circle cx="${cx - 12}" cy="${cy + 40}" r="8" fill="none" stroke="${color}" stroke-width="2"/>
            <circle cx="${cx + 12}" cy="${cy + 40}" r="8" fill="none" stroke="${color}" stroke-width="2"/>
            <line x1="${cx - 4}" y1="${cy + 40}" x2="${cx + 4}" y2="${cy + 40}" stroke="${color}" stroke-width="2"/>`;
  }
  if (style === "bandana") {
    return `<rect x="${cx - 22}" y="${cy + 50}" width="44" height="12" rx="4" fill="${color}" opacity="0.8"/>`;
  }
  if (style === "mask") {
    return `<rect x="${cx - 18}" y="${cy + 46}" width="36" height="18" rx="6" fill="${color}" opacity="0.9"/>
            <line x1="${cx - 10}" y1="${cy + 55}" x2="${cx + 10}" y2="${cy + 55}" stroke="#0a0a0f" stroke-width="1.5"/>`;
  }
  // visor
  return `<rect x="${cx - 22}" y="${cy + 34}" width="44" height="10" rx="3" fill="${color}" opacity="0.7"/>
          <rect x="${cx - 22}" y="${cy + 34}" width="44" height="4" rx="3" fill="${color}"/>`;
}

export function generateAvatarSVG(username: string, size = 64): string {
  const seed = hashStr(username || "anon");

  const bgShape = pick(BG_SHAPES, seed, 0);
  const bgColor = pick(BG_COLORS, seed, 3);
  const skinTone = pick(SKIN_TONES, seed, 7);
  const eyeStyle = pick(EYE_STYLES, seed, 11);
  const mouthStyle = pick(MOUTH_STYLES, seed, 15);
  const hairStyle = pick(HAIR_STYLES, seed, 19);
  const accessory = pick(ACCESSORIES, seed, 23);
  const hairColor = pick(["#1a1a2e", "#e2e8f0", "#f59e0b", "#00d4ff", "#ff6b35", "#a855f7", "#39d353", "#ff2d55"], seed, 27);
  const accentColor = pick(BG_COLORS, (seed >> 5), 0);

  const s = 100; // internal viewport
  const cx = 50, cy = 50;

  let bgEl = "";
  if (bgShape === "circle") {
    bgEl = `<circle cx="${cx}" cy="${cy}" r="50" fill="${bgColor}" opacity="0.2"/>`;
  } else if (bgShape === "hexagon") {
    bgEl = `<polygon points="50,0 93,25 93,75 50,100 7,75 7,25" fill="${bgColor}" opacity="0.2"/>`;
  } else if (bgShape === "diamond") {
    bgEl = `<polygon points="50,0 100,50 50,100 0,50" fill="${bgColor}" opacity="0.2"/>`;
  } else {
    bgEl = `<rect x="0" y="0" width="100" height="100" fill="${bgColor}" opacity="0.2"/>`;
  }

  const faceCy = cy - 5;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${size}" height="${size}">
  <rect width="100" height="100" fill="#0a0a0f"/>
  ${bgEl}
  ${renderHair(hairStyle, cx, faceCy - 28, hairColor)}
  <ellipse cx="${cx}" cy="${faceCy + 8}" rx="22" ry="26" fill="${skinTone}"/>
  ${renderEyes(eyeStyle, cx, faceCy - 4, accentColor)}
  ${renderMouth(mouthStyle, cx, faceCy + 14, accentColor)}
  ${renderAccessory(accessory, cx, faceCy - 8, accentColor)}
</svg>`;

  return svg;
}

export function avatarDataUrl(username: string, size = 64): string {
  const svg = generateAvatarSVG(username, size);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
