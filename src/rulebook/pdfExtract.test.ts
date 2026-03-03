import { Buffer } from "node:buffer";
import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import { normalizeRulebookText } from "./normalize.js";
import { extractTextFromPdfBuffer } from "./pdfExtract.js";

describe("extractTextFromPdfBuffer", () => {
  it("extracts key phrases from generated PDF text", async () => {
    const pdfBuffer = await buildPdfBuffer([
      "Tic Tac Toe Rulebook",
      "Two players alternate placing marks on a 3x3 board.",
      "First line of three wins."
    ]);

    const extracted = await extractTextFromPdfBuffer(pdfBuffer);
    const lowered = extracted.text.toLowerCase();
    expect(extracted.meta.error).toBeUndefined();
    expect(extracted.meta.pages).toBeGreaterThan(0);
    expect(lowered).toContain("tic tac toe");
    expect(lowered).toContain("first line of three wins");
  });

  it("normalizes extracted output deterministically", async () => {
    const pdfBuffer = await buildPdfBuffer(["Line 1", "Line   2", "Line\t3"]);
    const first = await extractTextFromPdfBuffer(pdfBuffer);
    const second = await extractTextFromPdfBuffer(pdfBuffer);

    expect(first.text).toBe(second.text);
    expect(first.text).toBe(normalizeRulebookText(first.text));
    expect(first.text.includes("\r")).toBe(false);
  });

  it("returns empty text with error metadata on invalid PDF bytes", async () => {
    const invalid = Buffer.from("not-a-pdf", "utf8");
    const extracted = await extractTextFromPdfBuffer(invalid);

    expect(extracted.text).toBe("");
    expect(typeof extracted.meta.error).toBe("string");
    expect(extracted.meta.error && extracted.meta.error.length > 0).toBe(true);
  });
});

async function buildPdfBuffer(lines: string[]): Promise<Buffer> {
  return await new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      info: {
        Title: "rulebook-fixture",
        CreationDate: new Date("2024-01-01T00:00:00Z"),
        ModDate: new Date("2024-01-01T00:00:00Z")
      }
    });
    doc.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    doc.on("error", (error: Error) => {
      rejectPromise(error);
    });
    doc.on("end", () => {
      resolvePromise(Buffer.concat(chunks));
    });
    for (const line of lines) {
      doc.text(line);
    }
    doc.end();
  });
}
