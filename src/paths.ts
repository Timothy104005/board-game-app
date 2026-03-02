import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

function hasJobsSource(root: string): boolean {
  return existsSync(resolve(root, "src", "jobs"));
}

export function getRepoRoot(cwd = process.cwd()): string {
  const start = resolve(cwd);
  if (hasJobsSource(start)) {
    return start;
  }

  let current = start;
  for (let depth = 0; depth < 8; depth += 1) {
    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    if (hasJobsSource(parent)) {
      return parent;
    }
    current = parent;
  }

  return start;
}

export function getArtifactsRoot(cwd = process.cwd()): string {
  return resolve(getRepoRoot(cwd), "artifacts");
}

export function getJobsRoot(cwd = process.cwd()): string {
  return resolve(getArtifactsRoot(cwd), "jobs");
}

export function resolveArtifactsPath(...segments: string[]): string {
  return resolve(getArtifactsRoot(), ...segments);
}

export function isPathInsideRepo(absPath: string, cwd = process.cwd()): boolean {
  const repoRoot = normalizeForCompare(getRepoRoot(cwd));
  const target = normalizeForCompare(resolve(absPath));
  return target === repoRoot || target.startsWith(`${repoRoot}/`);
}

export function toRepoRelativePath(absPath: string, cwd = process.cwd()): string {
  const repoRoot = getRepoRoot(cwd);
  const target = resolve(absPath);
  if (!isPathInsideRepo(target, cwd)) {
    throw new Error(`path is outside repository root: ${target}`);
  }
  return relative(repoRoot, target).replace(/\\/g, "/");
}

function normalizeForCompare(pathValue: string): string {
  const normalized = resolve(pathValue).replace(/\\/g, "/");
  if (process.platform === "win32") {
    return normalized.toLowerCase();
  }
  return normalized;
}
