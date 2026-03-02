import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getJobsRoot } from "../paths";
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

interface StoreOptions {
  lockTimeoutMs?: number;
  staleLockMs?: number;
  minBackoffMs?: number;
  maxBackoffMs?: number;
}

export function createJobsStore(rootDir = getJobsRoot(), options: StoreOptions = {}): JobsStore {
  const resolvedRootDir = resolve(rootDir);
  const projectsPath = resolve(resolvedRootDir, "projects.json");
  const runsPath = resolve(resolvedRootDir, "runs.json");
  const queuePath = resolve(resolvedRootDir, "queue.json");
  const lockPath = resolve(resolvedRootDir, "store.lock");
  const lockOptions = {
    timeoutMs: options.lockTimeoutMs ?? 5000,
    staleMs: options.staleLockMs ?? 30_000,
    minBackoffMs: options.minBackoffMs ?? 10,
    maxBackoffMs: options.maxBackoffMs ?? 200
  };

  function ensureInitialized(): void {
    mkdirSync(resolvedRootDir, { recursive: true });
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
    const lockFd = acquireLock(lockPath, lockOptions);
    try {
      return fn();
    } finally {
      releaseLock(lockPath, lockFd);
    }
  }

  return {
    rootDir: resolvedRootDir,
    withLock,
    readProjectsState: () => readJson<ProjectsState>(projectsPath),
    writeProjectsState: (value) => writeAtomicJson(projectsPath, value),
    readRunsState: () => readJson<RunsState>(runsPath),
    writeRunsState: (value) => writeAtomicJson(runsPath, value),
    readQueueState: () => readJson<QueueState>(queuePath),
    writeQueueState: (value) => writeAtomicJson(queuePath, value)
  };
}

function acquireLock(
  lockPath: string,
  options: {
    timeoutMs: number;
    staleMs: number;
    minBackoffMs: number;
    maxBackoffMs: number;
  }
): number {
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < options.timeoutMs) {
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
          if (ageMs > options.staleMs) {
            unlinkSync(lockPath);
            continue;
          }
        } catch {
          // no-op
        }
      }
      const delay = Math.min(options.maxBackoffMs, options.minBackoffMs * 2 ** attempt);
      attempt += 1;
      sleepMs(delay);
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
  const tempPath = `${path}.tmp.${process.pid}.${Date.now()}.${nextCounter()}`;
  writeFileSync(tempPath, `${stableStringify(value)}\n`, "utf8");
  renameWithRetry(tempPath, path);
}

let writeCounter = 0;
function nextCounter(): number {
  writeCounter += 1;
  return writeCounter;
}

function renameWithRetry(fromPath: string, toPath: string): void {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      renameSync(fromPath, toPath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") {
        throw error;
      }
      sleepMs(5 * (attempt + 1));
    }
  }
  renameSync(fromPath, toPath);
}
