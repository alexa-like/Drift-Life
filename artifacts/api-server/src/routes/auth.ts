import { Router } from "express";
import bcrypt from "bcryptjs";
import User, { generateTag, generateReferralCode, levelUp } from "../models/User";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt";
import { generateOtp, sendOtpEmail } from "../lib/mailer";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";

const router = Router();

export function safeUser(user: InstanceType<typeof User>) {
  return {
    id: user._id,
    username: user.username,
    tag: user.tag,
    email: user.email,
    avatar: user.avatar,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    faction: user.faction,
    level: user.level,
    xp: user.xp,
    xpToNext: user.xpToNext,
    prestige: user.prestige,
    skillPoints: user.skillPoints,
    dc: user.dc,
    nc: user.nc,
    credits: user.nc,
    health: user.health,
    maxHealth: user.maxHealth,
    energy: user.energy,
    maxEnergy: user.maxEnergy,
    nerve: user.nerve,
    maxNerve: user.maxNerve,
    strength: user.strength,
    charisma: user.charisma,
    intelligence: user.intelligence,
    streetCred: user.streetCred,
    district: user.district,
    job: user.job,
    rank: user.rank,
    wantedLevel: user.wantedLevel,
    totalCrimes: user.totalCrimes,
    successfulCrimes: user.successfulCrimes,
    totalFights: user.totalFights,
    wins: user.wins,
    losses: user.losses,
    hospitalizedUntil: user.hospitalizedUntil,
    jailUntil: user.jailUntil,
    lastDailyReward: user.lastDailyReward,
    dailyStreak: user.dailyStreak,
    role: user.role,
    bankBalance: user.bankBalance,
    gang: user.gang,
    isEmailVerified: user.isEmailVerified,
    equippedFrame: user.equippedFrame,
    equippedFrameRarity: user.equippedFrameRarity ?? "common",
    equippedFrameColor: user.equippedFrameColor ?? null,
    equippedTitle: user.equippedTitle,
    titles: user.titles,
    ownedFrames: user.ownedFrames || [],
    merit: user.merit ?? 0,
    appearOffline: user.appearOffline ?? false,
    dmPrivacy: user.dmPrivacy ?? "anyone",
    liteModeEnabled: user.liteModeEnabled ?? false,
    notificationPrefs: user.notificationPrefs ?? {
      achievements: true, dms: true, frameGifts: true, xpBoost: true, weeklyFrame: true,
    },
    devMode: user.devMode,
    battlePassPremium: (user as any).battlePassPremium ?? false,
    telegramNotifications: user.telegramNotifications ?? false,
    unlockedSkills: user.unlockedSkills || [],
    skillTree: user.skillTree ?? null,
    secondarySkill: user.secondarySkill ?? null,
    seasonXp: user.seasonXp ?? 0,
    craftingXp: user.craftingXp ?? 0,
    mutedUsers: user.mutedUsers || [],
    blockedUsers: user.blockedUsers || [],
    following: user.following || [],
    referralCode: user.referralCode,
    attacksToday: user.attacksToday,
    createdAt: user.createdAt,
  };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, faction, referralCode } = req.body;
    // Type-guard: reject non-string values to prevent NoSQL injection
    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "username, email and password required" });
    }
    if (!username || !email || !password)
      return res.status(400).json({ message: "username, email and password required" });
    if (username.length < 3 || username.length > 20)
      return res.status(400).json({ message: "Username must be 3-20 characters" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const emailLower = email.toLowerCase().trim();
    const existingEmail = await User.findOne({ email: emailLower });
    if (existingEmail) {
      // If account exists but is unverified, resend OTP so the player can complete verification
      if (!existingEmail.isEmailVerified) {
        const otp = generateOtp();
        existingEmail.emailOtp = otp;
        existingEmail.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await existingEmail.save();
        if (process.env["GMAIL_USER"] && process.env["GMAIL_PASS"]) {
          sendOtpEmail(existingEmail.email, otp).catch(() => {});
        }
        return res.status(200).json({
          message: "Account pending verification. A new code has been sent to your email.",
          userId: existingEmail._id,
          needsVerification: true,
          email: existingEmail.email,
        });
      }
      return res.status(409).json({ message: "Email already registered. Try logging in instead." });
    }
    const existingUser = await User.findOne({ username: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (existingUser) return res.status(409).json({ message: "Username already taken" });

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const tag = generateTag(username);
    const refCode = generateReferralCode();

    const user = await User.create({
      username,
      email: emailLower,
      tag,
      passwordHash,
      emailOtp: otp,
      emailOtpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      faction: faction && ["suits", "street", "grid"].includes(faction) ? faction : null,
      referralCode: refCode,
      referredBy: referralCode || null,
    });

    // Referral bonus
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referrer.dc += 500;
        referrer.xp += 200;
        levelUp(referrer);
        referrer.referralCount += 1;
        await referrer.save();
      }
    }

    let autoVerified = false;
    if (process.env["GMAIL_USER"] && process.env["GMAIL_PASS"]) {
      sendOtpEmail(user.email, otp).catch(() => {});
    } else {
      // No email provider — auto-verify so players can always log in
      user.isEmailVerified = true;
      user.emailOtp = null;
      user.emailOtpExpiry = null;
      user.dc = (user.dc || 0) + 750;
      await user.save();
      autoVerified = true;
    }

    if (autoVerified) {
      const payload = { userId: String(user._id), username: user.username, role: user.role };
      return res.status(201).json({
        message: "Account created. You can now log in.",
        accessToken: signAccess(payload),
        refreshToken: signRefresh(payload),
        user: safeUser(user),
        autoVerified: true,
      });
    }
    res.status(201).json({ message: "Account created. Check your email for the verification code.", userId: user._id });
  } catch (err: any) {
    if ((err as any).code === 11000) {
      return res.status(409).json({ message: "Email or username already registered. Try logging in instead." });
    }
    req.log.error({ err }, "register error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });
    if (!user.emailOtp || user.emailOtp !== otp)
      return res.status(400).json({ message: "Invalid verification code" });
    if (!user.emailOtpExpiry || user.emailOtpExpiry < new Date())
      return res.status(400).json({ message: "Code expired. Request a new one." });

    user.isEmailVerified = true;
    user.emailOtp = null;
    user.emailOtpExpiry = null;
    user.dc = (user.dc || 0) + 750;
    await user.save();

    const payload = { userId: String(user._id), username: user.username, role: user.role };
    res.json({ accessToken: signAccess(payload), refreshToken: signRefresh(payload), user: safeUser(user) });
  } catch (err: any) {
    req.log.error({ err }, "verify-email error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/resend-otp
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });
    const otp = generateOtp();
    user.emailOtp = otp;
    user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    sendOtpEmail(user.email, otp).catch(() => {});
    res.json({ message: "Verification code resent" });
  } catch (err: any) {
    req.log.error({ err }, "resend-otp error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    // Type-guard: reject non-string values to prevent NoSQL injection
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (user.banned) return res.status(403).json({ message: `Banned: ${user.banReason ?? "policy violation"}` });
    if (!user.isEmailVerified) return res.status(403).json({ message: "Email not verified", needsVerification: true, email: user.email });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    const payload = { userId: String(user._id), username: user.username, role: user.role };
    res.json({ accessToken: signAccess(payload), refreshToken: signRefresh(payload), user: safeUser(user) });
  } catch (err: any) {
    req.log.error({ err }, "login error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: "refreshToken required" });
    const payload = verifyRefresh(refreshToken);
    const user = await User.findById(payload.userId);
    if (!user || user.banned) return res.status(401).json({ message: "Unauthorized" });
    const newPayload = { userId: String(user._id), username: user.username, role: user.role };
    res.json({ accessToken: signAccess(newPayload), refreshToken: signRefresh(newPayload) });
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (_req, res) => {
  res.json({ message: "Logged out" });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (user) {
      const token = generateOtp();
      user.resetToken = token;
      user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      sendOtpEmail(user.email, token, "Password Reset").catch(() => {});
    }
    res.json({ message: "If that email exists, a reset code was sent." });
  } catch (err: any) {
    req.log.error({ err }, "forgot-password error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user || user.resetToken !== token || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();
    res.json({ message: "Password updated" });
  } catch (err: any) {
    req.log.error({ err }, "reset-password error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/select-faction
router.post("/select-faction", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { faction } = req.body;
    if (!["suits", "street", "grid"].includes(faction)) return res.status(400).json({ message: "Invalid faction" });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.faction) return res.status(400).json({ message: "Faction already chosen. This is permanent." });
    user.faction = faction;
    await user.save();
    res.json({ message: `Welcome to ${faction}`, faction, user: safeUser(user) });
  } catch (err: any) {
    req.log.error({ err }, "select-faction error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);
    await user.save();
    res.json(safeUser(user));
  } catch (err: any) {
    req.log.error({ err }, "me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/admin-setup — grants owner access; uses SETUP_KEY env or hardcoded dev key
// No auth required — used for initial owner bootstrap
router.post("/admin-setup", async (req, res) => {
  try {
    const { setupKey, email, username, password } = req.body;
    const validKey = process.env["SETUP_KEY"] || "DRIFTLIFE_SETUP_2047";
    if (setupKey !== validKey) return res.status(403).json({ message: "Invalid setup key" });
    if (!email && !username) return res.status(400).json({ message: "email or username required" });

    const emailLower = email?.toLowerCase().trim();
    let user = emailLower
      ? await User.findOne({ email: emailLower })
      : await User.findOne({ username: new RegExp(`^${username}$`, "i") });

    if (!user) {
      // Create the owner account
      if (!email || !username || !password) return res.status(400).json({ message: "email, username, and password required to create account" });
      if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      const passwordHash = await bcrypt.hash(password, 12);
      const tag = generateTag(username);
      const refCode = generateReferralCode();
      user = await User.create({
        username,
        email: emailLower,
        tag,
        passwordHash,
        isEmailVerified: true,
        role: "owner",
        devMode: true,
        dc: 1000000,
        nc: 10000,
        referralCode: refCode,
      });
    } else {
      user.isEmailVerified = true;
      user.role = "owner";
      (user as any).devMode = true;
      if (password && password.length >= 6) {
        user.passwordHash = await bcrypt.hash(password, 12);
      }
      await user.save();
    }

    const payload = { userId: String(user._id), username: user.username, role: user.role };
    res.json({
      message: `Owner access granted to ${user.username}`,
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload),
      user: safeUser(user),
    });
  } catch (err: any) {
    if ((err as any).code === 11000) {
      return res.status(409).json({ message: "Email or username already taken" });
    }
    req.log.error({ err }, "admin-setup error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
