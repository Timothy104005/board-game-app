import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRunRecord, readRunManifest } from "./coreJobs";
import type { RunManifest, RunRecord } from "./coreJobs";
import { getRepoRoot, isWithinRepo, resolveRepoPath } from "./repoPaths";

export interface ArtifactLink {
  key: string;
  path: string;
}

export interface RunStatusResponse {
  run: RunRecord;
  manifest: RunManifest | null;
  artifactLinks: ArtifactLink[];
  logTail: string[];
}

export function getRunStatusResponse(runId: string): RunStatusResponse | null {
  const run = getRunRecord(runId);
  if (!run) {
    return null;
  }
  const manifest = readRunManifest(run);
  const artifactLinks = Object.entries(manifest?.artifacts ?? {}).map(([key, pathValue]) => ({
    key,
    path: pathValue
  }));
  const logTail = readLogTail(run, 200);

  return {
    run,
    manifest,
    artifactLinks,
    logTail
  };
}

export function readArtifactText(runId: string, artifactKey: string): { path: string; content: string } | null {
  const status = getRunStatusResponse(runId);
  if (!status) {
    return null;
  }
  const artifact = status.artifactLinks.find((entry) => entry.key === artifactKey);
  if (!artifact) {
    return null;
  }
  const fullPath = resolveRepoPath(artifact.path);
  if (!isSafePath(fullPath) || !existsSync(fullPath)) {
    return null;
  }
  return {
    path: artifact.path,
    content: readFileSync(fullPath, "utf8")
  };
}

function readLogTail(run: RunRecord, maxLines: number): string[] {
  const logPath = resolve(run.runDir, "logs.txt");
  if (!existsSync(logPath)) {
    return [];
  }
  const lines = readFileSync(logPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  return lines.slice(-maxLines);
}

function isSafePath(pathValue: string): boolean {
  if (!isWithinRepo(pathValue)) {
    return false;
  }
  const root = getRepoRoot().replace(/\\/g, "/");
  const normalized = resolve(pathValue).replace(/\\/g, "/");
  return normalized.startsWith(root);
}
