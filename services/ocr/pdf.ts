import "server-only";

import { getDocumentProxy, renderPageAsImage } from "unpdf";
import type { OcrProvider } from "./types";

// Scanned resumes are 1-2 pages; cap work to keep cost/time bounded.
const MAX_OCR_PAGES = 3;

/**
 * Rasterizes a scanned (image-only) PDF page by page and runs each page image
 * through the OCR provider, returning the concatenated text. Used as the
 * fallback when a PDF yields no extractable text.
 */
export async function ocrPdfPages(
  pdfBytes: Uint8Array,
  ocr: OcrProvider,
): Promise<string> {
  const doc = await getDocumentProxy(pdfBytes);
  const pages = Math.min(doc.numPages, MAX_OCR_PAGES);

  const texts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const png = await renderPageAsImage(pdfBytes, i, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 2,
    });
    const { text } = await ocr.recognize({
      bytes: new Uint8Array(png),
      mimeType: "image/png",
    });
    if (text.trim()) texts.push(text.trim());
  }
  return texts.join("\n\n");
}
