import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkIR } from "../ir/checker.js";
import { compileToGameModule } from "../ir/compileToGameModule.js";
import { draftIRFromRulebookText } from "./draftIRFromText.js";
import { buildGapReport } from "./gapReport.js";

const CASES = [
  "tictactoe.rulebook.txt",
  "mini_splendor.rulebook.txt",
  "connect4.rulebook.txt",
  "nim.rulebook.txt",
  "pig.rulebook.txt",
  "unknown.rulebook.txt"
];

describe("rulebook goldens", () => {
  for (const fileName of CASES) {
    it(`matches golden for ${fileName}`, () => {
      const text = readFileSync(resolve(process.cwd(), "src", "rulebook", "examples", fileName), "utf8");
      const drafted = draftIRFromRulebookText(text);
      const checker = checkIR(drafted.irDraft);
      const gapReport = buildGapReport(drafted.irDraft, checker, drafted.debug);

      let compiledMeta:
        | {
            id: string;
            name: string;
            initialLegalActionTypes: string[];
            initialLegalActionCount: number;
          }
        | null = null;

      try {
        const module = compileToGameModule(drafted.irDraft);
        const initial = module.createInitialState("golden-seed");
        const legal = module.legalActions(initial);
        compiledMeta = {
          id: module.id,
          name: module.name,
          initialLegalActionTypes: [...new Set(legal.map((action) => action.type))].sort(),
          initialLegalActionCount: legal.length
        };
      } catch {
        compiledMeta = null;
      }

      const actual = {
        recognizer: drafted.debug.selectedRecognizer,
        irDraft: drafted.irDraft,
        gapSummary: gapReport.summary,
        gaps: gapReport.gaps,
        checker,
        compiledMeta
      };

      const goldenName = fileName.replace(".rulebook.txt", ".golden.json");
      const expected = JSON.parse(
        readFileSync(resolve(process.cwd(), "src", "rulebook", "goldens", goldenName), "utf8")
      ) as unknown;

      expect(actual).toEqual(expected);
    });
  }
});
