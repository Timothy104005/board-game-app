import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { executeRun } from "./executors.js";
import { dequeueNextRun, getProject, getRun, markRunStatus, updateProject } from "./queue.js";
import { stableStringify } from "../utils/stableJson.js";
import type { RunManifest } from "./types.js";

export interface WorkerDaemonOptions {
  pollIntervalMs?: number;
  maxParallelPoolSize?: number;
  rootDir?: string;
}

export async function runWorkerDaemon(opts: WorkerDaemonOptions = {}): Promise<void> {
  const pollIntervalMs = opts.pollIntervalMs ?? 500;
  while (true) {
    const processed = await processNextRun(opts);
    if (!processed) {
      await sleep(pollIntervalMs);
    }
  }
}

export async function processNextRun(opts: WorkerDaemonOptions = {}): Promise<boolean> {
  const maxParallelPoolSize = Math.max(1, Math.floor(opts.maxParallelPoolSize ?? 2));
  const next = dequeueNextRun({ rootDir: opts.rootDir });
  if (!next) {
    return false;
  }

  const startedAt = timestamp();
  markRunStatus(
    next.id,
    "running",
    {
      startedAt,
      error: null
    },
    { rootDir: opts.rootDir }
  );
  const run = getRun(next.id, { rootDir: opts.rootDir });
  if (!run) {
    return true;
  }

  mkdirSync(run.runDir, { recursive: true });
  const logsPath = resolve(run.runDir, "logs.txt");
  const log = (line: string) => {
    appendFileSync(logsPath, `[${timestamp()}] ${line}\n`, "utf8");
  };

  log(`starting run=${run.id} type=${run.jobType} project=${run.projectId}`);
  const project = getProject(run.projectId, { rootDir: opts.rootDir });
  if (!project) {
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
      error: `project not found: ${run.projectId}`
    });
    markRunStatus(
      run.id,
      "failed",
      {
        finishedAt,
        error: `project not found: ${run.projectId}`,
        manifestPath: manifest
      },
      { rootDir: opts.rootDir }
    );
    log(`failed: project not found`);
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

    markRunStatus(
      run.id,
      result.ok ? "succeeded" : "failed",
      {
        finishedAt,
        error: result.ok ? null : result.manifest.error ?? "job failed",
        manifestPath
      },
      { rootDir: opts.rootDir }
    );
    updateProject(
      project.id,
      {
        latestRunId: run.id,
        latestIrPath: result.projectPatch?.latestIrPath ?? project.latestIrPath,
        latestReplayPath: result.projectPatch?.latestReplayPath ?? project.latestReplayPath
      },
      { rootDir: opts.rootDir }
    );
    log(`finished status=${result.ok ? "succeeded" : "failed"}`);
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
    markRunStatus(
      run.id,
      "failed",
      {
        finishedAt,
        error: message,
        manifestPath
      },
      { rootDir: opts.rootDir }
    );
    updateProject(
      project.id,
      {
        latestRunId: run.id
      },
      { rootDir: opts.rootDir }
    );
    log(`failed: ${message}`);
  }

  return true;
}

function writeManifest(runDir: string, manifest: RunManifest): string {
  const fullPath = resolve(runDir, "manifest.json");
  writeFileSync(fullPath, `${stableStringify(manifest)}\n`, "utf8");
  return toRelative(fullPath);
}

function toRelative(pathValue: string): string {
  return pathValue.replace(`${process.cwd()}\\`, "").replace(/\\/g, "/");
}

function timestamp(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}
