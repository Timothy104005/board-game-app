import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createProject, enqueue, getRun, getStatus, listProjects, listRuns } from "./queue.js";

describe("jobs queue", () => {
  it("creates projects and persists deterministic ids", () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_queue_projects");
    cleanup(rootDir);

    const first = createProject(
      {
        name: "queue-proj-a",
        rulebookText: "Tic Tac Toe"
      },
      { rootDir }
    );
    const second = createProject(
      {
        name: "queue-proj-b",
        rulebookText: "Nim"
      },
      { rootDir }
    );

    expect(first.id).toBe("p000001");
    expect(second.id).toBe("p000002");
    const projects = listProjects({ rootDir });
    expect(projects.map((project) => project.id)).toEqual(["p000001", "p000002"]);

    cleanup(rootDir);
  });

  it("enqueues runs in FIFO order and tracks queued status", () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_queue_runs");
    cleanup(rootDir);

    const project = createProject(
      {
        name: "queue-runs",
        rulebookText: "Pig rules"
      },
      { rootDir }
    );
    const runA = enqueue(
      "rulebook_run",
      project.id,
      {
        seed: "42",
        matches: 10,
        maxTurns: 50
      },
      { rootDir }
    );
    const runB = enqueue(
      "simulate",
      project.id,
      {
        matches: 12,
        maxTurns: 40
      },
      { rootDir }
    );

    expect(runA).toBe("r000001");
    expect(runB).toBe("r000002");
    expect(getStatus(runA, { rootDir })).toBe("queued");
    expect(getStatus(runB, { rootDir })).toBe("queued");

    const runs = listRuns(project.id, { rootDir });
    expect(runs.map((run) => run.id)).toEqual(["r000001", "r000002"]);
    expect(getRun(runA, { rootDir })?.projectId).toBe(project.id);

    cleanup(rootDir);
  });
});

function cleanup(pathValue: string): void {
  if (existsSync(pathValue)) {
    rmSync(pathValue, { recursive: true, force: true });
  }
}
