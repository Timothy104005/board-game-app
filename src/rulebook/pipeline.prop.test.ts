import { test } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { FASTCHECK_PARAMETERS } from "../testing/fastCheckConfig.js";
import { rulebookTextArbitrary, seedArbitrary } from "../testing/arbitraries.js";
import { draftIRFromRulebookText } from "./draftIRFromText.js";

describe("rulebook pipeline fuzz", () => {
  test.prop([rulebookTextArbitrary, seedArbitrary], FASTCHECK_PARAMETERS)(
    "draftIRFromRulebookText never throws and returns stable shape",
    (text, seedId) => {
      expect(() => draftIRFromRulebookText(text, { seedId })).not.toThrow();
      const result = draftIRFromRulebookText(text, { seedId });

      expect(result).toHaveProperty("irDraft");
      expect(Array.isArray(result.gaps)).toBe(true);
      expect(result.debug).toBeTypeOf("object");
      expect(result.debug).not.toBeNull();
    }
  );
});
