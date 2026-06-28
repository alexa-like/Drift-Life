import mongoose, { Document, Schema } from "mongoose";

export type AchievementCategory = "combat" | "crime" | "wealth" | "social" | "exploration" | "collection";

export interface IAchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  meritReward: number;
  target: number;
  stat: string;
}

export const ACHIEVEMENT_CATALOG: IAchievementDef[] = [
  // COMBAT
  { id: "first_blood",     name: "First Blood",       description: "Win your first fight.",                  category: "combat",      meritReward: 10,    target: 1,    stat: "wins" },
  { id: "fighter_10",      name: "Brawler",            description: "Win 10 fights.",                         category: "combat",      meritReward: 50,    target: 10,   stat: "wins" },
  { id: "fighter_50",      name: "Street Soldier",     description: "Win 50 fights.",                         category: "combat",      meritReward: 150,   target: 50,   stat: "wins" },
  { id: "fighter_100",     name: "Enforcer",           description: "Win 100 fights.",                        category: "combat",      meritReward: 500,   target: 100,  stat: "wins" },
  { id: "fighter_500",     name: "Ghost Hunter",       description: "Win 500 fights.",                        category: "combat",      meritReward: 2000,  target: 500,  stat: "wins" },
  { id: "fighter_1000",    name: "War Machine",        description: "Win 1,000 fights.",                      category: "combat",      meritReward: 10000, target: 1000, stat: "wins" },
  { id: "unbeaten_10",     name: "Untouchable",        description: "Win 10 fights without a loss.",          category: "combat",      meritReward: 200,   target: 10,   stat: "winStreak" },
  { id: "unbeaten_25",     name: "Urban Legend",       description: "Win 25 fights without a loss.",          category: "combat",      meritReward: 1000,  target: 25,   stat: "winStreak" },
  { id: "total_fights_50", name: "In The Ring",        description: "Fight 50 times total.",                  category: "combat",      meritReward: 50,    target: 50,   stat: "totalFights" },
  { id: "total_fights_500",name: "Veteran",            description: "Fight 500 times total.",                 category: "combat",      meritReward: 500,   target: 500,  stat: "totalFights" },

  // CRIME
  { id: "first_crime",     name: "Petty Theft",        description: "Commit your first crime.",               category: "crime",       meritReward: 10,    target: 1,    stat: "totalCrimes" },
  { id: "crime_50",        name: "Career Criminal",    description: "Commit 50 crimes.",                      category: "crime",       meritReward: 50,    target: 50,   stat: "totalCrimes" },
  { id: "crime_100",       name: "Syndicate Runner",   description: "Commit 100 crimes.",                     category: "crime",       meritReward: 150,   target: 100,  stat: "totalCrimes" },
  { id: "crime_500",       name: "Notorious",          description: "Commit 500 crimes.",                     category: "crime",       meritReward: 500,   target: 500,  stat: "totalCrimes" },
  { id: "crime_1000",      name: "New Vanta Legend",   description: "Commit 1,000 crimes.",                   category: "crime",       meritReward: 2000,  target: 1000, stat: "totalCrimes" },
  { id: "crime_5000",      name: "The Ghost",          description: "Commit 5,000 crimes.",                   category: "crime",       meritReward: 10000, target: 5000, stat: "totalCrimes" },
  { id: "success_rate_90", name: "Professional",       description: "Reach 90% crime success rate (min 100).",category: "crime",       meritReward: 1000,  target: 90,   stat: "crimeSuccessRate" },
  { id: "never_jailed",    name: "Slippery",           description: "Commit 50 crimes without being jailed.", category: "crime",       meritReward: 500,   target: 50,   stat: "crimesSinceJail" },

  // WEALTH
  { id: "first_million",   name: "First Million",      description: "Earn your first 1,000,000 DC.",          category: "wealth",      meritReward: 150,   target: 1000000,   stat: "lifetimeDC" },
  { id: "ten_million",     name: "Fat Stacks",         description: "Accumulate 10,000,000 DC.",              category: "wealth",      meritReward: 500,   target: 10000000,  stat: "lifetimeDC" },
  { id: "hundred_million", name: "Corp Level",         description: "Accumulate 100,000,000 DC.",             category: "wealth",      meritReward: 2000,  target: 100000000, stat: "lifetimeDC" },
  { id: "banked_1m",       name: "Banker",             description: "Have 1,000,000 DC in the bank at once.", category: "wealth",      meritReward: 150,   target: 1000000,   stat: "bankBalance" },
  { id: "first_nc",        name: "Nova Coin",          description: "Earn your first 10 NC.",                 category: "wealth",      meritReward: 50,    target: 10,        stat: "nc" },
  { id: "first_purchase",  name: "Window Shopper",     description: "Purchase your first item from the shop.",category: "wealth",      meritReward: 10,    target: 1,         stat: "totalPurchases" },
  { id: "first_frame_buy", name: "Identity Crisis",    description: "Purchase your first frame.",             category: "wealth",      meritReward: 50,    target: 1,         stat: "ownedFramesCount" },
  { id: "first_merit",     name: "Merit Badge",        description: "Earn your first 100 M.",                 category: "wealth",      meritReward: 0,     target: 100,       stat: "merit" },

  // SOCIAL
  { id: "chat_100",        name: "Chatterbox",         description: "Send 100 messages.",                     category: "social",      meritReward: 50,    target: 100,  stat: "totalMessages" },
  { id: "chat_1000",       name: "Radio Host",         description: "Send 1,000 messages.",                   category: "social",      meritReward: 200,   target: 1000, stat: "totalMessages" },
  { id: "first_dm",        name: "First Contact",      description: "Send your first DM.",                    category: "social",      meritReward: 10,    target: 1,    stat: "totalDMs" },
  { id: "gift_frame",      name: "Generous",           description: "Gift a frame to another player.",        category: "social",      meritReward: 100,   target: 1,    stat: "framesGifted" },
  { id: "gift_5_frames",   name: "Big Spender",        description: "Gift 5 frames to other players.",       category: "social",      meritReward: 500,   target: 5,    stat: "framesGifted" },
  { id: "daily_7",         name: "Consistent",         description: "Claim your daily reward 7 days in a row.",category:"social",      meritReward: 50,    target: 7,    stat: "dailyStreak" },
  { id: "daily_30",        name: "Dedicated",          description: "Claim your daily reward 30 days in a row.",category:"social",     meritReward: 500,   target: 30,   stat: "dailyStreak" },

  // EXPLORATION
  { id: "first_travel",    name: "Wanderer",           description: "Travel to a new district for the first time.",category:"exploration",meritReward:10,  target: 1,    stat: "districtsVisited" },
  { id: "all_districts",   name: "City Map",           description: "Visit all 5 districts.",                 category: "exploration", meritReward: 200,   target: 5,    stat: "districtsVisited" },
  { id: "level_10",        name: "Getting Serious",    description: "Reach level 10.",                        category: "exploration", meritReward: 50,    target: 10,   stat: "level" },
  { id: "level_25",        name: "Mid-Tier",           description: "Reach level 25.",                        category: "exploration", meritReward: 150,   target: 25,   stat: "level" },
  { id: "level_50",        name: "Veteran Runner",     description: "Reach level 50.",                        category: "exploration", meritReward: 500,   target: 50,   stat: "level" },
  { id: "level_75",        name: "New Vanta Elite",    description: "Reach level 75.",                        category: "exploration", meritReward: 2000,  target: 75,   stat: "level" },
  { id: "level_100",       name: "God Tier",           description: "Reach level 100.",                       category: "exploration", meritReward: 10000, target: 100,  stat: "level" },
  { id: "prestige_1",      name: "Reborn",             description: "Reach your first prestige.",             category: "exploration", meritReward: 5000,  target: 1,    stat: "prestige" },
  { id: "all_jobs",        name: "Jack of All Trades", description: "Complete every job type at least once.", category: "exploration", meritReward: 200,   target: 5,    stat: "uniqueJobsCompleted" },

  // COLLECTION
  { id: "frames_5",        name: "Frame Collector",    description: "Own 5 frames.",                          category: "collection",  meritReward: 100,   target: 5,    stat: "ownedFramesCount" },
  { id: "frames_10",       name: "Style Icon",         description: "Own 10 frames.",                         category: "collection",  meritReward: 300,   target: 10,   stat: "ownedFramesCount" },
  { id: "frames_25",       name: "Closet Full",        description: "Own 25 frames.",                         category: "collection",  meritReward: 1000,  target: 25,   stat: "ownedFramesCount" },
  { id: "frames_all_55",   name: "The Completionist",  description: "Own all 55 frames.",                     category: "collection",  meritReward: 10000, target: 55,   stat: "ownedFramesCount" },
  { id: "own_epic",        name: "Going Epic",         description: "Own at least one epic frame.",           category: "collection",  meritReward: 200,   target: 1,    stat: "ownedEpicCount" },
  { id: "own_legendary",   name: "Legendary Status",   description: "Own at least one legendary frame.",      category: "collection",  meritReward: 500,   target: 1,    stat: "ownedLegendaryCount" },
  { id: "own_mythic",      name: "One of a Kind",      description: "Own at least one mythic frame.",         category: "collection",  meritReward: 2000,  target: 1,    stat: "ownedMythicCount" },
  { id: "equip_mythic",    name: "Fully Realized",     description: "Equip a mythic frame.",                  category: "collection",  meritReward: 500,   target: 1,    stat: "mythicEquipped" },
  { id: "all_rarity",      name: "Full Spectrum",      description: "Own at least one frame of every rarity.",category: "collection",  meritReward: 1000,  target: 6,    stat: "raritiesOwned" },
];

export interface IUserAchievement extends Document {
  userId: mongoose.Types.ObjectId;
  achievementId: string;
  progress: number;
  completed: boolean;
  completedAt: Date | null;
  meritGranted: boolean;
}

const UserAchievementSchema = new Schema<IUserAchievement>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    achievementId: { type: String, required: true },
    progress:      { type: Number, default: 0 },
    completed:     { type: Boolean, default: false },
    completedAt:   { type: Date, default: null },
    meritGranted:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
UserAchievementSchema.index({ userId: 1 });

export default mongoose.model<IUserAchievement>("UserAchievement", UserAchievementSchema);
