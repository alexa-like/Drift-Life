// ─── Frame System ─────────────────────────────────────────────────────────────
// Three rarity tiers (elite, legendary, mythic) with distinct themed names —
// every frame is a unique named collectible, not a generic rarity label.
// Acquisition is always paid: NC purchase, a paid subscription perk, or an
// owner-hosted giveaway event. No frame is ever free or randomly awarded.

export type Rarity = 'elite' | 'legendary' | 'mythic'

export type BodyArt =
  | 'none'
  | 'speed-lines'
  | 'data-grid'
  | 'smoke-particles'
  | 'thermal-heat'
  | 'glitch-tears'
  | 'lantern-drift'
  | 'chrome-shimmer'
  | 'void-stars'
  | 'gold-sparkles'
  | 'code-rain'
  | 'nova-burst'
  | 'aurora-sovereign'
  | 'petal-drift'
  | 'frost-shimmer'
  | 'circuit-pulse'

// Shape of the name tag that overlaps the top-left corner of the frame body.
// 'pennant' = chevron-cut tag (default). 'square' = hard-edged tag (Netrunner/terminal themes).
export type TagShape = 'pennant' | 'square'

export type HeaderVariant = 'solid' | 'animated-shimmer' | 'textured-weave'

export interface Frame {
  id: string
  name: string
  rarity: Rarity
  description: string

  // Visual
  headerVariant: HeaderVariant
  headerColor: string
  accentColor: string
  textOnHeader: 'white' | 'dark'
  bodyArt: BodyArt

  // Profile card
  logoComponent: string
  profileBgAnimation: BodyArt
  tagShape?: TagShape

  // Commerce
  priceNC: number
  availableVia: ('nc-purchase' | 'season-pass' | 'subscription')[]
}

// Runtime-enriched version (after merging server ownership data)
export interface FrameWithStatus extends Frame {
  owned: boolean
  equipped: boolean
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const FRAMES: Frame[] = [
  // ── ELITE (900 NC) ────────────────────────────────────────────────────────

  {
    id: 'neon_drift',
    name: 'Neon Drift',
    rarity: 'elite',
    description: 'Electric cyan speed — like a car passing at full throttle.',
    headerVariant: 'solid',
    headerColor: '#00E0FF',
    accentColor: '#00E0FF',
    textOnHeader: 'dark',
    bodyArt: 'speed-lines',
    logoComponent: 'NeonDriftLogo',
    profileBgAnimation: 'speed-lines',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'grid_static',
    name: 'Grid Static',
    rarity: 'elite',
    description: 'Terminal grid pulsing with live data. Node clusters active.',
    headerVariant: 'solid',
    headerColor: '#00FF9F',
    accentColor: '#00FF9F',
    textOnHeader: 'dark',
    bodyArt: 'data-grid',
    logoComponent: 'GridStaticLogo',
    profileBgAnimation: 'data-grid',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'street_phantom',
    name: 'Street Phantom',
    rarity: 'elite',
    description: 'Deep void energy. Purple smoke rising from the underground.',
    headerVariant: 'solid',
    headerColor: '#6A0DAD',
    accentColor: '#9B30FF',
    textOnHeader: 'white',
    bodyArt: 'smoke-particles',
    logoComponent: 'StreetPhantomLogo',
    profileBgAnimation: 'smoke-particles',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'urban_heat',
    name: 'Urban Heat',
    rarity: 'elite',
    description: 'Thermal signature visible from orbit. The city burns.',
    headerVariant: 'solid',
    headerColor: '#FF4500',
    accentColor: '#FF4500',
    textOnHeader: 'white',
    bodyArt: 'thermal-heat',
    logoComponent: 'UrbanHeatLogo',
    profileBgAnimation: 'thermal-heat',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'signal_breach',
    name: 'Signal Breach',
    rarity: 'elite',
    description: 'System compromised. Signal corrupted. Alert active.',
    headerVariant: 'solid',
    headerColor: '#FF0040',
    accentColor: '#FF0040',
    textOnHeader: 'white',
    bodyArt: 'glitch-tears',
    logoComponent: 'SignalBreachLogo',
    profileBgAnimation: 'glitch-tears',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'night_market',
    name: 'Night Market',
    rarity: 'elite',
    description: 'Lanterns and neon signs drift through the midnight bazaar.',
    headerVariant: 'solid',
    headerColor: '#FF007F',
    accentColor: '#FF007F',
    textOnHeader: 'white',
    bodyArt: 'lantern-drift',
    logoComponent: 'NightMarketLogo',
    profileBgAnimation: 'lantern-drift',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'chrome_edge',
    name: 'Chrome Edge',
    rarity: 'elite',
    description: 'Polished chrome finish. Light catches every angle.',
    headerVariant: 'solid',
    headerColor: '#C0C0C0',
    accentColor: '#C0C0C0',
    textOnHeader: 'dark',
    bodyArt: 'chrome-shimmer',
    logoComponent: 'ChromeEdgeLogo',
    profileBgAnimation: 'chrome-shimmer',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'void_signal',
    name: 'Void Signal',
    rarity: 'elite',
    description: 'Broadcasting from the deep void. Signal origin unknown.',
    headerVariant: 'solid',
    headerColor: '#0A0A1A',
    accentColor: '#4040FF',
    textOnHeader: 'white',
    bodyArt: 'void-stars',
    logoComponent: 'VoidSignalLogo',
    profileBgAnimation: 'void-stars',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'cyberkitty',
    name: 'CyberKitty',
    rarity: 'elite',
    description: 'Neon paws and pastel static. Cute with teeth.',
    headerVariant: 'solid',
    headerColor: '#FF6FB0',
    accentColor: '#FF6FB0',
    textOnHeader: 'dark',
    bodyArt: 'petal-drift',
    logoComponent: 'CyberKittyLogo',
    profileBgAnimation: 'petal-drift',
    tagShape: 'pennant',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'cyberfrost',
    name: 'CyberFrost',
    rarity: 'elite',
    description: 'Sub-zero circuitry. Every message ships with frostbite.',
    headerVariant: 'solid',
    headerColor: '#7FDBFF',
    accentColor: '#7FDBFF',
    textOnHeader: 'dark',
    bodyArt: 'frost-shimmer',
    logoComponent: 'CyberFrostLogo',
    profileBgAnimation: 'frost-shimmer',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'retro_miami',
    name: 'Retro Miami',
    rarity: 'elite',
    description: 'Sunset grid, palm static, synthwave chrome.',
    headerVariant: 'solid',
    headerColor: '#00F5D4',
    accentColor: '#FF2FD1',
    textOnHeader: 'dark',
    bodyArt: 'chrome-shimmer',
    logoComponent: 'RetroMiamiLogo',
    profileBgAnimation: 'chrome-shimmer',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'sakura',
    name: 'Sakura',
    rarity: 'elite',
    description: 'Digital cherry blossoms drift across the interface.',
    headerVariant: 'solid',
    headerColor: '#FFB7C5',
    accentColor: '#FFB7C5',
    textOnHeader: 'dark',
    bodyArt: 'petal-drift',
    logoComponent: 'SakuraLogo',
    profileBgAnimation: 'petal-drift',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'halloween',
    name: 'Halloween',
    rarity: 'elite',
    description: 'Jack-o-lantern static. Something glitches in the dark.',
    headerVariant: 'solid',
    headerColor: '#FF7518',
    accentColor: '#FF7518',
    textOnHeader: 'dark',
    bodyArt: 'glitch-tears',
    logoComponent: 'HalloweenLogo',
    profileBgAnimation: 'glitch-tears',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'cyberbloom',
    name: 'Cyberbloom',
    rarity: 'elite',
    description: 'Neon florals bloom in the feed. Toxic and beautiful.',
    headerVariant: 'solid',
    headerColor: '#39FF14',
    accentColor: '#39FF14',
    textOnHeader: 'dark',
    bodyArt: 'petal-drift',
    logoComponent: 'CyberbloomLogo',
    profileBgAnimation: 'petal-drift',
    priceNC: 900,
    availableVia: ['nc-purchase'],
  },

  // ── LEGENDARY (3,500 NC) ──────────────────────────────────────────────────

  {
    id: 'apex',
    name: 'APEX',
    rarity: 'legendary',
    description: 'Top of the hierarchy. Gold standard. Unmistakable.',
    headerVariant: 'animated-shimmer',
    headerColor: '#FFD700',
    accentColor: '#FFD700',
    textOnHeader: 'dark',
    bodyArt: 'gold-sparkles',
    logoComponent: 'ApexLogo',
    profileBgAnimation: 'gold-sparkles',
    priceNC: 3500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'blackout_protocol',
    name: 'Blackout Protocol',
    rarity: 'legendary',
    description: 'Terminal access granted. Command executing. No trace.',
    headerVariant: 'solid',
    headerColor: '#000000',
    accentColor: '#FFFFFF',
    textOnHeader: 'white',
    bodyArt: 'code-rain',
    logoComponent: 'BlackoutProtocolLogo',
    profileBgAnimation: 'code-rain',
    tagShape: 'square',
    priceNC: 3500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'nova_circuit',
    name: 'Nova Circuit',
    rarity: 'legendary',
    description: 'Explosive particle detonation. Every 4 seconds, a nova.',
    headerVariant: 'solid',
    headerColor: '#FF2D6B',
    accentColor: '#FF2D6B',
    textOnHeader: 'white',
    bodyArt: 'nova-burst',
    logoComponent: 'NovaCircuitLogo',
    profileBgAnimation: 'nova-burst',
    priceNC: 3500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'sovereign',
    name: 'Sovereign',
    rarity: 'legendary',
    description: 'Regal velvet aurora. Command without question.',
    headerVariant: 'textured-weave',
    headerColor: '#4B0082',
    accentColor: '#9040FF',
    textOnHeader: 'white',
    bodyArt: 'aurora-sovereign',
    logoComponent: 'SovereignLogo',
    profileBgAnimation: 'aurora-sovereign',
    priceNC: 3500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'cybersanta',
    name: 'CyberSanta',
    rarity: 'legendary',
    description: 'Holiday firmware update. Ho ho — access granted.',
    headerVariant: 'solid',
    headerColor: '#C41E3A',
    accentColor: '#FFD24D',
    textOnHeader: 'dark',
    bodyArt: 'frost-shimmer',
    logoComponent: 'CyberSantaLogo',
    profileBgAnimation: 'frost-shimmer',
    priceNC: 3500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'cyberdragon',
    name: 'CyberDragon',
    rarity: 'legendary',
    description: 'Molten alloy scales. The city burns when it speaks.',
    headerVariant: 'solid',
    headerColor: '#E63900',
    accentColor: '#FFAA00',
    textOnHeader: 'dark',
    bodyArt: 'thermal-heat',
    logoComponent: 'CyberDragonLogo',
    profileBgAnimation: 'thermal-heat',
    priceNC: 3500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'netrunner',
    name: 'Netrunner',
    rarity: 'legendary',
    description: 'Deep in the wire. Circuits pulse under every word.',
    headerVariant: 'solid',
    headerColor: '#0D0D0D',
    accentColor: '#00FF9F',
    textOnHeader: 'white',
    bodyArt: 'circuit-pulse',
    logoComponent: 'NetrunnerLogo',
    profileBgAnimation: 'circuit-pulse',
    tagShape: 'square',
    priceNC: 3500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'golden_new_year',
    name: 'Golden New Year',
    rarity: 'legendary',
    description: 'Fireworks in gold static. A new cycle begins.',
    headerVariant: 'animated-shimmer',
    headerColor: '#B8860B',
    accentColor: '#FFD700',
    textOnHeader: 'dark',
    bodyArt: 'gold-sparkles',
    logoComponent: 'GoldenNewYearLogo',
    profileBgAnimation: 'gold-sparkles',
    priceNC: 3500,
    availableVia: ['nc-purchase'],
  },

  // ── MYTHIC (7,500 NC) — the rarest, most expensive tier ──────────────────

  {
    id: 'lunar_stallion',
    name: 'Lunar Stallion',
    rarity: 'mythic',
    description: 'A silver mane against a starfield. Runs beyond the map.',
    headerVariant: 'solid',
    headerColor: '#1a1a3a',
    accentColor: '#C0C0FF',
    textOnHeader: 'white',
    bodyArt: 'void-stars',
    logoComponent: 'LunarStallionLogo',
    profileBgAnimation: 'void-stars',
    priceNC: 7500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'lightwalker',
    name: 'Lightwalker',
    rarity: 'mythic',
    description: 'Pure white aurora. Walks between signal and silence.',
    headerVariant: 'textured-weave',
    headerColor: '#E8E8FF',
    accentColor: '#FFFFFF',
    textOnHeader: 'dark',
    bodyArt: 'aurora-sovereign',
    logoComponent: 'LightwalkerLogo',
    profileBgAnimation: 'aurora-sovereign',
    priceNC: 7500,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'prestige_frame_P1',
    name: 'Prestige I',
    rarity: 'mythic',
    description: 'First reset. First proof the grind means something.',
    headerVariant: 'solid',
    headerColor: '#5c4a00',
    accentColor: '#FFD700',
    textOnHeader: 'white',
    bodyArt: 'gold-sparkles',
    logoComponent: 'PrestigeLogo',
    profileBgAnimation: 'gold-sparkles',
    priceNC: 6000,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'prestige_frame_P2',
    name: 'Prestige II',
    rarity: 'mythic',
    description: 'Second reset. The city remembers your name now.',
    headerVariant: 'solid',
    headerColor: '#2a2a3a',
    accentColor: '#C0C0C0',
    textOnHeader: 'white',
    bodyArt: 'chrome-shimmer',
    logoComponent: 'PrestigeLogo',
    profileBgAnimation: 'chrome-shimmer',
    priceNC: 8000,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'prestige_frame_P3',
    name: 'Prestige III',
    rarity: 'mythic',
    description: 'Third reset. Legend, not rumor.',
    headerVariant: 'textured-weave',
    headerColor: '#4B0082',
    accentColor: '#9040FF',
    textOnHeader: 'white',
    bodyArt: 'aurora-sovereign',
    logoComponent: 'PrestigeLogo',
    profileBgAnimation: 'aurora-sovereign',
    priceNC: 10000,
    availableVia: ['nc-purchase'],
  },
  {
    id: 'prestige_frame_P4',
    name: 'Prestige IV',
    rarity: 'mythic',
    description: 'Fourth reset. There is no ceiling above this one.',
    headerVariant: 'solid',
    headerColor: '#3a0000',
    accentColor: '#FF2D6B',
    textOnHeader: 'white',
    bodyArt: 'nova-burst',
    logoComponent: 'PrestigeLogo',
    profileBgAnimation: 'nova-burst',
    priceNC: 12000,
    availableVia: ['nc-purchase'],
  },

  // ── SUBSCRIBER-EXCLUSIVE — granted only with an active paid subscription;
  //    this is a paid perk, not a free/random grant, so it stays consistent
  //    with the "every frame is paid for" rule. ─────────────────────────────
  {
    id: 'sub_street_runner',
    name: 'Street Runner',
    rarity: 'elite',
    description: 'The road belongs to those who take it. Subscriber-exclusive.',
    headerVariant: 'solid',
    headerColor: '#003a5e',
    accentColor: '#00E0FF',
    textOnHeader: 'white',
    bodyArt: 'speed-lines',
    logoComponent: 'StreetRunnerLogo',
    profileBgAnimation: 'speed-lines',
    priceNC: 0,
    availableVia: ['subscription'],
  },
  {
    id: 'sub_neon_syndicate',
    name: 'Neon Syndicate',
    rarity: 'elite',
    description: 'Network. Influence. Power. Subscriber-exclusive.',
    headerVariant: 'solid',
    headerColor: '#3d0030',
    accentColor: '#FF4FA3',
    textOnHeader: 'white',
    bodyArt: 'data-grid',
    logoComponent: 'NeonSyndicateLogo',
    profileBgAnimation: 'data-grid',
    priceNC: 0,
    availableVia: ['subscription'],
  },
  {
    id: 'sub_apex_sovereign',
    name: 'Apex Sovereign',
    rarity: 'legendary',
    description: 'Beyond elite. Beyond legend. Subscriber-exclusive.',
    headerVariant: 'animated-shimmer',
    headerColor: '#3d3200',
    accentColor: '#FFD700',
    textOnHeader: 'white',
    bodyArt: 'aurora-sovereign',
    logoComponent: 'ApexSovereignLogo',
    profileBgAnimation: 'aurora-sovereign',
    priceNC: 0,
    availableVia: ['subscription'],
  },
]

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const RARITY_COLOR: Record<Rarity, string> = {
  elite: '#FFD700',
  legendary: '#FF4FA3',
  mythic: '#7FDBFF',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  elite: 'ELITE',
  legendary: 'LEGENDARY',
  mythic: 'MYTHIC',
}

export function getFrame(id: string | null | undefined): Frame | null {
  if (!id) return null
  return FRAMES.find(f => f.id === id) ?? null
}

export function enrichFrames(
  frames: Frame[],
  owned: string[],
  equipped: string | null,
): FrameWithStatus[] {
  return frames.map(f => ({
    ...f,
    owned: owned.includes(f.id),
    equipped: equipped === f.id,
  }))
}
