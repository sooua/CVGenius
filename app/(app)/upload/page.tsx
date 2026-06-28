import Link from "next/link";
import type { Metadata } from "next";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = {
  title: "上传简历",
};

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] text-olive-gray hover:text-near-black transition mb-6"
      >
        <span>←</span>
        <span>返回 Dashboard</span>
      </Link>

      <p className="overline mb-5">从现有简历开始</p>
      <h1 className="font-serif text-[34px] leading-tight text-near-black mb-3">
        把你手里那份交给 AI，几秒钟把它结构化
      </h1>
      <p className="text-[15px] text-olive-gray leading-relaxed max-w-xl mb-10">
        上传一份 PDF 或 Word——AI 会把里面的教育、项目、实习、技能、奖项全部抽取出来，
        填进编辑器里。之后你可以直接改写、体检、导出。
      </p>

      <UploadForm />

      <div className="mt-10 rounded-2xl bg-warm-sand/50 ring-1 ring-border-warm px-6 py-5">
        <p className="font-serif text-[15px] text-near-black mb-1.5">支持说明</p>
        <ul className="text-[13px] text-olive-gray leading-relaxed space-y-1">
          <li>· 支持 PDF 和 Word（.docx），不超过 5 MB</li>
          <li>· 文字版 PDF（可复制的那种）能准确抽取</li>
          <li>· 扫描件 / 图片版抽不出文字——切到「粘贴文字」，把简历内容贴进来即可</li>
          <li>· 旧版 .doc 请先另存为 .docx 或导出 PDF</li>
          <li>· 中英文都行；内容越接近简历格式，抽取越准</li>
          <li>· 我们不保留原文件，只保存结构化文字</li>
        </ul>
      </div>
    </div>
  );
}
