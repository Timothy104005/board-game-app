import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createProject, enqueue, getRun } from "../src/jobs/queue.js";
import { runWorkerDaemon } from "../src/jobs/worker.js";
import { getJobsRoot, getRepoRoot, resolveArtifactsPath } from "../src/paths.js";

interface EnqueuedRun {
  runId: string;
  projectId: string;
  projectName: string;
  jobType: string;
}

interface ExampleSpec {
  name: string;
  file: string;
}

const EXAMPLES: ExampleSpec[] = [
  { name: "tictactoe", file: "tictactoe.rulebook.txt" },
  { name: "pig", file: "pig.rulebook.txt" },
  { name: "nim", file: "nim.rulebook.txt" },
  { name: "connect4", file: "connect4.rulebook.txt" },
  { name: "mini_splendor", file: "mini_splendor.rulebook.txt" },
  { name: "unknown", file: "unknown.rulebook.txt" }
];

async function main(): Promise<void> {
  const repoRoot = getRepoRoot();
  const jobsRoot = getJobsRoot();
  const timestamp = formatTimestamp(new Date());
  const outDir = resolveArtifactsPath("schoolday", timestamp);
  mkdirSync(outDir, { recursive: true });

  resetJobsRoot(jobsRoot);
  const enqueued: EnqueuedRun[] = [];
  const projectsByName: Record<string, string> = {};

  for (const spec of EXAMPLES) {
    const rulebookPath = resolve(repoRoot, "src", "rulebook", "examples", spec.file);
    const rulebookText = readFileSync(rulebookPath, "utf8");
    const project = createProject({
      name: `schoolday-${spec.name}`,
      rulebookText,
      seedDefault: "42"
    });
    projectsByName[spec.name] = project.id;

    const runId = enqueue("rulebook_run", project.id, {
      seed: "42",
      matches: 50,
      maxTurns: 120
    });
    enqueued.push({
      runId,
      projectId: project.id,
      projectName: project.name,
      jobType: "rulebook_run"
    });
  }

  const miniSplendorProjectId = projectsByName.mini_splendor;
  if (miniSplendorProjectId) {
    const tuneRunId = enqueue("tune", miniSplendorProjectId, {
      seed: "42",
      iterations: 20,
      candidatesPerIter: 20,
      matches: 200,
      maxTurns: 200,
      poolSize: 2,
      spaceId: "mini_splendor"
    });
    enqueued.push({
      runId: tuneRunId,
      projectId: miniSplendorProjectId,
      projectName: "schoolday-mini_splendor",
      jobType: "tune"
    });

    const simRunId = enqueue("simulate", miniSplendorProjectId, {
      seed: "42",
      matches: 2000,
      maxTurns: 200,
      poolSize: 2
    });
    enqueued.push({
      runId: simRunId,
      projectId: miniSplendorProjectId,
      projectName: "schoolday-mini_splendor",
      jobType: "simulate"
    });
  }

  const pigProjectId = projectsByName.pig;
  if (pigProjectId) {
    const simRunId = enqueue("simulate", pigProjectId, {
      seed: "42",
      matches: 2000,
      maxTurns: 200,
      poolSize: 2
    });
    enqueued.push({
      runId: simRunId,
      projectId: pigProjectId,
      projectName: "schoolday-pig",
      jobType: "simulate"
    });
  }

  await runWorkerDaemon({
    once: true,
    pollIntervalMs: 200,
    maxParallelPoolSize: 2
  });

  const runSummaries = enqueued.map((entry) => {
    const run = getRun(entry.runId);
    if (!run) {
      throw new Error(`run missing after worker completed: ${entry.runId}`);
    }
    if (run.status === "queued" || run.status === "running") {
      throw new Error(`run did not complete: ${run.id} status=${run.status}`);
    }
    if (!run.manifestPath) {
      throw new Error(`run missing manifestPath: ${run.id}`);
    }
    const manifestAbs = resolve(repoRoot, run.manifestPath);
    if (!existsSync(manifestAbs)) {
      throw new Error(`manifest file not found: ${run.manifestPath}`);
    }
    return {
      ...entry,
      status: run.status,
      error: run.error,
      manifestPath: run.manifestPath,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt
    };
  });

  const summary = {
    timestamp,
    seed: "42",
    outDir: outDir.replace(/\\/g, "/"),
    jobsRoot: jobsRoot.replace(/\\/g, "/"),
    projectsByName,
    runCount: runSummaries.length,
    runs: runSummaries
  };
  const summaryPath = resolve(outDir, "summary.json");
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`[verify:schoolday] summary=${summaryPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify:schoolday] failed: ${message}`);
  process.exit(1);
});

function resetJobsRoot(jobsRoot: string): void {
  if (existsSync(jobsRoot)) {
    rmSync(jobsRoot, { recursive: true, force: true });
  }
  mkdirSync(jobsRoot, { recursive: true });
}

function formatTimestamp(date: Date): string {
  const y = date.getFullYear().toString();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}
