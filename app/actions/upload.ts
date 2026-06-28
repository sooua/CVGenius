"use server";

import { eq } from "drizzle-orm";
import { extractText } from "unpdf";
import mammoth from "mammoth";
import { aiTasks } from "@/db/schema/aiTasks";
import { resumes } from "@/db/schema/resumes";
import { db } from "@/db/client";
import { verifySession } from "@/lib/auth/dal";
import {
  checkQuota,
  getMonthlyAiUsage,
  getUserPlan,
  reserveAiTask,
} from "@/lib/ai/quota";
import { parseResumeFromText } from "@/services/ai/parse";
import { estimateCostCents } from "@/lib/ai/cost";
import { resolveOcrProvider } from "@/services/ocr";
import { ocrPdfPages } from "@/services/ocr/pdf";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type FileKind = "pdf" | "docx" | "doc" | "image" | "unknown";

function detectKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX_TYPE || name.endsWith(".docx")) return "docx";
  if (name.endsWith(".doc")) return "doc"; // legacy binary format
  if (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp)$/.test(name)
  ) {
    return "image";
  }
  return "unknown";
}

export type UploadResponse =
  | { ok: true; resumeId: string }
  | { ok: false; error: string };

export async function parseResumeUpload(
  formData: FormData,
): Promise<UploadResponse> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "请选择一个文件" };
  }

  const kind = detectKind(file);
  if (kind === "doc") {
    return {
      ok: false,
      error: "暂不支持旧版 .doc，请在 Word 里另存为 .docx，或导出 PDF 后再上传",
    };
  }
  if (kind === "unknown") {
    return { ok: false, error: "只支持 PDF、Word（.docx）和图片（png/jpg）" };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "文件大于 5 MB，暂不支持" };
  }

  const { userId } = await verifySession();

  const [usage, plan] = await Promise.all([
    getMonthlyAiUsage(userId),
    getUserPlan(userId),
  ]);
  const quota = checkQuota(usage, "upload", plan);
  if (!quota.ok) {
    return { ok: false, error: quota.error };
  }

  // 1. File → raw text (PDF via unpdf, Word via mammoth, image via cloud OCR)
  const buffer = new Uint8Array(await file.arrayBuffer());
  let rawText: string;
  try {
    if (kind === "pdf") {
      const { text } = await extractText(buffer, { mergePages: true });
      rawText = text.trim();
    } else if (kind === "docx") {
      const { value } = await mammoth.extractRawText({
        buffer: Buffer.from(buffer),
      });
      rawText = value.trim();
    } else {
      // image — cloud OCR
      const ocr = resolveOcrProvider();
      if (!ocr) {
        return {
          ok: false,
          error:
            "图片识别暂未开启，请切到「粘贴文字」，把简历内容贴进来。",
        };
      }
      const { text } = await ocr.recognize({
        bytes: buffer,
        mimeType: file.type || "image/jpeg",
      });
      rawText = text.trim();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "文件解析失败";
    const label =
      kind === "pdf" ? "PDF" : kind === "docx" ? "Word" : "图片";
    return { ok: false, error: `${label} 读取失败：${message}` };
  }

  // Scanned (image-only) PDF: no extractable text — fall back to rasterize+OCR.
  if (!rawText && kind === "pdf") {
    const ocr = resolveOcrProvider();
    if (ocr) {
      try {
        rawText = (await ocrPdfPages(buffer, ocr)).trim();
      } catch {
        // leave rawText empty -> guidance message below
      }
    }
  }

  if (!rawText) {
    return {
      ok: false,
      error:
        kind === "pdf"
          ? "PDF 里没有抽出文字——可能是扫描件或图片版。请截图后上传，或切到「粘贴文字」。"
          : kind === "docx"
            ? "Word 文档里没有抽到文字，请确认内容不是空的或纯图片，或改用「粘贴文字」。"
            : "图片里没识别到文字，请确认是清晰的简历截图/照片，或改用「粘贴文字」。",
    };
  }

  // 2. AI parse + persist (shared with the paste-text path below).
  return createResumeFromText({
    userId,
    plan,
    rawText,
    sourceType: "upload",
    inputJson: { fileName: file.name, fileSize: file.size },
  });
}

const MAX_TEXT_CHARS = 20000;

/**
 * Paste-text import — the practical answer to scanned/image resumes: the user
 * pastes the text (from their source doc or their own phone OCR) and it runs
 * through the same AI structuring pipeline as an upload.
 */
export async function parseResumeText(text: string): Promise<UploadResponse> {
  const raw = text.trim();
  if (raw.length < 40) {
    return { ok: false, error: "内容太短，请贴上完整的简历文字（至少 40 字）" };
  }

  const { userId } = await verifySession();
  const [usage, plan] = await Promise.all([
    getMonthlyAiUsage(userId),
    getUserPlan(userId),
  ]);
  const quota = checkQuota(usage, "upload", plan);
  if (!quota.ok) {
    return { ok: false, error: quota.error };
  }

  return createResumeFromText({
    userId,
    plan,
    rawText: raw.slice(0, MAX_TEXT_CHARS),
    sourceType: "create",
    inputJson: { source: "paste", length: raw.length },
  });
}

/** Reserves quota, runs the AI parse, and persists a resume from raw text. */
async function createResumeFromText(opts: {
  userId: string;
  plan: string;
  rawText: string;
  sourceType: "upload" | "create";
  inputJson: unknown;
}): Promise<UploadResponse> {
  // Reserve quota + create the ai_tasks row atomically so two concurrent
  // imports can't both slip past the limit.
  const reserved = await reserveAiTask({
    userId: opts.userId,
    kind: "upload",
    plan: opts.plan,
    inputJson: opts.inputJson,
  });
  if (!reserved.ok) {
    return { ok: false, error: reserved.error };
  }
  const task = { id: reserved.taskId };

  let parsedContent;
  try {
    const run = await parseResumeFromText(opts.rawText);
    parsedContent = run.content;

    await db
      .update(aiTasks)
      .set({
        status: "success",
        model: run.modelId,
        outputJson: run.content,
        tokensInput: run.tokensInput,
        tokensOutput: run.tokensOutput,
        costCny: estimateCostCents(
          run.modelId,
          run.tokensInput,
          run.tokensOutput,
        ),
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 解析失败";
    await db
      .update(aiTasks)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));
    return { ok: false, error: `AI 解析失败：${message}` };
  }

  const [created] = await db
    .insert(resumes)
    .values({
      userId: opts.userId,
      sourceType: opts.sourceType,
      rawText: opts.rawText,
      parsedJson: parsedContent,
      currentVersionJson: parsedContent,
    })
    .returning({ id: resumes.id });

  // Link the ai_tasks row to the new resume now that it exists.
  await db
    .update(aiTasks)
    .set({ resumeId: created.id })
    .where(eq(aiTasks.id, task.id));

  return { ok: true, resumeId: created.id };
}
