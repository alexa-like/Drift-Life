import { Router } from "express";
import User from "../models/User";
import { WALLET_CAP, BANK_CAP } from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/bank
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select("dc bankBalance").lean();
  if (!user) return res.status(404).json({ message: "Not found" });
  res.json({ wallet: user.dc, bank: user.bankBalance });
});

// POST /api/bank/deposit
router.post("/deposit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Math.floor(Number(req.body.amount));
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    if (user.dc < amount) return res.status(400).json({ message: "Insufficient funds" });
    if (user.bankBalance + amount > BANK_CAP)
      return res.status(400).json({ message: `Bank is full — max ${(BANK_CAP / 1_000_000_000).toFixed(0)}B DC` });

    user.dc -= amount;
    user.bankBalance += amount;
    await user.save();

    res.json({ wallet: user.dc, bank: user.bankBalance, message: `Deposited ${amount} DC` });
  } catch (err: any) {
    req.log.error({ err }, "deposit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/bank/withdraw
router.post("/withdraw", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Math.floor(Number(req.body.amount));
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    if (user.bankBalance < amount) return res.status(400).json({ message: "Insufficient funds" });
    if (user.dc + amount > WALLET_CAP)
      return res.status(400).json({ message: `Wallet is full — max ${(WALLET_CAP / 1_000_000).toFixed(0)}M DC on hand. Deposit some first.` });

    user.bankBalance -= amount;
    user.dc += amount;
    await user.save();

    res.json({ wallet: user.dc, bank: user.bankBalance, message: `Withdrew ${amount} DC` });
  } catch (err: any) {
    req.log.error({ err }, "withdraw error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/bank/transfer
router.post("/transfer", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetUsername, amount: rawAmount } = req.body;
    const amount = Math.floor(Number(rawAmount));
    if (!targetUsername || !amount || amount <= 0)
      return res.status(400).json({ message: "targetUsername and amount required" });

    const [sender, recipient] = await Promise.all([
      User.findById(req.userId),
      User.findOne({ username: targetUsername }),
    ]);

    if (!sender) return res.status(404).json({ message: "Not found" });
    if (!recipient) return res.status(404).json({ message: "Recipient not found" });
    if (String(sender._id) === String(recipient._id))
      return res.status(400).json({ message: "Cannot transfer to yourself" });
    if (sender.dc < amount) return res.status(400).json({ message: "Insufficient funds" });
    if (recipient.dc + amount > WALLET_CAP)
      return res.status(400).json({ message: `Recipient's wallet is full — they can hold max ${(WALLET_CAP / 1_000_000).toFixed(0)}M DC on hand` });

    sender.dc -= amount;
    recipient.dc += amount;
    await Promise.all([sender.save(), recipient.save()]);

    await FeedEvent.create({
      type: "bank",
      actor: sender.username,
      actorId: sender._id,
      target: recipient.username,
      targetId: recipient._id,
      message: `${sender.username} transferred ${amount} DC to ${recipient.username}`,
      dc: amount,
    });

    res.json({ wallet: sender.dc, bank: sender.bankBalance, message: `Transferred ${amount} DC to ${recipient.username}` });
  } catch (err: any) {
    req.log.error({ err }, "transfer error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
