import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { compileToGameModule } from "../ir/compileToGameModule.js";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import { FASTCHECK_PARAMETERS } from "../testing/fastCheckConfig.js";
import { seedArbitrary } from "../testing/arbitraries.js";
import { stableHash } from "../utils/stableHash.js";
import { resolveBotsForIR } from "./botConfig.js";
import { runBatch } from "./runBatch.js";

function loadFixture(): GameIRv0 {
  const fixturePath = resolve(process.cwd(), "src", "ir", "examples", "tictactoe.ir.json");
  return gameIRv0Schema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("simulation determinism fuzz", () => {
  test.prop([seedArbitrary], FASTCHECK_PARAMETERS)("same seed keeps replay hash stable", (seed) => {
    const ir = loadFixture();
    const game = compileToGameModule(ir);
    const bots = resolveBotsForIR(ir, "greedy_vs_random");

    const first = runBatch({
      game,
      bots,
      seed,
      matches: 6,
      maxTurns: 16
    });
    const second = runBatch({
      game,
      bots,
      seed,
      matches: 6,
      maxTurns: 16
    });

    expect(first.metrics).toEqual(second.metrics);
    expect(stableHash(first.matches[0]?.replayLog ?? [])).toBe(stableHash(second.matches[0]?.replayLog ?? []));
  });
});
