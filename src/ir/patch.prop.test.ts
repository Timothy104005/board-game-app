import { test } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { checkIR } from "./checker.js";
import { applyPatch } from "./patch.js";
import { gameIRv0Schema } from "./schema.js";
import { FASTCHECK_PARAMETERS } from "../testing/fastCheckConfig.js";
import { irVariantArbitrary, patchOperationsArbitrary } from "../testing/arbitraries.js";

describe("IR patch fuzz", () => {
  test.prop([irVariantArbitrary, patchOperationsArbitrary], FASTCHECK_PARAMETERS)(
    "applyPatch never throws and post-state is processable",
    (baseIr, operations) => {
      expect(() => applyPatch(baseIr, { operations })).not.toThrow();
      const result = applyPatch(baseIr, { operations });

      const parsed = gameIRv0Schema.safeParse(result.next);
      if (parsed.success) {
        const checks = checkIR(parsed.data);
        expect(Array.isArray(checks.errors)).toBe(true);
        expect(Array.isArray(checks.warnings)).toBe(true);
      } else {
        expect(parsed.error.issues.length).toBeGreaterThan(0);
      }
    }
  );
});
