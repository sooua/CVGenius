import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumeDocument, type PdfLocale } from "./template";
import type { ResumeContent } from "@/lib/resume/schema";
import type { TemplateId } from "@/lib/resume/templates";

export async function renderResumePdf(
  content: ResumeContent,
  locale: PdfLocale = "zh",
  template?: TemplateId,
): Promise<Buffer> {
  return renderToBuffer(
    <ResumeDocument content={content} locale={locale} template={template} />,
  );
}
