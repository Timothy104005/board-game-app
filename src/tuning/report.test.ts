import { describe, expect, it } from "vitest";
import { generateTuningReport } from "./report.js";

describe("tuning report", () => {
  it("generates deterministic markdown and json for fixed input", () => {
    const input = buildInput();
    const first = generateTuningReport(input);
    const second = generateTuningReport(input);
    expect(first).toEqual(second);
    expect(stableHash(first.markdown)).toBe(stableHash(second.markdown));
  });

  it("markdown includes required sections and json contains required fields", () => {
    const output = generateTuningReport(buildInput());

    expect(output.markdown).toContain("## Baseline");
    expect(output.markdown).toContain("## Best Candidate");
    expect(output.markdown).toContain("## Objective Breakdown");
    expect(output.markdown).toContain("## Patch Ops");
    expect(output.markdown).toContain("## Reproducibility");

    expect(output.json).toHaveProperty("baseline");
    expect(output.json).toHaveProperty("best");
    expect(output.json).toHaveProperty("history");
    expect(output.json).toHaveProperty("config");
  });
});

function buildInput(): Parameters<typeof generateTuningReport>[0] {
  return {
    baseIrMeta: {
      id: "mini_splendor_ir",
      name: "Mini Splendor IR"
    },
    baseline: {
      ir: {
        meta: { id: "mini_splendor_ir", name: "Mini Splendor IR", playersMin: 2, playersMax: 2 },
        rng: { seedable: true },
        state: { public: {}, players: { "0": {}, "1": {} } },
        turn: { order: "round_robin", phases: ["main"] },
        actions: [{ kind: "take_tokens", params: { colors: ["white"] } }],
        end: { kind: "turn_limit", maxTurns: 50 },
        scoring: { kind: "per_player_points" }
      },
      patch: null,
      metrics: {
        matches: 20,
        winRates: { "0": 0.6, "1": 0.3, draw: 0.1 },
        averageTurns: 18,
        actionDistribution: { take_tokens: 0.7, buy_card: 0.3 }
      },
      objective: {
        score: 0.5,
        derived: {
          winRateBySeat: { "0": 0.6, "1": 0.3 },
          drawRate: 0.1,
          avgTurns: 18,
          firstPlayerAdvantage: 0.15,
          actionEntropy: 0.88
        },
        breakdown: {
          fairnessPenalty: 0.15,
          firstPlayerPenalty: 0.15,
          turnPenalty: 0.1,
          entropyPenalty: -0.88,
          weightedFairness: 0.15,
          weightedFirstPlayer: 0.15,
          weightedTurn: 0.1,
          weightedEntropy: -0.88
        },
        config: {
          fairnessWeight: 1,
          firstPlayerWeight: 1,
          turnTargetWeight: 1,
          entropyWeight: 1,
          targetAvgTurns: 20
        }
      }
    },
    best: {
      ir: {
        meta: { id: "mini_splendor_ir", name: "Mini Splendor IR", playersMin: 2, playersMax: 2 },
        rng: { seedable: true },
        state: { public: {}, players: { "0": {}, "1": {} } },
        turn: { order: "round_robin", phases: ["main"] },
        actions: [{ kind: "take_tokens", params: { colors: ["white"] } }],
        end: { kind: "turn_limit", maxTurns: 50 },
        scoring: { kind: "per_player_points" }
      },
      patch: {
        id: "mini_splendor_0",
        ops: [{ op: "set", path: "/state/public/tokenLimit", value: 9 }],
        meta: { reason: "test", seed: "seed", knobs: { tokenLimit: 9 } }
      },
      metrics: {
        matches: 20,
        winRates: { "0": 0.52, "1": 0.4, draw: 0.08 },
        averageTurns: 20,
        actionDistribution: { take_tokens: 0.55, buy_card: 0.45 }
      },
      objective: {
        score: 0.2,
        derived: {
          winRateBySeat: { "0": 0.52, "1": 0.4 },
          drawRate: 0.08,
          avgTurns: 20,
          firstPlayerAdvantage: 0.06,
          actionEntropy: 0.99
        },
        breakdown: {
          fairnessPenalty: 0.06,
          firstPlayerPenalty: 0.06,
          turnPenalty: 0,
          entropyPenalty: -0.99,
          weightedFairness: 0.06,
          weightedFirstPlayer: 0.06,
          weightedTurn: 0,
          weightedEntropy: -0.99
        },
        config: {
          fairnessWeight: 1,
          firstPlayerWeight: 1,
          turnTargetWeight: 1,
          entropyWeight: 1,
          targetAvgTurns: 20
        }
      }
    },
    history: [
      {
        iter: 0,
        patchId: "mini_splendor_0",
        objective: 0.2,
        keyMetrics: { avgTurns: 20, firstPlayerAdvantage: 0.06, drawRate: 0.08 }
      }
    ],
    config: {
      spaceId: "mini_splendor",
      seed: "42",
      iterations: 2,
      candidatesPerIter: 3,
      matches: 20,
      maxTurns: 80,
      botsMode: "auto"
    }
  };
}

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
