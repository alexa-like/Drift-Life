import { Router } from "express";
import mongoose from "mongoose";
import Guild from "../models/Guild";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const GUILD_CREATE_COST = 10_000;
const GUILD_CREATE_LEVEL = 15;

// GET /api/guilds — list all guilds (paginated)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const guilds = await Guild.find()
      .sort({ level: -1, xp: -1 })
      .limit(50)
      .select("name tag description faction level treasury members officers recruits leaderId emblem");

    res.json(
      guilds.map((g) => ({
        id: g._id,
        name: g.name,
        tag: g.tag,
        description: g.description,
        faction: g.faction,
        level: g.level,
        treasury: g.treasury,
        memberCount: g.members.length + g.officers.length + g.recruits.length + 1,
        maxMembers: g.maxMembers,
        emblem: g.emblem,
        leaderId: g.leaderId,
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/guilds/mine — get my guild
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId guildRole");
    if (!user || !user.guildId) return res.json(null);

    const guild = await Guild.findById(user.guildId);
    if (!guild) return res.json(null);

    const allMemberIds = [guild.leaderId, ...guild.officers, ...guild.members, ...guild.recruits];
    const memberDocs = await User.find({ _id: { $in: allMemberIds } }).select("username level faction avatar equippedFrames");

    const memberMap = Object.fromEntries(memberDocs.map((m) => [m._id.toString(), m]));

    const buildMember = (id: mongoose.Types.ObjectId, role: string) => {
      const m = memberMap[id.toString()];
      if (!m) return null;
      return { id: m._id, username: m.username, level: m.level, faction: m.faction, avatar: m.avatar, role };
    };

    res.json({
      id: guild._id,
      name: guild.name,
      tag: guild.tag,
      description: guild.description,
      faction: guild.faction,
      level: guild.level,
      xp: guild.xp,
      treasury: guild.treasury,
      emblem: guild.emblem,
      maxMembers: guild.maxMembers,
      myRole: user.guildRole,
      members: [
        buildMember(guild.leaderId, "leader"),
        ...guild.officers.map((id) => buildMember(id, "officer")),
        ...guild.members.map((id) => buildMember(id, "member")),
        ...guild.recruits.map((id) => buildMember(id, "recruit")),
      ].filter(Boolean),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/guilds — create a guild
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, tag, description } = req.body as { name: string; tag: string; description?: string };
    if (!name?.trim() || !tag?.trim()) return res.status(400).json({ message: "Name and tag are required" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.level < GUILD_CREATE_LEVEL)
      return res.status(400).json({ message: `Requires level ${GUILD_CREATE_LEVEL} to create a guild` });
    if (user.guildId) return res.status(400).json({ message: "You are already in a guild" });
    if (user.dc < GUILD_CREATE_COST)
      return res.status(400).json({ message: `Costs ${GUILD_CREATE_COST.toLocaleString()} DC to create a guild` });

    const cleanTag = tag.trim().toUpperCase().slice(0, 5);
    if (await Guild.findOne({ name: name.trim() })) return res.status(400).json({ message: "Guild name already taken" });
    if (await Guild.findOne({ tag: cleanTag })) return res.status(400).json({ message: "Guild tag already taken" });

    const guild = await Guild.create({
      name: name.trim(),
      tag: cleanTag,
      description: description?.trim() ?? "",
      faction: user.faction,
      leaderId: user._id,
      officers: [],
      members: [],
      recruits: [],
    });

    user.dc -= GUILD_CREATE_COST;
    user.guildId = guild._id;
    user.guildRole = "leader";
    await user.save();

    res.status(201).json({ message: "Guild created!", guild: { id: guild._id, name: guild.name, tag: guild.tag } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/guilds/:id/join — join a guild (open join)
router.post("/:id/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.guildId) return res.status(400).json({ message: "You are already in a guild. Leave first." });

    const guild = await Guild.findById(req.params.id);
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    const totalMembers = 1 + guild.officers.length + guild.members.length + guild.recruits.length;
    if (totalMembers >= guild.maxMembers) return res.status(400).json({ message: "Guild is full" });

    guild.recruits.push(user._id);
    await guild.save();

    user.guildId = guild._id;
    user.guildRole = "recruit";
    await user.save();

    res.json({ message: `Joined ${guild.name} as a recruit` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/guilds/leave — leave current guild
router.post("/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const guild = await Guild.findById(user.guildId);
    if (!guild) {
      user.guildId = null;
      user.guildRole = null;
      await user.save();
      return res.json({ message: "Left guild" });
    }

    if (guild.leaderId.equals(user._id)) {
      if (guild.officers.length + guild.members.length + guild.recruits.length > 0) {
        return res.status(400).json({ message: "Transfer leadership before leaving" });
      }
      await Guild.findByIdAndDelete(guild._id);
    } else {
      guild.officers = guild.officers.filter((id) => !id.equals(user._id));
      guild.members = guild.members.filter((id) => !id.equals(user._id));
      guild.recruits = guild.recruits.filter((id) => !id.equals(user._id));
      await guild.save();
    }

    user.guildId = null;
    user.guildRole = null;
    await user.save();

    res.json({ message: "You have left the guild" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/guilds/treasury/donate — donate DC to treasury
router.post("/treasury/donate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || amount < 1) return res.status(400).json({ message: "Invalid amount" });

    const user = await User.findById(req.userId);
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (user.dc < amount) return res.status(400).json({ message: "Not enough DC" });

    const guild = await Guild.findById(user.guildId);
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    user.dc -= amount;
    guild.treasury += amount;
    guild.xp += Math.floor(amount / 1000);

    const oldLevel = guild.level;
    while (guild.xp >= guild.level * 1000) {
      guild.xp -= guild.level * 1000;
      guild.level += 1;
      guild.maxMembers = 15 + (guild.level - 1) * 5;
    }

    await Promise.all([user.save(), guild.save()]);

    res.json({
      message: `Donated ${amount.toLocaleString()} DC to ${guild.name}`,
      treasury: guild.treasury,
      guildLevel: guild.level,
      leveledUp: guild.level > oldLevel,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/guilds/promote — promote a member
router.post("/promote", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    const user = await User.findById(req.userId);
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (user.guildRole !== "leader" && user.guildRole !== "officer")
      return res.status(403).json({ message: "Only leaders and officers can promote members" });

    const guild = await Guild.findById(user.guildId);
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    const target = await User.findById(targetId);
    if (!target || !target.guildId?.equals(guild._id)) return res.status(404).json({ message: "Player not in your guild" });

    if (target.guildRole === "recruit") {
      guild.recruits = guild.recruits.filter((id) => !id.equals(target._id));
      guild.members.push(target._id);
      target.guildRole = "member";
    } else if (target.guildRole === "member" && user.guildRole === "leader") {
      guild.members = guild.members.filter((id) => !id.equals(target._id));
      guild.officers.push(target._id);
      target.guildRole = "officer";
    } else {
      return res.status(400).json({ message: "Cannot promote further" });
    }

    await Promise.all([guild.save(), target.save()]);

    await Notification.create({
      userId: target._id,
      type: "system",
      message: `You have been promoted to ${target.guildRole} in ${guild.name}`,
    });

    res.json({ message: `${target.username} promoted to ${target.guildRole}` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/guilds/kick — kick a member
router.post("/kick", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    const user = await User.findById(req.userId);
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (user.guildRole !== "leader" && user.guildRole !== "officer")
      return res.status(403).json({ message: "Only leaders and officers can kick members" });

    const guild = await Guild.findById(user.guildId);
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    const target = await User.findById(targetId);
    if (!target || !target.guildId?.equals(guild._id)) return res.status(404).json({ message: "Player not in your guild" });
    if (target.guildRole === "leader") return res.status(400).json({ message: "Cannot kick the guild leader" });
    if (target.guildRole === "officer" && user.guildRole !== "leader")
      return res.status(403).json({ message: "Only the leader can kick officers" });

    guild.officers = guild.officers.filter((id) => !id.equals(target._id));
    guild.members = guild.members.filter((id) => !id.equals(target._id));
    guild.recruits = guild.recruits.filter((id) => !id.equals(target._id));
    target.guildId = null;
    target.guildRole = null;

    await Promise.all([guild.save(), target.save()]);
    res.json({ message: `${target.username} has been kicked from the guild` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
