import { test } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { assertNoDeadEnd, type EngineForInvariants } from "../engine/invariantGate.js";
import { FASTCHECK_PARAMETERS } from "../testing/fastCheckConfig.js";
import { irVariantArbitrary, seedArbitrary } from "../testing/arbitraries.js";
import { compileToGameModule, type CompiledAction, type CompiledState } from "./compileToGameModule.js";

describe("IR compiler fuzz", () => {
  test.prop([irVariantArbitrary, seedArbitrary], FASTCHECK_PARAMETERS)(
    "compileToGameModule does not throw for generated variants",
    (ir, seed) => {
      expect(() => compileToGameModule(ir)).not.toThrow();
      const module = compileToGameModule(ir);
      const engine: EngineForInvariants<CompiledState, CompiledAction> = {
        legalActions: module.legalActions,
        applyAction: module.applyAction,
        isTerminal: module.isTerminal,
        score: module.score
      };

      expect(() => assertNoDeadEnd(engine, module.createInitialState, { seed, maxDepth: 1 })).not.toThrow();
    },
    15000
  );
});
