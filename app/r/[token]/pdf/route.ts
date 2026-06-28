import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { resumes } from "@/db/schema/resumes";
import { parseResumeContent } from "@/lib/resume/schema";
import { normalizeTemplate } from "@/lib/resume/templates";
import { isShareLive, shareCookieName } from "@/lib/share";
import { renderResumePdf } from "@/services/pdf/render";

// Public share PDF — no auth. Node runtime for fs font loading.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const resume = await db.query.resumes.findFirst({
    where: eq(resumes.shareToken, token),
  });
  if (!resume || !isShareLive(resume)) {
    return NextResponse.json(
      { error: "分享链接已失效或不存在" },
      { status: 404 },
    );
  }

  // Passcode gate: the viewer page sets a cookie holding the stored hash once
  // the visitor enters the right code. Re-check it here so the raw PDF URL
  // can't be hit directly without clearing the gate.
  if (resume.sharePasscode) {
    const cookie = (await cookies()).get(shareCookieName(token))?.value;
    if (cookie !== resume.sharePasscode) {
      return NextResponse.json({ error: "需要访问码" }, { status: 401 });
    }
  }

  const content = parseResumeContent(resume.currentVersionJson);
  const pdf = await renderResumePdf(
    content,
    "zh",
    normalizeTemplate(resume.template),
  );

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      // Private when gated; brief shared cache for open links.
      "Cache-Control": resume.sharePasscode
        ? "private, no-store"
        : "public, max-age=60",
    },
  });
}
