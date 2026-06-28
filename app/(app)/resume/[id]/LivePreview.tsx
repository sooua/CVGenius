"use client";

import { Font, PDFViewer } from "@react-pdf/renderer";
import { ResumeDocument } from "@/services/pdf/template";
import type { ResumeContent } from "@/lib/resume/schema";
import type { TemplateId } from "@/lib/resume/templates";

// Browser preview uses lightweight GB2312-subset fonts (~3MB total) so the
// client render stays fast. Rare glyphs outside the subset may not show in the
// preview — export uses the full server fonts, so the PDF is unaffected.
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "NotoSansSC",
    fonts: [
      {
        src: "/fonts/preview/NotoSansSC-Regular.subset.woff",
        fontWeight: 400,
      },
      {
        src: "/fonts/preview/NotoSansSC-Regular.subset.woff",
        fontWeight: 500,
      },
    ],
  });
  Font.register({
    family: "NotoSerifSC",
    src: "/fonts/preview/NotoSerifSC-Regular.subset.woff",
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

// Default export so it can be next/dynamic'd with ssr:false from the editor.
export default function LivePreview({
  content,
  template,
}: {
  content: ResumeContent;
  template: TemplateId;
}) {
  ensureFonts();
  return (
    <PDFViewer
      showToolbar={false}
      style={{
        width: "100%",
        height: "72vh",
        border: "none",
        borderRadius: 12,
        backgroundColor: "#ffffff",
      }}
    >
      <ResumeDocument content={content} template={template} />
    </PDFViewer>
  );
}
