import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createProject, enqueue, getProject } from "./queue.js";
import { createJobsStore } from "./store.js";

describe("jobs store", () => {
  it("initializes and persists json state files", () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_store");
    cleanup(rootDir);

    const store = createJobsStore(rootDir);
    store.withLock(() => {
      const projects = store.readProjectsState();
      projects.nextProjectNumber = 7;
      store.writeProjectsState(projects);
    });

    const reloaded = createJobsStore(rootDir);
    const state = reloaded.withLock(() => reloaded.readProjectsState());
    expect(state.nextProjectNumber).toBe(7);

    cleanup(rootDir);
  });

  it("recovers from stale lock file", () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_store_lock");
    cleanup(rootDir);
    mkdirSync(rootDir, { recursive: true });

    const store = createJobsStore(rootDir);
    const lockPath = resolve(rootDir, "store.lock");
    writeFileSync(lockPath, "locked\n", "utf8");
    const staleTime = new Date(Date.now() - 60_000);
    utimesSync(lockPath, staleTime, staleTime);

    const result = store.withLock(() => {
      const queue = store.readQueueState();
      queue.runIds.push("r000001");
      store.writeQueueState(queue);
      return queue.runIds.length;
    });

    expect(result).toBe(1);
    expect(existsSync(lockPath)).toBe(false);

    cleanup(rootDir);
  });

  it("keeps queue/runs state consistent under concurrent enqueue calls", async () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_store_concurrent");
    cleanup(rootDir);

    const project = createProject(
      {
        name: "concurrent-store",
        rulebookText: "Tic Tac Toe"
      },
      { rootDir }
    );

    await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        Promise.resolve().then(() =>
          enqueue(
            "rulebook_run",
            project.id,
            {
              seed: "42",
              matches: 8 + index,
              maxTurns: 16
            },
            { rootDir }
          )
        )
      )
    );

    const store = createJobsStore(rootDir);
    const state = store.withLock(() => ({
      runs: store.readRunsState(),
      queue: store.readQueueState()
    }));
    expect(state.runs.runs).toHaveLength(24);
    expect(state.queue.runIds).toHaveLength(24);
    expect(state.runs.runs.map((run) => run.id)).toEqual(Array.from({ length: 24 }, (_, i) => `r${String(i + 1).padStart(6, "0")}`));
    expect(getProject(project.id, { rootDir })?.latestRunId).toBe("r000024");

    cleanup(rootDir);
  });

  it("times out on active lock and then recovers once lock is stale", () => {
    const rootDir = resolve(process.cwd(), "artifacts", "jobs_test_store_timeout");
    cleanup(rootDir);
    mkdirSync(rootDir, { recursive: true });

    const lockPath = resolve(rootDir, "store.lock");
    writeFileSync(lockPath, "active\n", "utf8");

    const timeoutStore = createJobsStore(rootDir, {
      lockTimeoutMs: 40,
      staleLockMs: 60_000,
      minBackoffMs: 10,
      maxBackoffMs: 10
    });
    expect(() => timeoutStore.withLock(() => timeoutStore.readQueueState())).toThrow(/timed out acquiring jobs store lock/);

    const staleAt = new Date(Date.now() - 90_000);
    utimesSync(lockPath, staleAt, staleAt);
    const recoveredStore = createJobsStore(rootDir, {
      lockTimeoutMs: 1000,
      staleLockMs: 1000
    });
    const queueLength = recoveredStore.withLock(() => recoveredStore.readQueueState().runIds.length);
    expect(queueLength).toBe(0);

    cleanup(rootDir);
  });
});

function cleanup(pathValue: string): void {
  if (existsSync(pathValue)) {
    rmSync(pathValue, { recursive: true, force: true });
  }
}
