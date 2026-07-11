/**
 * routes/giveaways.ts — Tier 3 (creation/draft/escrow/card) + supporting endpoints
 *
 * POST /api/giveaways/draft          §3.1 — create a draft; nothing is deducted
 * POST /api/giveaways/:id/confirm    §3.2 — escrow pledge, go live
 * GET  /api/giveaways/live           §3.5 — live giveaways (approach B: no FeedEvent while live)
 * GET  /api/giveaways/:id/card       §3.4 — serve PNG card image
 *
 * export sweepExpiredDrafts()        §3.3 — delete expired drafts (called from startup worker)
 *
 * NOTE (§3.5 approach): FeedEvents of type "giveaway" are created ONLY at conclusion
 * (Tier 5). While a giveaway is live it is served directly from the Giveaway collection
 * via GET /api/giveaways/live. This keeps live giveaways safe from the normal 30-day
 * FeedEvent TTL.
 *
 * NOTE (§7.3 normal-route exception): a user with the "owner" role who creates a giveaway
 * through this route (not /api/owner/giveaways) is treated exactly like any other player —
 * isOwnerHosted stays false, escrow and eligibility rules still apply.
 */

import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import Giveaway from "../models/Giveaway";
import Item from "../models/Item";
import User from "../models/User";
import {
  isItemGiveawayEligible,
  isFrameGiveawayEligible,
} from "../lib/giveawayEligibility";
import {
  computePledgeValueDc,
  computeHostCoverage,
  computeUcTopUpCost,
  PledgeItemInput,
} from "../lib/giveawayValuation";
import {
  MIN_PLEDGE_VALUE_DC,
  MAX_CONCURRENT_OPEN_GIVEAWAYS_PER_HOST,
  MAX_ENTRANT_CAP,
  MAX_LIVE_DURATION_MS,
} from "../lib/giveawayConstants";
import { getGiveawayDraftLifetimeMs } from "./owner";
import { generateGiveawayCard } from "../lib/giveawayCardImage";
import GiveawayEntry from "../models/GiveawayEntry";
import { resolveGiveaway } from "../lib/resolveGiveaway";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve host display info, respecting the anonymity flag. */
async function resolveHostDisplay(
  hostId: mongoose.Types.ObjectId,
  isAnonymous: boolean,
): Promise<{ name: string; avatar: string | null; chatFrame: string | null; userId: string | null }> {
  if (isAnonymous) {
    return { name: "??? Anonymous Benefactor", avatar: null, chatFrame: null, userId: null };
  }
  const host = await User.findById(hostId)
    .select("username avatar equippedChatFrame")
    .lean();
  return {
    name: host?.username ?? "Unknown",
    avatar: host?.avatar ?? null,
    chatFrame: (host as any)?.equippedChatFrame ?? null,
    userId: String(hostId),
  };
}

/**
 * Generate the card image and persist it on the Giveaway document.
 * Designed to be called fire-and-forget after the giveaway flips to "live" —
 * errors are caught and logged; a failed card image is non-fatal (giveaway stays live).
 */
async function generateAndStoreCardImage(
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

// ── POST /api/giveaways/draft  (§3.1) ────────────────────────────────────────

router.post("/draft", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { pledge: pledgeInput, isAnonymous, durationMs: rawDuration, maxEntrants: rawMax } = req.body;

    if (!pledgeInput || typeof pledgeInput !== "object") {
      return res.status(400).json({ message: "pledge is required" });
    }

    // Validate duration
    const durationMs = Number(rawDuration);
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_LIVE_DURATION_MS) {
      return res.status(400).json({
        message: `durationMs must be a positive number ≤ ${MAX_LIVE_DURATION_MS} (3 days)`,
      });
    }

    // Validate maxEntrants — "unlimited" is never accepted (Appendix A)
    const maxEntrants = Math.floor(Number(rawMax));
    if (!Number.isFinite(maxEntrants) || maxEntrants < 1 || maxEntrants > MAX_ENTRANT_CAP) {
      return res.status(400).json({
        message: `maxEntrants must be an integer between 1 and ${MAX_ENTRANT_CAP}`,
      });
    }

    const host = await User.findById(req.userId);
    if (!host) return res.status(404).json({ message: "User not found" });

    // Anti-abuse: concurrent open-giveaway cap (§2.3); uses { host, status } index from Tier 1
    const openCount = await Giveaway.countDocuments({
      host:   host._id,
      status: { $in: ["draft", "live"] },
    });
    if (openCount >= MAX_CONCURRENT_OPEN_GIVEAWAYS_PER_HOST) {
      return res.status(400).json({
        message: `You already have ${openCount} open giveaway(s). Maximum ${MAX_CONCURRENT_OPEN_GIVEAWAYS_PER_HOST} allowed at a time.`,
      });
    }

    // ── Process items ─────────────────────────────────────────────────────────
    const itemInputs: Array<{ itemId: string; quantity: number }> = Array.isArray(pledgeInput.items)
      ? pledgeInput.items
      : [];
    const pledgeItems: PledgeItemInput[] = [];
    const itemErrors: Array<{ itemId: string; reason: string }> = [];

    for (const pi of itemInputs) {
      if (!mongoose.isValidObjectId(pi.itemId)) {
        itemErrors.push({ itemId: String(pi.itemId), reason: "invalid item ID format" });
        continue;
      }
      const qty = Math.floor(Number(pi.quantity));
      if (!qty || qty < 1) {
        itemErrors.push({ itemId: String(pi.itemId), reason: "quantity must be ≥ 1" });
        continue;
      }

      const itemDoc = await Item.findOne({ _id: pi.itemId, owner: req.userId });
      if (!itemDoc) {
        itemErrors.push({ itemId: String(pi.itemId), reason: "item not found in your inventory" });
        continue;
      }

      const elig = await isItemGiveawayEligible(itemDoc, false);
      if (!elig.eligible) {
        itemErrors.push({ itemId: String(itemDoc._id), reason: elig.reason! });
        continue;
      }

      pledgeItems.push({
        itemId:      itemDoc._id,
        name:        itemDoc.name,
        quantity:    qty,
        iconUrl:     itemDoc.iconUrl ?? null,
        marketPrice: itemDoc.marketPrice ?? null,
        basePrice:   itemDoc.basePrice  ?? 0,
      });
    }

    // ── Process frames ────────────────────────────────────────────────────────
    const frameInputs: string[] = Array.isArray(pledgeInput.frames) ? pledgeInput.frames : [];
    const pledgeFrames: string[] = [];
    const frameErrors: Array<{ frameId: string; reason: string }> = [];

    for (const frameId of frameInputs) {
      const elig = isFrameGiveawayEligible(host, String(frameId), false);
      if (!elig.eligible) {
        frameErrors.push({ frameId: String(frameId), reason: elig.reason! });
      } else {
        pledgeFrames.push(String(frameId));
      }
    }

    // All eligibility errors are returned together so the player can fix them all at once
    if (itemErrors.length > 0 || frameErrors.length > 0) {
      return res.status(400).json({
        message: "Some pledge items or frames are not eligible to be listed",
        itemErrors,
        frameErrors,
      });
    }

    // ── Normalize currency pledge values ──────────────────────────────────────
    const dc   = Math.max(0, Math.floor(Number(pledgeInput.dc)   || 0));
    const uc   = Math.max(0, Math.floor(Number(pledgeInput.uc)   || 0));
    const keys = Math.max(0, Math.floor(Number(pledgeInput.keys) || 0));

    // ── Valuation ─────────────────────────────────────────────────────────────
    const pledgeValueDc = computePledgeValueDc({ dc, keys, items: pledgeItems });

    if (pledgeValueDc < MIN_PLEDGE_VALUE_DC) {
      return res.status(400).json({
        message: `Pledge value (${pledgeValueDc.toLocaleString()} DC equivalent) is below the minimum of ${MIN_PLEDGE_VALUE_DC.toLocaleString()} DC`,
      });
    }

    // ── Coverage check ────────────────────────────────────────────────────────
    const coverage = await computeHostCoverage(host, {
      dc, uc, keys, items: pledgeItems, frames: pledgeFrames,
    });

    // Frame shortfalls are hard blockers — UC top-up cannot substitute for unowned frames
    if (coverage.shortfallFrames.length > 0) {
      return res.status(400).json({
        message: "You do not own the following frames and cannot pledge them",
        shortfallFrames: coverage.shortfallFrames,
      });
    }

    // UC top-up cost: converts DC/keys/item shortfall value into NC cost (§2.2)
    const ucTopUpCost = computeUcTopUpCost(coverage.shortfallDcEquivalent);
    // Total NC the host will need at confirm time = top-up cost + directly pledged UC
    const totalNcNeeded = ucTopUpCost + uc;

    // ── Create draft ──────────────────────────────────────────────────────────
    const draftLifetimeMs = await getGiveawayDraftLifetimeMs();

    const giveaway = await Giveaway.create({
      host:         host._id,
      isOwnerHosted: false,
      isAnonymous:  Boolean(isAnonymous),
      status:       "draft",
      pledge: {
        dc,
        uc,
        keys,
        items:  pledgeItems.map(pi => ({ itemId: pi.itemId, name: pi.name, quantity: pi.quantity, iconUrl: pi.iconUrl })),
        frames: pledgeFrames,
      },
      pledgeValueDc,
      ucTopUpPaid:  0,
      maxEntrants,
      durationMs,
      draftExpiresAt: new Date(Date.now() + draftLifetimeMs),
    });

    res.status(201).json({
      giveaway,
      coverage: coverage.isCovered ? null : {
        shortfallDc:           coverage.shortfallDc,
        shortfallUc:           coverage.shortfallUc,
        shortfallKeys:         coverage.shortfallKeys,
        shortfallItems:        coverage.shortfallItems.map(si => ({ name: si.name, missing: si.missing })),
      },
      ucTopUpCost,
      totalNcNeeded,
      draftExpiresAt: giveaway.draftExpiresAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "giveaway draft error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/giveaways/:id/confirm  (§3.2) ──────────────────────────────────
//
// Race-safety strategy: the very first write inside the transaction is a
// conditional findOneAndUpdate that flips status "draft" → "live". This acts
// as an optimistic lock — only one concurrent request can ever win it. All
// subsequent deductions run inside the same session, so they roll back as a
// unit if anything fails (insufficient NC, write conflict, etc.).
// Business-logic errors (INSUFFICIENT_NC, ALREADY_CLAIMED) use a flag to
// avoid the session.withTransaction automatic-retry path.

router.post("/:id/confirm", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid giveaway ID" });
    }

    // ── Pre-flight (outside transaction — informational fast-fail) ─────────
    const giveaway = await Giveaway.findById(req.params.id);
    if (!giveaway)                            return res.status(404).json({ message: "Giveaway not found" });
    if (String(giveaway.host) !== req.userId) return res.status(403).json({ message: "You are not the host of this giveaway" });
    if (giveaway.status !== "draft")          return res.status(400).json({ message: "Giveaway is not in draft status" });
    if (giveaway.draftExpiresAt && giveaway.draftExpiresAt < new Date()) {
      return res.status(400).json({ message: "This draft has expired — create a new one" });
    }

    const host = await User.findById(req.userId);
    if (!host) return res.status(404).json({ message: "User not found" });

    const { pledge } = giveaway;

    // ── Re-run eligibility checks ──────────────────────────────────────────
    const itemEligErrors: string[] = [];
    for (const pi of pledge.items) {
      const itemDoc = await Item.findOne({ _id: pi.itemId, owner: req.userId });
      if (!itemDoc) { itemEligErrors.push(`"${pi.name}" is no longer in your inventory`); continue; }
      const elig = await isItemGiveawayEligible(itemDoc, false);
      if (!elig.eligible) itemEligErrors.push(`"${pi.name}": ${elig.reason}`);
    }
    const frameEligErrors: string[] = [];
    for (const frameId of pledge.frames) {
      const elig = isFrameGiveawayEligible(host, frameId, false);
      if (!elig.eligible) frameEligErrors.push(`"${frameId}": ${elig.reason}`);
    }
    if (itemEligErrors.length > 0 || frameEligErrors.length > 0) {
      return res.status(400).json({
        message: "Eligibility check failed — resolve these issues first",
        itemErrors: itemEligErrors, frameErrors: frameEligErrors,
      });
    }

    // ── Re-run coverage to compute NC needed ───────────────────────────────
    const pledgeItemsForCoverage: PledgeItemInput[] = [];
    for (const pi of pledge.items) {
      const itemDoc = await Item.findOne({ _id: pi.itemId, owner: req.userId })
        .select("marketPrice basePrice").lean();
      pledgeItemsForCoverage.push({
        itemId: pi.itemId, name: pi.name, quantity: pi.quantity, iconUrl: pi.iconUrl ?? null,
        marketPrice: itemDoc?.marketPrice ?? null, basePrice: itemDoc?.basePrice ?? 0,
      });
    }
    const coverage = await computeHostCoverage(host, {
      dc: pledge.dc, uc: pledge.uc, keys: pledge.keys,
      items: pledgeItemsForCoverage, frames: [...pledge.frames],
    });
    if (coverage.shortfallFrames.length > 0) {
      return res.status(400).json({ message: `Frames no longer owned: ${coverage.shortfallFrames.join(", ")}` });
    }

    const ucTopUpCost      = computeUcTopUpCost(coverage.shortfallDcEquivalent);
    const totalNcDeduction = ucTopUpCost + pledge.uc;
    const liveExpiresAt    = new Date(Date.now() + giveaway.durationMs);

    // ── Transactional escrow ───────────────────────────────────────────────
    // All writes happen inside one session. The first write is the draft→live
    // flip — only one concurrent request can ever win it (optimistic lock).
    // bizErr is stored in an object so TS doesn't narrow it to `never` when
    // accessed after the withTransaction callback (TS can't track async mutations).
    type BusinessError = { status: number; body: object };
    const biz: { err: BusinessError | null } = { err: null };

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Abort retries immediately for known business-logic failures
        if (biz.err) throw new Error("BIZ_ERR");

        // ① Claim the draft — atomic optimistic lock.
        //    Filter requires status==="draft" and unexpired, so a second concurrent
        //    request (or a retry after a transient error) will find status==="live"
        //    and fail here, aborting cleanly.
        const claimed = await Giveaway.findOneAndUpdate(
          {
            _id:           giveaway._id,
            host:          req.userId,
            status:        "draft",
            draftExpiresAt: { $gt: new Date() },
          },
          { status: "live", liveExpiresAt, ucTopUpPaid: ucTopUpCost },
          { session },
        );
        if (!claimed) {
          biz.err = { status: 409, body: { message: "This draft was already confirmed or has expired" } };
          throw new Error("BIZ_ERR");
        }

        // ② Deduct NC: shortfall top-up + directly pledged UC.
        if (totalNcDeduction > 0) {
          const ncOk = await User.findOneAndUpdate(
            { _id: req.userId, nc: { $gte: totalNcDeduction } },
            { $inc: { nc: -totalNcDeduction } },
            { session },
          );
          if (!ncOk) {
            biz.err = {
              status: 402,
              body: {
                message:       `Not enough NC — need ${totalNcDeduction.toLocaleString()} NC` +
                               (ucTopUpCost > 0 ? ` (${ucTopUpCost.toLocaleString()} shortfall top-up + ${pledge.uc.toLocaleString()} pledged NC)` : ` (pledged NC)`),
                ucTopUpCost,
                totalNcNeeded: totalNcDeduction,
              },
            };
            throw new Error("BIZ_ERR");
          }
        }

        // ③ Deduct DC: deduct what the host currently has (gap covered by ucTopUpCost).
        if (pledge.dc > 0) {
          const freshUser = await User.findById(req.userId).select("dc").session(session).lean();
          const dcToDeduct = Math.min(pledge.dc, (freshUser as any)?.dc ?? 0);
          if (dcToDeduct > 0) {
            await User.findOneAndUpdate(
              { _id: req.userId, dc: { $gte: dcToDeduct } },
              { $inc: { dc: -dcToDeduct } },
              { session },
            );
          }
        }

        // ④ Deduct keys.
        if (pledge.keys > 0) {
          const freshUser = await User.findById(req.userId).select("keys").session(session).lean();
          const keysToDeduct = Math.min(pledge.keys, (freshUser as any)?.keys ?? 0);
          if (keysToDeduct > 0) {
            await User.findOneAndUpdate(
              { _id: req.userId, keys: { $gte: keysToDeduct } },
              { $inc: { keys: -keysToDeduct } },
              { session },
            );
          }
        }

        // ⑤ Deduct items.
        for (const pi of pledge.items) {
          const live = await Item.findOne({ _id: pi.itemId, owner: req.userId })
            .select("quantity").session(session).lean();
          const qtyToDeduct = Math.min(pi.quantity, live?.quantity ?? 0);
          if (qtyToDeduct > 0) {
            await Item.findOneAndUpdate(
              { _id: pi.itemId, owner: req.userId, quantity: { $gte: qtyToDeduct } },
              { $inc: { quantity: -qtyToDeduct } },
              { session },
            );
          }
        }

        // ⑥ Pull frames (fully owned — verified above).
        if (pledge.frames.length > 0) {
          await User.findOneAndUpdate(
            { _id: req.userId },
            { $pullAll: { ownedChatFrames: [...pledge.frames] } },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    // Surface business errors after the session is closed
    if (biz.err) {
      return res.status(biz.err.status).json(biz.err.body);
    }

    // ── Generate card image (fire-and-forget) ──────────────────────────────
    void generateAndStoreCardImage(String(giveaway._id), pledge);

    const updated = await Giveaway.findById(giveaway._id).lean();
    res.json({
      giveaway:     updated,
      cardImageUrl: `/api/giveaways/${giveaway._id}/card`,
      liveExpiresAt,
      message:      "Giveaway is now live!",
    });
  } catch (err: any) {
    req.log.error({ err }, "giveaway confirm error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/giveaways/live  (§3.5 — Approach B) ─────────────────────────────
// Live giveaways are served directly from the Giveaway collection while open.
// No FeedEvent is created until the giveaway concludes (Tier 5).
// Respects anonymity per Appendix A: anonymous host → "??? Anonymous Benefactor", no link.

router.get("/live", requireAuth, async (_req, res) => {
  try {
    const giveaways = await Giveaway.find({ status: "live" })
      .sort({ liveExpiresAt: 1 })
      .lean();

    const result = await Promise.all(
      giveaways.map(async (g) => {
        const hostDisplay = await resolveHostDisplay(g.host, g.isAnonymous);
        return {
          id:            g._id,
          isAnonymous:   g.isAnonymous,
          host:          hostDisplay,
          status:        g.status,
          pledge:        g.pledge,
          pledgeValueDc: g.pledgeValueDc,
          maxEntrants:   g.maxEntrants,
          liveExpiresAt: g.liveExpiresAt,
          cardImageUrl:  g.cardImageUrl,
          createdAt:     g.createdAt,
        };
      }),
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/giveaways/:id  (§4.2 — expanded view) ───────────────────────────
// Full pledge contents for the "Try your luck" expanded card. Anonymity is
// respected here too, not just on the collapsed card (Appendix A).

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid giveaway ID" });
    }
    const g = await Giveaway.findById(req.params.id).lean();
    if (!g) return res.status(404).json({ message: "Giveaway not found" });

    const hostDisplay = await resolveHostDisplay(g.host, g.isAnonymous);
    const alreadyEntered = await GiveawayEntry.exists({ giveawayId: g._id, userId: req.userId });

    res.json({
      id:            g._id,
      isAnonymous:   g.isAnonymous,
      isOwnerHosted: g.isOwnerHosted,
      host:          hostDisplay,
      status:        g.status,
      pledge:        g.pledge,
      pledgeValueDc: g.pledgeValueDc,
      maxEntrants:   g.maxEntrants,
      entrantCount:  g.entrantCount,
      liveExpiresAt: g.liveExpiresAt,
      cardImageUrl:  g.cardImageUrl,
      createdAt:     g.createdAt,
      isHost:        String(g.host) === req.userId,
      alreadyEntered: Boolean(alreadyEntered),
      canEnter:      g.status === "live" && String(g.host) !== req.userId && !alreadyEntered,
    });
  } catch (err: any) {
    req.log.error({ err }, "giveaway detail error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/giveaways/:id/enter  (§4.3 — entry, §4.4 — cap-reached trigger) ─
// Rejects: host entering own giveaway, non-live status, duplicate entry
// (unique index on GiveawayEntry), and any account under Vanta review (§6.2).
// If the new entry brings entrantCount to maxEntrants, immediately invokes the
// SAME resolution function the Tier 5 timer worker uses — no duplicate logic.

router.post("/:id/enter", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid giveaway ID" });
    }

    const user = await User.findById(req.userId).select("underReview").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.underReview) {
      return res.status(403).json({ message: "Your account is under review and cannot enter giveaways" });
    }

    const giveaway = await Giveaway.findById(req.params.id);
    if (!giveaway) return res.status(404).json({ message: "Giveaway not found" });
    if (giveaway.status !== "live") {
      return res.status(400).json({ message: "This giveaway is not currently live" });
    }
    if (String(giveaway.host) === req.userId) {
      return res.status(400).json({ message: "You cannot enter your own giveaway" });
    }

    // Atomically claim an entrant slot BEFORE creating the entry doc. The $expr
    // guard compares two fields on the same document (entrantCount < maxEntrants),
    // so two concurrent requests can never both squeeze past a nearly-full cap —
    // only one is guaranteed to win the last slot.
    const claimed = await Giveaway.findOneAndUpdate(
      { _id: giveaway._id, status: "live", $expr: { $lt: ["$entrantCount", "$maxEntrants"] } },
      { $inc: { entrantCount: 1 } },
      { new: true },
    );
    if (!claimed) {
      return res.status(400).json({ message: "This giveaway is full or no longer live" });
    }

    try {
      await GiveawayEntry.create({ giveawayId: giveaway._id, userId: req.userId });
    } catch (err: any) {
      // Roll back the slot claim — this entrant didn't actually get in.
      await Giveaway.findByIdAndUpdate(giveaway._id, { $inc: { entrantCount: -1 } }).catch(() => {});
      if (err?.code === 11000) {
        return res.status(400).json({ message: "You have already entered this giveaway" });
      }
      throw err;
    }

    res.json({
      message: "You're in! Good luck.",
      entrantCount: claimed.entrantCount,
      maxEntrants: claimed.maxEntrants,
    });

    // §4.4 — cap-reached trigger. Fires after responding so the player isn't
    // kept waiting on the (possibly slower) distribution transaction. Calls
    // the exact same resolveGiveaway() the Tier 5 worker uses for timer expiry.
    if (claimed.entrantCount >= claimed.maxEntrants) {
      resolveGiveaway(giveaway._id).catch((err) => {
        console.error(`[giveaway:${giveaway._id}] cap-reached resolution failed:`, err);
      });
    }
  } catch (err: any) {
    req.log.error({ err }, "giveaway enter error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/giveaways/:id/card  (§3.4 — serve PNG) ─────────────────────────
// No auth required — card images are shareable assets.
// Returns 404 if the image is still generating or generation failed.

router.get("/:id/card", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid giveaway ID" });
    }
    const g = await Giveaway.findById(req.params.id).select("cardImageData").lean();
    if (!g || !(g as any).cardImageData) {
      return res.status(404).json({ message: "Card image not yet available" });
    }
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send((g as any).cardImageData.buffer ?? (g as any).cardImageData);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── §3.3 Draft auto-expiry ────────────────────────────────────────────────────
// Exported so the startup worker (index.ts) can call it on an interval.
// When Tier 5's resolution worker is built, it will absorb this sweep so there
// is a single polling loop — do not add a second setInterval for this function.
// Draft deletion has no side effects (nothing was ever deducted while in draft).

export async function sweepExpiredDrafts(): Promise<void> {
  const result = await Giveaway.deleteMany({
    status:        "draft",
    draftExpiresAt: { $lt: new Date() },
  });
  if (result.deletedCount > 0) {
    console.info(`[giveaway] swept ${result.deletedCount} expired draft(s)`);
  }
}

export default router;
