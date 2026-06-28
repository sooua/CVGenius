import { z } from "zod";

/**
 * Structured output schemas. We always force the model to return JSON
 * that matches one of these shapes so business code stays typed.
 */

export const rewriteBlockSchema = z.object({
  original: z.string(),
  rewritten: z.string(),
  reasons: z.array(z.string()).min(1).max(5),
  preservedFacts: z.array(z.string()).default([]),
});
export type RewriteBlock = z.infer<typeof rewriteBlockSchema>;

export const expandResultSchema = z.object({
  highlights: z.array(z.string()).min(1).max(5),
});
export type ExpandResult = z.infer<typeof expandResultSchema>;

export const interviewQuestionSchema = z.object({
  category: z.enum(["behavioral", "technical", "project", "fit"]),
  question: z.string(),
  /** What the interviewer is probing for. */
  probe: z.string(),
  /** How to approach it — which of the candidate's experiences to draw on. */
  tip: z.string(),
});
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;

export const interviewPrepResultSchema = z.object({
  questions: z.array(interviewQuestionSchema).min(3).max(12),
});
export type InterviewPrepResult = z.infer<typeof interviewPrepResultSchema>;

export const checkupIssueSchema = z.object({
  severity: z.enum(["critical", "moderate", "suggestion"]),
  dimension: z.enum([
    "structure",
    "job_match",
    "professional_tone",
    "outcome",
    "conciseness",
  ]),
  title: z.string(),
  detail: z.string(),
  section: z.string().optional(),
  suggestedRewrite: z.string().optional(),
});
export type CheckupIssue = z.infer<typeof checkupIssueSchema>;

export const checkupResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  dimensionScores: z.object({
    structure: z.number().min(0).max(100),
    jobMatch: z.number().min(0).max(100),
    professionalTone: z.number().min(0).max(100),
    outcome: z.number().min(0).max(100),
    conciseness: z.number().min(0).max(100),
  }),
  summary: z.string(),
  issues: z.array(checkupIssueSchema).max(10),
});
export type CheckupResult = z.infer<typeof checkupResultSchema>;

export const matchSuggestionSchema = z.object({
  title: z.string(),
  detail: z.string(),
  /** If the AI thinks the resume should add a specific bullet to bridge a gap. */
  suggestedHighlight: z.string().optional(),
});
export type MatchSuggestion = z.infer<typeof matchSuggestionSchema>;

export const matchResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  dimensionScores: z.object({
    skills: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
    tone: z.number().min(0).max(100),
  }),
  matchedKeywords: z.array(z.string()).max(30),
  missingKeywords: z.array(z.string()).max(30),
  summary: z.string(),
  suggestions: z.array(matchSuggestionSchema).max(8),
});
export type MatchResult = z.infer<typeof matchResultSchema>;
