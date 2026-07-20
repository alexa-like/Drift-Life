# DRIFTLIFE — MASTER FIX PROMPT
> Paste this entire prompt into a new Replit Agent session (with the DriftLife source code open) to fix every identified issue.

---

## CONTEXT

You are working on **DriftLife**, a cyberpunk browser-based multiplayer RPG at `https://driftlife-wrsh.onrender.com/`. The stack is:
- **Backend:** Node.js + Express, MongoDB (Mongoose), Socket.IO, JWT auth
- **Frontend:** React + Vite (single-page app, served as static files)
- **Auth:** JWT access token (15min) + refresh token (30 days)
- **Deployment:** Render.com

A full audit has been completed. Below are all issues with exact root causes, affected files (inferred from bundle analysis + API testing), and the exact fix to apply for each. **Fix every issue in order. Do not skip any.**

---

## PHASE A — CRITICAL SECURITY & STABILITY FIXES
### (Fix these first — they are game-breaking exploits)

---

### FIX A-1: Add Atomic Server-Side Locks for Jobs, Crimes, and Combat
**Problem:** 50 concurrent job requests all succeed. 20 concurrent crime requests all succeed. 10 concurrent NPC fights all succeed. The pattern is read-then-write without an atomic lock, so parallel requests all read the "ok" state before any write lands.

**Root cause:** All three routes do roughly:
```js
const user = await User.findById(userId);
if (user.energy < cost) return res.status(400).json({message: "Not enough energy"});
// ... compute reward ...
await User.findByIdAndUpdate(userId, { $inc: { energy: -cost, dc: reward } });
```
Between the findById and the update, 49 other requests have already read the same user document.

**Fix — use `findOneAndUpdate` with condition (atomic):**

For **jobs** (`routes/jobs.js` or similar), replace the pattern with:
```js
// BEFORE (vulnerable)
const user = await User.findById(userId);
if (user.energy < job.energyCost) return error;
if (user.onCooldown) return error;
await User.findByIdAndUpdate(userId, {...});

// AFTER (atomic — findOneAndUpdate acts as compare-and-swap)
const user = await User.findOneAndUpdate(
  {
    _id: userId,
    energy: { $gte: job.energyCost },          // condition: must have enough energy
    $or: [
      { [`jobCooldowns.${jobId}`]: { $exists: false } },
      { [`jobCooldowns.${jobId}`]: { $lte: new Date() } }
    ]
  },
  {
    $inc: { energy: -job.energyCost },
    $set: { [`jobCooldowns.${jobId}`]: cooldownUntil }
  },
  { new: true }
);
if (!user) return res.status(400).json({ message: "Job on cooldown or not enough energy" });
// now apply reward safely
await User.findByIdAndUpdate(userId, { $inc: { dc: reward, xp: xpGain } });
```

For **crimes** (`routes/crimes.js`), use the same atomic pattern on nerve:
```js
const user = await User.findOneAndUpdate(
  {
    _id: userId,
    nerve: { $gte: crime.nerveCost },
    $or: [
      { lastCrimeAt: { $exists: false } },
      { lastCrimeAt: { $lte: new Date(Date.now() - CRIME_COOLDOWN_MS) } }
    ]
  },
  {
    $inc: { nerve: -crime.nerveCost },
    $set: { lastCrimeAt: new Date() }
  },
  { new: true }
);
if (!user) return res.status(400).json({ message: "Not enough nerve or on cooldown" });
```

For **combat** (`routes/combat.js`), add a per-user combat cooldown (e.g. 5 seconds):
```js
const COMBAT_COOLDOWN_MS = 5000;
const user = await User.findOneAndUpdate(
  {
    _id: userId,
    $or: [
      { lastCombatAt: { $exists: false } },
      { lastCombatAt: { $lte: new Date(Date.now() - COMBAT_COOLDOWN_MS) } }
    ]
  },
  { $set: { lastCombatAt: new Date() } },
  { new: true }
);
if (!user) return res.status(429).json({ message: "Combat cooldown — wait a few seconds" });
```

Also add `lastCrimeAt`, `lastCombatAt`, `jobCooldowns` to the User schema if not already present.

---

### FIX A-2: Add Rate Limiting Middleware
**Problem:** No rate limiting on any endpoint. Login can be brute-forced. Crime/job/combat spam not throttled at HTTP layer.

**Install:** `npm install express-rate-limit`

**Add to `app.js` / `server.js` BEFORE route mounting:**
```js
const rateLimit = require('express-rate-limit');

// Global limiter — 300 requests per minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests — slow down' }
}));

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Too many login attempts — try again in 15 minutes' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Game action limiter (jobs, crimes, combat) — max 10/minute per IP
const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.userId || req.ip, // per-user not per-IP
  message: { message: 'Action rate limit — slow down' }
});
app.use('/api/jobs', actionLimiter);
app.use('/api/crimes', actionLimiter);
app.use('/api/combat', actionLimiter);
```

---

### FIX A-3: Add Security Headers with Helmet
**Problem:** Zero security headers returned. No CSP, no X-Frame-Options, no HSTS.

**Install:** `npm install helmet`

**Add to `app.js` as the FIRST middleware:**
```js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // tighten after testing
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://image.pollinations.ai", "https://i.imgur.com"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```

---

### FIX A-4: Sanitize Chat Content (Stored XSS)
**Problem:** `<script>alert(document.cookie)</script>` is stored verbatim in the DB.

**Install:** `npm install sanitize-html`

**In `routes/chat.js`** (global and DM message handlers):
```js
const sanitizeHtml = require('sanitize-html');

// In your POST /global and POST /dm handlers:
const raw = req.body.content;
if (!raw || typeof raw !== 'string') return res.status(400).json({ message: 'content required' });

const content = sanitizeHtml(raw, {
  allowedTags: [],        // strip ALL HTML — chat is plain text only
  allowedAttributes: {},
}).trim();

if (!content) return res.status(400).json({ message: 'content required' });
if (content.length > 500) return res.status(400).json({ message: 'Message too long (max 500 chars)' });
```

---

### FIX A-5: Fix NoSQL Injection on Login
**Problem:** `{"email":{"$gt":""},"password":{"$gt":""}}` reaches MongoDB, causing 500.

**In `routes/auth.js`**, add type validation BEFORE any DB access:
```js
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Type-guard: reject non-string values immediately
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'email and password required' });
  }
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password required' });
  }

  // Now safe to query
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  // ...
});
```
Apply the same pattern to `/register` — validate all fields are strings before DB access.

---

### FIX A-6: Fix Duplicate Item Drops from NPC Combat
**Problem:** Each NPC fight creates a new inventory document instead of incrementing `quantity`. Result: owner has Combat Knife ×13, Scrap Metal ×11, Bandage ×9, etc.

**In `routes/combat.js`**, replace inventory insert with upsert:
```js
// BEFORE (creates duplicates)
await Inventory.create({ userId, name: drop.name, ...drop });

// AFTER (upsert — increments quantity if item already exists)
await Inventory.findOneAndUpdate(
  { userId, name: drop.name, type: drop.type, rarity: drop.rarity },
  {
    $inc: { quantity: 1 },
    $setOnInsert: {
      userId, name: drop.name, type: drop.type, rarity: drop.rarity,
      strengthBonus: drop.strengthBonus || 0,
      charismaBonus: drop.charismaBonus || 0,
      intelligenceBonus: drop.intelligenceBonus || 0,
      defenseBonus: drop.defenseBonus || 0,
      description: drop.description || '',
      basePrice: drop.basePrice || 0,
    }
  },
  { upsert: true }
);
```

Also clean up existing duplicates with a one-time migration script:
```js
// scripts/dedup-inventory.js — run once
const items = await Inventory.aggregate([
  { $group: {
    _id: { userId: "$userId", name: "$name", rarity: "$rarity" },
    ids: { $push: "$_id" },
    count: { $sum: 1 }
  }},
  { $match: { count: { $gt: 1 } }}
]);

for (const group of items) {
  const [keep, ...dupes] = group.ids;
  await Inventory.findByIdAndUpdate(keep, { $set: { quantity: group.count } });
  await Inventory.deleteMany({ _id: { $in: dupes } });
}
```

---

## PHASE B — HIGH PRIORITY BUG FIXES

---

### FIX B-1: Fix hospital/use-item Server Crash (500)
**In `routes/hospital.js`**, wrap the use-item handler in proper error handling:
```js
router.post('/use-item', authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId || typeof itemId !== 'string') {
      return res.status(400).json({ message: 'itemId required' });
    }

    const item = await Inventory.findOne({ _id: itemId, userId: req.user.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.type !== 'consumable' && item.effect !== 'heal') {
      return res.status(400).json({ message: 'Item cannot be used here' });
    }

    const healAmount = item.healAmount || 20;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $inc: { health: healAmount } },
      { new: true }
    );
    // Cap health at maxHealth
    if (user.health > user.maxHealth) {
      await User.findByIdAndUpdate(req.user.userId, { $set: { health: user.maxHealth } });
    }
    // Remove item (or decrement quantity)
    if (item.quantity > 1) {
      await Inventory.findByIdAndUpdate(itemId, { $inc: { quantity: -1 } });
    } else {
      await Inventory.findByIdAndDelete(itemId);
    }

    return res.json({ message: `Used ${item.name} — healed ${healAmount} HP`, health: Math.min(user.health + healAmount, user.maxHealth) });
  } catch (err) {
    console.error('use-item error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
```

---

### FIX B-2: Fix Market — Sell Non-Owned Item Crash (500)
**In `routes/market.js`**:
```js
router.post('/listings', authMiddleware, async (req, res) => {
  try {
    const { itemId, price } = req.body;
    if (!itemId || !price || typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ message: 'itemId and a positive price are required' });
    }

    // Check ownership BEFORE doing anything else
    const item = await Inventory.findOne({ _id: itemId, userId: req.user.userId });
    if (!item) return res.status(404).json({ message: 'Item not found in your inventory' });
    if (item.equipped) return res.status(400).json({ message: 'Unequip before listing' });
    if (item.marketListed) return res.status(400).json({ message: 'Already listed' });

    await Inventory.findByIdAndUpdate(itemId, { $set: { marketListed: true, marketPrice: price } });
    return res.json({ message: 'Item listed on market', price });
  } catch (err) {
    console.error('market list error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
```
Also register the route correctly — it was returning "Cannot POST /api/market/list". The correct route path should be `POST /api/market/listings` (consistent with GET and DELETE).

---

### FIX B-3: Fix Profile Route Crash (500 on /api/user/profile/:username)
**In `routes/users.js`**, ensure the handler gracefully resolves:
```js
router.get('/profile/:username', authMiddleware, async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne(
      { username: { $regex: new RegExp(`^${username}$`, 'i') } },
      // project only public fields — never expose email, password hash, tokens
      'username tag avatar avatarUrl bio faction level prestige rank equippedFrame equippedFrameRarity equippedTitle titles strength charisma intelligence streetCred wins losses totalFights totalCrimes wantedLevel district dc bankBalance merit createdAt'
    );
    if (!user) return res.status(404).json({ message: 'Player not found' });
    return res.json(user);
  } catch (err) {
    console.error('profile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
```
This is the same fix applied to `/api/profile/:username` — consolidate into one route so both paths work.

---

### FIX B-4: Fix Settings — Reject Unknown / Dangerous Fields
**In `routes/settings.js`**, whitelist ONLY the fields that settings can update:
```js
const ALLOWED_SETTINGS = new Set([
  'appearOffline', 'dmPrivacy', 'liteModeEnabled',
  'notificationPrefs', 'telegramNotifications', 'telegramId'
]);

router.patch('/', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (ALLOWED_SETTINGS.has(key)) {
        updates[key] = value;
      }
      // silently ignore unknown fields (or return 400 if you prefer strict mode)
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, select: 'appearOffline dmPrivacy liteModeEnabled notificationPrefs telegramNotifications telegramId' }
    );
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});
```

---

### FIX B-5: Register Auth Routes That Currently Return HTML
**Problem:** `POST /api/auth/verify-email`, `POST /api/auth/resend-otp`, `POST /api/auth/select-faction` all return the React SPA HTML — they are missing from the Express router.

**In `routes/auth.js`**, add these handlers:
```js
// Email verification
router.post('/verify-email', async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp || typeof otp !== 'string') return res.status(400).json({ message: 'OTP required' });

    const user = await User.findOne({ emailOtp: otp, emailOtpExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    await User.findByIdAndUpdate(user._id, {
      $set: { isEmailVerified: true },
      $unset: { emailOtp: '', emailOtpExpiry: '' }
    });
    return res.json({ message: 'Email verified successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string' || !email) return res.status(400).json({ message: 'email required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isEmailVerified) return res.status(400).json({ message: 'Already verified' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await User.findByIdAndUpdate(user._id, { $set: { emailOtp: otp, emailOtpExpiry: expiry } });

    // Send email (use your existing email service)
    await sendEmail(user.email, 'DriftLife — Verify your email', `Your OTP: ${otp}`);
    return res.json({ message: 'OTP resent' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Select faction (used during onboarding)
router.post('/select-faction', authMiddleware, async (req, res) => {
  try {
    const { faction } = req.body;
    const VALID_FACTIONS = ['grid', 'suits', 'syndicate', 'lost', 'neutral'];
    if (!VALID_FACTIONS.includes(faction)) {
      return res.status(400).json({ message: 'Invalid faction', valid: VALID_FACTIONS });
    }
    const user = await User.findById(req.user.userId);
    if (user.faction && user.faction !== 'neutral') {
      return res.status(400).json({ message: 'Faction already set' });
    }
    await User.findByIdAndUpdate(req.user.userId, { $set: { faction } });
    return res.json({ message: `Joined ${faction}`, faction });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});
```

---

## PHASE C — MISSING BACKEND FEATURES (Implement These)

---

### FIX C-1: PvP Combat Route
**Problem:** `POST /api/combat/pvp/:targetId` returns "Cannot POST" — route not registered.

**In `routes/combat.js`**, add:
```js
router.post('/pvp/:targetId', authMiddleware, async (req, res) => {
  try {
    const attackerId = req.user.userId;
    const { targetId } = req.params;

    if (attackerId === targetId) return res.status(400).json({ message: 'Cannot attack yourself' });

    // Combat cooldown (atomic)
    const attacker = await User.findOneAndUpdate(
      {
        _id: attackerId,
        $or: [
          { lastCombatAt: { $exists: false } },
          { lastCombatAt: { $lte: new Date(Date.now() - 10000) } } // 10s PvP cooldown
        ]
      },
      { $set: { lastCombatAt: new Date() } },
      { new: true }
    );
    if (!attacker) return res.status(429).json({ message: 'Combat cooldown — wait 10 seconds' });
    if (attacker.hospitalized) return res.status(400).json({ message: 'You are hospitalized' });
    if (attacker.jailUntil && attacker.jailUntil > new Date()) return res.status(400).json({ message: 'You are in jail' });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'Player not found' });
    if (Math.abs(attacker.level - target.level) > 25) {
      return res.status(400).json({ message: 'Target is too far outside your level range (max ±25)' });
    }
    if (target.hospitalized) return res.status(400).json({ message: 'Target is already hospitalized' });

    // Combat resolution
    const attackerPower = attacker.strength + Math.random() * 10;
    const defenderPower = target.strength * 0.8 + Math.random() * 10;
    const attackerWins = attackerPower > defenderPower;

    const dcStolen = attackerWins ? Math.floor(Math.min(target.dc * 0.05, 5000)) : 0;
    const xpGained = attackerWins ? Math.floor(target.level * 5) : 0;
    const damage = attackerWins ? Math.floor(Math.random() * 20 + 10) : Math.floor(Math.random() * 15 + 5);

    // Apply results atomically
    if (attackerWins) {
      await User.findByIdAndUpdate(attackerId, { $inc: { wins: 1, dc: dcStolen, xp: xpGained, attacksToday: 1 } });
      const targetUser = await User.findByIdAndUpdate(targetId, {
        $inc: { losses: 1, dc: -dcStolen, health: -damage }
      }, { new: true });

      // Hospitalize if health drops to 0
      if (targetUser.health <= 0) {
        const hoursOut = 1;
        await User.findByIdAndUpdate(targetId, {
          $set: {
            health: 0,
            hospitalizedUntil: new Date(Date.now() + hoursOut * 3600000)
          }
        });
      }
    } else {
      await User.findByIdAndUpdate(attackerId, {
        $inc: { losses: 1, health: -damage, attacksToday: 1 }
      });
    }

    return res.json({
      attackerWins,
      dcStolen,
      xpGained,
      damage,
      narrative: attackerWins
        ? `You overpowered ${target.username} and took ${dcStolen} DC.`
        : `${target.username} fought back. You took ${damage} damage.`
    });
  } catch (err) {
    console.error('pvp error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
```

---

### FIX C-2: Friends System Backend
**Create `routes/friends.js`** and register at `/api/friends`:
```js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // create this model
const authMiddleware = require('../middleware/auth');

// GET /api/friends — list accepted friends
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('friends', 'username tag avatar avatarUrl level faction equippedFrame district');
    return res.json(user.friends || []);
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/friends/requests — pending requests
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ to: req.user.userId, status: 'pending' })
      .populate('from', 'username tag avatar avatarUrl level faction');
    return res.json(requests);
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/friends/request — send friend request
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ message: 'targetId required' });
    if (targetId === req.user.userId) return res.status(400).json({ message: 'Cannot friend yourself' });

    const existing = await FriendRequest.findOne({
      $or: [
        { from: req.user.userId, to: targetId },
        { from: targetId, to: req.user.userId }
      ],
      status: 'pending'
    });
    if (existing) return res.status(400).json({ message: 'Request already exists' });

    await FriendRequest.create({ from: req.user.userId, to: targetId, status: 'pending' });
    return res.json({ message: 'Friend request sent' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/friends/accept — accept a request
router.post('/accept', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await FriendRequest.findOne({ _id: requestId, to: req.user.userId, status: 'pending' });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await FriendRequest.findByIdAndUpdate(requestId, { $set: { status: 'accepted' } });
    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { friends: request.from } });
    await User.findByIdAndUpdate(request.from, { $addToSet: { friends: req.user.userId } });
    return res.json({ message: 'Friend request accepted' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/friends/:friendId — remove friend
router.delete('/:friendId', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.params;
    await User.findByIdAndUpdate(req.user.userId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: req.user.userId } });
    return res.json({ message: 'Friend removed' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
```

**Register in main app:**
```js
app.use('/api/friends', require('./routes/friends'));
```

**FriendRequest model (`models/FriendRequest.js`):**
```js
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ from: 1, to: 1 });
module.exports = mongoose.model('FriendRequest', schema);
```

---

### FIX C-3: Inventory Equip/Unequip Routes
**Problem:** `POST /api/inventory/equip` and `/api/inventory/unequip` return "Cannot POST".

**In `routes/inventory.js`** (or wherever inventory is handled), add:
```js
// POST /api/inventory/equip/:itemId
router.post('/equip/:itemId', authMiddleware, async (req, res) => {
  try {
    const item = await Inventory.findOne({ _id: req.params.itemId, userId: req.user.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.equipped) return res.status(400).json({ message: 'Already equipped' });

    // Unequip existing item in same slot
    await Inventory.updateMany(
      { userId: req.user.userId, slot: item.slot, equipped: true },
      { $set: { equipped: false } }
    );
    await Inventory.findByIdAndUpdate(item._id, { $set: { equipped: true } });

    // Apply stat bonuses to user
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: {
        strength: item.strengthBonus || 0,
        charisma: item.charismaBonus || 0,
        intelligence: item.intelligenceBonus || 0,
        streetCred: item.streetCredBonus || 0,
      }
    });
    return res.json({ message: `${item.name} equipped` });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/inventory/unequip/:itemId
router.post('/unequip/:itemId', authMiddleware, async (req, res) => {
  try {
    const item = await Inventory.findOne({ _id: req.params.itemId, userId: req.user.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (!item.equipped) return res.status(400).json({ message: 'Item not equipped' });

    await Inventory.findByIdAndUpdate(item._id, { $set: { equipped: false } });
    // Remove stat bonuses
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: {
        strength: -(item.strengthBonus || 0),
        charisma: -(item.charismaBonus || 0),
        intelligence: -(item.intelligenceBonus || 0),
        streetCred: -(item.streetCredBonus || 0),
      }
    });
    return res.json({ message: `${item.name} unequipped` });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});
```

---

### FIX C-4: Market — Register Listing Route Correctly
**Problem:** `POST /api/market/list` returns "Cannot POST". The correct pattern should be `POST /api/market/listings`.

**In `routes/market.js`**, ensure this route exists:
```js
// POST /api/market/listings — list an item
router.post('/listings', authMiddleware, async (req, res) => {
  // (full implementation in FIX B-2 above)
});
```
Also add market route to app.js if not registered:
```js
app.use('/api/market', require('./routes/market'));
```

---

### FIX C-5: Faction Chat Backend
**In `routes/chat.js`**, add faction chat:
```js
// GET /api/chat/faction — get faction chat messages
router.get('/faction', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId, 'faction');
    if (!user.faction || user.faction === 'neutral') {
      return res.status(400).json({ message: 'You must belong to a faction to use faction chat' });
    }
    const messages = await ChatMessage.find({ channel: `faction:${user.faction}` })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json(messages.reverse());
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/chat/faction
router.post('/faction', authMiddleware, factionChatRateLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.faction || user.faction === 'neutral') {
      return res.status(400).json({ message: 'Join a faction to use faction chat' });
    }
    const content = sanitizeHtml(req.body.content || '', { allowedTags: [] }).trim();
    if (!content) return res.status(400).json({ message: 'content required' });
    if (content.length > 500) return res.status(400).json({ message: 'Message too long' });

    const msg = await ChatMessage.create({
      userId: user._id,
      username: user.username,
      channel: `faction:${user.faction}`,
      content,
    });

    // Emit to faction room via Socket.IO
    req.app.get('io').to(`faction:${user.faction}`).emit('faction_message', msg);
    return res.json({ message: 'Sent', id: msg._id });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});
```

---

### FIX C-6: Add More NPCs per District
**Problem:** Only `street_punk` is in `/api/combat/npcs`. Districts reference other NPCs (Chief Ralston, Shadowbyte, etc.) but none are registered.

**In your NPC data file or DB seed**, add all district NPCs:
```js
const NPCS = [
  // Residential North (Level 1-5)
  { id: "street_punk", name: "Street Punk", district: "residential-north", level: 5, hp: 30, strength: 8, dcMin: 500, dcMax: 1000, xp: 50, dropRarity: "common", description: "A desperate kid looking for an easy score." },
  { id: "chief_ralston", name: "Chief Ralston", district: "residential-north", level: 8, hp: 60, strength: 14, dcMin: 800, dcMax: 2000, xp: 100, dropRarity: "uncommon", description: "A corrupt local officer running a shakedown operation." },

  // Tech Quarter (Level 5-15)
  { id: "shadowbyte", name: "Shadowbyte", district: "tech-quarter", level: 12, hp: 80, strength: 18, dcMin: 1500, dcMax: 4000, xp: 200, dropRarity: "uncommon", description: "A rogue Grid operative dealing in stolen data." },
  { id: "grid_enforcer", name: "Grid Enforcer", district: "tech-quarter", level: 10, hp: 70, strength: 16, dcMin: 1200, dcMax: 3000, xp: 150, dropRarity: "common", description: "A Grid-affiliated security agent." },

  // (Add more per district here)
];
```

Update the `/api/combat/npcs` route to filter by the player's current district:
```js
router.get('/npcs', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId, 'district level');
  const npcs = NPCS.filter(n => n.district === user.district && n.level <= user.level + 10);
  return res.json(npcs);
});
```

---

## PHASE D — PERFORMANCE FIXES

---

### FIX D-1: Add Field Projection to /api/user/me
**Problem:** Returns the entire user document (246ms). Should project only needed fields.

```js
router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId, '-password -emailOtp -emailOtpExpiry -refreshTokens');
  return res.json(user);
});
```

---

### FIX D-2: Add Pagination to Frames and Market
```js
// GET /api/frames?page=1&limit=20
router.get('/', authMiddleware, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const frames = await Frame.find({}).skip(skip).limit(limit);
  const total = await Frame.countDocuments();
  return res.json({ frames, total, page, pages: Math.ceil(total / limit) });
});
```

---

### FIX D-3: Add MongoDB Indexes for Performance
**In your DB initialization or a migration file**, ensure indexes exist:
```js
// Users
await User.collection.createIndex({ username: 1 }, { unique: true });
await User.collection.createIndex({ email: 1 }, { unique: true });
await User.collection.createIndex({ dc: -1 }); // leaderboard by dc
await User.collection.createIndex({ level: -1 }); // leaderboard by level
await User.collection.createIndex({ wins: -1 }); // leaderboard by wins
await User.collection.createIndex({ merit: -1 }); // leaderboard by merit

// Inventory
await Inventory.collection.createIndex({ userId: 1 });
await Inventory.collection.createIndex({ userId: 1, name: 1, rarity: 1 }); // for dedup

// Chat
await ChatMessage.collection.createIndex({ channel: 1, createdAt: -1 });

// Achievements
await UserAchievement.collection.createIndex({ userId: 1 });

// Market
await MarketListing.collection.createIndex({ listedAt: -1 });
await MarketListing.collection.createIndex({ sellerId: 1 });
```

---

### FIX D-4: Add Keep-Alive Ping to Prevent Render Cold Starts
**In your `server.js`** (or as a separate cron on Render):
```js
// Self-ping every 14 minutes to prevent Render free tier sleep
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
  setInterval(async () => {
    try {
      await fetch(`${process.env.RENDER_EXTERNAL_URL}/api/healthz`);
    } catch (e) { /* ignore */ }
  }, 14 * 60 * 1000);
}
```
Or better: use a free uptime monitor (UptimeRobot, Better Uptime) to ping `/api/healthz` every 5 minutes.

---

## PHASE E — MEDIUM PRIORITY (Do After Critical)

---

### FIX E-1: Add Crew System Backend
Create `routes/crew.js`:
```js
// GET /api/crew — get current user's crew
// POST /api/crew — create a crew
// POST /api/crew/join/:crewId — join a crew  
// POST /api/crew/leave — leave current crew
// DELETE /api/crew/:crewId — disband crew (leader only)
// GET /api/crew/list — list all crews
// POST /api/crew/invite/:userId — invite player
// POST /api/crew/kick/:userId — kick member (leader only)
```
Register: `app.use('/api/crew', require('./routes/crew'));`

---

### FIX E-2: Add Gang System Backend
Same pattern as crew but with territory control, war mechanics, and faction alignment.
```
// GET /api/gang
// POST /api/gang
// POST /api/gang/join/:gangId
// POST /api/gang/leave
// GET /api/gang/list
// GET /api/gang/territory
// POST /api/gang/war/:gangId
```

---

### FIX E-3: Add Follow System
In `routes/users.js`:
```js
// POST /api/user/follow/:targetId
router.post('/follow/:targetId', authMiddleware, async (req, res) => {
  const { targetId } = req.params;
  if (targetId === req.user.userId) return res.status(400).json({ message: 'Cannot follow yourself' });
  await User.findByIdAndUpdate(req.user.userId, { $addToSet: { following: targetId } });
  return res.json({ message: 'Followed' });
});

// POST /api/user/unfollow/:targetId
router.post('/unfollow/:targetId', authMiddleware, async (req, res) => {
  await User.findByIdAndUpdate(req.user.userId, { $pull: { following: req.params.targetId } });
  return res.json({ message: 'Unfollowed' });
});
```

---

### FIX E-4: Implement Prestige Route
```js
// POST /api/prestige
router.post('/', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (user.level < 100) return res.status(400).json({ message: 'Must be level 100 to prestige' });

  await User.findByIdAndUpdate(req.user.userId, {
    $inc: { prestige: 1, skillPoints: 5 },
    $set: {
      level: 1, xp: 0,
      strength: 10, charisma: 5, intelligence: 5, streetCred: 0
    }
  });
  return res.json({ message: 'Prestige successful! You start over, stronger.' });
});
```
Register: `app.use('/api/prestige', require('./routes/prestige'));`

---

### FIX E-5: Fix HTTP Method Consistency
Go through all routes and ensure the HTTP method matches REST conventions:
- Render `PUT /api/settings` → `405 Method Not Allowed` with header `Allow: PATCH` (don't just silently fail)
- `POST /api/frames/color` → should be `PATCH /api/frames/color` for consistency (or keep POST but document it)
- `GET /api/bank/deposit` → `405 Method Not Allowed` (GET on deposit makes no sense)
- Add to `app.js` a global handler for unknown methods:
```js
// After all routes
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});
```

---

## PHASE F — FRONTEND FIXES

These changes go in the React frontend source code (re-build + deploy needed):

### FF-1: Use Correct HTTP Method for Settings
```js
// In your settings API call:
// WRONG:
await fetch('/api/settings', { method: 'PUT', ... });
// CORRECT:
await fetch('/api/settings', { method: 'PATCH', ... });
```

### FF-2: Use Correct Market List Route
```js
// WRONG:
await fetch('/api/market/list', { method: 'POST', ... });
// CORRECT:
await fetch('/api/market/listings', { method: 'POST', ... });
```

### FF-3: Use Correct Market Buy Route
```js
// CORRECT (it's per-listing):
await fetch(`/api/market/listings/${listingId}/buy`, { method: 'POST' });
```

### FF-4: Profile Link — Use Username Not ID
```js
// If navigating to player profile, use username not ObjectId:
// WRONG: /api/user/${user.id}
// CORRECT: /api/profile/${user.username}
```

### FF-5: Add Error Boundary to Prevent White Screens
Wrap the entire app in an error boundary:
```jsx
// ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('App crashed:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#00ffff', fontFamily: 'monospace' }}>
          <h2>⚠ Something crashed</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}>
            Return to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// In App.jsx:
<ErrorBoundary>
  <Router>
    {/* routes */}
  </Router>
</ErrorBoundary>
```

---

## VERIFICATION CHECKLIST

After applying all fixes, run this test sequence:

```bash
BASE="https://your-game-url.onrender.com"
TOKEN="<owner-access-token>"

# A-1: Race condition fixed
for i in $(seq 1 20); do
  curl -s -X POST "$BASE/api/jobs/delivery_driver/work" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"result":"success"}' &
done
wait
# EXPECTED: Only first succeeds, rest return 429 or "on cooldown"

# A-2: Rate limiter works
for i in $(seq 1 25); do
  curl -s -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" -d '{"email":"x","password":"y"}' &
done
wait
# EXPECTED: After ~20 requests, get "Too many login attempts"

# A-3: Security headers present
curl -sI "$BASE/" | grep -i "x-frame\|content-security\|x-content-type"
# EXPECTED: Headers present

# A-4: XSS sanitized
curl -s -X POST "$BASE/api/chat/global" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"<script>alert(1)</script>"}'
# EXPECTED: Content stored as empty string or rejected

# A-5: NoSQL injection blocked
curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":{"$gt":""},"password":{"$gt":""}}'
# EXPECTED: 400 "email and password required"

# A-6: No duplicate items after NPC fight
for i in $(seq 1 5); do
  curl -s -X POST "$BASE/api/combat/npc/street_punk" \
    -H "Authorization: Bearer $TOKEN" &
done; wait
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/inventory" | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const n={}; d.forEach(i=>n[i.name]=(n[i.name]||0)+i.quantity); console.log(n);"
# EXPECTED: quantity increments, no duplicate entries

# B-1: Hospital use-item no longer crashes
curl -s -X POST "$BASE/api/hospital/use-item" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"itemId":"fakeid"}'
# EXPECTED: 404 "Item not found" not 500

# C-1: PvP works
curl -s -X POST "$BASE/api/combat/pvp/NORMAL_USER_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
# EXPECTED: combat result JSON

# C-2: Friends routes work
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/friends"
# EXPECTED: [] or array of friends
```

---

## FINAL SCORES (After Fixes Applied)

| Dimension | Before | After (Target) |
|---|---|---|
| Security | 38 / 100 | 78 / 100 |
| Stability | 52 / 100 | 85 / 100 |
| Performance | 74 / 100 | 84 / 100 |
| Production Readiness | 41 / 100 | 77 / 100 |

---

## DEPENDENCIES TO INSTALL

```bash
npm install helmet express-rate-limit sanitize-html
# or
yarn add helmet express-rate-limit sanitize-html
```

---

*End of Master Fix Prompt — Generated by full 5-phase audit on 2026-06-30*
