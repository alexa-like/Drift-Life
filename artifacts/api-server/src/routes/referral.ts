import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import User from "../models/User";

const router = Router();

// GET /api/referral — player's referral code + stats
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("referralCode referralCount referralRewardsClaimed username")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Count how many referred players have actually reached level 5
    const reachedLevel5 = user.referralRewardsClaimed ?? 0;

    res.json({
      referralCode:          user.referralCode,
      referralLink:          `https://neonoir.app/register?ref=${user.referralCode}`,
      totalSignups:          user.referralCount ?? 0,
      reachedLevel5,
      pendingRewards:        Math.max(0, (user.referralCount ?? 0) - reachedLevel5),
    });
  } catch (err: any) {
    req.log.error({ err }, "referral stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
