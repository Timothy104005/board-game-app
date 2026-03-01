import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import type { PatchSpace } from "./patchSpace.js";
import { miniSplendorSpace } from "./spaces/miniSplendorSpace.js";
import { tuneIR } from "./tuner.js";

function loadMiniSplendorFixture(): GameIRv0 {
  const fixturePath = resolve(process.cwd(), "src", "ir", "examples", "mini_splendor.ir.json");
  return gameIRv0Schema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
}

describe("tuner", () => {
  it("is deterministic under fixed inputs", () => {
    const base = loadMiniSplendorFixture();
    const first = tuneIR({
      baseIr: base,
      space: miniSplendorSpace,
      seed: "tuner-det",
      iterations: 2,
      candidatesPerIter: 3,
      simConfig: { matches: 10, maxTurns: 40 },
      stagnationPatience: 2
    });
    const second = tuneIR({
      baseIr: base,
      space: miniSplendorSpace,
      seed: "tuner-det",
      iterations: 2,
      candidatesPerIter: 3,
      simConfig: { matches: 10, maxTurns: 40 },
      stagnationPatience: 2
    });

    expect(first.best.patch?.id ?? null).toBe(second.best.patch?.id ?? null);
    expect(stableHash(first.history)).toBe(stableHash(second.history));
    expect(first.best.objective.score).toBe(second.best.objective.score);
  });

  it("returns baseline and chooses best objective no worse than baseline", () => {
    const base = loadMiniSplendorFixture();
    const result = tuneIR({
      baseIr: base,
      space: miniSplendorSpace,
      seed: "tuner-smoke",
      iterations: 2,
      candidatesPerIter: 3,
      simConfig: { matches: 10, maxTurns: 40 },
      stagnationPatience: 2
    });

    expect(result.baseline.metrics.matches).toBe(10);
    expect(result.best.objective.score).toBeLessThanOrEqual(result.baseline.objective.score);
    expect(Array.isArray(result.history)).toBe(true);
    expect(Array.isArray(result.rejected)).toBe(true);
  });

  it("records rejected candidates deterministically without throwing", () => {
    const base = loadMiniSplendorFixture();
    const invalidSpace: PatchSpace = {
      id: "invalid-space",
      canHandle: () => true,
      propose: () => [
        {
          id: "bad-merge",
          ops: [{ op: "merge", path: "/state/public", value: "not-an-object" }],
          meta: { reason: "force reject", seed: "x", knobs: {} }
        }
      ],
      constraints: () => ({ ok: true, errors: [] })
    };

    const result = tuneIR({
      baseIr: base,
      space: invalidSpace,
      seed: "tuner-reject",
      iterations: 1,
      candidatesPerIter: 1,
      simConfig: { matches: 5, maxTurns: 20 },
      stagnationPatience: 1
    });

    expect(result.rejected.length).toBeGreaterThan(0);
    expect(result.rejected[0].patchId).toBe("bad-merge");
    expect(result.best.objective.score).toBe(result.baseline.objective.score);
  });
});

function stableHash(value: unknown): string {
  return fnv1a(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "undefined") {
    return '"__undefined__"';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
