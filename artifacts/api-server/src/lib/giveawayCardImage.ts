/**
 * giveawayCardImage.ts — §3.4
 *
 * Generates exactly one PNG card image per giveaway at the moment it goes live.
 * Never called again for the same giveaway after the initial generation.
 *
 * Requires: sharp (native module, externalized in build.mjs)
 * Output:   512×200 PNG buffer — dark cyberpunk background with up to 4 item icons.
 */

import sharp, { type OverlayOptions } from "sharp";
import Giveaway from "../models/Giveaway";

const CARD_W    = 512;
const CARD_H    = 200;
const ICON_SIZE = 96;
const PADDING   = 12;
const MAX_ICONS = 4;

/** Dark navy background color */
const BG = { r: 10, g: 10, b: 22, alpha: 1 } as const;
/** Neon-purple placeholder square color (used for items without a fetchable iconUrl) */
const PLACEHOLDER_BG = { r: 48, g: 18, b: 72, alpha: 1 } as const;

// ── Image fetching ──────────────────────────────────────────────────────────

/** Fetch an absolute HTTP(S) URL into a Buffer. Returns null on any failure. */
async function fetchRemoteImage(url: string): Promise<Buffer | null> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Return a resized ICON_SIZE×ICON_SIZE PNG buffer for a given icon source, or a placeholder. */
async function renderIcon(iconUrl: string | null | undefined): Promise<Buffer> {
  if (iconUrl) {
    const raw = await fetchRemoteImage(iconUrl);
    if (raw) {
      try {
        return await sharp(raw)
          .resize(ICON_SIZE, ICON_SIZE, { fit: "cover" })
          .png()
          .toBuffer();
      } catch {
        /* fall through to placeholder */
      }
    }
  }

  // Placeholder: neon-purple square
  return sharp({
    create: {
      width:    ICON_SIZE,
      height:   ICON_SIZE,
      channels: 4,
      background: PLACEHOLDER_BG,
    },
  })
    .png()
    .toBuffer();
}

// ── Card layout ─────────────────────────────────────────────────────────────

/**
 * Generate the giveaway card image.
 *
 * Shows up to MAX_ICONS item icons centred on a dark background.
 * DC / UC / keys / frames have no iconUrl — they add to icon count but render
 * as a placeholder, which keeps the card honest about the pledge contents.
 *
 * This function must be called at most once per giveaway (§3.4: "generated once
 * at creation, never regenerated"). Callers are responsible for enforcing that.
 */
export async function generateGiveawayCard(pledge: {
  dc: number;
  uc: number;
  keys: number;
  items: Array<{ name: string; iconUrl?: string | null; quantity: number }>;
  frames: string[];
}): Promise<Buffer> {
  // Collect icon sources — items first (they have iconUrls), then currency placeholders
  const iconSources: Array<string | null> = [];

  for (const item of pledge.items.slice(0, MAX_ICONS)) {
    iconSources.push(item.iconUrl ?? null);
  }

  // If fewer than MAX_ICONS from items, fill remaining slots for DC/keys/frames
  const currencySlots = MAX_ICONS - iconSources.length;
  for (let i = 0; i < currencySlots && i < (pledge.dc > 0 ? 1 : 0) + (pledge.keys > 0 ? 1 : 0) + pledge.frames.length; i++) {
    iconSources.push(null);
  }

  const numIcons = Math.max(1, Math.min(iconSources.length, MAX_ICONS));

  // Render each icon (parallel for speed)
  const iconBuffers = await Promise.all(
    iconSources.slice(0, numIcons).map((url) => renderIcon(url)),
  );

  // Build background
  const bg = await sharp({
    create: {
      width:    CARD_W,
      height:   CARD_H,
      channels: 4,
      background: BG,
    },
  })
    .png()
    .toBuffer();

  // Compute horizontal layout: icons centred on the card
  const totalIconsW = numIcons * ICON_SIZE + (numIcons - 1) * PADDING;
  const startX      = Math.round((CARD_W - totalIconsW) / 2);
  const startY      = Math.round((CARD_H - ICON_SIZE) / 2);

  const composites: OverlayOptions[] = iconBuffers.map((buf, i) => ({
    input: buf,
    left:  startX + i * (ICON_SIZE + PADDING),
    top:   startY,
  }));

  return sharp(bg).composite(composites).png().toBuffer();
}

/**
 * Generate the card image and persist it on the Giveaway document.
 *
 * Lives here (rather than in routes/giveaways.ts) so both routes/giveaways.ts
 * (player flow, §3.2) and routes/owner.ts (Tier 7 §7.1 owner-hosted flow) can
 * call it without creating a circular import between those two route files
 * (routes/giveaways.ts already imports getGiveawayDraftLifetimeMs from
 * routes/owner.ts).
 *
 * Designed to be called fire-and-forget right after a giveaway flips to
 * "live" — errors are caught and logged; a failed card image is non-fatal
 * (the giveaway stays live with cardImageUrl left null).
 */
export async function generateAndStoreCardImage(
  giveawayId: string,
  pledge: { dc: number; uc: number; keys: number; items: any[]; frames: any[] },
): Promise<void> {
  try {
    const cardBuffer = await generateGiveawayCard({
      dc:     pledge.dc,
      uc:     pledge.uc,
      keys:   pledge.keys,
      items:  pledge.items.map((i: any) => ({ name: i.name, iconUrl: i.iconUrl ?? null, quantity: i.quantity })),
      frames: [...pledge.frames],
    });
    await Giveaway.findByIdAndUpdate(giveawayId, {
      cardImageData: cardBuffer,
      cardImageUrl:  `/api/giveaways/${giveawayId}/card`,
    });
  } catch (err) {
    console.error(`[giveaway:${giveawayId}] card image generation failed:`, err);
    // Leave cardImageUrl null — the frontend must handle a missing card gracefully.
    await Giveaway.findByIdAndUpdate(giveawayId, { cardImageUrl: null }).catch(() => {});
  }
}
