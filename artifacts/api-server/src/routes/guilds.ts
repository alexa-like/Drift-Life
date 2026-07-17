import { Router } from "express";
import mongoose from "mongoose";
import Guild from "../models/Guild";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { guildCreateSchema, guildTreasuryDonateSchema, guildTargetSchema } from "../lib/schemas";

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
    const memberDocs = await User.find({ _id: { $in: allMemberIds } }).select("username level faction avatar");

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
router.post("/", requireAuth, validateBody(guildCreateSchema), async (req: AuthRequest, res) => {
  try {
    const { name, tag, description } = req.body as { name: string; tag: string; description?: string };

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
router.post("/treasury/donate", requireAuth, validateBody(guildTreasuryDonateSchema), async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };

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

    // Audit ledger entry (Section 6)
    try {
      const GuildTreasuryEntry = (await import("../models/GuildTreasuryEntry")).default;
      await GuildTreasuryEntry.create({
        guildId: guild._id, actorId: user._id, actorUsername: user.username,
        amount, reason: "donation", balanceAfter: guild.treasury,
      });
    } catch { /* non-critical */ }

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
router.post("/promote", requireAuth, validateBody(guildTargetSchema), async (req: AuthRequest, res) => {
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
router.post("/kick", requireAuth, validateBody(guildTargetSchema), async (req: AuthRequest, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// TURF WAR SYSTEM — Section 6
// Districts have a controlling guild. Guilds earn weeklyTurfPoints by winning
// turf races. Every Monday the guild with most points in each district takes control.
// ─────────────────────────────────────────────────────────────────────────────

const TURF_DISTRICTS = [
  { id: "neon_strip", name: "Neon Strip",        tier: 1, raceCost: 2_000,  defenderPower: 25, income: 500 },
  { id: "docks",      name: "The Docks",         tier: 2, raceCost: 5_000,  defenderPower: 40, income: 1_200 },
  { id: "slums",      name: "The Slums",         tier: 2, raceCost: 4_000,  defenderPower: 35, income: 900 },
  { id: "corp_zone",  name: "Corporate Zone",    tier: 4, raceCost: 20_000, defenderPower: 70, income: 5_000 },
  { id: "industrial", name: "Industrial Sector", tier: 3, raceCost: 10_000, defenderPower: 55, income: 2_500 },
  { id: "outskirts",  name: "The Outskirts",     tier: 5, raceCost: 30_000, defenderPower: 85, income: 8_000 },
];

// GET /api/guilds/turf — district control standings
router.get("/turf", requireAuth, async (req: AuthRequest, res) => {
  try {
    const guilds = await Guild.find({ weeklyTurfPoints: { $gt: 0 } })
      .select("name tag weeklyTurfPoints controlledDistricts")
      .sort({ weeklyTurfPoints: -1 })
      .limit(20)
      .lean();

    // For each district, find controlling guild (one that has it in controlledDistricts)
    const controlMap: Record<string, { guildName: string; guildTag: string } | null> = {};
    for (const d of TURF_DISTRICTS) {
      const ctrl = (await Guild.findOne({ controlledDistricts: d.id }).select("name tag").lean()) as any;
      controlMap[d.id] = ctrl ? { guildName: ctrl.name, guildTag: ctrl.tag } : null;
    }

    res.json({
      districts: TURF_DISTRICTS.map(d => ({
        ...d,
        controlling: controlMap[d.id],
      })),
      leaderboard: guilds.map(g => ({
        name: g.name, tag: g.tag, points: g.weeklyTurfPoints, districts: g.controlledDistricts,
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/guilds/turf/race/:districtId — run a turf race for a district
// Officer or leader only; costs guild treasury DC; resolved against district defender NPC stats
router.post("/turf/race/:districtId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const districtId = String(req.params.districtId);
    const district = TURF_DISTRICTS.find(d => d.id === districtId);
    if (!district) return res.status(404).json({ message: "District not found" });

    const user = await User.findById(req.userId).select("guildId guildRole level");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.guildId) return res.status(400).json({ message: "You must be in a guild to race for turf" });
    if (user.guildRole !== "leader" && user.guildRole !== "officer")
      return res.status(403).json({ message: "Only officers and the leader can initiate turf races" });

    // ── Atomic treasury deduction ─────────────────────────────────────────────
    // Using findOneAndUpdate with $gte guard prevents double-spend under load.
    const guild = await Guild.findOneAndUpdate(
      { _id: user.guildId, treasury: { $gte: district.raceCost } },
      { $inc: { treasury: -district.raceCost } },
      { returnDocument: 'after' }
    );
    if (!guild) return res.status(400).json({ message: `Guild treasury needs at least ${district.raceCost.toLocaleString()} DC` });

    // ── Weekly reset ──────────────────────────────────────────────────────────
    // Lazily reset weekly points on first race of a new week (Monday 00:00 UTC).
    const now = new Date();
    const lastReset = guild.lastTurfResetAt ?? new Date(0);
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setUTCHours(0, 0, 0, 0);
    mondayThisWeek.setUTCDate(mondayThisWeek.getUTCDate() - ((mondayThisWeek.getUTCDay() + 6) % 7));
    if (lastReset < mondayThisWeek) {
      guild.weeklyTurfPoints = 0;
      guild.lastTurfResetAt = now;
    }

    // Race resolution: user level + random vs district defender power
    const challengerPower = user.level * 2 + Math.floor(Math.random() * 20);
    const defenderPower = district.defenderPower + Math.floor(Math.random() * 20);
    const won = challengerPower > defenderPower;

    const pointsEarned = won ? district.tier * 10 : district.tier * 2;
    guild.weeklyTurfPoints = (guild.weeklyTurfPoints ?? 0) + pointsEarned;

    // District control: transfer ownership on win (permanent until next challenger wins)
    const alreadyControls = guild.controlledDistricts?.includes(districtId);
    if (won && !alreadyControls) {
      // Atomically remove from any other guild, then add to this one
      await Guild.updateMany({ _id: { $ne: guild._id }, controlledDistricts: districtId }, { $pull: { controlledDistricts: districtId } });
      guild.controlledDistricts = [...(guild.controlledDistricts ?? []), districtId];
    }

    await guild.save();

    res.json({
      won,
      districtId,
      districtName: district.name,
      challengerPower,
      defenderPower,
      pointsEarned,
      weeklyTurfPoints: guild.weeklyTurfPoints,
      controlledDistricts: guild.controlledDistricts,
      message: won
        ? `Victory! ${guild.name} now controls ${district.name}. +${pointsEarned} turf points.`
        : `Defeat. ${district.name} held its ground. +${pointsEarned} points for effort.`,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
