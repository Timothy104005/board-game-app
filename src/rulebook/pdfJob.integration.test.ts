import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import { getRun, createProject, enqueue } from "../jobs/queue.js";
import type { RunManifest } from "../jobs/types.js";
import { runWorkerDaemon } from "../jobs/worker.js";
import { getJobsRoot, getRepoRoot, resolveArtifactsPath } from "../paths.js";
import { getUploadExtractedTextPath, getUploadPdfPath } from "./pdfArtifacts.js";

describe("rulebook_run_pdf integration", () => {
  it("processes PDF upload and writes IR/gaps/patch/replay artifacts", async () => {
    const jobsRoot = getJobsRoot();
    cleanup(jobsRoot);

    const project = createProject({
      name: "pdf-job-integration",
      rulebookText: "placeholder",
      seedDefault: "42"
    });
    const projectArtifactsRoot = resolveArtifactsPath("projects", project.id);
    const uploadId = "u1234567890ab";
    const uploadPdfPath = getUploadPdfPath(project.id, uploadId);
    mkdirSync(dirname(uploadPdfPath), { recursive: true });
    const tictactoeFixturePath = resolve(getRepoRoot(), "src", "rulebook", "examples", "tictactoe.rulebook.txt");
    const tictactoeFixtureLines = readFileSync(tictactoeFixturePath, "utf8").split(/\r?\n/);
    writeFileSync(
      uploadPdfPath,
      await buildPdfBuffer(tictactoeFixtureLines)
    );

    try {
      const runId = enqueue("rulebook_run_pdf", project.id, {
        uploadId,
        seed: "42",
        games: 12,
        maxTurns: 20
      });
      await runWorkerDaemon({
        once: true,
        pollIntervalMs: 50,
        maxParallelPoolSize: 1
      });

      const run = getRun(runId);
      expect(run?.status).toBe("succeeded");
      expect(run?.runDir).toBe(resolveArtifactsPath("projects", project.id, "runs", runId));
      expect(run?.manifestPath).toBeDefined();
      const manifestAbsPath = resolve(getRepoRoot(), run?.manifestPath ?? "");
      expect(existsSync(manifestAbsPath)).toBe(true);

      const manifest = JSON.parse(readFileSync(manifestAbsPath, "utf8")) as RunManifest;
      expect(manifest.status).toBe("succeeded");
      expect(manifest.sourceType).toBe("pdf");
      expect(manifest.uploadId).toBe(uploadId);
      expect(typeof manifest.pdfSha256).toBe("string");
      expect(manifest.pdfSha256 && manifest.pdfSha256.length).toBe(64);

      expect(manifest.artifacts.ir).toBeDefined();
      expect(manifest.artifacts.gaps).toBeDefined();
      expect(manifest.artifacts.patchTemplate).toBeDefined();
      expect(manifest.artifacts.extractedText).toBeDefined();
      expect(manifest.artifacts.sampleReplay).toBeDefined();
      for (const artifactPath of Object.values(manifest.artifacts)) {
        expect(existsSync(resolve(getRepoRoot(), artifactPath))).toBe(true);
      }

      const extractedUploadPath = getUploadExtractedTextPath(project.id, uploadId);
      expect(existsSync(extractedUploadPath)).toBe(true);
      const extractedText = readFileSync(extractedUploadPath, "utf8");
      expect(extractedText.toLowerCase()).toContain("tic tac toe");
    } finally {
      cleanup(projectArtifactsRoot);
      cleanup(jobsRoot);
    }
  });
});

async function buildPdfBuffer(lines: string[]): Promise<Buffer> {
  return await new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      info: {
        Title: "rulebook-job-fixture",
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

function cleanup(pathValue: string): void {
  if (existsSync(pathValue)) {
    rmSync(pathValue, { recursive: true, force: true });
  }
}
