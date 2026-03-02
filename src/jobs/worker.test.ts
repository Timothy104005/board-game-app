import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { enqueue, getRun, markRunStatus, recoverInterruptedRuns } from "./queue.js";
import { createProject } from "./queue.js";
import { processNextRun } from "./worker.js";

describe("jobs worker", () => {
  it("transitions queued -> running -> succeeded and writes manifest", async () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_worker_success");
    cleanup(rootDir);

    const project = createProject(
      {
        name: "worker-success",
        rulebookText: [
          "Tic Tac Toe",
          "Two players alternate marking cells in a 3x3 board.",
          "First to align three marks wins."
        ].join("\n")
      },
      { rootDir }
    );
    const runId = enqueue(
      "rulebook_run",
      project.id,
      {
        seed: "42",
        matches: 8,
        maxTurns: 16
      },
      { rootDir }
    );

    const processed = await processNextRun({
      rootDir,
      maxParallelPoolSize: 1,
      pollIntervalMs: 10
    });
    expect(processed).toBe(true);

    const run = getRun(runId, { rootDir });
    expect(run?.status).toBe("succeeded");
    expect(run?.startedAt).not.toBeNull();
    expect(run?.finishedAt).not.toBeNull();
    expect(run?.manifestPath).not.toBeNull();

    const manifestPath = resolve(process.cwd(), run?.manifestPath ?? "");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { status: string; artifacts?: Record<string, string> };
    expect(manifest.status).toBe("succeeded");
    expect(manifest.artifacts?.ir).toBeDefined();
    expect(manifest.artifacts?.gaps).toBeDefined();

    cleanup(rootDir);
  });

  it("transitions queued -> running -> failed and still writes manifest", async () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_worker_fail");
    cleanup(rootDir);

    const project = createProject(
      {
        name: "worker-fail",
        rulebookText: "fallback"
      },
      { rootDir }
    );
    const runId = enqueue(
      "tune",
      project.id,
      {
        seed: "42",
        spaceId: "unknown" as "mini_splendor"
      },
      { rootDir }
    );

    await processNextRun({
      rootDir,
      maxParallelPoolSize: 1,
      pollIntervalMs: 10
    });

    const run = getRun(runId, { rootDir });
    expect(run?.status).toBe("failed");
    expect(run?.manifestPath).not.toBeNull();
    expect(run?.error).toMatch(/unsupported tune space|requires payload\.irPath|latestIrPath/);

    const manifestPath = resolve(process.cwd(), run?.manifestPath ?? "");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { status: string; error?: string };
    expect(manifest.status).toBe("failed");
    expect(manifest.error).toBeDefined();

    cleanup(rootDir);
  });

  it("requeues interrupted running jobs and processes them on next worker cycle", async () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_worker_recovery");
    cleanup(rootDir);

    const project = createProject(
      {
        name: "worker-recovery",
        rulebookText: [
          "Tic Tac Toe",
          "Two players alternate marking cells in a 3x3 board.",
          "First to align three marks wins."
        ].join("\n")
      },
      { rootDir }
    );
    const runId = enqueue(
      "rulebook_run",
      project.id,
      {
        seed: "42",
        matches: 6,
        maxTurns: 12
      },
      { rootDir }
    );

    markRunStatus(
      runId,
      "running",
      {
        startedAt: new Date().toISOString(),
        error: null
      },
      { rootDir }
    );
    const recovered = recoverInterruptedRuns({ rootDir });
    expect(recovered.requeuedRunIds).toContain(runId);
    expect(getRun(runId, { rootDir })?.status).toBe("queued");

    await processNextRun({
      rootDir,
      maxParallelPoolSize: 1
    });
    expect(getRun(runId, { rootDir })?.status).toBe("succeeded");

    cleanup(rootDir);
  });
});

function cleanup(pathValue: string): void {
  if (existsSync(pathValue)) {
    rmSync(pathValue, { recursive: true, force: true });
  }
}
