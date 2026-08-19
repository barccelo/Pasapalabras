import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  words: text("words").notNull(),
  mode: text("mode").notNull(),
  duration: integer("duration").notNull(),
  timerMode: text("timer_mode").notNull().default("countdown"),
  teamA: text("team_a").notNull(),
  teamB: text("team_b").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const liveSessions = sqliteTable("live_sessions", {
  id: text("id").primaryKey(),
  gameTitle: text("game_title").notNull(),
  state: text("state").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
