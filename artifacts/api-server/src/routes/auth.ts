import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt";
import { generateOtp, sendOtpEmail } from "../lib/mailer";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "username, email and password required" });
    if (username.length < 3 || username.length > 20)
      return res.status(400).json({ message: "Username must be 3-20 characters" });
    if (password.length < 8)
      return res.status(400).json({ message: "Password must be at least 8 characters" });

    const existing = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] });
    if (existing)
      return res.status(409).json({ message: "Username or email already taken" });

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      passwordHash,
      emailOtp: otp,
      emailOtpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Fire-and-forget OTP email
    sendOtpEmail(user.email, otp).catch(() => {});

    res.status(201).json({ message: "Account created. Check your email for the verification code.", userId: user._id });
  } catch (err: any) {
    req.log.error({ err }, "register error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });
    if (!user.emailOtp || user.emailOtp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });
    if (!user.emailOtpExpiry || user.emailOtpExpiry < new Date())
      return res.status(400).json({ message: "OTP expired" });

    user.isEmailVerified = true;
    user.emailOtp = null;
    user.emailOtpExpiry = null;
    await user.save();

    const payload = { userId: String(user._id), username: user.username, role: user.role };
    res.json({
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload),
      user: safeUser(user),
    });
  } catch (err: any) {
    req.log.error({ err }, "verify-email error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/resend-otp
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });

    const otp = generateOtp();
    user.emailOtp = otp;
    user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    sendOtpEmail(user.email, otp).catch(() => {});

    res.json({ message: "OTP resent" });
  } catch (err: any) {
    req.log.error({ err }, "resend-otp error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email and password required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (user.banned) return res.status(403).json({ message: `Banned: ${user.banReason ?? "no reason given"}` });
    if (!user.isEmailVerified) return res.status(403).json({ message: "Email not verified", needsVerification: true, email: user.email });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    user.lastLogin = new Date();
    await user.save();

    const payload = { userId: String(user._id), username: user.username, role: user.role };
    res.json({
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload),
      user: safeUser(user),
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
    res.json({ accessToken: signAccess(newPayload) });
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (_req, res) => {
  res.json({ message: "Logged out" });
});

function safeUser(user: InstanceType<typeof User>) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    level: user.level,
    xp: user.xp,
    xpToNext: user.xpToNext,
    dc: user.dc,
    credits: user.credits,
    health: user.health,
    maxHealth: user.maxHealth,
    energy: user.energy,
    maxEnergy: user.maxEnergy,
    nerve: user.nerve,
    maxNerve: user.maxNerve,
    strength: user.strength,
    defense: user.defense,
    speed: user.speed,
    stealth: user.stealth,
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
    createdAt: user.createdAt,
  };
}

export { safeUser };
export default router;
