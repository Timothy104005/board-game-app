import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync, spawnSync } from "node:child_process";

interface CommandSpec {
  id: string;
  command: string;
  args: string[];
  expectedExitCode: number;
}

interface CommandResult {
  id: string;
  command: string;
  exitCode: number;
  expectedExitCode: number;
  passed: boolean;
  durationMs: number;
  logPath: string;
}

const npmCmd = "npm";
const npxCmd = "npx";
const timestamp = formatTimestamp(new Date());
const repoRoot = process.cwd();
const runRoot = resolve(repoRoot, "artifacts", "soak", timestamp);
const logsDir = resolve(runRoot, "logs");
const simDir = resolve(runRoot, "sim");
const rulebookRunDir = resolve(runRoot, "rulebook_run");

mkdirSync(logsDir, { recursive: true });
mkdirSync(simDir, { recursive: true });
mkdirSync(rulebookRunDir, { recursive: true });

const gitCommit = resolveGitCommit();
const commandSpecs: CommandSpec[] = buildCommandSpecs(rulebookRunDir);
const results: CommandResult[] = [];

for (let i = 0; i < commandSpecs.length; i += 1) {
  const spec = commandSpecs[i];
  const result = runCommand(spec, i + 1, logsDir);
  results.push(result);
}

const keyMetrics = collectKeyMetrics(simDir, rulebookRunDir);
const summary = {
  timestamp,
  gitCommit,
  commandsExecuted: commandSpecs.map((spec) => joinCommand(spec.command, spec.args)),
  results,
  overallPass: results.every((result) => result.passed),
  keyMetrics
};

const summaryPath = resolve(runRoot, "summary.json");
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(`[verify:soak] runRoot=${runRoot}`);
console.log(`[verify:soak] summary=${summaryPath}`);
console.log(`[verify:soak] overallPass=${summary.overallPass}`);

process.exit(summary.overallPass ? 0 : 1);

function buildCommandSpecs(outputDir: string): CommandSpec[] {
  const specs: CommandSpec[] = [
    {
      id: "test",
      command: npmCmd,
      args: ["test"],
      expectedExitCode: 0
    },
    {
      id: "sim_tictactoe",
      command: npmCmd,
      args: ["run", "sim:tictactoe", "--", "soak-ttt", "200", "32"],
      expectedExitCode: 0
    },
    {
      id: "sim_splendor",
      command: npmCmd,
      args: ["run", "sim:splendor", "--", "soak-splendor", "200", "120"],
      expectedExitCode: 0
    }
  ];

  const rulebooks = [
    { id: "rb_tictactoe", file: "tictactoe.rulebook.txt", expectedExitCode: 0 },
    { id: "rb_pig", file: "pig.rulebook.txt", expectedExitCode: 0 },
    { id: "rb_nim", file: "nim.rulebook.txt", expectedExitCode: 0 },
    { id: "rb_connect4", file: "connect4.rulebook.txt", expectedExitCode: 0 },
    { id: "rb_mini_splendor", file: "mini_splendor.rulebook.txt", expectedExitCode: 0 },
    { id: "rb_unknown", file: "unknown.rulebook.txt", expectedExitCode: 1 }
  ];

  for (const rulebook of rulebooks) {
    specs.push({
      id: rulebook.id,
      command: npxCmd,
      args: [
        "tsx",
        "scripts/rulebookRun.ts",
        "--in",
        `src/rulebook/examples/${rulebook.file}`,
        "--seed",
        "soak-seed",
        "--games",
        "40",
        "--maxTurns",
        "120",
        "--outDir",
        outputDir
      ],
      expectedExitCode: rulebook.expectedExitCode
    });
  }

  return specs;
}

function runCommand(spec: CommandSpec, index: number, logDir: string): CommandResult {
  const startedAt = Date.now();
  const commandString = joinCommand(spec.command, spec.args);
  const proc = spawnSync(commandString, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true
  });
  const durationMs = Date.now() - startedAt;

  const exitCode = typeof proc.status === "number" ? proc.status : proc.error ? -1 : 0;
  const passed = exitCode === spec.expectedExitCode;

  const logPath = resolve(logDir, `${String(index).padStart(2, "0")}-${spec.id}.log`);
  writeFileSync(
    logPath,
    [
      `command: ${commandString}`,
      `exitCode: ${exitCode}`,
      `expectedExitCode: ${spec.expectedExitCode}`,
      `passed: ${passed}`,
      `durationMs: ${durationMs}`,
      "",
      "[stdout]",
      proc.stdout ?? "",
      "",
      "[stderr]",
      proc.stderr ?? "",
      proc.error ? `\n[error]\n${String(proc.error)}` : ""
    ].join("\n")
  );

  return {
    id: spec.id,
    command: commandString,
    exitCode,
    expectedExitCode: spec.expectedExitCode,
    passed,
    durationMs,
    logPath: toRelative(logPath)
  };
}

function collectKeyMetrics(simOutDir: string, rulebookOutDir: string): Record<string, unknown> {
  const simMetrics = {
    tictactoe: loadSimMetrics("tictactoe-soak-ttt.json", simOutDir),
    splendor: loadSimMetrics("splendor-soak-splendor.json", simOutDir)
  };

  const rulebookMetrics = {
    tictactoe: loadRulebookSummary("tictactoe.rulebook.sim.summary.json", rulebookOutDir),
    pig: loadRulebookSummary("pig.rulebook.sim.summary.json", rulebookOutDir),
    nim: loadRulebookSummary("nim.rulebook.sim.summary.json", rulebookOutDir),
    connect4: loadRulebookSummary("connect4.rulebook.sim.summary.json", rulebookOutDir),
    mini_splendor: loadRulebookSummary("mini_splendor.rulebook.sim.summary.json", rulebookOutDir)
  };

  return {
    sim: simMetrics,
    rulebookRuns: rulebookMetrics
  };
}

function loadSimMetrics(fileName: string, simOutDir: string): Record<string, unknown> | null {
  const sourcePath = resolve(repoRoot, "artifacts", "replays", fileName);
  if (!existsSync(sourcePath)) {
    return null;
  }
  const copiedPath = resolve(simOutDir, fileName);
  copyFileSync(sourcePath, copiedPath);

  const parsed = JSON.parse(readFileSync(sourcePath, "utf8")) as {
    metrics?: { winRates?: Record<string, number>; averageTurns?: number };
  };
  return {
    winRates: parsed.metrics?.winRates ?? {},
    averageTurns: parsed.metrics?.averageTurns ?? null
  };
}

function loadRulebookSummary(fileName: string, rulebookOutDir: string): Record<string, unknown> | null {
  const fullPath = resolve(rulebookOutDir, fileName);
  if (!existsSync(fullPath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(fullPath, "utf8")) as {
    winRates?: Record<string, number>;
    averageTurns?: number;
  };
  return {
    winRates: parsed.winRates ?? {},
    averageTurns: parsed.averageTurns ?? null
  };
}

function resolveGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();
  } catch {
    return "unknown";
  }
}

function joinCommand(command: string, args: string[]): string {
  return [command, ...args].join(" ");
}

function toRelative(pathValue: string): string {
  return pathValue.replace(`${repoRoot}\\`, "").replace(/\\/g, "/");
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
