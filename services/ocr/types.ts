/**
 * Provider-agnostic OCR contract. Concrete adapters (qwenVision.ts, and later
 * Baidu/Tencent/Google Vision) implement this; business code never talks to a
 * specific OCR SDK directly.
 */
export interface OcrInput {
  bytes: Uint8Array;
  /** e.g. "image/png", "image/jpeg". */
  mimeType: string;
}

export interface OcrProvider {
  readonly id: string;
  /** Returns the recognized text, in reading order, as plain text. */
  recognize(input: OcrInput): Promise<{ text: string }>;
}
