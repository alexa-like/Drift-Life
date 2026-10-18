## 2025-05-18 - Avoid Unnecessary DB Write Queries on GET Endpoints

**Learning:** `maybeResetWeekly()` in `leaderboard.ts` was executing a `User.updateMany` write query on every single GET request for weekly leaderboards. Even when no documents needed updating, sending write operations to MongoDB on hot GET endpoints creates unnecessary write lock overhead and database load.

**Action:** Guard lazy reset routines with an in-memory timestamp (`lastCheckedResetMondayTime`) to ensure DB write queries run at most once per reset interval (e.g., per week) per process.
