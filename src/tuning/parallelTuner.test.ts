import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import { stableHash } from "../utils/stableHash.js";
import { miniSplendorSpace } from "./spaces/miniSplendorSpace.js";
import { tuneIR } from "./tuner.js";

function loadMiniSplendorFixture(): GameIRv0 {
  const fixturePath = resolve(process.cwd(), "src", "ir", "examples", "mini_splendor.ir.json");
  return gameIRv0Schema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("parallel tuner", () => {
  it(
    "matches serial best patch under fixed seed",
    async () => {
      const base = loadMiniSplendorFixture();
      const serial = await tuneIR({
        baseIr: base,
        space: miniSplendorSpace,
        seed: "parallel-tuner",
        iterations: 2,
        candidatesPerIter: 4,
        simConfig: { matches: 20, maxTurns: 80 },
        stagnationPatience: 2,
        poolSize: 1
      });
      const parallel = await tuneIR({
        baseIr: base,
        space: miniSplendorSpace,
        seed: "parallel-tuner",
        iterations: 2,
        candidatesPerIter: 4,
        simConfig: { matches: 20, maxTurns: 80 },
        stagnationPatience: 2,
        poolSize: 2
      });

      expect(parallel.best.patch?.id ?? null).toBe(serial.best.patch?.id ?? null);
      expect(parallel.best.objective.score).toBe(serial.best.objective.score);
    },
    15000
  );

  it(
    "is deterministic across repeated parallel runs",
    async () => {
      const base = loadMiniSplendorFixture();
      const first = await tuneIR({
        baseIr: base,
        space: miniSplendorSpace,
        seed: "parallel-tuner-det",
        iterations: 2,
        candidatesPerIter: 4,
        simConfig: { matches: 20, maxTurns: 80 },
        stagnationPatience: 2,
        poolSize: 2
      });
      const second = await tuneIR({
        baseIr: base,
        space: miniSplendorSpace,
        seed: "parallel-tuner-det",
        iterations: 2,
        candidatesPerIter: 4,
        simConfig: { matches: 20, maxTurns: 80 },
        stagnationPatience: 2,
        poolSize: 2
      });

      expect(first.best.patch?.id ?? null).toBe(second.best.patch?.id ?? null);
      expect(stableHash(first.history)).toBe(stableHash(second.history));
      expect(stableHash(first.rejected)).toBe(stableHash(second.rejected));
    },
    15000
  );
});
