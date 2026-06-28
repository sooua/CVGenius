import { z } from "zod";

/**
 * Shape of `resumes.current_version_json`.
 * Treated as the canonical structure everywhere — UI forms, AI prompts,
 * PDF export all read this type.
 */

export const experienceKinds = ["education", "project", "internship"] as const;
export type ExperienceKind = (typeof experienceKinds)[number];

export const experienceKindLabels: Record<ExperienceKind, string> = {
  education: "教育经历",
  project: "项目经历",
  internship: "实习 / 工作",
};

export const experienceSchema = z.object({
  id: z.string(),
  kind: z.enum(experienceKinds),
  title: z.string().max(120).default(""),
  org: z.string().max(120).default(""),
  role: z.string().max(80).default(""),
  startDate: z.string().max(20).default(""),
  endDate: z.string().max(20).default(""),
  location: z.string().max(80).default(""),
  highlights: z.array(z.string().max(500)).default([]),
});
export type Experience = z.infer<typeof experienceSchema>;

export const basicInfoSchema = z.object({
  name: z.string().max(40).default(""),
  headline: z.string().max(80).default(""),
  email: z.string().max(120).default(""),
  phone: z.string().max(40).default(""),
  location: z.string().max(80).default(""),
  portfolioUrl: z.string().max(200).default(""),
  github: z.string().max(200).default(""),
  linkedin: z.string().max(200).default(""),
});
export type BasicInfo = z.infer<typeof basicInfoSchema>;

export const languageSchema = z.object({
  id: z.string(),
  name: z.string().max(40).default(""),
  level: z.string().max(40).default(""),
});
export type Language = z.infer<typeof languageSchema>;

export const skillGroupSchema = z.object({
  id: z.string(),
  category: z.string().max(40).default(""),
  items: z.array(z.string().max(60)).default([]),
});
export type SkillGroup = z.infer<typeof skillGroupSchema>;

export const awardSchema = z.object({
  id: z.string(),
  title: z.string().max(120).default(""),
  date: z.string().max(20).default(""),
  issuer: z.string().max(80).default(""),
});
export type Award = z.infer<typeof awardSchema>;

export const certificationSchema = z.object({
  id: z.string(),
  title: z.string().max(120).default(""),
  date: z.string().max(20).default(""),
  issuer: z.string().max(80).default(""),
});
export type Certification = z.infer<typeof certificationSchema>;

export const resumeContentSchema = z.object({
  basicInfo: basicInfoSchema,
  targetRole: z.string().max(80).default(""),
  summary: z.string().max(600).default(""),
  experiences: z.array(experienceSchema).default([]),
  skills: z.array(skillGroupSchema).default([]),
  awards: z.array(awardSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
  languages: z.array(languageSchema).default([]),
});
export type ResumeContent = z.infer<typeof resumeContentSchema>;

export function emptyBasicInfo(): BasicInfo {
  return {
    name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    portfolioUrl: "",
    github: "",
    linkedin: "",
  };
}

export function emptyResumeContent(): ResumeContent {
  return {
    basicInfo: emptyBasicInfo(),
    targetRole: "",
    summary: "",
    experiences: [],
    skills: [],
    awards: [],
    certifications: [],
    languages: [],
  };
}

export function parseResumeContent(raw: unknown): ResumeContent {
  const result = resumeContentSchema.safeParse(raw);
  return result.success ? result.data : emptyResumeContent();
}
