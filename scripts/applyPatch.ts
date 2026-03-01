import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkIR } from "../src/ir/checker.js";
import { applyPatch, type IRPatch } from "../src/ir/patch.js";
import { buildGapReport } from "../src/rulebook/gapReport.js";

const args = process.argv.slice(2);
const draftPathArg = getArgValue(args, "--draft");
const patchPathArg = getArgValue(args, "--patch");
const outPathArg = getArgValue(args, "--out");

if (!draftPathArg || !patchPathArg || !outPathArg) {
  console.error("Usage: tsx scripts/applyPatch.ts --draft <draft.json> --patch <patch.json> --out <out.json>");
  process.exit(1);
}

const draftPath = resolve(process.cwd(), draftPathArg);
const patchPath = resolve(process.cwd(), patchPathArg);
const outPath = resolve(process.cwd(), outPathArg);

const irDraft = JSON.parse(readFileSync(draftPath, "utf8")) as unknown;
const rawPatch = JSON.parse(readFileSync(patchPath, "utf8")) as { patchTemplate?: IRPatch } | IRPatch;
const patch = "operations" in rawPatch ? rawPatch : rawPatch.patchTemplate;

if (!patch || !Array.isArray(patch.operations)) {
  console.error("Patch file must contain operations or patchTemplate.operations.");
  process.exit(1);
}

const applied = applyPatch(irDraft, patch);
const checker = checkIR(applied.next);
const gaps = buildGapReport(applied.next, checker, {});

writeFileSync(outPath, `${JSON.stringify(applied.next, null, 2)}\n`);
writeFileSync(
  `${outPath}.checked.json`,
  `${JSON.stringify({ appliedOps: applied.appliedOps, patchErrors: applied.errors, checker }, null, 2)}\n`
);
writeFileSync(`${outPath}.gaps.json`, `${JSON.stringify(gaps, null, 2)}\n`);

console.log(`[applyPatch] out=${outPath}`);
console.log(`[applyPatch] appliedOps=${applied.appliedOps} patchErrors=${applied.errors.length}`);
console.log(`[applyPatch] checkerErrors=${checker.errors.length} checkerWarnings=${checker.warnings.length}`);

process.exit(applied.errors.length > 0 || checker.errors.length > 0 ? 1 : 0);

function getArgValue(argsList: string[], flag: string): string | undefined {
  const index = argsList.indexOf(flag);
  if (index < 0 || index + 1 >= argsList.length) {
    return undefined;
  }
  return argsList[index + 1];
}
