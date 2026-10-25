# Bolt's Journal

## 2025-05-18 - Leaderboard Indexes on User Collection
**Learning:** Frequent queries in `leaderboard.ts` (level, wins, raceWins, totalCrimes, weeklyDc, weeklyArenaWins, weeklyRaceWins, prestige, weeklyReset) were running unindexed collection scans on `User`. Adding targeted compound indexes drastically speeds up leaderboard sorting and weekly resets.
**Action:** Always index leaderboard sorting fields combined with `banned` status filter for MongoDB user collections.
