import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getJobsRoot, getRepoRoot, isPathInsideRepo, toRepoRelativePath } from "./paths";

describe("paths", () => {
  it("resolves jobs root identically from repo root and apps/web cwd", () => {
    const originalCwd = process.cwd();
    const repoRoot = getRepoRoot(originalCwd);
    const webRoot = resolve(repoRoot, "apps", "web");
    let jobsFromRepo: string;
    let jobsFromWeb: string;

    try {
      process.chdir(repoRoot);
      jobsFromRepo = getJobsRoot();

      process.chdir(webRoot);
      jobsFromWeb = getJobsRoot();
    } finally {
      process.chdir(originalCwd);
    }

    expect(jobsFromRepo!).toBe(resolve(repoRoot, "artifacts", "jobs"));
    expect(jobsFromWeb!).toBe(jobsFromRepo!);
  });

  it("keeps path-safety checks anchored to the discovered repo root", () => {
    const repoRoot = getRepoRoot();
    const inside = resolve(repoRoot, "artifacts", "jobs", "runs.json");
    const outside = resolve(repoRoot, "..", "outside.txt");

    expect(isPathInsideRepo(inside)).toBe(true);
    expect(isPathInsideRepo(outside)).toBe(false);
    expect(toRepoRelativePath(inside)).toBe("artifacts/jobs/runs.json");
  });
});
