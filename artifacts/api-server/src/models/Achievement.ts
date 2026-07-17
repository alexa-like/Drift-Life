import mongoose, { Document, Schema } from "mongoose";

export type AchievementCategory = "arena" | "crime" | "wealth" | "social" | "exploration" | "collection" | "racing";

export interface IAchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  dcReward:  number;   // DC granted on completion
  keyReward?: number;  // Keys granted on completion (Tier 6+)
  target: number;
  stat: string;
}

export const ACHIEVEMENT_CATALOG: IAchievementDef[] = [
  // ARENA (PvP combat system)
  { id: "first_blood",       name: "First Blood",        description: "Win your first Arena fight.",              category: "arena",  dcReward: 100,   keyReward: 1, target: 1,    stat: "arenaWins" },
  { id: "arena_wins_10",     name: "Brawler",             description: "Win 10 Arena fights.",                    category: "arena",  dcReward: 500,   keyReward: 3, target: 10,   stat: "arenaWins" },
  { id: "arena_wins_50",     name: "Street Soldier",      description: "Win 50 Arena fights.",                    category: "arena",  dcReward: 1500,  keyReward: 5, target: 50,   stat: "arenaWins" },
  { id: "arena_wins_100",    name: "Enforcer",            description: "Win 100 Arena fights.",                   category: "arena",  dcReward: 5000,               target: 100,  stat: "arenaWins" },
  { id: "arena_wins_500",    name: "Ghost Hunter",        description: "Win 500 Arena fights.",                   category: "arena",  dcReward: 20000,              target: 500,  stat: "arenaWins" },
  { id: "arena_wins_1000",   name: "War Machine",         description: "Win 1,000 Arena fights.",                 category: "arena",  dcReward: 100000,             target: 1000, stat: "arenaWins" },
  { id: "arena_fights_50",   name: "In The Ring",         description: "Enter the Arena 50 times.",               category: "arena",  dcReward: 500,                target: 50,   stat: "arenaFights" },
  { id: "arena_fights_500",  name: "Veteran",             description: "Enter the Arena 500 times.",              category: "arena",  dcReward: 5000,               target: 500,  stat: "arenaFights" },

  // CRIME
  { id: "first_crime",      name: "Petty Theft",         description: "Commit your first crime.",                category: "crime",       dcReward: 100,    target: 1,    stat: "totalCrimes" },
  { id: "crime_50",         name: "Career Criminal",     description: "Commit 50 crimes.",                       category: "crime",       dcReward: 500,    target: 50,   stat: "totalCrimes" },
  { id: "crime_100",        name: "Syndicate Runner",    description: "Commit 100 crimes.",                      category: "crime",       dcReward: 1500,   target: 100,  stat: "totalCrimes" },
  { id: "crime_500",        name: "Notorious",           description: "Commit 500 crimes.",                      category: "crime",       dcReward: 5000,   target: 500,  stat: "totalCrimes" },
  { id: "crime_1000",       name: "New Vanta Legend",    description: "Commit 1,000 crimes.",                    category: "crime",       dcReward: 20000,  target: 1000, stat: "totalCrimes" },
  { id: "crime_5000",       name: "The Ghost",           description: "Commit 5,000 crimes.",                    category: "crime",       dcReward: 100000, target: 5000, stat: "totalCrimes" },
  { id: "success_rate_90",  name: "Professional",        description: "Reach 90% crime success rate (min 100).", category: "crime",       dcReward: 10000,  target: 90,   stat: "crimeSuccessRate" },
  { id: "never_jailed",     name: "Slippery",            description: "Commit 50 crimes without being jailed.",  category: "crime",       dcReward: 5000,   target: 50,   stat: "crimesSinceJail" },

  // WEALTH
  { id: "first_million",    name: "First Million",       description: "Earn your first 1,000,000 DC.",           category: "wealth",      dcReward: 1500,   target: 1000000,   stat: "lifetimeDC" },
  { id: "ten_million",      name: "Fat Stacks",          description: "Accumulate 10,000,000 DC.",               category: "wealth",      dcReward: 5000,   target: 10000000,  stat: "lifetimeDC" },
  { id: "hundred_million",  name: "Corp Level",          description: "Accumulate 100,000,000 DC.",              category: "wealth",      dcReward: 20000,  target: 100000000, stat: "lifetimeDC" },
  { id: "banked_1m",        name: "Banker",              description: "Have 1,000,000 DC in the bank at once.",  category: "wealth",      dcReward: 1500,   target: 1000000,   stat: "bankBalance" },
  { id: "first_nc",         name: "Nova Coin",           description: "Earn your first 10 NC.",                  category: "wealth",      dcReward: 500,    target: 10,        stat: "nc" },
  { id: "first_purchase",   name: "Window Shopper",      description: "Purchase your first item from the shop.", category: "wealth",      dcReward: 100,    target: 1,         stat: "totalPurchases" },

  // SOCIAL
  { id: "chat_100",         name: "Chatterbox",          description: "Send 100 messages.",                      category: "social",      dcReward: 500,    target: 100,  stat: "totalMessages" },
  { id: "chat_1000",        name: "Radio Host",          description: "Send 1,000 messages.",                    category: "social",      dcReward: 2000,   target: 1000, stat: "totalMessages" },
  { id: "first_dm",         name: "First Contact",       description: "Send your first DM.",                     category: "social",      dcReward: 100,    target: 1,    stat: "totalDMs" },
  { id: "daily_7",          name: "Consistent",          description: "Claim your daily reward 7 days in a row.",category: "social",      dcReward: 500,    target: 7,    stat: "dailyStreak" },
  { id: "daily_30",         name: "Dedicated",           description: "Claim your daily reward 30 days in a row.",category: "social",     dcReward: 5000,   target: 30,   stat: "dailyStreak" },

  // EXPLORATION
  { id: "first_travel",     name: "Wanderer",            description: "Travel to a new district.",               category: "exploration", dcReward: 100,    target: 1,    stat: "districtsVisited" },
  { id: "all_districts",    name: "City Map",            description: "Visit all 5 districts.",                  category: "exploration", dcReward: 2000,   target: 5,    stat: "districtsVisited" },
  { id: "level_10",         name: "Getting Serious",     description: "Reach level 10.",                         category: "exploration", dcReward: 500,   keyReward: 1, target: 10,   stat: "level" },
  { id: "level_25",         name: "Mid-Tier",            description: "Reach level 25.",                         category: "exploration", dcReward: 1500,  keyReward: 3, target: 25,   stat: "level" },
  { id: "level_50",         name: "Veteran Runner",      description: "Reach level 50.",                         category: "exploration", dcReward: 5000,  keyReward: 5, target: 50,   stat: "level" },
  { id: "level_75",         name: "New Vanta Elite",     description: "Reach level 75.",                         category: "exploration", dcReward: 20000,  target: 75,   stat: "level" },
  { id: "level_100",        name: "God Tier",            description: "Reach level 100.",                        category: "exploration", dcReward: 100000, target: 100,  stat: "level" },
  { id: "prestige_1",       name: "Reborn",              description: "Reach your first prestige.",              category: "exploration", dcReward: 50000,  target: 1,    stat: "prestige" },
  { id: "all_jobs",         name: "Jack of All Trades",  description: "Complete every job type at least once.",  category: "exploration", dcReward: 2000,   target: 5,    stat: "uniqueJobsCompleted" },

  // RACING
  { id: "race_first_win",   name: "Pole Position",       description: "Finish 1st in a race.",                   category: "racing",      dcReward: 500,   keyReward: 1, target: 1,   stat: "raceWins" },
  { id: "race_wins_10",     name: "Speed Demon",         description: "Win 10 races.",                           category: "racing",      dcReward: 1500,  keyReward: 3, target: 10,  stat: "raceWins" },
  { id: "race_wins_50",     name: "Street Racer",        description: "Win 50 races.",                           category: "racing",      dcReward: 5000,  keyReward: 5, target: 50,  stat: "raceWins" },
  { id: "race_plays_10",    name: "On The Grid",         description: "Complete 10 races.",                      category: "racing",      dcReward: 300,   target: 10,  stat: "totalRaces" },
  { id: "race_plays_50",    name: "Track Regular",       description: "Complete 50 races.",                      category: "racing",      dcReward: 1500,  target: 50,  stat: "totalRaces" },

  // ARENA STREAKS (progress = max Arena win streak ever achieved)
  { id: "arena_streak_5",   name: "Hot Streak",          description: "Reach a 5 Arena win streak.",             category: "arena",  dcReward: 500,   keyReward: 2, target: 5,   stat: "combatWinStreak" },
  { id: "arena_streak_10",  name: "Unstoppable",         description: "Reach a 10 Arena win streak.",            category: "arena",  dcReward: 2000,  keyReward: 5, target: 10,  stat: "combatWinStreak" },
];

export interface IUserAchievement extends Document {
  userId: mongoose.Types.ObjectId;
  achievementId: string;
  progress: number;
  completed: boolean;
  completedAt: Date | null;
  rewardGranted: boolean;   // true once DC reward has been paid out
}

const UserAchievementSchema = new Schema<IUserAchievement>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    achievementId: { type: String, required: true },
    progress:      { type: Number, default: 0 },
    completed:     { type: Boolean, default: false },
    completedAt:   { type: Date, default: null },
    rewardGranted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
UserAchievementSchema.index({ userId: 1 });

export default mongoose.model<IUserAchievement>("UserAchievement", UserAchievementSchema);
