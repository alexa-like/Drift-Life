## 2025-05-18 - Avoid N+1 lookups when fetching user notification targets in async background handlers

**Learning:** In fire-and-forget notification functions like `notifyMentions`, querying only `_id` in initial target search causes secondary per-user DB queries (like `User.findById(target._id).select("telegramId telegramNotifications")`) inside `Promise.all` loops.
**Action:** Always project required notification properties (`telegramId`, `telegramNotifications`, etc.) in the initial `User.find()` query whenever iterating over target users.
