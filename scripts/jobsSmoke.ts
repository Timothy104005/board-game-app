import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createProject, enqueue, getRun } from "../src/jobs/queue.js";
import { runWorkerDaemon } from "../src/jobs/worker.js";
import { getJobsRoot, getRepoRoot } from "../src/paths.js";

async function main(): Promise<void> {
  const jobsRoot = getJobsRoot();
  const repoRoot = getRepoRoot();
  const fixturePath = resolve(repoRoot, "src", "rulebook", "examples", "tictactoe.rulebook.txt");
  const fixtureText = readFileSync(fixturePath, "utf8");

  safeResetJobsRoot(jobsRoot);
  const project = createProject({
    name: "jobs-smoke-tictactoe",
    rulebookText: fixtureText,
    seedDefault: "42"
  });
  const runId = enqueue("rulebook_run", project.id, {
    seed: "42",
    matches: 12,
    maxTurns: 20
  });

  console.log(`[jobs:smoke] project=${project.id} run=${runId}`);
  await runWorkerDaemon({
    once: true,
    pollIntervalMs: 100,
    maxParallelPoolSize: 1
  });

  const run = getRun(runId);
  if (!run) {
    throw new Error(`smoke run missing: ${runId}`);
  }
  if (run.status !== "succeeded") {
    throw new Error(`smoke run failed: status=${run.status} error=${run.error ?? ""}`);
  }
  if (!run.manifestPath || !existsSync(resolve(repoRoot, run.manifestPath))) {
    throw new Error(`smoke run missing manifest: ${run.manifestPath ?? "null"}`);
  }

  console.log(`[jobs:smoke] status=${run.status}`);
  console.log(`[jobs:smoke] manifest=${run.manifestPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[jobs:smoke] failed: ${message}`);
  process.exit(1);
});

function safeResetJobsRoot(jobsRoot: string): void {
  if (existsSync(jobsRoot)) {
    rmSync(jobsRoot, { recursive: true, force: true });
  }
  mkdirSync(jobsRoot, { recursive: true });
}
