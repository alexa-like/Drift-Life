import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import FriendRequest from "../models/FriendRequest";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/friends — list accepted friends
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("friends", "username tag avatar avatarUrl level faction equippedFrame district")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json((user as any).friends || []);
  } catch (err: any) {
    req.log.error({ err }, "get friends error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/friends/requests — pending friend requests sent TO me
router.get("/requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const requests = await FriendRequest.find({ to: req.userId, status: "pending" })
      .populate("from", "username tag avatar avatarUrl level faction")
      .lean();
    res.json(requests);
  } catch (err: any) {
    req.log.error({ err }, "get friend requests error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/friends/request — send friend request
router.post("/request", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body;
    if (!targetId || typeof targetId !== "string" || !mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ message: "targetId required" });
    }
    if (targetId === req.userId) {
      return res.status(400).json({ message: "Cannot friend yourself" });
    }

    const target = await User.findById(targetId).lean();
    if (!target) return res.status(404).json({ message: "Player not found" });

    const existing = await FriendRequest.findOne({
      $or: [
        { from: req.userId, to: targetId },
        { from: targetId, to: req.userId },
      ],
      status: "pending",
    });
    if (existing) return res.status(400).json({ message: "Friend request already exists" });

    await FriendRequest.create({ from: req.userId, to: targetId });
    res.json({ message: "Friend request sent" });
  } catch (err: any) {
    req.log.error({ err }, "send friend request error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/friends/accept — accept a pending request
router.post("/accept", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId || !mongoose.isValidObjectId(requestId)) return res.status(400).json({ message: "requestId required" });

    const request = await FriendRequest.findOne({
      _id: requestId,
      to: req.userId,
      status: "pending",
    });
    if (!request) return res.status(404).json({ message: "Friend request not found" });

    await FriendRequest.findByIdAndUpdate(requestId, { $set: { status: "accepted" } });
    await Promise.all([
      User.findByIdAndUpdate(req.userId, { $addToSet: { friends: request.from } }),
      User.findByIdAndUpdate(request.from, { $addToSet: { friends: req.userId } }),
    ]);
    res.json({ message: "Friend request accepted" });
  } catch (err: any) {
    req.log.error({ err }, "accept friend request error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/friends/request/:requestId — decline / cancel a pending request
router.delete("/request/:requestId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const request = await FriendRequest.findOne({
      _id: req.params.requestId,
      $or: [{ from: req.userId }, { to: req.userId }],
      status: "pending",
    });
    if (!request) return res.status(404).json({ message: "Request not found" });
    await FriendRequest.findByIdAndUpdate(request._id, { $set: { status: "rejected" } });
    res.json({ message: "Request declined" });
  } catch (err: any) {
    req.log.error({ err }, "decline friend request error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/friends/:friendId — remove friend
router.delete("/:friendId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { friendId } = req.params;
    if (!mongoose.isValidObjectId(friendId)) return res.status(400).json({ message: "Invalid friendId" });
    await Promise.all([
      User.findByIdAndUpdate(req.userId, { $pull: { friends: friendId } }),
      User.findByIdAndUpdate(friendId, { $pull: { friends: req.userId } }),
    ]);
    res.json({ message: "Friend removed" });
  } catch (err: any) {
    req.log.error({ err }, "remove friend error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
