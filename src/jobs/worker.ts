import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { toRepoRelativePath } from "../paths.js";
import { stableStringify } from "../utils/stableJson.js";
import { executeRun } from "./executors.js";
import { dequeueNextRun, getProject, getRun, markRunStatus, recoverInterruptedRuns, updateProject } from "./queue.js";
import type { RunManifest } from "./types.js";

export interface WorkerEvent {
  ts?: string;
  level: "info" | "warn" | "error";
  event: string;
  runId?: string;
  message?: string;
  [key: string]: unknown;
}

export interface WorkerDaemonOptions {
  pollIntervalMs?: number;
  maxParallelPoolSize?: number;
  rootDir?: string;
  once?: boolean;
  signal?: AbortSignal;
  onEvent?: (event: WorkerEvent) => void;
}

export async function runWorkerDaemon(opts: WorkerDaemonOptions = {}): Promise<void> {
  const pollIntervalMs = Math.max(10, opts.pollIntervalMs ?? 500);
  const recovery = recoverInterruptedRuns({ rootDir: opts.rootDir });
  if (recovery.requeuedRunIds.length > 0) {
    emit(opts, {
      level: "warn",
      event: "recovered_interrupted_runs",
      runCount: recovery.requeuedRunIds.length,
      runIds: recovery.requeuedRunIds
    });
  } else {
    emit(opts, {
      level: "info",
      event: "startup_no_recovery_needed"
    });
  }

  while (!opts.signal?.aborted) {
    let processed = false;
    try {
      processed = await processNextRun(opts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit(opts, {
        level: "error",
        event: "loop_error",
        message
      });
    }

    if (!processed) {
      if (opts.once) {
        emit(opts, {
          level: "info",
          event: "drained"
        });
        return;
      }
      await sleep(pollIntervalMs, opts.signal);
    }
  }

  emit(opts, {
    level: "info",
    event: "stopped_by_signal"
  });
}

export async function processNextRun(opts: WorkerDaemonOptions = {}): Promise<boolean> {
  const maxParallelPoolSize = Math.max(1, Math.floor(opts.maxParallelPoolSize ?? 2));
  const next = dequeueNextRun({ rootDir: opts.rootDir });
  if (!next) {
    return false;
  }

  const startedAt = timestamp();
  safeMarkRunStatus(
    next.id,
    "running",
    {
      startedAt,
      error: null
    },
    opts
  );
  const run = getRun(next.id, { rootDir: opts.rootDir });
  if (!run) {
    emit(opts, {
      level: "warn",
      event: "run_missing_after_dequeue",
      runId: next.id
    });
    return true;
  }

  mkdirSync(run.runDir, { recursive: true });
  const logsPath = resolve(run.runDir, "logs.txt");
  const log = (line: string) => {
    try {
      appendFileSync(logsPath, `[${timestamp()}] ${line}\n`, "utf8");
    } catch (error) {
      emit(opts, {
        level: "warn",
        event: "log_append_failed",
        runId: run.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };

  emit(opts, {
    level: "info",
    event: "run_started",
    runId: run.id,
    jobType: run.jobType,
    projectId: run.projectId
  });
  log(`starting run=${run.id} type=${run.jobType} project=${run.projectId}`);
  const project = getProject(run.projectId, { rootDir: opts.rootDir });
  if (!project) {
    const missingProjectError = `project not found: ${run.projectId}`;
    const finishedAt = timestamp();
    const manifest = writeManifest(run.runDir, {
      runId: run.id,
      projectId: run.projectId,
      jobType: run.jobType,
      status: "failed",
      createdAt: run.createdAt,
      startedAt,
      finishedAt,
      seed: "42",
      config: {},
      artifacts: {},
      error: missingProjectError
    });
    safeMarkRunStatus(
      run.id,
      "failed",
      {
        finishedAt,
        error: missingProjectError,
        manifestPath: manifest
      },
      opts
    );
    log(`failed: project not found`);
    emit(opts, {
      level: "error",
      event: "run_failed",
      runId: run.id,
      message: missingProjectError
    });
    return true;
  }

  try {
    const result = await executeRun({
      run,
      project,
      maxParallelPoolSize,
      log
    });
    const finishedAt = timestamp();
    const manifestPath = writeManifest(run.runDir, {
      ...result.manifest,
      status: result.ok ? "succeeded" : "failed",
      startedAt,
      finishedAt
    });

    safeMarkRunStatus(
      run.id,
      result.ok ? "succeeded" : "failed",
      {
        finishedAt,
        error: result.ok ? null : result.manifest.error ?? "job failed",
        manifestPath
      },
      opts
    );
    safeUpdateProject(
      project.id,
      {
        latestRunId: run.id,
        latestIrPath: result.projectPatch?.latestIrPath ?? project.latestIrPath,
        latestReplayPath: result.projectPatch?.latestReplayPath ?? project.latestReplayPath
      },
      opts
    );
    log(`finished status=${result.ok ? "succeeded" : "failed"}`);
    emit(opts, {
      level: "info",
      event: "run_finished",
      runId: run.id,
      status: result.ok ? "succeeded" : "failed"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = timestamp();
    const manifestPath = writeManifest(run.runDir, {
      runId: run.id,
      projectId: run.projectId,
      jobType: run.jobType,
      status: "failed",
      createdAt: run.createdAt,
      startedAt,
      finishedAt,
      seed: project.seedDefault,
      config: {},
      artifacts: {},
      error: message
    });
    safeMarkRunStatus(
      run.id,
      "failed",
      {
        finishedAt,
        error: message,
        manifestPath
      },
      opts
    );
    safeUpdateProject(
      project.id,
      {
        latestRunId: run.id
      },
      opts
    );
    log(`failed: ${message}`);
    emit(opts, {
      level: "error",
      event: "run_failed",
      runId: run.id,
      message
    });
  }

  return true;
}

function safeMarkRunStatus(
  runId: string,
  status: "queued" | "running" | "succeeded" | "failed",
  patch: {
    startedAt?: string | null;
    finishedAt?: string | null;
    error?: string | null;
    manifestPath?: string | null;
  },
  opts: WorkerDaemonOptions
): void {
  try {
    markRunStatus(runId, status, patch, { rootDir: opts.rootDir });
  } catch (error) {
    emit(opts, {
      level: "warn",
      event: "mark_status_failed",
      runId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function safeUpdateProject(
  projectId: string,
  patch: {
    latestRunId?: string | null;
    latestIrPath?: string | null;
    latestReplayPath?: string | null;
  },
  opts: WorkerDaemonOptions
): void {
  try {
    updateProject(projectId, patch, { rootDir: opts.rootDir });
  } catch (error) {
    emit(opts, {
      level: "warn",
      event: "project_update_failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function writeManifest(runDir: string, manifest: RunManifest): string {
  mkdirSync(runDir, { recursive: true });
  const fullPath = resolve(runDir, "manifest.json");
  writeFileSync(fullPath, `${stableStringify(manifest)}\n`, "utf8");
  return toRepoRelativePath(fullPath);
}

function emit(opts: WorkerDaemonOptions, event: WorkerEvent): void {
  opts.onEvent?.({
    ts: timestamp(),
    ...event
  });
}

function timestamp(): string {
  return new Date().toISOString();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolvePromise();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolvePromise();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
