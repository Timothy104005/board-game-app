import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildEvaluationCacheKey, createFileCache } from "./cache.js";

describe("file cache", () => {
  it("sets and gets values", () => {
    const rootDir = resolve(process.cwd(), "artifacts", "cache_test_set_get");
    cleanup(rootDir);

    const cache = createFileCache({ rootDir });
    const key = "abc123";
    const value = { score: 1.234, metrics: { matches: 10 } };

    expect(cache.get<typeof value>(key)).toBeNull();
    cache.set(key, value);
    expect(cache.get<typeof value>(key)).toEqual(value);

    cleanup(rootDir);
  });

  it("builds deterministic keys", () => {
    const first = buildEvaluationCacheKey({
      irHash: "ir-hash",
      seed: "seed-42",
      botsConfig: { mode: "auto" },
      simConfig: { matches: 20, maxTurns: 80 },
      codeVersion: "abc"
    });
    const second = buildEvaluationCacheKey({
      irHash: "ir-hash",
      seed: "seed-42",
      botsConfig: { mode: "auto" },
      simConfig: { maxTurns: 80, matches: 20 },
      codeVersion: "abc"
    });

    expect(first).toBe(second);
  });

  it("returns identical payload on cache hit", () => {
    const rootDir = resolve(process.cwd(), "artifacts", "cache_test_hit");
    cleanup(rootDir);

    const cache = createFileCache({ rootDir });
    const key = buildEvaluationCacheKey({
      irHash: "ir",
      seed: "seed",
      botsConfig: { mode: "random_vs_random" },
      simConfig: { matches: 30, maxTurns: 16 }
    });
    const payload = {
      metrics: {
        matches: 30,
        winRates: { "0": 0.5, "1": 0.4, draw: 0.1 },
        averageTurns: 7.2,
        actionDistribution: { tictactoe_place: 1 }
      }
    };

    cache.set(key, payload);
    const hit = cache.get<typeof payload>(key);
    expect(hit).toEqual(payload);

    cleanup(rootDir);
  });
});

function cleanup(rootDir: string): void {
  if (existsSync(rootDir)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
}
