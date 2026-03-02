import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
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
});

function cleanup(pathValue: string): void {
  if (existsSync(pathValue)) {
    rmSync(pathValue, { recursive: true, force: true });
  }
}
