import { Router } from "express";
import User from "../../models/User";
import { WALLET_CAP, BANK_CAP } from "../../models/User";

import { requireAuth, AuthRequest } from "../../middlewares/auth";
import { validateBody } from "../../middlewares/validate";
import { bankAmountSchema, bankTransferSchema } from "../../lib/schemas";

const router = Router();

// GET /api/bank
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select("dc bankBalance").lean();
  if (!user) return res.status(404).json({ message: "Not found" });
  res.json({ wallet: user.dc, bank: user.bankBalance });
});

// POST /api/bank/deposit
router.post("/deposit", requireAuth, validateBody(bankAmountSchema), async (req: AuthRequest, res) => {
  try {
    const amount = Math.floor(Number(req.body.amount));
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    // ATOMIC: check wallet has enough AND bank won't overflow, deduct both in one op
    const updated = await User.findOneAndUpdate(
      {
        _id: req.userId,
        dc: { $gte: amount },
        bankBalance: { $lte: BANK_CAP - amount },
      },
      { $inc: { dc: -amount, bankBalance: amount } },
      { returnDocument: 'after' },
    );

    if (!updated) {
      // Distinguish failure reason for a helpful error message
      const user = await User.findById(req.userId).select("dc bankBalance").lean();
      if (!user) return res.status(404).json({ message: "Not found" });
      if ((user as any).dc < amount) return res.status(400).json({ message: "Insufficient funds" });
      return res.status(400).json({ message: `Bank is full — max ${(BANK_CAP / 1_000_000_000).toFixed(0)}B DC` });
    }

    res.json({ wallet: updated.dc, bank: updated.bankBalance, message: `Deposited ${amount.toLocaleString()} DC` });
  } catch (err: any) {
    req.log.error({ err }, "deposit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/bank/withdraw
router.post("/withdraw", requireAuth, validateBody(bankAmountSchema), async (req: AuthRequest, res) => {
  try {
    const amount = Math.floor(Number(req.body.amount));
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    // ATOMIC: check bank has enough AND wallet won't overflow, deduct both in one op
    const updated = await User.findOneAndUpdate(
      {
        _id: req.userId,
        bankBalance: { $gte: amount },
        dc: { $lte: WALLET_CAP - amount },
      },
      { $inc: { bankBalance: -amount, dc: amount } },
      { returnDocument: 'after' },
    );

    if (!updated) {
      const user = await User.findById(req.userId).select("dc bankBalance").lean();
      if (!user) return res.status(404).json({ message: "Not found" });
      if ((user as any).bankBalance < amount) return res.status(400).json({ message: "Insufficient funds" });
      return res.status(400).json({ message: `Wallet is full — max ${(WALLET_CAP / 1_000_000).toFixed(0)}M DC on hand. Deposit some first.` });
    }

    res.json({ wallet: updated.dc, bank: updated.bankBalance, message: `Withdrew ${amount.toLocaleString()} DC` });
  } catch (err: any) {
    req.log.error({ err }, "withdraw error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/bank/transfer — 7% wire fee on all player-to-player transfers
router.post("/transfer", requireAuth, validateBody(bankTransferSchema), async (req: AuthRequest, res) => {
  try {
    const { targetUsername, amount: rawAmount } = req.body;
    if (typeof targetUsername !== "string" || !targetUsername) {
      return res.status(400).json({ message: "targetUsername and amount required" });
    }
    const amount = Math.floor(Number(rawAmount));
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const WIRE_FEE_PCT = 0.07;
    const fee = Math.max(1, Math.floor(amount * WIRE_FEE_PCT));
    const totalCost = amount + fee;

    const recipient = await User.findOne({ username: targetUsername }).select("_id username dc").lean();
    if (!recipient) return res.status(404).json({ message: "Recipient not found" });
    if (String(recipient._id) === req.userId) {
      return res.status(400).json({ message: "Cannot transfer to yourself" });
    }
    if ((recipient as any).dc + amount > WALLET_CAP) {
      return res.status(400).json({ message: `Recipient's wallet is full — they can hold max ${(WALLET_CAP / 1_000_000).toFixed(0)}M DC on hand` });
    }

    // ATOMIC: deduct sender DC + fee with balance check
    const sender = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: totalCost } },
      { $inc: { dc: -totalCost } },
      { returnDocument: 'after' },
    );
    if (!sender) return res.status(400).json({ message: `Insufficient funds — transfer costs ${totalCost.toLocaleString()} DC (${amount.toLocaleString()} + ${fee.toLocaleString()} wire fee)` });

    // Credit recipient — aggregation pipeline enforces wallet cap atomically
    await User.findByIdAndUpdate(
      recipient._id,
      [{ $set: { dc: { $min: [{ $add: ["$dc", amount] }, WALLET_CAP] } } }],
      { updatePipeline: true },
    );

    res.json({
      wallet: sender.dc,
      bank: sender.bankBalance,
      fee,
      message: `Transferred ${amount.toLocaleString()} DC to ${recipient.username} (${fee.toLocaleString()} DC wire fee)`,
    });
  } catch (err: any) {
    req.log.error({ err }, "transfer error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
