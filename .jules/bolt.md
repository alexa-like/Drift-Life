## 2025-02-18 - Mini-game Leaderboard User Rank Optimization
**Learning:** Querying leaderboard user rank via `countDocuments` for every request creates redundant database load when top leaderboard entries are already fetched into application memory.
**Action:** Always check if the current user is present in pre-fetched top query results before triggering a DB rank aggregation/count query.
