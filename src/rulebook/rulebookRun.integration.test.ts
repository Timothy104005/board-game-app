import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runRulebookPipeline } from "./runRulebookPipeline.js";

function loadRulebook(name: string): string {
  return readFileSync(resolve(process.cwd(), "src", "rulebook", "examples", name), "utf8");
}

describe("rulebook run pipeline", () => {
  it("returns simulation summary and sample replay for recognized templates", () => {
    const result = runRulebookPipeline({
      text: loadRulebook("tictactoe.rulebook.txt"),
      seed: "pipeline-ttt",
      matches: 5,
      maxTurns: 20
    });

    expect(result.ok).toBe(true);
    expect(result.simulation).toBeDefined();
    expect(result.simulation?.summary.matches).toBe(5);
    expect(result.simulation?.sampleReplay.length).toBeGreaterThan(0);
  });

  it("returns failure and patch template for unknown templates", () => {
    const result = runRulebookPipeline({
      text: loadRulebook("unknown.rulebook.txt"),
      seed: "pipeline-unknown",
      matches: 5,
      maxTurns: 20
    });

    expect(result.ok).toBe(false);
    expect(result.gapReport.summary.errors).toBeGreaterThan(0);
    expect(result.patchTemplate.operations.length).toBeGreaterThan(0);
  });
});
