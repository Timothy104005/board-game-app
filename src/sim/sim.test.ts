import { describe, expect, it } from "vitest";
import { createGreedyBot } from "../bots/greedyBot.js";
import { createRandomBot } from "../bots/randomBot.js";
import { gameRegistry } from "../games/index.js";
import { runBatch } from "./runBatch.js";

describe("simulation runner", () => {
  it("is deterministic under fixed seed", () => {
    const game = gameRegistry.tictactoe;
    const bots = {
      "0": createGreedyBot("greedy"),
      "1": createRandomBot("random")
    };

    const first = runBatch({
      game,
      bots,
      seed: "sim-deterministic",
      matches: 5,
      maxTurns: 16
    });
    const second = runBatch({
      game,
      bots,
      seed: "sim-deterministic",
      matches: 5,
      maxTurns: 16
    });

    expect(first.metrics).toEqual(second.metrics);
    expect(stableHash(first.matches)).toBe(stableHash(second.matches));
  });

  it("batch win rates sum to one", () => {
    const game = gameRegistry.splendor;
    const bots = {
      "0": createGreedyBot("greedy"),
      "1": createRandomBot("random")
    };

    const batch = runBatch({
      game,
      bots,
      seed: "sim-winrates",
      matches: 8,
      maxTurns: 40
    });

    const total = Object.values(batch.metrics.winRates).reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThan(0.999999);
    expect(total).toBeLessThan(1.000001);
  });
});

function stableHash(value: unknown): string {
  return fnv1a(stableStringify(value));
}

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
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
  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }
  if (typeof value === "function" || typeof value === "symbol") {
    return JSON.stringify(String(value));
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}
