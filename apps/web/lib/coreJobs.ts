import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createProject,
  enqueue,
  getProject,
  getRun,
  listProjects,
  listRuns,
  updateProject
} from "../../../src/jobs/queue";
import { getJobsRoot, getRepoRoot } from "../../../src/paths";
import type { CreateProjectInput, JobPayload, JobType, ProjectRecord, RunManifest, RunRecord } from "../../../src/jobs/types";

export type { CreateProjectInput, JobPayload, JobType, ProjectRecord, RunManifest, RunRecord };
const jobsRoot = getJobsRoot();

export function createProjectRecord(input: CreateProjectInput): ProjectRecord {
  return createProject(input, { rootDir: jobsRoot });
}

export function updateProjectRecord(
  projectId: string,
  patch: Partial<Pick<ProjectRecord, "name" | "rulebookText" | "seedDefault">>
): ProjectRecord {
  return updateProject(projectId, patch, { rootDir: jobsRoot });
}

export function listProjectRecords(): ProjectRecord[] {
  return listProjects({ rootDir: jobsRoot });
}

export function getProjectRecord(projectId: string): ProjectRecord | null {
  return getProject(projectId, { rootDir: jobsRoot });
}

export function listRunRecords(projectId: string): RunRecord[] {
  return listRuns(projectId, { rootDir: jobsRoot });
}

export function getRunRecord(runId: string): RunRecord | null {
  return getRun(runId, { rootDir: jobsRoot });
}

export function enqueueRun(jobType: JobType, projectId: string, payload: JobPayload): string {
  return enqueue(jobType, projectId, payload, { rootDir: jobsRoot });
}

export function readRunManifest(run: RunRecord): RunManifest | null {
  if (!run.manifestPath) {
    return null;
  }
  const fullPath = resolve(getRepoRoot(), run.manifestPath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return JSON.parse(readFileSync(fullPath, "utf8")) as RunManifest;
}
