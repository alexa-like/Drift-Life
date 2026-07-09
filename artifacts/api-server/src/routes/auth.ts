import { Router } from "express";
import bcrypt from "bcryptjs";
import User, { generateTag, generateReferralCode, levelUp, activeBuffTotal } from "../models/User";
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
    prestigeXpBoost: user.prestigeXpBoost ?? 0,
    skillPoints: user.skillPoints,
    dc: user.dc,
    nc: user.nc,
    keys: user.keys ?? 0,
    keyShards: user.keyShards ?? 0,

    health: user.health,
    maxHealth: user.maxHealth,
    energy: user.energy,
    maxEnergy: user.maxEnergy,
    adrenaline: user.adrenaline ?? 0,
    maxAdrenaline: user.maxAdrenaline ?? 5,
    nitro: user.nitro ?? 0,
    maxNitro: user.maxNitro ?? 5,
    nerve: user.nerve,
    maxNerve: user.maxNerve,
    activeBuffs: user.activeBuffs ?? [],
    travelingTo: user.travelingTo ?? null,
    travelArrivesAt: user.travelArrivesAt ?? null,
    status: (user as any).status ?? 'normal',
    currentLocation: (user as any).currentLocation ?? 'downtown',
    jailedUntil: (user as any).jailedUntil ?? null,
    lastMuggedAt: (user as any).lastMuggedAt ?? null,
    strength: user.strength + activeBuffTotal(user, "strength"),
    charisma: user.charisma + activeBuffTotal(user, "charisma"),
    intelligence: user.intelligence + activeBuffTotal(user, "intelligence"),
    streetCred: user.streetCred + activeBuffTotal(user, "streetCred"),
    baseStrength: user.strength,
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
    equippedTitle: user.equippedTitle,
    titles: user.titles,
    merit: user.merit ?? 0,
    appearOffline: user.appearOffline ?? false,
    dmPrivacy: user.dmPrivacy ?? "anyone",
    liteModeEnabled: user.liteModeEnabled ?? false,
    notificationPrefs: user.notificationPrefs ?? {
      achievements: true, dms: true, xpBoost: true,
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
    createdAt: user.createdAt,
    onboardingStage: user.onboardingStage ?? 0,
    ownedChatFrames: (user as any).ownedChatFrames || [],
    equippedChatFrame: (user as any).equippedChatFrame || null,
    // ── Monetization ───────────────────────────────────────────────────────
    subscriptionTier: (user as any).subscriptionTier ?? null,
    subscriptionExpiresAt: (user as any).subscriptionExpiresAt ?? null,
    ncDailyClaimedAt: (user as any).ncDailyClaimedAt ?? null,
    ncClaimStreak: (user as any).ncClaimStreak ?? 0,
    telegramLinked: !!(user as any).telegramId,
    telegramUsername: (user as any).telegramUsername ?? null,
    gameTheme: (user as any).gameTheme ?? "default",
    // ── 10.14 Mentor system ─────────────────────────────────────────────────
    isMentor:  (user as any).isMentor  ?? false,
    mentorId:  (user as any).mentorId  ? String((user as any).mentorId) : null,
    menteeCount: ((user as any).menteeIds ?? []).length,
    // ── 10.15 Pinned badges ─────────────────────────────────────────────────
    pinnedBadges: (user as any).pinnedBadges ?? [],
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
        // Same 60-second cooldown as /resend-otp to prevent email spam
        if (existingEmail.emailOtpExpiry && existingEmail.emailOtpExpiry.getTime() - Date.now() > 9 * 60 * 1000) {
          return res.status(429).json({ message: "Please wait at least 60 seconds before requesting another code.", userId: existingEmail._id, needsVerification: true, email: existingEmail.email });
        }
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
      nc: 25, // welcome bonus — 25 Nova Credits for new players
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
    // 60-second cooldown: emailOtpExpiry is set to now+10min on send,
    // so if it's still >9 min away the code was sent less than 1 minute ago.
    if (user.emailOtpExpiry && user.emailOtpExpiry.getTime() - Date.now() > 9 * 60 * 1000) {
      return res.status(429).json({ message: "Please wait at least 60 seconds before requesting another code." });
    }
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

// ── Login Reward helpers ──────────────────────────────────────────────────────
const LOGIN_REWARD_TABLE: Record<number, { dc?: number; keyShards?: number; items?: string[]; key?: number }> = {
  1: { keyShards: 3 },
  2: { dc: 500 },
  3: { keyShards: 3, items: ["street_medkit"] },
  4: { dc: 800 },
  5: { keyShards: 3, items: ["adrenaline_vial"] },
  6: { dc: 1000, items: ["nitro_can"] },
  7: { dc: 1500, items: ["_random_stim"] },
  14: { dc: 3000, keyShards: 3 },
  30: { dc: 5000, key: 1 },
};

function getStreakDay(streak: number): number {
  if (streak === 14) return 14;
  if (streak === 30) return 30;
  return ((streak - 1) % 7) + 1;
}

function grantLoginReward(user: any): { dc: number; keyShards: number; keys: number; items: string[]; converted: boolean } {
  const day = getStreakDay(user.loginStreak);
  const reward = LOGIN_REWARD_TABLE[day] ?? LOGIN_REWARD_TABLE[((day - 1) % 7) + 1] ?? {};
  let dc = reward.dc ?? 0;
  let keyShards = reward.keyShards ?? 0;
  let keys = reward.key ?? 0;
  const items: string[] = [];

  if (reward.items) {
    for (const it of reward.items) {
      if (it === "_random_stim") {
        const opts = ["stim_shot", "combat_stim", "fuel_pack"];
        items.push(opts[Math.floor(Math.random() * opts.length)]);
      } else {
        items.push(it);
      }
    }
  }

  user.dc = Math.min(100_000_000, (user.dc ?? 0) + dc);
  user.keyShards = (user.keyShards ?? 0) + keyShards;
  user.keys = (user.keys ?? 0) + keys;

  // Auto-convert shards >= 20 → +1 key
  let converted = false;
  while (user.keyShards >= 20) {
    user.keyShards -= 20;
    user.keys += 1;
    converted = true;
  }

  return { dc, keyShards, keys, items, converted };
}

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

    // Daily login streak + reward
    const today = new Date().toDateString();
    const lastDate = (user as any).lastLoginDate ? new Date((user as any).lastLoginDate).toDateString() : null;
    let loginReward: ReturnType<typeof grantLoginReward> | null = null;

    if (lastDate !== today) {
      const yesterday = new Date(Date.now() - 86_400_000).toDateString();
      (user as any).loginStreak = (lastDate === yesterday) ? ((user as any).loginStreak ?? 0) + 1 : 1;
      (user as any).lastLoginDate = new Date();
      loginReward = grantLoginReward(user);
      await user.save();
    }

    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    const payload = { userId: String(user._id), username: user.username, role: user.role };
    res.json({
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload),
      user: safeUser(user),
      loginReward: loginReward ? {
        ...loginReward,
        streak: (user as any).loginStreak,
        streakDay: getStreakDay((user as any).loginStreak),
        nextDayPreview: LOGIN_REWARD_TABLE[getStreakDay(((user as any).loginStreak % 30) + 1)] ?? LOGIN_REWARD_TABLE[((((user as any).loginStreak) % 7)) + 1] ?? {},
      } : null,
    });
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
    const validKey = process.env["SETUP_KEY"];
    if (!validKey) return res.status(503).json({ message: "Admin setup not configured. Set the SETUP_KEY environment variable." });
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
