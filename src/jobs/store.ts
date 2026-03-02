import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stableStringify } from "../utils/stableJson";
import type { ProjectRecord, RunRecord } from "./types";

export interface ProjectsState {
  nextProjectNumber: number;
  projects: ProjectRecord[];
}

export interface RunsState {
  nextRunNumber: number;
  runs: RunRecord[];
}

export interface QueueState {
  runIds: string[];
}

export interface JobsStore {
  rootDir: string;
  withLock<T>(fn: () => T): T;
  readProjectsState(): ProjectsState;
  writeProjectsState(value: ProjectsState): void;
  readRunsState(): RunsState;
  writeRunsState(value: RunsState): void;
  readQueueState(): QueueState;
  writeQueueState(value: QueueState): void;
}

export function createJobsStore(rootDir = resolve(process.cwd(), "artifacts", "jobs")): JobsStore {
  const projectsPath = resolve(rootDir, "projects.json");
  const runsPath = resolve(rootDir, "runs.json");
  const queuePath = resolve(rootDir, "queue.json");
  const lockPath = resolve(rootDir, "store.lock");

  function ensureInitialized(): void {
    mkdirSync(rootDir, { recursive: true });
    if (!existsSync(projectsPath)) {
      writeAtomicJson(projectsPath, {
        nextProjectNumber: 1,
        projects: []
      } satisfies ProjectsState);
    }
    if (!existsSync(runsPath)) {
      writeAtomicJson(runsPath, {
        nextRunNumber: 1,
        runs: []
      } satisfies RunsState);
    }
    if (!existsSync(queuePath)) {
      writeAtomicJson(queuePath, {
        runIds: []
      } satisfies QueueState);
    }
  }

  function withLock<T>(fn: () => T): T {
    ensureInitialized();
    const lockFd = acquireLock(lockPath);
    try {
      return fn();
    } finally {
      releaseLock(lockPath, lockFd);
    }
  }

  return {
    rootDir,
    withLock,
    readProjectsState: () => readJson<ProjectsState>(projectsPath),
    writeProjectsState: (value) => writeAtomicJson(projectsPath, value),
    readRunsState: () => readJson<RunsState>(runsPath),
    writeRunsState: (value) => writeAtomicJson(runsPath, value),
    readQueueState: () => readJson<QueueState>(queuePath),
    writeQueueState: (value) => writeAtomicJson(queuePath, value)
  };
}

function acquireLock(lockPath: string): number {
  const start = Date.now();
  const timeoutMs = 5000;
  const staleMs = 30_000;

  while (Date.now() - start < timeoutMs) {
    try {
      return openSync(lockPath, "wx");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }

      if (existsSync(lockPath)) {
        try {
          const ageMs = Date.now() - statSync(lockPath).mtimeMs;
          if (ageMs > staleMs) {
            unlinkSync(lockPath);
            continue;
          }
        } catch {
          // no-op
        }
      }
      sleepMs(20);
    }
  }

  throw new Error(`timed out acquiring jobs store lock: ${lockPath}`);
}

function releaseLock(lockPath: string, fd: number): void {
  try {
    closeSync(fd);
  } catch {
    // no-op
  }
  try {
    unlinkSync(lockPath);
  } catch {
    // no-op
  }
}

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeAtomicJson(path: string, value: unknown): void {
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, `${stableStringify(value)}\n`, "utf8");
  renameSync(tempPath, path);
}
