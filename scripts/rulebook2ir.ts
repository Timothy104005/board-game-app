import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { checkIR } from "../src/ir/checker.js";
import { draftIRFromRulebookText } from "../src/rulebook/draftIRFromText.js";
import { buildGapReport } from "../src/rulebook/gapReport.js";
import { suggestPatchTemplate } from "../src/rulebook/gapsToPatchTemplate.js";

const args = process.argv.slice(2);
const inputPath = getArgValue(args, "--in");
const outputDir = getArgValue(args, "--outDir") ?? "artifacts/rulebook_ir";

if (!inputPath) {
  console.error("Usage: tsx scripts/rulebook2ir.ts --in <path> --outDir <path>");
  process.exit(1);
}

const resolvedInput = resolve(process.cwd(), inputPath);
const resolvedOutputDir = resolve(process.cwd(), outputDir);
const text = readFileSync(resolvedInput, "utf8");

const drafted = draftIRFromRulebookText(text);
const checker = checkIR(drafted.irDraft);
const report = buildGapReport(drafted.irDraft, checker, drafted.debug);
const patchSuggestion = suggestPatchTemplate(drafted.irDraft, report.gaps);

mkdirSync(resolvedOutputDir, { recursive: true });

const base = removeExtension(basename(resolvedInput));
const draftPath = resolve(resolvedOutputDir, `${base}.ir.draft.json`);
const gapsPath = resolve(resolvedOutputDir, `${base}.gaps.json`);
const debugPath = resolve(resolvedOutputDir, `${base}.debug.json`);
const patchTemplatePath = resolve(resolvedOutputDir, `${base}.patch.template.json`);

writeFileSync(draftPath, `${JSON.stringify(drafted.irDraft, null, 2)}\n`);
writeFileSync(gapsPath, `${JSON.stringify({ gaps: report.gaps, summary: report.summary, notes: report.notes }, null, 2)}\n`);
writeFileSync(debugPath, `${JSON.stringify(drafted.debug, null, 2)}\n`);
writeFileSync(
  patchTemplatePath,
  `${JSON.stringify({ patchTemplate: patchSuggestion.patchTemplate, notes: patchSuggestion.notes }, null, 2)}\n`
);

const errorCount = report.summary.errors;
console.log(`[rb:2ir] input=${resolvedInput}`);
console.log(`[rb:2ir] draft=${draftPath}`);
console.log(`[rb:2ir] gaps=${gapsPath}`);
console.log(`[rb:2ir] debug=${debugPath}`);
console.log(`[rb:2ir] patchTemplate=${patchTemplatePath}`);
console.log(`[rb:2ir] errors=${report.summary.errors} warnings=${report.summary.warnings}`);

process.exit(errorCount > 0 ? 1 : 0);

function getArgValue(argsList: string[], flag: string): string | undefined {
  const index = argsList.indexOf(flag);
  if (index < 0 || index + 1 >= argsList.length) {
    return undefined;
  }
  return argsList[index + 1];
}

function removeExtension(fileName: string): string {
  const extension = extname(fileName);
  if (extension.length === 0) {
    return fileName;
  }
  return fileName.slice(0, -extension.length);
}
