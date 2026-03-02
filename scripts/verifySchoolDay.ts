import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createProject, enqueue, getRun, listProjects, listRuns } from "../src/jobs/queue.js";

interface EnqueuedRun {
  runId: string;
  projectId: string;
  jobType: string;
}

const timestamp = formatTimestamp(new Date());
const outDir = resolve(process.cwd(), "artifacts", "schoolday", timestamp);
mkdirSync(outDir, { recursive: true });

const commandResults: Array<{ command: string; exitCode: number }> = [];
const enqueued: EnqueuedRun[] = [];

const testResult = spawnSync("npm", ["test"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: true
});
commandResults.push({
  command: "npm test",
  exitCode: testResult.status ?? -1
});
if ((testResult.status ?? 1) !== 0) {
  failAndExit("npm test failed");
}

const workerProc = spawn("npm run jobs:worker", {
  cwd: process.cwd(),
  shell: true,
  stdio: "inherit"
});

const projectsByName = ensureSchooldayProjects();
const projectIds = Object.values(projectsByName);
for (const projectId of projectIds) {
  const runId = enqueue("rulebook_run", projectId, {
    seed: "42",
    matches: 50,
    maxTurns: 120
  });
  enqueued.push({ runId, projectId, jobType: "rulebook_run" });
}

const miniSplendorProjectId = projectsByName.mini_splendor;
if (miniSplendorProjectId) {
  const tuneRunId = enqueue("tune", miniSplendorProjectId, {
    seed: "42",
    iterations: 50,
    candidatesPerIter: 50,
    matches: 500,
    maxTurns: 200,
    poolSize: 2,
    spaceId: "mini_splendor"
  });
  enqueued.push({ runId: tuneRunId, projectId: miniSplendorProjectId, jobType: "tune" });
}

if (miniSplendorProjectId) {
  const simSplendor = enqueue("simulate", miniSplendorProjectId, {
    seed: "42",
    matches: 5000,
    maxTurns: 200,
    poolSize: 2
  });
  enqueued.push({ runId: simSplendor, projectId: miniSplendorProjectId, jobType: "simulate" });
}

const pigProjectId = projectsByName.pig;
if (pigProjectId) {
  const simPig = enqueue("simulate", pigProjectId, {
    seed: "42",
    matches: 5000,
    maxTurns: 200,
    poolSize: 2
  });
  enqueued.push({ runId: simPig, projectId: pigProjectId, jobType: "simulate" });
}

waitForCompletion(enqueued.map((entry) => entry.runId))
  .then((statuses) => {
    const summary = {
      timestamp,
      commandResults,
      enqueued,
      statuses,
      runsByProject: Object.fromEntries(projectIds.map((projectId) => [projectId, listRuns(projectId)]))
    };
    const summaryPath = resolve(outDir, "summary.json");
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`[verify:schoolday] summary=${summaryPath}`);
    workerProc.kill("SIGTERM");
    process.exit(0);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    workerProc.kill("SIGTERM");
    failAndExit(message);
  });

function ensureSchooldayProjects(): Record<string, string> {
  const examples: Array<{ name: string; file: string }> = [
    { name: "tictactoe", file: "tictactoe.rulebook.txt" },
    { name: "pig", file: "pig.rulebook.txt" },
    { name: "nim", file: "nim.rulebook.txt" },
    { name: "connect4", file: "connect4.rulebook.txt" },
    { name: "mini_splendor", file: "mini_splendor.rulebook.txt" },
    { name: "unknown", file: "unknown.rulebook.txt" }
  ];

  const projectsByName: Record<string, string> = {};
  for (const entry of examples) {
    const text = readFileSync(resolve(process.cwd(), "src", "rulebook", "examples", entry.file), "utf8");
    const existing = findProjectIdByName(`schoolday-${entry.name}`);
    if (existing) {
      projectsByName[entry.name] = existing;
      continue;
    }
    const projectId = enqueueProject(`schoolday-${entry.name}`, text);
    projectsByName[entry.name] = projectId;
  }
  return projectsByName;
}

function enqueueProject(name: string, rulebookText: string): string {
  const project = createProject({
    name,
    rulebookText,
    seedDefault: "42"
  });
  return project.id as string;
}

function findProjectIdByName(name: string): string | null {
  const project = listProjects().find((entry) => entry.name === name);
  return project?.id ?? null;
}

async function waitForCompletion(runIds: string[]): Promise<Record<string, string>> {
  const statuses: Record<string, string> = {};
  const deadline = Date.now() + 1000 * 60 * 60 * 12;
  while (Date.now() < deadline) {
    let allDone = true;
    for (const runId of runIds) {
      const run = getRun(runId);
      const status = run?.status ?? "missing";
      statuses[runId] = status;
      if (status === "queued" || status === "running") {
        allDone = false;
      }
    }
    if (allDone) {
      return statuses;
    }
    await sleep(1000);
  }
  throw new Error("verify:schoolday timed out waiting for jobs");
}

function failAndExit(message: string): never {
  const summaryPath = resolve(outDir, "summary.json");
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        timestamp,
        commandResults,
        enqueued,
        error: message
      },
      null,
      2
    )}\n`
  );
  console.error(`[verify:schoolday] failed: ${message}`);
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
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
