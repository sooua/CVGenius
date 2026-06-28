"use server";

import { getDocumentProxy } from "unpdf";
import { verifySession } from "@/lib/auth/dal";
import {
  resumeContentSchema,
  type ResumeContent,
} from "@/lib/resume/schema";
import { normalizeTemplate, type TemplateId } from "@/lib/resume/templates";
import {
  normalizeSectionOrder,
  type SectionKey,
} from "@/lib/resume/sections";
import { renderResumePdf } from "@/services/pdf/render";

/**
 * Renders the given content and returns the page count, so the editor can
 * nudge users toward a one-page resume. Stateless — operates on the passed
 * content, not the saved version, so it reflects unsaved edits.
 */
export async function getResumePageCount(input: {
  content: ResumeContent;
  template?: TemplateId;
  sectionOrder?: SectionKey[];
}): Promise<{ pages: number } | { error: string }> {
  await verifySession();
  const parsed = resumeContentSchema.safeParse(input.content);
  if (!parsed.success) return { error: "内容格式有误" };

  const pdf = await renderResumePdf(
    parsed.data,
    "zh",
    normalizeTemplate(input.template),
    normalizeSectionOrder(input.sectionOrder),
  );
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  return { pages: doc.numPages };
}
