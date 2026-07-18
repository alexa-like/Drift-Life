import { Router } from "express";
import mongoose from "mongoose";
import Faction, {
  IFaction,
  FACTION_CREATE_COST,
  FACTION_CREATE_LEVEL,
  addFactionNews,
} from "../models/Faction";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// ── Shared helpers ────────────────────────────────────────────────────────────

function memberCount(f: IFaction): number {
  return 1 + f.coLeaderIds.length + f.officerIds.length + f.memberIds.length + f.recruitIds.length;
}

function getRoleInFaction(
  f: IFaction,
  userId: string
): "leader" | "co-leader" | "officer" | "member" | "recruit" | null {
  if (f.leaderId.toString() === userId) return "leader";
  if (f.coLeaderIds.some(id => id.toString() === userId)) return "co-leader";
  if (f.officerIds.some(id => id.toString() === userId))  return "officer";
  if (f.memberIds.some(id => id.toString() === userId))   return "member";
  if (f.recruitIds.some(id => id.toString() === userId))  return "recruit";
  return null;
}

function removeFromAllLists(f: IFaction, uid: mongoose.Types.ObjectId): void {
  f.coLeaderIds = f.coLeaderIds.filter(id => !id.equals(uid));
  f.officerIds  = f.officerIds.filter(id => !id.equals(uid));
  f.memberIds   = f.memberIds.filter(id => !id.equals(uid));
  f.recruitIds  = f.recruitIds.filter(id => !id.equals(uid));
}

const ALLOWED_COLORS  = ["#00d4ff","#ff2d55","#f59e0b","#a855f7","#39d353","#ff6b35","#e879f9","#22d3ee","#64748b","#0ea5e9"];
const ALLOWED_EMBLEMS = ["◆","◉","◈","⬡","▲","★","♦","✦","◎","⬢","✺","⊕","⚔","🔥","⚡","💀","🐍","🦅","🐉","🕷"];

// ═══════════════════════════════════════════════════════════════════════════════
// READ ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/factions — public browse list ─────────────────────────────────────
router.get("/", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const factions = await Faction.find().sort({ respect: -1, level: -1 }).limit(50).lean();
    res.json(factions.map(f => ({
      id:           f._id,
      name:         f.name,
      tag:          f.tag,
      description:  f.description,
      color:        f.color,
      emblem:       f.emblem,
      level:        f.level,
      respect:      f.respect,
      isRecruiting: f.isRecruiting,
      memberCount:  1 + f.coLeaderIds.length + f.officerIds.length + f.memberIds.length + f.recruitIds.length,
      maxMembers:   f.maxMembers,
    })));
  } catch (err) {
    (_req as AuthRequest).log.error({ err }, "GET /factions error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/factions/standings ─────────────────────────────────────────────────
router.get("/standings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const factions = await Faction.find().sort({ respect: -1, level: -1 }).limit(20).lean();
    const factionIds = factions.map(f => f._id);

    const userStats = await User.aggregate([
      { $match: { banned: false, factionId: { $in: factionIds } } },
      { $group: {
        _id:         "$factionId",
        players:     { $sum: 1 },
        totalWins:   { $sum: "$wins" },
        totalCrimes: { $sum: "$totalCrimes" },
        totalWealth: { $sum: { $add: ["$dc", "$bankBalance"] } },
      }},
    ]);
    const statsMap = Object.fromEntries(userStats.map(s => [s._id.toString(), s]));

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

// GET /api/factions/mine — my faction data ────────────────────────────────────
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userDoc = await User.findById(req.userId).select("factionId factionRole").lean();
    const factionId = (userDoc as any)?.factionId;
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
    const memberDocs = await User.find({ _id: { $in: allIds } }).select("username level").lean();
    const memberMap = Object.fromEntries(memberDocs.map(m => [m._id.toString(), { username: m.username, level: m.level }]));

    function buildMember(id: mongoose.Types.ObjectId, role: string) {
      const m = memberMap[id.toString()];
      if (!m) return null;
      return { id: id.toString(), username: m.username, level: m.level, role };
    }

    res.json({
      id:           faction._id,
      name:         faction.name,
      tag:          faction.tag,
      description:  faction.description,
      color:        faction.color,
      emblem:       faction.emblem,
      level:        faction.level,
      xp:           faction.xp,
      treasury:     faction.treasury,
      respect:      faction.respect,
      isRecruiting: faction.isRecruiting,
      maxMembers:   faction.maxMembers,
      myRole:       (userDoc as any).factionRole ?? "member",
      memberCount:  memberCount(faction as IFaction),
      pendingInviteCount: (faction as any).pendingInvites?.length ?? 0,
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

// GET /api/factions/invites — pending invites sent TO current user ─────────────
router.get("/invites", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(String(req.userId));
    const factions = await Faction.find({ "pendingInvites.userId": uid })
      .select("name tag color emblem level respect pendingInvites")
      .lean();

    const inviterIds = factions.flatMap(f =>
      ((f as any).pendingInvites as any[])
        .filter((inv: any) => inv.userId.toString() === String(req.userId))
        .map((inv: any) => inv.invitedBy)
    );
    const inviters = await User.find({ _id: { $in: inviterIds } }).select("username").lean();
    const inviterMap = Object.fromEntries(inviters.map(u => [u._id.toString(), u.username]));

    const result = factions.flatMap(f =>
      ((f as any).pendingInvites as any[])
        .filter((inv: any) => inv.userId.toString() === String(req.userId))
        .map((inv: any) => ({
          factionId:      f._id,
          factionName:    f.name,
          factionTag:     f.tag,
          factionColor:   f.color,
          factionEmblem:  f.emblem,
          factionLevel:   f.level,
          factionRespect: f.respect,
          invitedBy:      inviterMap[inv.invitedBy.toString()] ?? "Unknown",
          invitedAt:      inv.invitedAt,
          note:           inv.note ?? "",
        }))
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "GET /factions/invites error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/factions/news — my faction's activity log ─────────────────────────
router.get("/news", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userDoc = await User.findById(req.userId).select("factionId").lean();
    const factionId = (userDoc as any)?.factionId;
    if (!factionId) return res.status(400).json({ message: "Not in a faction" });

    const faction = await Faction.findById(factionId).select("newsLog").lean();
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const news = [...((faction as any).newsLog ?? [])].reverse().slice(0, 50);
    res.json(news);
  } catch (err) {
    req.log.error({ err }, "GET /factions/news error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE ROUTES — faction management
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/factions — create faction ─────────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.level < FACTION_CREATE_LEVEL)
      return res.status(400).json({ message: `Requires level ${FACTION_CREATE_LEVEL} to create a faction` });
    if (user.dc < FACTION_CREATE_COST)
      return res.status(400).json({ message: `Creating a faction costs ${FACTION_CREATE_COST.toLocaleString()} DC` });
    if ((user as any).factionId)
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

    addFactionNews(faction as any, "founded", `${user.username} founded the faction.`);
    await faction.save();

    user.dc -= FACTION_CREATE_COST;
    (user as any).factionId   = faction._id;
    (user as any).factionRole = "leader";
    user.faction = cleanTag;
    await user.save();

    res.status(201).json({ message: "Faction created!", factionId: faction._id });
  } catch (err) {
    req.log.error({ err }, "POST /factions error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/factions/leave ────────────────────────────────────────────────────
router.post("/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const factionId = (user as any).factionId;
    if (!factionId) return res.status(400).json({ message: "You are not in a faction" });

    const faction = await Faction.findById(factionId);
    if (!faction) {
      (user as any).factionId   = null;
      (user as any).factionRole = null;
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
      removeFromAllLists(faction, user._id);
      addFactionNews(faction, "leave", `${user.username} left the faction.`);
      await faction.save();
    }

    (user as any).factionId   = null;
    (user as any).factionRole = null;
    user.faction = null;
    await user.save();

    res.json({ message: "You have left the faction" });
  } catch (err) {
    req.log.error({ err }, "POST /factions/leave error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/factions/kick ─────────────────────────────────────────────────────
router.post("/kick", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const myFactionId = (user as any).factionId;
    if (!myFactionId) return res.status(400).json({ message: "You are not in a faction" });

    const myRole = (user as any).factionRole ?? "";
    if (!["leader","co-leader","officer"].includes(myRole))
      return res.status(403).json({ message: "Only officers and above can kick members" });

    const faction = await Faction.findById(myFactionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    const targetFactionId = (target as any).factionId;
    if (!targetFactionId || targetFactionId.toString() !== faction._id.toString())
      return res.status(404).json({ message: "Player is not in your faction" });

    const targetRole = (target as any).factionRole ?? "";
    if (targetRole === "leader")
      return res.status(400).json({ message: "Cannot kick the faction leader" });
    if (targetRole === "co-leader" && myRole !== "leader")
      return res.status(403).json({ message: "Only the leader can kick co-leaders" });
    if (targetRole === "officer" && myRole === "officer")
      return res.status(403).json({ message: "Officers cannot kick each other" });

    removeFromAllLists(faction, target._id);
    addFactionNews(faction, "kick", `${target.username} was removed from the faction by ${user.username}.`);

    (target as any).factionId   = null;
    (target as any).factionRole = null;
    target.faction = null;

    await Promise.all([faction.save(), target.save()]);

    Notification.create({
      userId:  target._id,
      type:    "system",
      message: `You have been removed from ${faction.name}`,
    }).catch(() => {});

    res.json({ message: `${target.username} has been removed from the faction` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/kick error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/factions/promote ──────────────────────────────────────────────────
router.post("/promote", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const myFactionId = (user as any).factionId;
    if (!myFactionId) return res.status(400).json({ message: "You are not in a faction" });

    const myRole = (user as any).factionRole ?? "";
    if (!["leader","co-leader"].includes(myRole))
      return res.status(403).json({ message: "Only co-leaders and above can promote members" });

    const faction = await Faction.findById(myFactionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    const targetFactionId = (target as any).factionId;
    if (!targetFactionId || targetFactionId.toString() !== faction._id.toString())
      return res.status(404).json({ message: "Player is not in your faction" });

    const targetRole = (target as any).factionRole ?? "";
    let newRole = "";

    if (targetRole === "recruit") {
      faction.recruitIds = faction.recruitIds.filter(id => !id.equals(target._id));
      faction.memberIds.push(target._id);
      newRole = "member";
    } else if (targetRole === "member") {
      faction.memberIds = faction.memberIds.filter(id => !id.equals(target._id));
      faction.officerIds.push(target._id);
      newRole = "officer";
    } else if (targetRole === "officer" && myRole === "leader") {
      faction.officerIds = faction.officerIds.filter(id => !id.equals(target._id));
      faction.coLeaderIds.push(target._id);
      newRole = "co-leader";
    } else {
      return res.status(400).json({ message: "Cannot promote further (or insufficient rank)" });
    }

    (target as any).factionRole = newRole;
    addFactionNews(faction, "promote", `${target.username} was promoted to ${newRole} by ${user.username}.`);

    await Promise.all([faction.save(), target.save()]);

    Notification.create({
      userId:  target._id,
      type:    "system",
      message: `You have been promoted to ${newRole} in ${faction.name}`,
    }).catch(() => {});

    res.json({ message: `${target.username} promoted to ${newRole}` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/promote error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/factions/demote ───────────────────────────────────────────────────
router.post("/demote", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const myFactionId = (user as any).factionId;
    if (!myFactionId) return res.status(400).json({ message: "You are not in a faction" });

    if ((user as any).factionRole !== "leader")
      return res.status(403).json({ message: "Only the faction leader can demote members" });

    const faction = await Faction.findById(myFactionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    const targetFactionId = (target as any).factionId;
    if (!targetFactionId || targetFactionId.toString() !== faction._id.toString())
      return res.status(404).json({ message: "Player is not in your faction" });

    const targetRole = (target as any).factionRole ?? "";
    let newRole = "";

    if (targetRole === "co-leader") {
      faction.coLeaderIds = faction.coLeaderIds.filter(id => !id.equals(target._id));
      faction.officerIds.push(target._id);
      newRole = "officer";
    } else if (targetRole === "officer") {
      faction.officerIds = faction.officerIds.filter(id => !id.equals(target._id));
      faction.memberIds.push(target._id);
      newRole = "member";
    } else if (targetRole === "member") {
      faction.memberIds = faction.memberIds.filter(id => !id.equals(target._id));
      faction.recruitIds.push(target._id);
      newRole = "recruit";
    } else {
      return res.status(400).json({ message: "Cannot demote further" });
    }

    (target as any).factionRole = newRole;
    addFactionNews(faction, "demote", `${target.username} was demoted to ${newRole} by ${user.username}.`);

    await Promise.all([faction.save(), target.save()]);
    res.json({ message: `${target.username} demoted to ${newRole}` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/demote error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVITE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/factions/invite — send invite by username ─────────────────────────
router.post("/invite", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username, note } = req.body as { username: string; note?: string };
    if (!username?.trim())
      return res.status(400).json({ message: "Username is required" });

    const sender = await User.findById(req.userId);
    if (!sender) return res.status(404).json({ message: "User not found" });

    const myFactionId = (sender as any).factionId;
    if (!myFactionId) return res.status(400).json({ message: "You are not in a faction" });

    const myRole = (sender as any).factionRole ?? "";
    if (!["leader","co-leader","officer"].includes(myRole))
      return res.status(403).json({ message: "Only officers and above can send invites" });

    const faction = await Faction.findById(myFactionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    if (memberCount(faction) >= faction.maxMembers)
      return res.status(400).json({ message: "Faction is at full capacity" });

    const target = await User.findOne({ username: { $regex: `^${username.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
    if (!target) return res.status(404).json({ message: `Player "${username}" not found` });
    if (target._id.toString() === String(req.userId))
      return res.status(400).json({ message: "Cannot invite yourself" });
    if ((target as any).factionId)
      return res.status(400).json({ message: `${target.username} is already in a faction` });

    const uid = target._id;
    const alreadyInvited = (faction as any).pendingInvites?.some(
      (inv: any) => inv.userId.toString() === uid.toString()
    );
    if (alreadyInvited)
      return res.status(400).json({ message: `${target.username} already has a pending invite` });

    (faction as any).pendingInvites.push({
      userId:    uid,
      invitedBy: sender._id,
      invitedAt: new Date(),
      note:      note?.trim().slice(0, 200) ?? "",
    });
    faction.markModified("pendingInvites");
    await faction.save();

    Notification.create({
      userId:  uid,
      type:    "system",
      message: `${sender.username} from [${faction.tag}] ${faction.name} has invited you to join their faction.`,
    }).catch(() => {});

    res.json({ message: `Invite sent to ${target.username}` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/invite error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/factions/invite/respond — accept or decline an invite ─────────────
router.post("/invite/respond", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { factionId, accept } = req.body as { factionId: string; accept: boolean };
    if (!factionId) return res.status(400).json({ message: "factionId is required" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user as any).factionId)
      return res.status(400).json({ message: "Leave your current faction before accepting an invite" });

    const faction = await Faction.findById(factionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const inviteIndex = (faction as any).pendingInvites.findIndex(
      (inv: any) => inv.userId.toString() === String(req.userId)
    );
    if (inviteIndex === -1)
      return res.status(404).json({ message: "Invite not found" });

    // Remove invite regardless of decision
    (faction as any).pendingInvites.splice(inviteIndex, 1);
    faction.markModified("pendingInvites");

    if (accept) {
      if (memberCount(faction) >= faction.maxMembers) {
        await faction.save();
        return res.status(400).json({ message: "Faction is now at full capacity" });
      }
      faction.recruitIds.push(user._id);
      (user as any).factionId   = faction._id;
      (user as any).factionRole = "recruit";
      user.faction = faction.tag;

      addFactionNews(faction, "join", `${user.username} joined the faction (accepted invite).`);

      await Promise.all([faction.save(), user.save()]);
      res.json({ message: `Welcome to ${faction.name}! You joined as a recruit.` });
    } else {
      await faction.save();
      res.json({ message: "Invite declined" });
    }
  } catch (err) {
    req.log.error({ err }, "POST /factions/invite/respond error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TREASURY
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/factions/treasury/donate ──────────────────────────────────────────
router.post("/treasury/donate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || amount < 1_000)
      return res.status(400).json({ message: "Minimum donation is 1,000 DC" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const factionId = (user as any).factionId;
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

    addFactionNews(faction, "donate", `${user.username} donated ${amount.toLocaleString()} DC to the treasury.`);

    await Promise.all([user.save(), faction.save()]);
    res.json({
      message:  `Donated ${amount.toLocaleString()} DC to ${faction.name}`,
      treasury: faction.treasury,
      level:    faction.level,
    });
  } catch (err) {
    req.log.error({ err }, "POST /factions/treasury/donate error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/factions/treasury/withdraw ────────────────────────────────────────
router.post("/treasury/withdraw", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || amount < 1_000)
      return res.status(400).json({ message: "Minimum withdrawal is 1,000 DC" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const factionId = (user as any).factionId;
    if (!factionId) return res.status(400).json({ message: "You are not in a faction" });

    const myRole = (user as any).factionRole ?? "";
    if (!["leader","co-leader"].includes(myRole))
      return res.status(403).json({ message: "Only leaders and co-leaders can withdraw from the treasury" });

    // Atomic withdrawal
    const faction = await Faction.findOneAndUpdate(
      { _id: factionId, treasury: { $gte: amount } },
      { $inc: { treasury: -amount } },
      { returnDocument: "after" }
    );
    if (!faction) return res.status(400).json({ message: "Insufficient treasury funds" });

    user.dc += amount;
    await user.save();

    addFactionNews(faction as any, "withdraw", `${user.username} withdrew ${amount.toLocaleString()} DC from the treasury.`);
    await (faction as any).save();

    res.json({
      message:  `Withdrew ${amount.toLocaleString()} DC from ${faction.name}`,
      treasury: faction.treasury,
      newDc:    user.dc,
    });
  } catch (err) {
    req.log.error({ err }, "POST /factions/treasury/withdraw error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERSHIP & SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/factions/transfer-leadership ──────────────────────────────────────
router.post("/transfer-leadership", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    if (!targetId) return res.status(400).json({ message: "targetId is required" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const factionId = (user as any).factionId;
    if (!factionId) return res.status(400).json({ message: "You are not in a faction" });
    if ((user as any).factionRole !== "leader")
      return res.status(403).json({ message: "Only the current leader can transfer leadership" });

    const faction = await Faction.findById(factionId);
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    if (targetId === String(req.userId))
      return res.status(400).json({ message: "You are already the leader" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Player not found" });

    const targetFactionId = (target as any).factionId;
    if (!targetFactionId || targetFactionId.toString() !== faction._id.toString())
      return res.status(400).json({ message: "Target player is not in your faction" });

    // Remove target from any list
    removeFromAllLists(faction, target._id);

    // Current leader becomes co-leader
    faction.coLeaderIds.push(user._id);
    (user as any).factionRole = "co-leader";

    // Target becomes leader
    faction.leaderId = target._id;
    (target as any).factionRole = "leader";

    addFactionNews(faction, "leadership_transfer", `${user.username} transferred leadership to ${target.username}.`);

    await Promise.all([faction.save(), user.save(), target.save()]);

    Notification.create({
      userId:  target._id,
      type:    "system",
      message: `${user.username} transferred faction leadership of ${faction.name} to you.`,
    }).catch(() => {});

    res.json({ message: `Leadership transferred to ${target.username}` });
  } catch (err) {
    req.log.error({ err }, "POST /factions/transfer-leadership error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/factions/settings ────────────────────────────────────────────────
router.patch("/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const factionId = (user as any).factionId;
    if (!factionId) return res.status(400).json({ message: "You are not in a faction" });
    if ((user as any).factionRole !== "leader")
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

// ═══════════════════════════════════════════════════════════════════════════════
// OPEN JOIN (must be last — wildcard param)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/factions/:id/join ─────────────────────────────────────────────────
router.post("/:id/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user as any).factionId)
      return res.status(400).json({ message: "You are already in a faction. Leave first." });

    const faction = await Faction.findById(req.params["id"]);
    if (!faction) return res.status(404).json({ message: "Faction not found" });
    if (!faction.isRecruiting)
      return res.status(400).json({ message: "This faction is not currently recruiting" });

    if (memberCount(faction) >= faction.maxMembers)
      return res.status(400).json({ message: "Faction is at full capacity" });

    faction.recruitIds.push(user._id);
    (user as any).factionId   = faction._id;
    (user as any).factionRole = "recruit";
    user.faction = faction.tag;

    addFactionNews(faction, "join", `${user.username} joined the faction as a recruit.`);

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
