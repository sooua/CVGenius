import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { resumes, resumeShareViews } from "@/db/schema/resumes";
import { parseResumeContent } from "@/lib/resume/schema";
import { hashPasscode, isShareLive, shareCookieName } from "@/lib/share";
import { env } from "@/lib/env.server";

export const runtime = "nodejs";

async function verifyPasscode(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!token) redirect("/r/invalid");

  const resume = await db.query.resumes.findFirst({
    where: eq(resumes.shareToken, token),
    columns: { sharePasscode: true, shareEnabled: true, shareExpiresAt: true },
  });

  if (!resume || !isShareLive(resume) || !resume.sharePasscode) {
    redirect(`/r/${token}`);
  }

  if (hashPasscode(code) !== resume.sharePasscode) {
    redirect(`/r/${token}?bad=1`);
  }

  // Cookie value is the stored hash itself — a bearer token only derivable
  // from the right code. The PDF route re-checks it on every request.
  (await cookies()).set(shareCookieName(token), resume.sharePasscode, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: `/r/${token}`,
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(`/r/${token}`);
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ bad?: string }>;
}) {
  const { token } = await params;
  const { bad } = await searchParams;

  const resume = await db.query.resumes.findFirst({
    where: eq(resumes.shareToken, token),
  });

  if (!resume || !isShareLive(resume)) {
    return (
      <Shell>
        <h1 className="font-serif text-[22px] text-near-black mb-2">
          链接已失效
        </h1>
        <p className="text-[14px] text-olive-gray leading-relaxed">
          这个分享链接已关闭或已过期。如果你需要查看，请向分享者重新索取。
        </p>
      </Shell>
    );
  }

  // Passcode gate.
  if (resume.sharePasscode) {
    const cookie = (await cookies()).get(shareCookieName(token))?.value;
    if (cookie !== resume.sharePasscode) {
      return (
        <Shell>
          <p className="overline mb-3">受保护的分享</p>
          <h1 className="font-serif text-[22px] text-near-black mb-2">
            需要访问码
          </h1>
          <p className="text-[14px] text-olive-gray leading-relaxed mb-5">
            分享者给这份简历设置了访问码，请输入后查看。
          </p>
          <form action={verifyPasscode} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <input
              name="code"
              autoFocus
              autoComplete="off"
              placeholder="访问码"
              className="w-full rounded-xl bg-white ring-1 ring-border-warm px-4 py-2.5 text-[15px] text-near-black tracking-widest text-center placeholder:text-warm-silver placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-terracotta transition"
            />
            {bad ? (
              <p className="text-[12.5px] text-error">访问码不正确，再试一次。</p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-terracotta text-ivory px-5 py-2.5 text-[14px] font-medium hover:bg-coral transition"
            >
              查看简历
            </button>
          </form>
        </Shell>
      );
    }
  }

  // Gate cleared — record the view (best-effort; never block rendering).
  try {
    await db.insert(resumeShareViews).values({ resumeId: resume.id });
  } catch {
    /* analytics is non-critical */
  }

  const content = parseResumeContent(resume.currentVersionJson);
  const name = content.basicInfo.name?.trim() || "一份简历";
  const pdfUrl = `/r/${token}/pdf`;

  return (
    <div className="min-h-screen bg-parchment">
      <header className="flex items-center justify-between gap-4 px-5 md:px-8 py-4 border-b border-border-warm bg-parchment/90 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="overline mb-0.5">FirstCV · 分享的简历</p>
          <p className="font-serif text-[16px] text-near-black truncate">
            {name}
          </p>
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-warm-sand text-charcoal-warm px-3.5 py-2 text-[13px] hover:bg-border-cream transition"
        >
          在新标签打开
        </a>
      </header>
      <main className="px-2 md:px-8 py-4 md:py-6">
        <iframe
          src={pdfUrl}
          title={`${name} · 简历 PDF`}
          className="w-full h-[82vh] rounded-xl ring-1 ring-border-warm bg-white"
        />
      </main>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-5">
      <div className="w-full max-w-md rounded-3xl bg-ivory ring-1 ring-border-warm px-8 py-10">
        {children}
      </div>
    </div>
  );
}
