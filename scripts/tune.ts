import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateTuningReport } from "../src/tuning/report.js";
import { miniSplendorSpace } from "../src/tuning/spaces/miniSplendorSpace.js";
import { tuneIR } from "../src/tuning/tuner.js";

const args = process.argv.slice(2);
const irPath = getArgValue(args, "--ir");
const spaceId = getArgValue(args, "--space") ?? "mini_splendor";
const seed = getArgValue(args, "--seed") ?? "42";
const iterations = parsePositiveInt(getArgValue(args, "--iters"), 30);
const candidatesPerIter = parsePositiveInt(getArgValue(args, "--cand"), 20);
const matches = parsePositiveInt(getArgValue(args, "--matches"), 200);
const maxTurns = parsePositiveInt(getArgValue(args, "--maxTurns"), 200);
const stagnationPatience = parsePositiveInt(getArgValue(args, "--stagnation"), iterations);

if (!irPath) {
  console.error(
    "Usage: tsx scripts/tune.ts --ir <path> --space mini_splendor --seed 42 --iters 30 --cand 20 --matches 200 --maxTurns 200"
  );
  process.exit(1);
}

const space = resolveSpace(spaceId);
if (!space) {
  console.error(`Unsupported patch space: ${spaceId}`);
  process.exit(1);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[tune] failed: ${message}`);
  process.exit(1);
});

async function run(): Promise<void> {
  const fullIrPath = resolve(process.cwd(), irPath);
  const baseIr = JSON.parse(readFileSync(fullIrPath, "utf8")) as unknown;

  const result = await tuneIR({
    baseIr,
    space,
    seed,
    iterations,
    candidatesPerIter,
    simConfig: { matches, maxTurns },
    stagnationPatience,
    botsMode: "auto"
  });

  const timestamp = formatTimestamp(new Date());
  const outDir = resolve(process.cwd(), "artifacts", "tuning", timestamp);
  mkdirSync(outDir, { recursive: true });

  const report = generateTuningReport({
    baseIrMeta: {
      id: result.baseline.ir.meta.id,
      name: result.baseline.ir.meta.name
    },
    baseline: result.baseline,
    best: result.best,
    history: result.history,
    config: {
      spaceId: space.id,
      seed,
      iterations,
      candidatesPerIter,
      matches,
      maxTurns,
      botsMode: "auto"
    }
  });

  const bestPatch = result.best.patch
    ? {
        id: result.best.patch.id,
        operations: result.best.patch.ops,
        meta: result.best.patch.meta
      }
    : {
        id: null,
        operations: [],
        meta: { reason: "baseline selected", seed, knobs: {} }
      };

  writeFileSync(resolve(outDir, "report.md"), `${report.markdown}\n`);
  writeFileSync(resolve(outDir, "report.json"), `${JSON.stringify(report.json, null, 2)}\n`);
  writeFileSync(resolve(outDir, "best.patch.json"), `${JSON.stringify(bestPatch, null, 2)}\n`);
  writeFileSync(resolve(outDir, "best.ir.json"), `${JSON.stringify(result.best.ir, null, 2)}\n`);

  console.log(`[tune] ir=${fullIrPath}`);
  console.log(`[tune] space=${space.id}`);
  console.log(`[tune] baselineObjective=${result.baseline.objective.score.toFixed(6)}`);
  console.log(`[tune] bestObjective=${result.best.objective.score.toFixed(6)}`);
  console.log(`[tune] outDir=${outDir}`);
  process.exit(0);
}

function resolveSpace(spaceName: string): typeof miniSplendorSpace | null {
  if (spaceName === "mini_splendor") {
    return miniSplendorSpace;
  }
  return null;
}

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

function formatTimestamp(date: Date): string {
  const y = date.getFullYear().toString();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}
