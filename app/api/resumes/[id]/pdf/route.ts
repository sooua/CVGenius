import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { resumes } from "@/db/schema/resumes";
import { verifySession } from "@/lib/auth/dal";
import { parseResumeContent } from "@/lib/resume/schema";
import { normalizeTemplate } from "@/lib/resume/templates";
import { renderResumePdf } from "@/services/pdf/render";
import { getOrGenerateEnglishVersion } from "@/app/actions/ai";

// Rendering fonts + PDF uses Node APIs (fs) — must run on Node runtime, not edge.
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId } = await verifySession();

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.userId, userId)),
  });
  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";
  // ?template= lets the editor preview a template before it's saved; falls
  // back to the resume's stored choice.
  const templateParam = url.searchParams.get("template");
  const template = normalizeTemplate(templateParam ?? resume.template);

  let content = parseResumeContent(resume.currentVersionJson);

  if (lang === "en") {
    const translation = await getOrGenerateEnglishVersion({
      resumeId: id,
      userId,
    });
    if (!translation.ok) {
      return NextResponse.json(
        { error: translation.error },
        { status: translation.requiresUpgrade ? 402 : 500 },
      );
    }
    content = translation.content;
  }

  const pdf = await renderResumePdf(content, lang, template);
  const { ascii, unicode } = buildFilename(content.basicInfo.name, lang);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(unicode)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

function buildFilename(
  name: string,
  lang: "zh" | "en",
): { ascii: string; unicode: string } {
  const stem = name.trim() || (lang === "en" ? "resume" : "resume");
  const suffix = lang === "en" ? "-FirstCV-en.pdf" : "-FirstCV.pdf";
  const unicode = `${stem}${suffix}`;
  const ascii = /[^\x20-\x7e]/.test(stem)
    ? `resume${suffix}`
    : unicode;
  return { ascii, unicode };
}
