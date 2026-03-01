import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkIR } from "../ir/checker.js";
import { draftIRFromRulebookText } from "./draftIRFromText.js";
import { buildGapReport } from "./gapReport.js";
import { suggestPatchTemplate } from "./gapsToPatchTemplate.js";

describe("gaps to patch template", () => {
  it("builds a non-empty patch template for unknown rulebook errors", () => {
    const rulebookPath = resolve(process.cwd(), "src", "rulebook", "examples", "unknown.rulebook.txt");
    const text = readFileSync(rulebookPath, "utf8");

    const drafted = draftIRFromRulebookText(text, { seedId: "unknown_patch" });
    const checker = checkIR(drafted.irDraft);
    const report = buildGapReport(drafted.irDraft, checker, drafted.debug);
    const suggestion = suggestPatchTemplate(drafted.irDraft, report.gaps);

    expect(report.summary.errors).toBeGreaterThan(0);
    expect(suggestion.patchTemplate.operations.length).toBeGreaterThan(0);
    expect(suggestion.notes.length).toBeGreaterThan(0);
  });
});
