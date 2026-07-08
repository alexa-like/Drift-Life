import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

// ── Bank ─────────────────────────────────────────────────────────────────
export const bankAmountSchema = z.object({
  amount: z.coerce.number().finite().positive().max(1_000_000_000_000),
});
export const bankTransferSchema = z.object({
  targetUsername: z.string().trim().min(1).max(32),
  amount: z.coerce.number().finite().positive().max(1_000_000_000_000),
});

// ── Combat ───────────────────────────────────────────────────────────────
export const combatAttackSchema = z.object({
  targetId: objectId,
});

// ── Market ───────────────────────────────────────────────────────────────
export const marketShopBuySchema = z.object({
  itemId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(99).optional().default(1),
});
export const marketListingCreateSchema = z.object({
  itemId: objectId,
  price: z.coerce.number().finite().positive().max(1_000_000_000),
});
export const marketListingBuySchema = z.object({});

// ── Auction ──────────────────────────────────────────────────────────────
export const auctionListSchema = z.object({
  itemId: objectId,
  startingPrice: z.coerce.number().finite().min(1).max(1_000_000_000),
  buyoutPrice: z.coerce.number().finite().positive().max(1_000_000_000).optional(),
  durationHours: z.coerce.number().finite().min(1).max(72),
});
export const auctionBidSchema = z.object({
  amount: z.coerce.number().finite().positive().max(1_000_000_000),
});

// ── Jobs ─────────────────────────────────────────────────────────────────
export const jobsMinigameCompleteSchema = z.object({
  token: z.string().trim().min(1),
  score: z.coerce.number().finite().min(0).max(100),
});

// ── Crimes ───────────────────────────────────────────────────────────────
export const pursuitResolveSchema = z.object({
  outcome: z.enum(["bribe", "outrun", "busted"]),
});
export const crimesLaunderSchema = z.object({
  amount: z.coerce.number().finite().positive().max(1_000_000_000),
});

// ── Net ──────────────────────────────────────────────────────────────────
export const netHackInitiateSchema = z.object({
  targetId: objectId,
});
export const netHackSubmitSchema = z.object({
  sessionId: z.string().trim().min(1),
  answer: z.array(z.string()).max(10),
});
export const netSimAmountSchema = z.object({
  amount: z.coerce.number().int().positive().max(1_000_000_000),
});
export const netDarkListSchema = z.object({
  itemName: z.string().trim().min(1).max(60),
  price: z.coerce.number().finite().positive().max(1_000_000_000),
  currency: z.enum(["dc", "sim"]).optional().default("dc"),
});

// ── Guilds ───────────────────────────────────────────────────────────────
export const guildTreasuryDonateSchema = z.object({
  amount: z.coerce.number().finite().positive().max(1_000_000_000),
});
export const guildCreateSchema = z.object({
  name: z.string().trim().min(3).max(24),
  tag: z.string().trim().min(2).max(5),
  description: z.string().trim().max(280).optional().default(""),
});
export const guildTargetSchema = z.object({
  targetId: objectId,
});
