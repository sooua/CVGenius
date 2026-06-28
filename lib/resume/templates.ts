/**
 * Resume PDF template registry. Kept free of server-only deps (no react-pdf,
 * no node:*) so the client editor, server actions, and the PDF renderer can
 * all import it. `template` is presentation metadata stored on the resume row
 * — deliberately NOT part of ResumeContent, so it never leaks into AI schemas.
 */
export const RESUME_TEMPLATES = [
  { id: "classic", name: "经典", desc: "衬线标题 · 暖橙强调" },
  { id: "minimal", name: "极简", desc: "黑白克制 · ATS 友好" },
  { id: "modern", name: "现代", desc: "色块标题 · 沉稳蓝灰" },
  { id: "twocol", name: "双栏", desc: "左栏信息 · 右栏经历" },
] as const;

export type TemplateId = (typeof RESUME_TEMPLATES)[number]["id"];

export const TEMPLATE_IDS = RESUME_TEMPLATES.map((t) => t.id) as TemplateId[];

export const DEFAULT_TEMPLATE: TemplateId = "classic";

export function normalizeTemplate(value: unknown): TemplateId {
  return typeof value === "string" && TEMPLATE_IDS.includes(value as TemplateId)
    ? (value as TemplateId)
    : DEFAULT_TEMPLATE;
}
