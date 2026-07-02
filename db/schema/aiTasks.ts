import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { resumes } from "./resumes";
import { users } from "./users";

/**
 * Every AI call is recorded as a task row for retry, debugging, and
 * cost attribution. status transitions: pending → running → success|failed.
 */
export const aiTasks = pgTable("ai_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  resumeId: uuid("resume_id").references(() => resumes.id, {
    onDelete: "set null",
  }),

  taskType: varchar("task_type", { length: 30 }).notNull(),
  // generate | rewrite_block | checkup | parse_upload

  provider: varchar("provider", { length: 20 }).notNull().default("deepseek"),
  model: varchar("model", { length: 60 }).notNull(),

  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json"),

  status: varchar("status", { length: 20 }).notNull().default("pending"),
  errorMessage: text("error_message"),

  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  costCnyMilli: integer("cost_cny_milli"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AiTask = typeof aiTasks.$inferSelect;
export type NewAiTask = typeof aiTasks.$inferInsert;
