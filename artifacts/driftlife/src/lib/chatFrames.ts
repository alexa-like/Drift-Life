// ─── Frame System ─────────────────────────────────────────────────────────────
// Full spec: FRAME_SYSTEM_SPEC — two rarities only (elite, legendary).
// All frames purchased with NC. No old gradient frames remain.

export type Rarity = 'elite' | 'legendary'

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
  // ── ELITE ───────────────────────────────────────────────────────────────────

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
    priceNC: 500,
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
    priceNC: 500,
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
    priceNC: 500,
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
    priceNC: 500,
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
    priceNC: 500,
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
    priceNC: 500,
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
    priceNC: 500,
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
    priceNC: 500,
    availableVia: ['nc-purchase'],
  },

  // ── LEGENDARY ───────────────────────────────────────────────────────────────

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
    priceNC: 2000,
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
    priceNC: 2000,
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
    priceNC: 2000,
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
    priceNC: 2000,
    availableVia: ['nc-purchase'],
  },
]

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const RARITY_COLOR: Record<Rarity, string> = {
  elite: '#FFD700',
  legendary: '#FF4FA3',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  elite: 'ELITE',
  legendary: 'LEGENDARY',
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
