import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import PDFDocument from "pdfkit";

export async function createPdfFixture(lines: string[]): Promise<{ filePath: string; cleanup: () => void }> {
  const dirPath = mkdtempSync(join(tmpdir(), "rulebook-pdf-fixture-"));
  const filePath = join(dirPath, "rulebook.pdf");
  writeFileSync(filePath, await buildPdfBuffer(lines));
  return {
    filePath,
    cleanup: () => {
      rmSync(dirPath, { recursive: true, force: true });
    }
  };
}

async function buildPdfBuffer(lines: string[]): Promise<Buffer> {
  return await new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      info: {
        Title: "playwright-pdf-fixture",
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
