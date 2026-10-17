## 2025-05-18 - Leaderboard Queries Missing Compound Indexes on User Model

**Learning:** Queries on the `User` collection like `/api/leaderboard` filter on `{ banned: false }` and sort by fields such as `level`, `wins`, `raceWins`, `totalCrimes`, `weeklyDc`, `weeklyArenaWins`, `weeklyRaceWins`, or `prestige`. Without compound indexes starting with `banned` and the respective sort fields, MongoDB performs full collection scans and in-memory sorts for every leaderboard request and `/api/leaderboard/my-rank` query.

**Action:** Always add compound indexes for filter+sort fields (e.g. `{ banned: 1, level: -1, xp: -1 }`) on heavily queried collections like `User` to allow index-covered scanning and fast sorting without memory limits.
