import { Router } from "express";
import User from "../models/User";
import Frame from "../models/Frame";
import { requireAuth, requireOwner, AuthRequest } from "../middlewares/auth";
import { emitFeedEvent } from "../lib/feedEvents";

const router = Router();

function requireStaff(req: AuthRequest, res: any, next: any) {
  if (req.role !== "owner" && req.role !== "admin" && req.role !== "staff") {
    return res.status(403).json({ message: "Staff only" });
  }
  next();
}

// GET /api/frames — all visible frames + player's owned set
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("ownedFrames equippedFrame equippedFrameRarity equippedFrameColor dc nc merit")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const ownedFrames: string[] = user.ownedFrames || [];
    const now = new Date();

    const frames = await Frame.find({
      $or: [
        { isVisible: true },
        { isVisible: false, frameId: { $in: ownedFrames } },
      ],
    }).lean();

    const weeklyFree = frames.find(f => f.isWeeklyFree);

    res.json(
      frames
        .filter(f => {
          if (f.availableFrom && f.availableFrom > now) return false;
          if (f.availableUntil && f.availableUntil < now && !ownedFrames.includes(f.frameId)) return false;
          return true;
        })
        .map(f => {
          const effectivePrice = (f.salePrice !== null && f.saleExpiry && f.saleExpiry > now)
            ? f.salePrice
            : f.price;
          const isOnSale = f.salePrice !== null && f.saleExpiry != null && f.saleExpiry > now;
          const isOwned = f.isFree || (weeklyFree && weeklyFree.frameId === f.frameId) || ownedFrames.includes(f.frameId);
          return {
            frameId: f.frameId,
            displayName: f.displayName,
            rarity: f.rarity,
            glowColor: f.glowColor,
            animationType: f.animationType,
            variantIndex: f.variantIndex,
            price: effectivePrice,
            originalPrice: f.price,
            isOnSale,
            currency: f.currency,
            isFree: f.isFree || (weeklyFree?.frameId === f.frameId),
            description: f.description,
            earnedBy: f.earnedBy ?? undefined,
            isWeeklyFree: f.isWeeklyFree,
            isFeatured: f.isFeatured,
            isLimited: !!(f.availableUntil && f.availableUntil > now),
            availableUntil: f.availableUntil ?? undefined,
            mythicAliasOf: f.mythicAliasOf ?? undefined,
            createdAt: (f as any).createdAt ?? undefined,
            owned: isOwned,
            equipped: user.equippedFrame === f.frameId,
          };
        })
    );
  } catch (err: any) {
    req.log.error({ err }, "get frames error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/purchase/:frameId
router.post("/purchase/:frameId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const frame = await Frame.findOne({ frameId: req.params.frameId });
    if (!frame) return res.status(404).json({ message: "Frame not found" });
    if (!frame.isVisible) return res.status(404).json({ message: "Frame not found" });
    if (frame.isFree) return res.status(400).json({ message: "This frame is free — equip it directly" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.ownedFrames.includes(frame.frameId)) {
      return res.status(400).json({ message: "You already own this frame" });
    }

    const now = new Date();
    const effectivePrice = (frame.salePrice !== null && frame.saleExpiry && frame.saleExpiry > now)
      ? frame.salePrice
      : frame.price;

    if (frame.currency === "dc") {
      if (user.dc < effectivePrice) {
        return res.status(400).json({ message: `Not enough DC. Costs ${effectivePrice.toLocaleString()} DC.` });
      }
      user.dc -= effectivePrice;
    } else if (frame.currency === "merit") {
      if (user.merit < effectivePrice) {
        return res.status(400).json({ message: `Not enough Merit. Costs ${effectivePrice} M.` });
      }
      user.merit -= effectivePrice;
    } else {
      if (user.nc < effectivePrice) {
        return res.status(400).json({ message: `Not enough NC. Costs ${effectivePrice} NC.` });
      }
      user.nc -= effectivePrice;
    }

    user.ownedFrames.push(frame.frameId);
    user.markModified("ownedFrames");
    await user.save();

    res.json({
      message: `${frame.displayName} frame purchased`,
      frameId: frame.frameId,
      ownedFrames: user.ownedFrames,
    });
  } catch (err: any) {
    req.log.error({ err }, "purchase frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/equip/:frameId
router.post("/equip/:frameId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const frame = await Frame.findOne({ frameId: req.params.frameId });
    if (!frame) return res.status(404).json({ message: "Frame not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isWeeklyFree = frame.isWeeklyFree;
    if (!frame.isFree && !isWeeklyFree && !user.ownedFrames.includes(frame.frameId)) {
      return res.status(403).json({ message: "You don't own this frame" });
    }

    user.equippedFrame = frame.frameId;
    user.equippedFrameRarity = frame.rarity;
    await user.save();

    res.json({ equippedFrame: frame.frameId, equippedFrameRarity: frame.rarity });
  } catch (err: any) {
    req.log.error({ err }, "equip frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/color — save custom frame color
router.post("/color", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { color } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (color === null || color === "") {
      user.equippedFrameColor = null;
    } else if (typeof color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
      user.equippedFrameColor = color;
    } else {
      return res.status(400).json({ message: "Invalid color format. Use hex (#RRGGBB)" });
    }

    await user.save();
    res.json({ equippedFrameColor: user.equippedFrameColor });
  } catch (err: any) {
    req.log.error({ err }, "set frame color error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/gift — gift a frame to another player
router.post("/gift", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { frameId, targetUserId } = req.body;
    if (!frameId || !targetUserId) {
      return res.status(400).json({ message: "frameId and targetUserId required" });
    }

    const frame = await Frame.findOne({ frameId });
    if (!frame) return res.status(404).json({ message: "Frame not found" });
    if (frame.isFree) return res.status(400).json({ message: "Cannot gift free frames" });

    const sender = await User.findById(req.userId);
    if (!sender) return res.status(404).json({ message: "User not found" });

    if (!sender.ownedFrames.includes(frameId)) {
      return res.status(403).json({ message: "You don't own this frame" });
    }
    if (sender.equippedFrame === frameId) {
      return res.status(400).json({ message: "Cannot gift your currently equipped frame" });
    }
    if ((sender.receivedAsGift || []).includes(frameId)) {
      return res.status(400).json({ message: "Cannot re-gift frames you received as a gift" });
    }

    const recipient = await User.findById(targetUserId);
    if (!recipient || recipient.banned) {
      return res.status(404).json({ message: "Target player not found" });
    }
    if (recipient.ownedFrames.includes(frameId)) {
      return res.status(400).json({ message: "That player already owns this frame" });
    }

    const now = new Date();
    const effectivePrice = (frame.salePrice !== null && frame.saleExpiry && frame.saleExpiry > now)
      ? frame.salePrice
      : frame.price;
    const fee = Math.ceil(effectivePrice * 0.1);

    if (frame.currency === "dc") {
      if (sender.dc < fee) return res.status(400).json({ message: `Not enough DC for gifting fee (${fee.toLocaleString()} DC)` });
      sender.dc -= fee;
    } else if (frame.currency === "merit") {
      if (sender.merit < fee) return res.status(400).json({ message: `Not enough Merit for gifting fee (${fee} M)` });
      sender.merit -= fee;
    } else {
      if (sender.nc < fee) return res.status(400).json({ message: `Not enough NC for gifting fee (${fee} NC)` });
      sender.nc -= fee;
    }

    sender.ownedFrames = sender.ownedFrames.filter(f => f !== frameId);
    sender.markModified("ownedFrames");

    recipient.ownedFrames.push(frameId);
    recipient.receivedAsGift = [...(recipient.receivedAsGift || []), frameId];
    recipient.markModified("ownedFrames");
    recipient.markModified("receivedAsGift");

    await sender.save();
    await recipient.save();

    await emitFeedEvent({
      type: "frame_gift",
      actor: sender.username,
      actorId: String(sender._id),
      actorFrame: sender.equippedFrame,
      actorFrameColor: sender.equippedFrameColor,
      actorAvatarUrl: sender.avatarUrl,
      target: recipient.username,
      message: `${sender.username} gifted [${frame.displayName}] to ${recipient.username}`,
      dc: 0,
      xp: 0,
    });

    res.json({ message: `${frame.displayName} gifted to ${recipient.username}`, fee });
  } catch (err: any) {
    req.log.error({ err }, "gift frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── OWNER FRAME MANAGEMENT ────────────────────────────────────────────────────

// GET /api/frames/owner/all — all frames with stats
router.get("/owner/all", requireAuth, requireStaff as any, async (req: AuthRequest, res) => {
  try {
    const frames = await Frame.find({}).lean();
    const ownedCounts: Record<string, number> = {};
    const allUsers = await User.find({}).select("ownedFrames equippedFrame").lean();
    for (const u of allUsers) {
      for (const fid of (u.ownedFrames || [])) {
        ownedCounts[fid] = (ownedCounts[fid] || 0) + 1;
      }
    }
    res.json(frames.map(f => ({ ...f, ownedByCount: ownedCounts[f.frameId] || 0 })));
  } catch (err: any) {
    req.log.error({ err }, "owner get all frames error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/frames/owner/:frameId — update frame settings
router.patch("/owner/:frameId", requireAuth, requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { frameId } = req.params;
    const {
      displayName, description, price, currency, earnedBy,
      isVisible, isFeatured, salePrice, saleExpiry,
      availableFrom, availableUntil, isWeeklyFree,
    } = req.body;

    const frame = await Frame.findOne({ frameId });
    if (!frame) return res.status(404).json({ message: "Frame not found" });

    if (displayName !== undefined) frame.displayName = displayName;
    if (description !== undefined) frame.description = description;
    if (price !== undefined) frame.price = Number(price);
    if (currency !== undefined) frame.currency = currency;
    if (earnedBy !== undefined) frame.earnedBy = earnedBy || null;
    if (isVisible !== undefined) frame.isVisible = Boolean(isVisible);
    if (isFeatured !== undefined) frame.isFeatured = Boolean(isFeatured);
    if (salePrice !== undefined) frame.salePrice = salePrice !== null ? Number(salePrice) : null;
    if (saleExpiry !== undefined) frame.saleExpiry = saleExpiry ? new Date(saleExpiry) : null;
    if (availableFrom !== undefined) frame.availableFrom = availableFrom ? new Date(availableFrom) : null;
    if (availableUntil !== undefined) frame.availableUntil = availableUntil ? new Date(availableUntil) : null;
    if (isWeeklyFree !== undefined) {
      if (isWeeklyFree) {
        await Frame.updateMany({ isWeeklyFree: true }, { isWeeklyFree: false });
      }
      frame.isWeeklyFree = Boolean(isWeeklyFree);
    }

    await frame.save();
    res.json({ message: "Frame updated", frame });
  } catch (err: any) {
    req.log.error({ err }, "owner patch frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/owner/create — create a new custom frame
router.post("/owner/create", requireAuth, requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const {
      frameId, displayName, rarity, glowColor, animationType,
      variantIndex, price, currency, description, earnedBy,
    } = req.body;

    if (!frameId || !displayName || !rarity || !glowColor || !animationType) {
      return res.status(400).json({ message: "frameId, displayName, rarity, glowColor, animationType required" });
    }

    const existing = await Frame.findOne({ frameId });
    if (existing) return res.status(400).json({ message: "Frame ID already exists" });

    const frame = await Frame.create({
      frameId,
      displayName,
      rarity,
      glowColor,
      animationType,
      variantIndex: variantIndex ?? 0,
      price: price ?? 0,
      currency: currency ?? "dc",
      description: description ?? "",
      earnedBy: earnedBy || null,
      isCustom: true,
      isVisible: true,
      isFeatured: false,
    });

    res.json({ message: "Frame created", frame });
  } catch (err: any) {
    req.log.error({ err }, "owner create frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/owner/revoke — revoke a frame from a player
router.post("/owner/revoke", requireAuth, requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { frameId, userId } = req.body;
    if (!frameId || !userId) return res.status(400).json({ message: "frameId and userId required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.ownedFrames.includes(frameId)) {
      return res.status(400).json({ message: "Player does not own this frame" });
    }

    user.ownedFrames = user.ownedFrames.filter((f: string) => f !== frameId);
    if (user.equippedFrame === frameId) {
      user.equippedFrame = "ghostFrame";
      user.equippedFrameRarity = "common";
    }
    user.markModified("ownedFrames");
    await user.save();

    req.log.info({ frameId, userId }, "frame revoked from player");
    res.json({ message: `Frame revoked from ${user.username}` });
  } catch (err: any) {
    req.log.error({ err }, "owner revoke frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/frames/owner/:frameId — delete a custom frame
router.delete("/owner/:frameId", requireAuth, requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const frame = await Frame.findOne({ frameId: req.params.frameId });
    if (!frame) return res.status(404).json({ message: "Frame not found" });
    if (!frame.isCustom) return res.status(403).json({ message: "Cannot delete built-in frames" });

    await frame.deleteOne();
    res.json({ message: "Frame deleted" });
  } catch (err: any) {
    req.log.error({ err }, "owner delete frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/owner/grant — grant a frame to a player
router.post("/owner/grant", requireAuth, requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { frameId, targetUserId } = req.body;
    if (!frameId || !targetUserId) return res.status(400).json({ message: "frameId and targetUserId required" });

    const frame = await Frame.findOne({ frameId });
    if (!frame) return res.status(404).json({ message: "Frame not found" });

    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.ownedFrames.includes(frameId)) {
      user.ownedFrames.push(frameId);
      user.markModified("ownedFrames");
      await user.save();
    }

    res.json({ message: `${frame.displayName} granted to ${user.username}`, ownedFrames: user.ownedFrames });
  } catch (err: any) {
    req.log.error({ err }, "owner grant frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/owner/revoke — revoke a frame from a player
router.post("/owner/revoke", requireAuth, requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { frameId, targetUserId } = req.body;
    if (!frameId || !targetUserId) return res.status(400).json({ message: "frameId and targetUserId required" });

    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.ownedFrames = user.ownedFrames.filter(f => f !== frameId);
    user.markModified("ownedFrames");
    if (user.equippedFrame === frameId) {
      user.equippedFrame = "ghostFrame";
      user.equippedFrameRarity = "common";
    }
    await user.save();

    res.json({ message: `Frame revoked from ${user.username}` });
  } catch (err: any) {
    req.log.error({ err }, "owner revoke frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/owner/bulk — bulk actions
router.post("/owner/bulk", requireAuth, requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { frameIds, action, value } = req.body;
    if (!Array.isArray(frameIds) || !action) return res.status(400).json({ message: "frameIds and action required" });

    if (action === "hide") {
      await Frame.updateMany({ frameId: { $in: frameIds } }, { isVisible: false });
    } else if (action === "show") {
      await Frame.updateMany({ frameId: { $in: frameIds } }, { isVisible: true });
    } else if (action === "sale") {
      const { salePrice, saleExpiry } = value || {};
      await Frame.updateMany(
        { frameId: { $in: frameIds } },
        { salePrice: salePrice ?? null, saleExpiry: saleExpiry ? new Date(saleExpiry) : null }
      );
    } else {
      return res.status(400).json({ message: "Unknown action" });
    }

    res.json({ message: `Bulk ${action} applied to ${frameIds.length} frames` });
  } catch (err: any) {
    req.log.error({ err }, "owner bulk frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
