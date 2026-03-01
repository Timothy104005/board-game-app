import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileToGameModule } from "../ir/compileToGameModule.js";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import { stableHash } from "../utils/stableHash.js";
import { resolveBotsForIR } from "./botConfig.js";
import { runBatch } from "./runBatch.js";
import { runBatchParallel } from "./runBatchParallel.js";

function loadFixture(): GameIRv0 {
  const fixturePath = resolve(process.cwd(), "src", "ir", "examples", "tictactoe.ir.json");
  return gameIRv0Schema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("parallel simulation batch", () => {
  it(
    "matches serial metrics and replay hash for fixed seed",
    async () => {
      const ir = loadFixture();
      const game = compileToGameModule(ir);
      const bots = resolveBotsForIR(ir, "greedy_vs_random");
      const serial = runBatch({
        game,
        bots,
        seed: "parallel-parity",
        matches: 40,
        maxTurns: 16
      });

      const parallel2 = await runBatchParallel({
        ir,
        seed: "parallel-parity",
        matches: 40,
        maxTurns: 16,
        bots: "greedy_vs_random",
        poolSize: 2
      });
      const parallel4 = await runBatchParallel({
        ir,
        seed: "parallel-parity",
        matches: 40,
        maxTurns: 16,
        bots: "greedy_vs_random",
        poolSize: 4
      });

      for (const candidate of [parallel2, parallel4]) {
        expect(candidate.metrics.winRates).toEqual(serial.metrics.winRates);
        expect(candidate.metrics.averageTurns).toBe(serial.metrics.averageTurns);
        expect(candidate.metrics.actionDistribution).toEqual(serial.metrics.actionDistribution);
        expect(stableHash(candidate.matches[0]?.replayLog ?? [])).toBe(stableHash(serial.matches[0]?.replayLog ?? []));
      }
    },
    10000
  );
});
