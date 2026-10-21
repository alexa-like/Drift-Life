## 2025-02-28 - Lazy Reset Operations & Unindexed Leaderboard Queries

**Learning:** Route handlers performing "lazy resets" (such as `maybeResetWeekly()`) often issue unindexed write/update queries against MongoDB on every single incoming API request. Without in-memory timestamp tracking and compound indexes on filter/sort fields (`banned` + metric fields), high-frequency endpoints cause redundant DB load and full collection scans.
**Action:** Always wrap lazy reset functions with in-memory timestamp guards (e.g. tracking Monday UTC midnight) and add compound MongoDB indexes for query filter + sort keys in Mongoose schemas.
