import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * A resume is the canonical record for one person's CV draft.
 * Its content lives in current_version_json for fast reads; history
 * lives in resume_versions.
 */
export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  sourceType: varchar("source_type", { length: 20 })
    .notNull()
    .default("create"), // create | upload
  originalFileUrl: text("original_file_url"),
  rawText: text("raw_text"),

  parsedJson: jsonb("parsed_json"),
  currentVersionJson: jsonb("current_version_json"),

  status: varchar("status", { length: 20 }).notNull().default("draft"),

  // PDF template choice (presentation only). See lib/resume/templates.ts.
  template: varchar("template", { length: 20 }).notNull().default("classic"),
  // Section order (presentation only). null = default order. See sections.ts.
  sectionOrder: jsonb("section_order"),

  shareToken: text("share_token").unique(),
  shareEnabled: boolean("share_enabled").notNull().default(false),
  // null = never expires. When set, the public link 404s past this time.
  shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
  // null = no passcode. Stores a sha256 hex of the code, never plaintext.
  sharePasscode: varchar("share_passcode", { length: 64 }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const resumeVersions = pgTable("resume_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id")
    .notNull()
    .references(() => resumes.id, { onDelete: "cascade" }),
  contentJson: jsonb("content_json").notNull(),
  label: varchar("label", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
export type ResumeVersion = typeof resumeVersions.$inferSelect;
