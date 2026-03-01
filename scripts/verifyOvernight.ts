import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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

const args = process.argv.slice(2);
const outDir = getArgValue(args, "--outDir") ?? "artifacts/overnight";
const repoRoot = process.cwd();
const timestamp = formatTimestamp(new Date());
const runRoot = resolve(repoRoot, outDir, timestamp);
const logsDir = resolve(runRoot, "logs");

mkdirSync(logsDir, { recursive: true });

const commandSpecs = buildCommandSpecs();
const results: CommandResult[] = [];

for (let i = 0; i < commandSpecs.length; i += 1) {
  const spec = commandSpecs[i];
  const result = runCommand(spec, i + 1, logsDir);
  results.push(result);
}

const manifest = {
  timestamp,
  gitCommit: resolveGitCommit(),
  nodeVersion: process.version,
  commands: commandSpecs.map((spec) => joinCommand(spec.command, spec.args)),
  results,
  overallPass: results.every((result) => result.passed),
  keyMetrics: collectKeyMetrics()
};

const manifestPath = resolve(runRoot, "manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[verify:overnight] runRoot=${runRoot}`);
console.log(`[verify:overnight] manifest=${manifestPath}`);
console.log(`[verify:overnight] overallPass=${manifest.overallPass}`);

process.exit(manifest.overallPass ? 0 : 1);

function buildCommandSpecs(): CommandSpec[] {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const rbScripts = Object.keys(packageJson.scripts ?? {})
    .filter((name) => name.startsWith("rb:run:"))
    .sort((a, b) => a.localeCompare(b));

  const specs: CommandSpec[] = [
    {
      id: "test",
      command: "npm",
      args: ["test"],
      expectedExitCode: 0
    },
    {
      id: "sim_tictactoe_500",
      command: "npm",
      args: ["run", "sim:tictactoe", "--", "overnight-ttt", "500", "32"],
      expectedExitCode: 0
    },
    {
      id: "sim_splendor_500",
      command: "npm",
      args: ["run", "sim:splendor", "--", "overnight-splendor", "500", "120"],
      expectedExitCode: 0
    },
    {
      id: "tune_smoke",
      command: "npm",
      args: ["run", "tune:smoke"],
      expectedExitCode: 0
    },
    {
      id: "tune_splendor_medium",
      command: "npx",
      args: [
        "tsx",
        "scripts/tune.ts",
        "--ir",
        "src/ir/examples/mini_splendor.ir.json",
        "--space",
        "mini_splendor",
        "--seed",
        "42",
        "--iters",
        "10",
        "--cand",
        "30",
        "--matches",
        "200",
        "--maxTurns",
        "200"
      ],
      expectedExitCode: 0
    }
  ];

  for (const scriptName of rbScripts) {
    specs.push({
      id: scriptName.replace(/:/g, "_"),
      command: "npm",
      args: ["run", scriptName],
      expectedExitCode: 0
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

function collectKeyMetrics(): Record<string, unknown> {
  return {
    sim: {
      tictactoe: loadSimMetrics("tictactoe-overnight-ttt.json"),
      splendor: loadSimMetrics("splendor-overnight-splendor.json")
    },
    tuning: collectTuningSummaries(),
    rulebook: collectRulebookSummaries()
  };
}

function loadSimMetrics(fileName: string): Record<string, unknown> | null {
  const fullPath = resolve(repoRoot, "artifacts", "replays", fileName);
  if (!existsSync(fullPath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(fullPath, "utf8")) as {
    metrics?: {
      winRates?: Record<string, number>;
      averageTurns?: number;
      actionDistribution?: Record<string, number>;
    };
  };

  return {
    winRates: parsed.metrics?.winRates ?? {},
    averageTurns: parsed.metrics?.averageTurns ?? null,
    actionDistribution: parsed.metrics?.actionDistribution ?? {}
  };
}

function collectTuningSummaries(): Record<string, unknown> {
  const tuningRoot = resolve(repoRoot, "artifacts", "tuning");
  if (!existsSync(tuningRoot)) {
    return {};
  }

  const reportPaths = listFilesByName(tuningRoot, "report.json").sort((a, b) => {
    const aTime = statSync(a).mtimeMs;
    const bTime = statSync(b).mtimeMs;
    return aTime - bTime;
  });
  const latest = reportPaths.slice(-2);
  const summaries: Record<string, unknown> = {};
  for (let i = 0; i < latest.length; i += 1) {
    const reportPath = latest[i];
    const parsed = JSON.parse(readFileSync(reportPath, "utf8")) as {
      baseline?: { objectiveScore?: number };
      best?: { objectiveScore?: number };
      objectiveDelta?: number;
    };
    summaries[`report_${i + 1}`] = {
      path: toRelative(reportPath),
      baselineObjective: parsed.baseline?.objectiveScore ?? null,
      bestObjective: parsed.best?.objectiveScore ?? null,
      objectiveDelta: parsed.objectiveDelta ?? null
    };
  }
  return summaries;
}

function collectRulebookSummaries(): Record<string, unknown> {
  const root = resolve(repoRoot, "artifacts", "rulebook_run");
  if (!existsSync(root)) {
    return {};
  }
  const summaryFiles = listFilesBySuffix(root, ".sim.summary.json").sort((a, b) => a.localeCompare(b));

  const summaries: Record<string, unknown> = {};
  for (const fullPath of summaryFiles) {
    const parsed = JSON.parse(readFileSync(fullPath, "utf8")) as {
      winRates?: Record<string, number>;
      averageTurns?: number;
    };
    summaries[toRelative(fullPath)] = {
      winRates: parsed.winRates ?? {},
      averageTurns: parsed.averageTurns ?? null
    };
  }
  return summaries;
}

function resolveGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unknown";
  }
}

function getArgValue(argsList: string[], flag: string): string | undefined {
  const index = argsList.indexOf(flag);
  if (index < 0 || index + 1 >= argsList.length) {
    return undefined;
  }
  return argsList[index + 1];
}

function joinCommand(command: string, argsList: string[]): string {
  return [command, ...argsList].join(" ");
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

function listFilesByName(rootDir: string, fileName: string): string[] {
  const out: string[] = [];
  walk(rootDir, (fullPath) => {
    if (fullPath.endsWith(`\\${fileName}`) || fullPath.endsWith(`/${fileName}`)) {
      out.push(fullPath);
    }
  });
  return out;
}

function listFilesBySuffix(rootDir: string, suffix: string): string[] {
  const out: string[] = [];
  walk(rootDir, (fullPath) => {
    if (fullPath.endsWith(suffix)) {
      out.push(fullPath);
    }
  });
  return out;
}

function walk(rootDir: string, onFile: (fullPath: string) => void): void {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(rootDir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, onFile);
    } else if (entry.isFile()) {
      onFile(fullPath);
    }
  }
}
