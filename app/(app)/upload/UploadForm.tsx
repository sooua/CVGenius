"use client";

import { useState, useRef, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { parseResumeText, parseResumeUpload } from "@/app/actions/upload";

type UploadState =
  | { kind: "idle" }
  | { kind: "selected"; file: File }
  | { kind: "running"; file: File; stage: string }
  | { kind: "error"; message: string; file?: File };

const MAX_BYTES = 5 * 1024 * 1024;

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function validate(file: File): string | null {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isDocx = file.type === DOCX_TYPE || name.endsWith(".docx");
  if (name.endsWith(".doc") && !isDocx) {
    return "暂不支持旧版 .doc，请另存为 .docx 或导出 PDF";
  }
  if (!isPdf && !isDocx) {
    return "只支持 PDF 和 Word（.docx）文件";
  }
  if (file.size > MAX_BYTES) {
    return "文件超过 5 MB";
  }
  return null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<"file" | "paste">("file");

  const setFile = (file: File) => {
    const err = validate(file);
    if (err) {
      setState({ kind: "error", message: err, file });
      return;
    }
    setState({ kind: "selected", file });
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const submit = async () => {
    if (state.kind !== "selected" && state.kind !== "error") return;
    const file = state.file;
    if (!file) return;

    setState({ kind: "running", file, stage: "正在读取文件文字…" });
    // AI parse can take 15-30s; fake a stage bump halfway through for feedback
    const stageTimer = setTimeout(() => {
      setState((curr) =>
        curr.kind === "running"
          ? { ...curr, stage: "正在让 AI 抽取结构…" }
          : curr,
      );
    }, 2500);

    const fd = new FormData();
    fd.append("file", file);
    const response = await parseResumeUpload(fd);
    clearTimeout(stageTimer);

    if (response.ok) {
      router.push(`/resume/${response.resumeId}`);
    } else {
      setState({ kind: "error", message: response.error, file });
    }
  };

  const reset = () => {
    setState({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const running = state.kind === "running";

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl bg-warm-sand/60 p-1 text-[13px]">
        {(["file", "paste"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            disabled={running}
            className={
              "rounded-lg px-4 py-1.5 transition disabled:opacity-60 " +
              (mode === m
                ? "bg-white text-near-black ring-1 ring-border-warm"
                : "text-olive-gray hover:text-near-black")
            }
          >
            {m === "file" ? "上传文件" : "粘贴文字"}
          </button>
        ))}
      </div>

      {mode === "paste" ? (
        <PasteImport />
      ) : (
        <>
      <label
        htmlFor="upload-file"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={
          "block rounded-3xl ring-2 ring-dashed px-8 py-12 text-center transition-all duration-200 cursor-pointer " +
          (dragActive
            ? "bg-parchment ring-terracotta"
            : "bg-ivory ring-border-warm hover:ring-terracotta") +
          (running ? " pointer-events-none opacity-75" : "")
        }
      >
        <input
          ref={inputRef}
          id="upload-file"
          type="file"
          accept="application/pdf,.pdf,.docx"
          className="hidden"
          disabled={running}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />

        {state.kind === "idle" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-2xl bg-warm-sand flex items-center justify-center font-serif text-[20px] text-terracotta mb-4">
              ↑
            </div>
            <p className="font-serif text-[17px] text-near-black mb-1.5">
              把 PDF 或 Word 拖到这里，或者点击选择
            </p>
            <p className="text-[12.5px] text-stone-gray">
              最大 5 MB · 支持 PDF、Word（.docx）
            </p>
          </>
        )}

        {(state.kind === "selected" || state.kind === "error") && state.file && (
          <div className="space-y-2">
            <p className="font-serif text-[16px] text-near-black truncate">
              {state.file.name}
            </p>
            <p className="text-[12.5px] text-stone-gray">
              {formatSize(state.file.size)} · {state.kind === "error" ? "有问题" : "已就绪"}
            </p>
            {state.kind === "error" && (
              <p className="text-[13px] text-error mt-2">{state.message}</p>
            )}
          </div>
        )}

        {state.kind === "running" && (
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-terracotta/15 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-terracotta animate-pulse" />
            </div>
            <p className="font-serif text-[16px] text-near-black">
              {state.stage}
            </p>
            <p className="text-[12.5px] text-stone-gray">
              整个过程大约 15-30 秒，别关页面
            </p>
          </div>
        )}
      </label>

      {state.kind === "selected" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-xl bg-terracotta text-ivory py-3 text-[14px] font-medium hover:bg-coral transition"
          >
            开始分析
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-warm-sand text-charcoal-warm px-5 py-3 text-[14px] hover:bg-border-cream transition"
          >
            换一份
          </button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-xl bg-warm-sand text-charcoal-warm py-3 text-[14px] hover:bg-border-cream transition"
          >
            换一份重试
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function PasteImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    const res = await parseResumeText(text);
    if (res.ok) {
      router.push(`/resume/${res.resumeId}`);
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  const count = text.trim().length;

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        disabled={busy}
        placeholder="把简历文字整段贴进来——扫描件可以先用手机扫描 App 转成文字，或从原始文档里复制。AI 会自动抽成结构化简历。"
        className="w-full rounded-2xl bg-ivory ring-1 ring-border-warm px-5 py-4 text-[13.5px] text-near-black placeholder:text-warm-silver leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta transition resize-y"
      />
      {error && <p className="text-[13px] text-error">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-stone-gray">
          {count < 40 ? `还差 ${Math.max(0, 40 - count)} 个字开始` : `${count} 字`}
          {busy ? " · 正在让 AI 抽取结构，约 15-30 秒" : ""}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={busy || count < 40}
          className="rounded-xl bg-terracotta text-ivory px-5 py-2.5 text-[14px] font-medium hover:bg-coral disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy ? "结构化中…" : "结构化"}
        </button>
      </div>
    </div>
  );
}
