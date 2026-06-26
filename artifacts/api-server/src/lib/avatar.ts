function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const BG_COLORS = [
  "#0d1b2a","#1a1a2e","#16213e","#0f3460","#1b2838",
  "#0a0a0f","#111118","#1e0a30","#0d2137","#12201a",
  "#1f0a0a","#0a1f0a",
];
const SHAPE = ["circle","diamond","hexagon","square"];
const EYE_COLORS = ["#00d4ff","#ff2d55","#39d353","#a855f7","#f59e0b","#ff6b35","#ffffff"];
const SKIN_TONES = ["#8d5524","#c68642","#e0ac69","#f1c27d","#ffdbac","#a0522d"];
const ACCENT_COLORS = ["#00d4ff","#ff2d55","#39d353","#a855f7","#f59e0b","#ff6b35"];

export function generateAvatarSVG(username: string): string {
  const seed = hashStr(username);
  const bg = BG_COLORS[seed % BG_COLORS.length];
  const shape = SHAPE[(seed >> 4) % SHAPE.length];
  const eyeColor = EYE_COLORS[(seed >> 8) % EYE_COLORS.length];
  const skin = SKIN_TONES[(seed >> 12) % SKIN_TONES.length];
  const accent = ACCENT_COLORS[(seed >> 16) % ACCENT_COLORS.length];
  const hasGlasses = (seed >> 20) % 3 === 0;
  const hasVisor = (seed >> 22) % 4 === 0;

  let clipPath = "";
  if (shape === "circle") clipPath = `<clipPath id="clip"><circle cx="64" cy="64" r="60"/></clipPath>`;
  else if (shape === "diamond") clipPath = `<clipPath id="clip"><polygon points="64,4 124,64 64,124 4,64"/></clipPath>`;
  else if (shape === "hexagon") clipPath = `<clipPath id="clip"><polygon points="64,4 110,28 110,100 64,124 18,100 18,28"/></clipPath>`;
  else clipPath = `<clipPath id="clip"><rect x="4" y="4" width="120" height="120" rx="8"/></clipPath>`;

  const visorSVG = hasVisor
    ? `<rect x="30" y="52" width="68" height="16" rx="8" fill="${accent}" opacity="0.9"/><rect x="30" y="52" width="68" height="8" rx="4" fill="${accent}" opacity="0.4"/>`
    : "";
  const glassesSVG = hasGlasses && !hasVisor
    ? `<rect x="28" y="52" width="28" height="14" rx="7" fill="none" stroke="${accent}" stroke-width="2"/>
       <rect x="72" y="52" width="28" height="14" rx="7" fill="none" stroke="${accent}" stroke-width="2"/>
       <line x1="56" y1="59" x2="72" y2="59" stroke="${accent}" stroke-width="2"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>${clipPath}</defs>
  <g clip-path="url(#clip)">
    <rect width="128" height="128" fill="${bg}"/>
    <ellipse cx="64" cy="96" rx="40" ry="32" fill="${skin}" opacity="0.3"/>
    <ellipse cx="64" cy="70" rx="26" ry="30" fill="${skin}"/>
    <rect x="44" y="56" width="12" height="8" rx="2" fill="${eyeColor}" opacity="0.9"/>
    <rect x="72" y="56" width="12" height="8" rx="2" fill="${eyeColor}" opacity="0.9"/>
    <line x1="44" y1="80" x2="84" y2="80" stroke="${skin}" stroke-width="3" opacity="0.5"/>
    <rect x="0" y="100" width="128" height="28" fill="${accent}" opacity="0.15"/>
    ${visorSVG}${glassesSVG}
    <rect x="0" y="0" width="128" height="128" fill="${accent}" opacity="0.04"/>
  </g>
</svg>`;
}

export function avatarSeedIndex(username: string): string {
  return String((hashStr(username) % 20) + 1);
}
