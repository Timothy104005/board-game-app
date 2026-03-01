import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { runRulebookPipeline } from "../src/rulebook/runRulebookPipeline.js";

const args = process.argv.slice(2);
const inputPath = getArgValue(args, "--in");
const seed = getArgValue(args, "--seed") ?? "42";
const matches = parsePositiveInt(getArgValue(args, "--games"), 20);
const maxTurns = parsePositiveInt(getArgValue(args, "--maxTurns"), 80);
const outDir = getArgValue(args, "--outDir") ?? "artifacts/rulebook_run";

if (!inputPath) {
  console.error("Usage: tsx scripts/rulebookRun.ts --in <rulebook.txt> --seed 42 --games 100 --maxTurns 80 --outDir <dir>");
  process.exit(1);
}

const resolvedInput = resolve(process.cwd(), inputPath);
const resolvedOutDir = resolve(process.cwd(), outDir);
mkdirSync(resolvedOutDir, { recursive: true });

const text = readFileSync(resolvedInput, "utf8");
const result = runRulebookPipeline({
  text,
  seed,
  matches,
  maxTurns
});

const base = removeExtension(basename(resolvedInput));
const irPath = resolve(resolvedOutDir, `${base}.ir.json`);
const gapsPath = resolve(resolvedOutDir, `${base}.gaps.json`);
const patchPath = resolve(resolvedOutDir, `${base}.patch.template.json`);

writeFileSync(irPath, `${JSON.stringify(result.irDraft, null, 2)}\n`);
writeFileSync(gapsPath, `${JSON.stringify(result.gapReport, null, 2)}\n`);
writeFileSync(patchPath, `${JSON.stringify({ patchTemplate: result.patchTemplate }, null, 2)}\n`);

if (result.ok && result.simulation) {
  const summaryPath = resolve(resolvedOutDir, `${base}.sim.summary.json`);
  const replayPath = resolve(resolvedOutDir, `${base}.replay.sample.json`);
  writeFileSync(summaryPath, `${JSON.stringify(result.simulation.summary, null, 2)}\n`);
  writeFileSync(replayPath, `${JSON.stringify(result.simulation.sampleReplay, null, 2)}\n`);
}

console.log(`[rb:run] input=${resolvedInput}`);
console.log(`[rb:run] ir=${irPath}`);
console.log(`[rb:run] gaps=${gapsPath}`);
console.log(`[rb:run] patchTemplate=${patchPath}`);
console.log(`[rb:run] ok=${result.ok}`);

process.exit(result.ok ? 0 : 1);

function getArgValue(argsList: string[], flag: string): string | undefined {
  const index = argsList.indexOf(flag);
  if (index < 0 || index + 1 >= argsList.length) {
    return undefined;
  }
  return argsList[index + 1];
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function removeExtension(fileName: string): string {
  const extension = extname(fileName);
  if (extension.length === 0) {
    return fileName;
  }
  return fileName.slice(0, -extension.length);
}
