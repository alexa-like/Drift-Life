import { Router } from "express";
import mongoose from "mongoose";
import Faction, { IFaction, FACTION_CREATE_COST, FACTION_CREATE_LEVEL } from "../models/Faction";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function memberCount(f: IFaction): number {
  return 1 + f.coLeaderIds.length + f.officerIds.length + f.memberIds.length + f.recruitIds.length;
}

function getRoleInFaction(
  f: IFaction,
  userId: string
): "leader" | "co-leader" | "officer" | "member" | "recruit" | null {
  if (f.leaderId.toString() === userId) return "leader";
  if (f.coLeaderIds.some(id => id.toString() === userId)) return "co-leader";
  if (f.officerIds.some(id => id.toString() === userId)) return "officer";
  if (f.memberIds.some(id => id.toString() === userId)) return "member";
  if (f.recruitIds.some(id => id.toString() === userId)) return "recruit";
  return null;
}

const ALLOWED_COLORS  = ["#00d4ff", "#ff2d55", "#f59e0b", "#a855f7", "#39d353", "#ff6b35", "#e879f9", "#22d3ee", "#64748b", "#0ea5e9"];
const ALLOWED_EMBLEMS = ["◆", "◉", "◈", "⬡", "▲", "★", "♦", "✦", "◎", "⬢", "✺", "⊕", "⚔", "🔥", "⚡", "💀", "🐍", "🦅", "🐉", "🕷"];

// ── GET /api/factions — list all (for browsing) ───────────────────────────────
router.get("/", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const factions = await Faction.find().sort({ respect: -1, level: -1 }).limit(50).lean();
    res.json(factions.map(f => ({
      id:          f._id,
      name:        f.name,
      tag:         f.tag,
      description: f.description,
      color:       f.color,
      emblem:      f.emblem,
      level:       f.level,
      respect:     f.respect,
      isRecruiting: f.isRecruiting,
      memberCount: 1 + f.coLeaderIds.length + f.officerIds.length + f.memberIds.length + f.recruitIds.length,
      maxMembers:  f.maxMembers,
    })));
  } catch (err) {
    (_req as AuthRequest).log.error({ err }, "GET /factions error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/factions/standings ───────────────────────────────────────────────
router.get("/standings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const factions = await Faction.find().sort({ respect: -1, level: -1 }).limit(20).lean();
    const factionIds = factions.map(f => f._id);

    const userStats = await User.aggregate([
      { $match: { banned: false, factionId: { $in: factionIds } } },
      {
        $group: {
          _id:          "$factionId",
          players:      { $sum: 1 },
          totalWins:    { $sum: "$wins" },
          totalCrimes:  { $sum: "$totalCrimes" },
          totalWealth:  { $sum: { $add: ["$dc", "$bankBalance"] } },
        },
      },
    ]);

    const statsMap: Record<string, { players: number; totalWins: number; totalCrimes: number; totalWealth: number }> =
      Object.fromEntries(userStats.map(s => [s._id.toString(), s]));

    res.json(factions.map((f, i) => {
      const s = statsMap[f._id.toString()] ?? { players: 0, totalWins: 0, totalCrimes: 0, totalWealth: 0 };
      return {
        rank:        i + 1,
        id:          f._id,
        name:        f.name,
        tag:         f.tag,
        color:       f.color,
        emblem:      f.emblem,
        level:       f.level,
        respect:     f.respect,
        players:     s.players,
        totalWins:   s.totalWins,
        totalCrimes: s.totalCrimes,
        totalWealth: s.totalWealth,
        influence:   f.respect + s.totalWins * 5 + s.totalCrimes * 2,
      };
    }));
  } catch (err) {
    req.log.error({ err }, "GET /factions/standings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/factions/mine ────────────────────────────────────────────────────
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userDoc = await User.findById(req.userId).select("factionId factionRole").lean();
    const factionId = (userDoc as { factionId?: mongoose.Types.ObjectId | null })?.factionId;
    if (!userDoc || !factionId) return res.json(null);

    const faction = await Faction.findById(factionId).lean();
    if (!faction) return res.json(null);

    const allIds: mongoose.Types.ObjectId[] = [
      faction.leaderId,
      ...faction.coLeaderIds,
      ...faction.officerIds,
      ...faction.memberIds,
      ...faction.recruitIds,
    ];

    const memberDocs = await User.find({ _id: { $in: allIds } })
      .select("username level")
      .lean();
    const memberMap: Record<string, { username: string; level: number }> =
      Object.fromEntries(memberDocs.map(m => [m._id.toString(), { username: m.username, level: m.level }]));

    function buildMember(id: mongoose.Types.ObjectId, role: string): object | null {
      const m = memberMap[id.toString()];
      if (!m) return null;
      return { id: id.toString(), username: m.username, level: m.level, role };
    }

    res.json({
      id:          faction._id,
      name:        faction.name,
      tag:         faction.tag,
      description: faction.description,
      color:       faction.color,
      emblem:      faction.emblem,
      level:       faction.level,
      xp:          faction.xp,
      treasury:    faction.treasury,
      respect:     faction.respect,
      isRecruiting: faction.isRecruiting,
      maxMembers:  faction.maxMembers,
      myRole:      (userDoc as { factionRole?: string }).factionRole ?? "member",
      memberCount: memberCount(faction as IFaction),
      members: [
        buildMember(faction.leaderId, "leader"),
        ...faction.coLeaderIds.map(id => buildMember(id, "co-leader")),
        ...faction.officerIds.map(id => buildMember(id, "officer")),
        ...faction.memberIds.map(id => buildMember(id, "member")),
        ...faction.recruitIds.map(id => buildMember(id, "recruit")),
      ].filter(Boolean),
    });
  } catch (err) {
    req.log.error({ err }, "GET /factions/mine error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/factions — create faction ──────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.level < FACTION_CREATE_LEVEL)
      return res.status(400).json({ message: `Requires level ${FACTION_CREATE_LEVEL} to create a faction` });
    if (user.dc < FACTION_CREATE_COST)
      return res.status(400).json({ message: `Creating a faction costs ${FACTION_CREATE_COST.toLocaleString()} DC` });
    if ((user as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId)
      return res.status(400).json({ message: "You are already in a faction. Leave first." });

    const { name, tag, description, color, emblem } = req.body as {
      name: string; tag: string; description?: string; color?: string; emblem?: string;
    };

    if (!name?.trim() || name.trim().length < 3)
      return res.status(400).json({ message: "Faction name must be at least 3 characters" });
    if (!tag?.trim())
      return res.status(400).json({ message: "Faction tag is required" });

    const cleanTag = tag.trim().toUpperCase().slice(0, 5);
    if (cleanTag.length < 2)
      return res.status(400).json({ message: "Tag must be at least 2 characters" });

    const [nameTaken, tagTaken] = await Promise.all([
      Faction.findOne({ name: { $regex: `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }),
      Faction.findOne({ tag: cleanTag }),
    ]);
    if (nameTaken) return res.status(400).json({ message: "Faction name already taken" });
    if (tagTaken)  return res.status(400).json({ message: "Faction tag already taken" });

    const chosenColor  = color  && ALLOWED_COLORS.includes(color)   ? color  : "#00d4ff";
    const chosenEmblem = emblem && ALLOWED_EMBLEMS.includes(emblem)  ? emblem : "◆";

    const faction = await Faction.create({
      name:        name.trim(),
      tag:         cleanTag,
      description: description?.trim().slice(0, 300) ?? "",
      color:       chosenColor,
      emblem:      chosenEmblem,
      leaderId:    user._id,
    });

    user.dc -= FACTION_CREATE_COST;
    (user as unknown as { factionId: mongoose.Types.ObjectId; factionRole: string }).factionId   = faction._id;
    (user as unknown as { factionId: mongoose.Types.ObjectId; factionRole: string }).factionRole = "leader";
    user.faction = cleanTag;
    await user.save();

    res.status(201).json({ message: "Faction created!", factionId: faction._id });
  } catch (err) {
    req.log.error({ err }, "POST /factions error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/factions/leave ──────────────────────────────────────────────────
router.post("/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const factionId = (user as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!factionId) return res.status(400).json({ message: "You are not in a faction" });

    const faction = await Faction.findById(factionId);
    if (!faction) {
      (user as unknown as { factionId: null; factionRole: null }).factionId   = null;
      (user as unknown as { factionId: null; factionRole: null }).factionRole = null;
      user.faction = null;
      await user.save();
      return res.json({ message: "Left faction" });
    }

    if (faction.leaderId.equals(user._id)) {
      const others = faction.coLeaderIds.length + faction.officerIds.length +
                     faction.memberIds.length + faction.recruitIds.length;
      if (others > 0)
        return res.status(400).json({ message: "Transfer leadership to another member before leaving" });
      await Faction.findByIdAndDelete(faction._id);
    } else {
      faction.coLeaderIds = faction.coLeaderIds.filter(id => !id.equals(user._id));
      faction.officerIds  = faction.officerIds.filter(id => !id.equals(user._id));
      faction.memberIds   = faction.memberIds.filter(id => !id.equals(user._id));
      faction.recruitIds  = faction.recruitIds.filter(id => !id.equals(user._id));
      await faction.save();
    }

    (user as unknown as { factionId: null; factionRole: null }).factionId   = null;
    (user as unknown as { factionId: null; factionRole: null }).factionRole = null;
    user.faction = null;
    await user.save();

    res.json({ message: "You have left the faction" });
  } catch (err) {
    req.log.error({ err }, "POST /factions/leave error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/factions/kick ───────────────────────────────────────────────────
router.post("/kick", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const myFactionId = (user as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!myFactionId) return res.status(400).json({ message: "You are not in a faction" });

    const myRole = (user as unknown as { factionRole?: string }).factionRole ?? "";
    if (!["leader", "co-leader", "officer"].includes(myRole))
      return res.status(403).json({ message: "Only officers and above can kick members" });

    const faction = await Faction.findById(myFactionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    const targetFactionId = (target as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!targetFactionId || targetFactionId.toString() !== faction._id.toString())
      return res.status(404).json({ message: "Player is not in your faction" });

    const targetRole = (target as unknown as { factionRole?: string }).factionRole ?? "";
    if (targetRole === "leader")       return res.status(400).json({ message: "Cannot kick the faction leader" });
    if (targetRole === "co-leader" && myRole !== "leader")
      return res.status(403).json({ message: "Only the leader can kick co-leaders" });
    if (targetRole === "officer" && myRole === "officer")
      return res.status(403).json({ message: "Officers cannot kick each other" });

    faction.coLeaderIds = faction.coLeaderIds.filter(id => !id.equals(target._id));
    faction.officerIds  = faction.officerIds.filter(id => !id.equals(target._id));
    faction.memberIds   = faction.memberIds.filter(id => !id.equals(target._id));
    faction.recruitIds  = faction.recruitIds.filter(id => !id.equals(target._id));

    (target as unknown as { factionId: null; factionRole: null }).factionId   = null;
    (target as unknown as { factionId: null; factionRole: null }).factionRole = null;
    target.faction = null;

    await Promise.all([faction.save(), target.save()]);

    Notification.create({
      userId: target._id,
      type:    "system",
      message: `You have been removed from ${faction.name}`,
    }).catch(() => {});

    res.json({ message: `${target.username} has been removed from the faction` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/kick error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/factions/promote ────────────────────────────────────────────────
router.post("/promote", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const myFactionId = (user as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!myFactionId) return res.status(400).json({ message: "You are not in a faction" });

    const myRole = (user as unknown as { factionRole?: string }).factionRole ?? "";
    if (!["leader", "co-leader"].includes(myRole))
      return res.status(403).json({ message: "Only co-leaders and above can promote members" });

    const faction = await Faction.findById(myFactionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    const targetFactionId = (target as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!targetFactionId || targetFactionId.toString() !== faction._id.toString())
      return res.status(404).json({ message: "Player is not in your faction" });

    const targetRole = (target as unknown as { factionRole?: string }).factionRole ?? "";
    const targetUserRef = target as unknown as { factionRole: string };

    if (targetRole === "recruit") {
      faction.recruitIds = faction.recruitIds.filter(id => !id.equals(target._id));
      faction.memberIds.push(target._id);
      targetUserRef.factionRole = "member";
    } else if (targetRole === "member") {
      faction.memberIds = faction.memberIds.filter(id => !id.equals(target._id));
      faction.officerIds.push(target._id);
      targetUserRef.factionRole = "officer";
    } else if (targetRole === "officer" && myRole === "leader") {
      faction.officerIds = faction.officerIds.filter(id => !id.equals(target._id));
      faction.coLeaderIds.push(target._id);
      targetUserRef.factionRole = "co-leader";
    } else {
      return res.status(400).json({ message: "Cannot promote further (or insufficient rank)" });
    }

    await Promise.all([faction.save(), target.save()]);

    Notification.create({
      userId: target._id,
      type:    "system",
      message: `You have been promoted to ${targetUserRef.factionRole} in ${faction.name}`,
    }).catch(() => {});

    res.json({ message: `${target.username} promoted to ${targetUserRef.factionRole}` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/promote error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/factions/demote ─────────────────────────────────────────────────
router.post("/demote", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const myFactionId = (user as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!myFactionId) return res.status(400).json({ message: "You are not in a faction" });

    if ((user as unknown as { factionRole?: string }).factionRole !== "leader")
      return res.status(403).json({ message: "Only the faction leader can demote members" });

    const faction = await Faction.findById(myFactionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    const targetFactionId = (target as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!targetFactionId || targetFactionId.toString() !== faction._id.toString())
      return res.status(404).json({ message: "Player is not in your faction" });

    const targetRole = (target as unknown as { factionRole?: string }).factionRole ?? "";
    const targetRef  = target as unknown as { factionRole: string };

    if (targetRole === "co-leader") {
      faction.coLeaderIds = faction.coLeaderIds.filter(id => !id.equals(target._id));
      faction.officerIds.push(target._id);
      targetRef.factionRole = "officer";
    } else if (targetRole === "officer") {
      faction.officerIds = faction.officerIds.filter(id => !id.equals(target._id));
      faction.memberIds.push(target._id);
      targetRef.factionRole = "member";
    } else if (targetRole === "member") {
      faction.memberIds = faction.memberIds.filter(id => !id.equals(target._id));
      faction.recruitIds.push(target._id);
      targetRef.factionRole = "recruit";
    } else {
      return res.status(400).json({ message: "Cannot demote further" });
    }

    await Promise.all([faction.save(), target.save()]);
    res.json({ message: `${target.username} demoted to ${targetRef.factionRole}` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/demote error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/factions/treasury/donate ───────────────────────────────────────
router.post("/treasury/donate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || amount < 1_000) return res.status(400).json({ message: "Minimum donation is 1,000 DC" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const factionId = (user as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!factionId) return res.status(400).json({ message: "You are not in a faction" });
    if (user.dc < amount) return res.status(400).json({ message: "Insufficient DC" });

    const faction = await Faction.findById(factionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    user.dc -= amount;
    faction.treasury += amount;
    faction.xp += Math.floor(amount / 10_000);

    // Faction level-up
    while (faction.xp >= faction.level * 1_000) {
      faction.xp -= faction.level * 1_000;
      faction.level += 1;
      faction.maxMembers = 50 + (faction.level - 1) * 10;
    }

    await Promise.all([user.save(), faction.save()]);
    res.json({ message: `Donated ${amount.toLocaleString()} DC to ${faction.name}`, treasury: faction.treasury, level: faction.level });
  } catch (err) {
    req.log.error({ err }, "POST /factions/treasury/donate error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PATCH /api/factions/settings ─────────────────────────────────────────────
router.patch("/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const factionId = (user as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId;
    if (!factionId) return res.status(400).json({ message: "You are not in a faction" });
    if ((user as unknown as { factionRole?: string }).factionRole !== "leader")
      return res.status(403).json({ message: "Only the faction leader can edit settings" });

    const faction = await Faction.findById(factionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const { description, isRecruiting } = req.body as { description?: string; isRecruiting?: boolean };
    if (description  !== undefined) faction.description  = description.trim().slice(0, 300);
    if (isRecruiting !== undefined) faction.isRecruiting = isRecruiting;

    await faction.save();
    res.json({ message: "Settings updated" });
  } catch (err) {
    req.log.error({ err }, "PATCH /factions/settings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/factions/:id/join ───────────────────────────────────────────────
router.post("/:id/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user as unknown as { factionId?: mongoose.Types.ObjectId | null }).factionId)
      return res.status(400).json({ message: "You are already in a faction. Leave first." });

    const faction = await Faction.findById(req.params["id"]);
    if (!faction) return res.status(404).json({ message: "Faction not found" });
    if (!faction.isRecruiting)
      return res.status(400).json({ message: "This faction is not currently recruiting" });

    const total = 1 + faction.coLeaderIds.length + faction.officerIds.length +
                  faction.memberIds.length + faction.recruitIds.length;
    if (total >= faction.maxMembers)
      return res.status(400).json({ message: "Faction is at full capacity" });

    faction.recruitIds.push(user._id);
    (user as unknown as { factionId: mongoose.Types.ObjectId; factionRole: string }).factionId   = faction._id;
    (user as unknown as { factionId: mongoose.Types.ObjectId; factionRole: string }).factionRole = "recruit";
    user.faction = faction.tag;

    await Promise.all([faction.save(), user.save()]);

    Notification.create({
      userId:  faction.leaderId,
      type:    "system",
      message: `${user.username} joined ${faction.name} as a recruit`,
    }).catch(() => {});

    res.json({ message: `You joined ${faction.name} as a recruit` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/:id/join error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
