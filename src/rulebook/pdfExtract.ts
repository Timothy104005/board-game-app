import { PDFParse } from "pdf-parse";
import { normalizeRulebookText } from "./normalize.js";

export interface PdfExtractMeta {
  pages?: number;
  error?: string;
}

export interface PdfExtractResult {
  text: string;
  meta: PdfExtractMeta;
}

export async function extractTextFromPdfBuffer(pdf: Buffer): Promise<PdfExtractResult> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: new Uint8Array(pdf) });
    const parsed = await parser.getText();
    return {
      text: normalizeExtractedText(parsed.text),
      meta: {
        pages: parsed.pages.length
      }
    };
  } catch (error) {
    return {
      text: "",
      meta: {
        error: error instanceof Error ? error.message : String(error)
      }
    };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // parser cleanup errors are intentionally ignored to keep extraction non-throwing.
      }
    }
  }
}

function normalizeExtractedText(raw: string): string {
  const cleaned = raw
    .replace(/\u000c/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]+/g, " ");
  return normalizeRulebookText(cleaned);
}
