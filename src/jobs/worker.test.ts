import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createProject, enqueue, getRun } from "./queue.js";
import { processNextRun } from "./worker.js";

describe("jobs worker", () => {
  it("processes queued rulebook run and writes manifest", async () => {
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
    expect(run?.manifestPath).not.toBeNull();

    const manifestPath = resolve(process.cwd(), run?.manifestPath ?? "");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { artifacts?: Record<string, string> };
    expect(manifest.artifacts?.ir).toBeDefined();
    expect(manifest.artifacts?.gaps).toBeDefined();

    cleanup(rootDir);
  });

  it("marks failed runs when execution errors", async () => {
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
      "apply_patch",
      project.id,
      {
        patch: {
          operations: [{ op: "set", path: "/meta/name", value: "patched" }]
        }
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
    expect(run?.error).toMatch(/latestIrPath|irPath/);

    cleanup(rootDir);
  });
});

function cleanup(pathValue: string): void {
  if (existsSync(pathValue)) {
    rmSync(pathValue, { recursive: true, force: true });
  }
}
