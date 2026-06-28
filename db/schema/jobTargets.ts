import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { resumes } from "./resumes";

/**
 * A job the user is targeting / has applied to — a lightweight application
 * tracker. Optionally linked to the resume version used.
 */
export const jobTargets = pgTable("job_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  resumeId: uuid("resume_id").references(() => resumes.id, {
    onDelete: "set null",
  }),

  company: varchar("company", { length: 120 }),
  role: varchar("role", { length: 120 }),
  jobUrl: text("job_url"),
  // saved | applied | interviewing | offer | rejected
  status: varchar("status", { length: 20 }).notNull().default("saved"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),

  category: varchar("category", { length: 50 }),
  subCategory: varchar("sub_category", { length: 80 }),
  keywords: jsonb("keywords"),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type JobTarget = typeof jobTargets.$inferSelect;
export type NewJobTarget = typeof jobTargets.$inferInsert;
