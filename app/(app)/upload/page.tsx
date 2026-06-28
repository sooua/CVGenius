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
        上传 PDF、Word，或直接拍张简历照片——AI 会把里面的教育、项目、实习、技能、奖项
        全部抽取出来，填进编辑器里。之后你可以直接改写、体检、导出。
      </p>

      <UploadForm />

      <div className="mt-10 rounded-2xl bg-warm-sand/50 ring-1 ring-border-warm px-6 py-5">
        <p className="font-serif text-[15px] text-near-black mb-1.5">支持说明</p>
        <ul className="text-[13px] text-olive-gray leading-relaxed space-y-1">
          <li>· 支持 PDF、Word（.docx）和图片（png/jpg），不超过 5 MB</li>
          <li>· 文字版 PDF / Word 直接抽取；简历照片或截图走 AI 识别（OCR）</li>
          <li>· 扫描成 PDF 的简历抽不出文字——截图上传，或切到「粘贴文字」</li>
          <li>· 旧版 .doc 请先另存为 .docx 或导出 PDF</li>
          <li>· 中英文都行；内容越接近简历格式，抽取越准</li>
          <li>· 我们不保留原文件，只保存结构化文字</li>
        </ul>
      </div>
    </div>
  );
}
