import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function getRepoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(resolve(cwd, "src", "jobs"))) {
    return cwd;
  }
  const twoUp = resolve(cwd, "..", "..");
  if (existsSync(resolve(twoUp, "src", "jobs"))) {
    return twoUp;
  }
  return cwd;
}

export function getJobsRoot(): string {
  return resolve(getRepoRoot(), "artifacts", "jobs");
}

export function resolveRepoPath(pathValue: string): string {
  return resolve(getRepoRoot(), pathValue);
}

export function isWithinRepo(pathValue: string): boolean {
  const normalized = pathValue.replace(/\\/g, "/");
  const normalizedRoot = getRepoRoot().replace(/\\/g, "/");
  return normalized.startsWith(normalizedRoot);
}
