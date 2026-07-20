import mongoose, { Document, Schema } from "mongoose";

// ── Template definition ────────────────────────────────────────────────────────
export interface IQuestTemplate extends Document {
  title: string;
  description: string;
  action: string;         // the hook action key e.g. "crime_success"
  targetCount: number;
  reward: { dc: number; nc: number; seasonXp: number; eventPoints?: number };
  difficulty: "easy" | "medium" | "hard";
  type: "daily" | "weekly" | "both";
  isActive: boolean;
}

const QuestTemplateSchema = new Schema<IQuestTemplate>(
  {
    title:       { type: String, required: true },
    description: { type: String, required: true },
    action:      { type: String, required: true, index: true },
    targetCount: { type: Number, required: true },
    reward: {
      dc:          { type: Number, default: 0 },
      nc:          { type: Number, default: 0 },
      seasonXp:    { type: Number, default: 0 },
      eventPoints: { type: Number, default: 0 },
    },
    difficulty:  { type: String, enum: ["easy", "medium", "hard"], default: "easy" },
    type:        { type: String, enum: ["daily", "weekly", "both"], default: "daily" },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const QuestTemplate = mongoose.model<IQuestTemplate>("QuestTemplate", QuestTemplateSchema);

// ── 20 seed templates ──────────────────────────────────────────────────────────
// Called once at server start if collection is empty.
export async function seedQuestTemplates(): Promise<void> {
  const count = await QuestTemplate.countDocuments();
  if (count > 0) return;

  const templates: Omit<IQuestTemplate, keyof Document>[] = [
    // ── Daily — Easy ──────────────────────────────────────────────────────────
    { title: "Street Hustler",      description: "Commit 2 successful crimes.",          action: "crime_success",  targetCount: 2,  reward: { dc: 3000,   nc: 0, seasonXp: 80  }, difficulty: "easy",   type: "daily",  isActive: true },
    { title: "Bare Knuckles",       description: "Fight 2 arena matches.",               action: "arena_fight",    targetCount: 2,  reward: { dc: 2500,   nc: 0, seasonXp: 60  }, difficulty: "easy",   type: "daily",  isActive: true },
    { title: "City Sprinter",       description: "Finish 2 races.",                      action: "race_finish",    targetCount: 2,  reward: { dc: 2500,   nc: 0, seasonXp: 60  }, difficulty: "easy",   type: "daily",  isActive: true },
    { title: "Iron Fist",           description: "Win an arena match.",                  action: "arena_win",      targetCount: 1,  reward: { dc: 3500,   nc: 0, seasonXp: 100 }, difficulty: "easy",   type: "daily",  isActive: true },
    { title: "Start Your Engines",  description: "Win 1 race.",                          action: "race_1st",       targetCount: 1,  reward: { dc: 4000,   nc: 0, seasonXp: 120 }, difficulty: "easy",   type: "daily",  isActive: true },
    { title: "Grind the Shift",     description: "Complete a job shift.",                action: "job_shift",      targetCount: 1,  reward: { dc: 2000,   nc: 0, seasonXp: 50  }, difficulty: "easy",   type: "daily",  isActive: true },
    { title: "Pump Iron",           description: "Complete 2 gym training sessions.",    action: "gym_train",      targetCount: 2,  reward: { dc: 1500,   nc: 0, seasonXp: 50  }, difficulty: "easy",   type: "daily",  isActive: true },
    // ── Daily — Medium ────────────────────────────────────────────────────────
    { title: "Crime Spree",         description: "Commit 5 successful crimes.",          action: "crime_success",  targetCount: 5,  reward: { dc: 8000,   nc: 0, seasonXp: 200 }, difficulty: "medium", type: "daily",  isActive: true },
    { title: "Combat Champion",     description: "Win 3 arena matches.",                 action: "arena_win",      targetCount: 3,  reward: { dc: 10000,  nc: 0, seasonXp: 250 }, difficulty: "medium", type: "daily",  isActive: true },
    { title: "Speed Demon",         description: "Win 2 races.",                         action: "race_1st",       targetCount: 2,  reward: { dc: 10000,  nc: 0, seasonXp: 250 }, difficulty: "medium", type: "daily",  isActive: true },
    { title: "Boss Hunter",         description: "Strike the city boss 5 times.",        action: "boss_strike",    targetCount: 5,  reward: { dc: 7500,   nc: 0, seasonXp: 200 }, difficulty: "medium", type: "daily",  isActive: true },
    { title: "Loot Drop",           description: "Collect 3 event items.",               action: "event_collect",  targetCount: 3,  reward: { dc: 6000,   nc: 0, seasonXp: 180 }, difficulty: "medium", type: "daily",  isActive: true },
    // ── Weekly — Easy ─────────────────────────────────────────────────────────
    { title: "Persistent Criminal", description: "Commit 20 successful crimes.",         action: "crime_success",  targetCount: 20, reward: { dc: 35000,  nc: 2, seasonXp: 700 }, difficulty: "easy",   type: "weekly", isActive: true },
    { title: "Arena Regular",       description: "Fight 15 arena matches.",              action: "arena_fight",    targetCount: 15, reward: { dc: 30000,  nc: 2, seasonXp: 600 }, difficulty: "easy",   type: "weekly", isActive: true },
    { title: "Race Circuit",        description: "Finish 10 races.",                     action: "race_finish",    targetCount: 10, reward: { dc: 30000,  nc: 2, seasonXp: 600 }, difficulty: "easy",   type: "weekly", isActive: true },
    { title: "Gym Rat",             description: "Complete 14 gym sessions this week.",  action: "gym_train",      targetCount: 14, reward: { dc: 20000,  nc: 1, seasonXp: 400 }, difficulty: "easy",   type: "weekly", isActive: true },
    // ── Weekly — Medium/Hard ──────────────────────────────────────────────────
    { title: "Arena Dominator",     description: "Win 10 arena matches this week.",      action: "arena_win",      targetCount: 10, reward: { dc: 60000,  nc: 5, seasonXp: 1500 }, difficulty: "hard",   type: "weekly", isActive: true },
    { title: "Speed King",          description: "Win 7 races this week.",               action: "race_1st",       targetCount: 7,  reward: { dc: 60000,  nc: 5, seasonXp: 1500 }, difficulty: "hard",   type: "weekly", isActive: true },
    { title: "Raid Striker",        description: "Strike the boss 25 times this week.",  action: "boss_strike",    targetCount: 25, reward: { dc: 45000,  nc: 4, seasonXp: 1200 }, difficulty: "medium", type: "weekly", isActive: true },
    { title: "Season Warrior",      description: "Complete 5 daily quests this week.",   action: "daily_quest",    targetCount: 5,  reward: { dc: 25000,  nc: 3, seasonXp: 800  }, difficulty: "medium", type: "weekly", isActive: true },
  ];

  await QuestTemplate.insertMany(templates);
}
