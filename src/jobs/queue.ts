import { isAbsolute, resolve } from "node:path";
import { getJobsRoot, getRepoRoot } from "../paths";
import { createJobsStore } from "./store";
import type { CreateProjectInput, JobPayload, JobType, ProjectRecord, RunRecord, RunStatus } from "./types";

interface QueueOptions {
  rootDir?: string;
}

export function createProject(input: CreateProjectInput, options: QueueOptions = {}): ProjectRecord {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const projectsState = store.readProjectsState();
    const now = timestamp();
    const project: ProjectRecord = {
      id: formatId("p", projectsState.nextProjectNumber),
      name: input.name.trim(),
      rulebookText: input.rulebookText,
      seedDefault: input.seedDefault ?? "42",
      createdAt: now,
      updatedAt: now,
      latestRunId: null,
      latestIrPath: null,
      latestReplayPath: null
    };
    projectsState.nextProjectNumber += 1;
    projectsState.projects.push(project);
    store.writeProjectsState(projectsState);
    return project;
  });
}

export function listProjects(options: QueueOptions = {}): ProjectRecord[] {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const projectsState = store.readProjectsState();
    return [...projectsState.projects].sort((a, b) => a.id.localeCompare(b.id));
  });
}

export function getProject(projectId: string, options: QueueOptions = {}): ProjectRecord | null {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const projectsState = store.readProjectsState();
    return projectsState.projects.find((project) => project.id === projectId) ?? null;
  });
}

export function updateProject(
  projectId: string,
  patch: Partial<Pick<ProjectRecord, "latestRunId" | "latestIrPath" | "latestReplayPath" | "rulebookText" | "name" | "seedDefault">>,
  options: QueueOptions = {}
): ProjectRecord {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const projectsState = store.readProjectsState();
    const project = projectsState.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error(`project not found: ${projectId}`);
    }
    if (typeof patch.latestRunId !== "undefined") {
      project.latestRunId = patch.latestRunId;
    }
    if (typeof patch.latestIrPath !== "undefined") {
      project.latestIrPath = patch.latestIrPath;
    }
    if (typeof patch.latestReplayPath !== "undefined") {
      project.latestReplayPath = patch.latestReplayPath;
    }
    if (typeof patch.rulebookText !== "undefined") {
      project.rulebookText = patch.rulebookText;
    }
    if (typeof patch.name !== "undefined") {
      project.name = patch.name;
    }
    if (typeof patch.seedDefault !== "undefined") {
      project.seedDefault = patch.seedDefault;
    }
    project.updatedAt = timestamp();
    store.writeProjectsState(projectsState);
    return project;
  });
}

export function enqueue(jobType: JobType, projectId: string, payload: JobPayload, options: QueueOptions = {}): string {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const projectsState = store.readProjectsState();
    const runsState = store.readRunsState();
    const queueState = store.readQueueState();
    const project = projectsState.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error(`project not found: ${projectId}`);
    }

    const now = timestamp();
    const runId = formatId("r", runsState.nextRunNumber);
    runsState.nextRunNumber += 1;
    const runDir = resolve(store.rootDir, runId);
    const record: RunRecord = {
      id: runId,
      projectId,
      jobType,
      status: "queued",
      payload,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      error: null,
      runDir,
      manifestPath: null
    };
    runsState.runs.push(record);
    queueState.runIds.push(runId);
    project.latestRunId = runId;
    project.updatedAt = now;

    store.writeRunsState(runsState);
    store.writeQueueState(queueState);
    store.writeProjectsState(projectsState);
    return runId;
  });
}

export function getRun(runId: string, options: QueueOptions = {}): RunRecord | null {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const runsState = store.readRunsState();
    return runsState.runs.find((run) => run.id === runId) ?? null;
  });
}

export function getStatus(runId: string, options: QueueOptions = {}): RunStatus | null {
  const run = getRun(runId, options);
  return run?.status ?? null;
}

export function listRuns(projectId: string, options: QueueOptions = {}): RunRecord[] {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const runsState = store.readRunsState();
    return runsState.runs
      .filter((run) => run.projectId === projectId)
      .sort((a, b) => a.id.localeCompare(b.id));
  });
}

export function dequeueNextRun(options: QueueOptions = {}): RunRecord | null {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const runsState = store.readRunsState();
    const queueState = store.readQueueState();
    while (queueState.runIds.length > 0) {
      const nextId = queueState.runIds.shift() as string;
      const run = runsState.runs.find((entry) => entry.id === nextId) ?? null;
      if (run && run.status === "queued") {
        store.writeQueueState(queueState);
        return run;
      }
    }
    store.writeQueueState(queueState);
    return null;
  });
}

export function markRunStatus(
  runId: string,
  status: RunStatus,
  patch: Partial<Pick<RunRecord, "startedAt" | "finishedAt" | "error" | "manifestPath">> = {},
  options: QueueOptions = {}
): RunRecord {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const runsState = store.readRunsState();
    const run = runsState.runs.find((entry) => entry.id === runId);
    if (!run) {
      throw new Error(`run not found: ${runId}`);
    }
    run.status = status;
    if (typeof patch.startedAt !== "undefined") {
      run.startedAt = patch.startedAt;
    }
    if (typeof patch.finishedAt !== "undefined") {
      run.finishedAt = patch.finishedAt;
    }
    if (typeof patch.error !== "undefined") {
      run.error = patch.error;
    }
    if (typeof patch.manifestPath !== "undefined") {
      run.manifestPath = patch.manifestPath;
    }
    store.writeRunsState(runsState);
    return run;
  });
}

export function recoverInterruptedRuns(options: QueueOptions = {}): { requeuedRunIds: string[] } {
  const store = createJobsStore(resolveRoot(options));
  return store.withLock(() => {
    const runsState = store.readRunsState();
    const queueState = store.readQueueState();
    const queueSet = new Set(queueState.runIds);
    const requeuedRunIds: string[] = [];

    for (const run of runsState.runs) {
      if (run.status === "running") {
        run.status = "queued";
        run.startedAt = null;
        run.finishedAt = null;
        run.error = null;
        if (!queueSet.has(run.id)) {
          queueState.runIds.push(run.id);
          queueSet.add(run.id);
        }
        requeuedRunIds.push(run.id);
      } else if (run.status === "queued" && !queueSet.has(run.id)) {
        queueState.runIds.push(run.id);
        queueSet.add(run.id);
      }
    }

    if (requeuedRunIds.length > 0) {
      store.writeRunsState(runsState);
    }
    store.writeQueueState(queueState);
    return { requeuedRunIds };
  });
}

function formatId(prefix: "p" | "r", number: number): string {
  return `${prefix}${String(number).padStart(6, "0")}`;
}

function timestamp(): string {
  return new Date().toISOString();
}

function resolveRoot(options: QueueOptions): string | undefined {
  if (!options.rootDir) {
    return getJobsRoot();
  }
  if (isAbsolute(options.rootDir)) {
    return options.rootDir;
  }
  return resolve(getRepoRoot(), options.rootDir);
}
