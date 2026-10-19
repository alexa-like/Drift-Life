## 2025-02-18 - Leaderboard Mongo Compound Indexes & Lazy Reset Guard
**Learning:** High-volume GET endpoints (like leaderboards) were executing both unindexed sorting collection scans and write queries (`User.updateMany`) on every hit due to unguarded lazy reset logic.
**Action:** Always create compound indexes `{ banned: 1, metric: -1 }` on user metrics queried for leaderboards, and use in-memory timestamp/state guards before calling lazy bulk update operations on read endpoints.
