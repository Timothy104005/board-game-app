import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkIR } from "../ir/checker.js";
import { applyPatch } from "../ir/patch.js";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import { miniSplendorSpace } from "./spaces/miniSplendorSpace.js";

function loadMiniSplendorFixture(): GameIRv0 {
  const fixturePath = resolve(process.cwd(), "src", "ir", "examples", "mini_splendor.ir.json");
  return gameIRv0Schema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("mini splendor patch space", () => {
  it("proposes deterministic candidates under fixed seed", () => {
    const base = loadMiniSplendorFixture();
    const first = miniSplendorSpace.propose("space-seed", base, 5);
    const second = miniSplendorSpace.propose("space-seed", base, 5);
    expect(first).toEqual(second);
  });

  it("generated candidates apply and pass schema/checker", () => {
    const base = loadMiniSplendorFixture();
    const candidates = miniSplendorSpace.propose("space-apply", base, 4);
    expect(candidates.length).toBe(4);

    for (const candidate of candidates) {
      const patchResult = applyPatch(base, { operations: candidate.ops });
      expect(patchResult.errors).toEqual([]);

      const parsed = gameIRv0Schema.parse(patchResult.next);
      const checks = checkIR(parsed);
      expect(checks.errors).toEqual([]);

      const constraints = miniSplendorSpace.constraints(base, parsed);
      expect(constraints.ok).toBe(true);
      expect(constraints.errors).toEqual([]);
    }
  });

  it("generated knobs stay within bounds and cardPool size remains unchanged", () => {
    const base = loadMiniSplendorFixture();
    const basePoolSize = (base.state.public.cardPool as unknown[]).length;
    const candidates = miniSplendorSpace.propose("space-bounds", base, 6);

    for (const candidate of candidates) {
      for (const op of candidate.ops) {
        if (op.path === "/state/public/tokenLimit") {
          expect(typeof op.value).toBe("number");
          expect(op.value as number).toBeGreaterThanOrEqual(8);
          expect(op.value as number).toBeLessThanOrEqual(12);
        }
        if (op.path === "/end") {
          const end = op.value as { kind: string; target: number };
          expect(end.kind).toBe("score_at_least");
          expect(end.target).toBeGreaterThanOrEqual(10);
          expect(end.target).toBeLessThanOrEqual(20);
        }
      }

      const patchResult = applyPatch(base, { operations: candidate.ops });
      const parsed = gameIRv0Schema.parse(patchResult.next);
      const candidatePoolSize = (parsed.state.public.cardPool as unknown[]).length;
      expect(candidatePoolSize).toBe(basePoolSize);
    }
  });
});
