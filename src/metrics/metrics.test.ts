import { describe, expect, it } from "vitest";
import { computeDerivedMetrics, computeObjective, shannonEntropy } from "./metrics.js";

describe("metrics objective library", () => {
  it("computes first-player advantage from seat win rates", () => {
    const derived = computeDerivedMetrics({
      winRates: { "0": 0.6, "1": 0.3, draw: 0.1 },
      averageTurns: 12,
      actionDistribution: { a: 1 }
    });

    expect(derived.winRateBySeat).toEqual({ "0": 0.6, "1": 0.3 });
    expect(derived.drawRate).toBe(0.1);
    expect(derived.firstPlayerAdvantage).toBeCloseTo(0.15, 6);
  });

  it("computes shannon entropy deterministically", () => {
    expect(shannonEntropy({ only: 1 })).toBe(0);
    expect(shannonEntropy({ a: 0.5, b: 0.5 })).toBeCloseTo(1, 6);

    const derived = computeDerivedMetrics({
      winRates: { "0": 0.5, "1": 0.5 },
      averageTurns: 10,
      actionDistribution: { attack: 0.8, pass: 0.2 }
    });
    expect(derived.actionEntropy).toBeCloseTo(shannonEntropy({ attack: 0.8, pass: 0.2 }), 12);
  });

  it("objective score is monotonic for fairness and turn target distance", () => {
    const fair = computeObjective(
      {
        winRates: { "0": 0.5, "1": 0.5 },
        averageTurns: 20,
        actionDistribution: { x: 0.5, y: 0.5 }
      },
      {
        fairnessWeight: 1,
        firstPlayerWeight: 0,
        turnTargetWeight: 0,
        entropyWeight: 0,
        targetAvgTurns: 20
      }
    );
    const unfair = computeObjective(
      {
        winRates: { "0": 0.8, "1": 0.2 },
        averageTurns: 20,
        actionDistribution: { x: 0.5, y: 0.5 }
      },
      {
        fairnessWeight: 1,
        firstPlayerWeight: 0,
        turnTargetWeight: 0,
        entropyWeight: 0,
        targetAvgTurns: 20
      }
    );
    expect(unfair.score).toBeGreaterThan(fair.score);

    const onTarget = computeObjective(
      {
        winRates: { "0": 0.5, "1": 0.5 },
        averageTurns: 20,
        actionDistribution: { x: 0.5, y: 0.5 }
      },
      {
        fairnessWeight: 0,
        firstPlayerWeight: 0,
        turnTargetWeight: 1,
        entropyWeight: 0,
        targetAvgTurns: 20
      }
    );
    const farFromTarget = computeObjective(
      {
        winRates: { "0": 0.5, "1": 0.5 },
        averageTurns: 40,
        actionDistribution: { x: 0.5, y: 0.5 }
      },
      {
        fairnessWeight: 0,
        firstPlayerWeight: 0,
        turnTargetWeight: 1,
        entropyWeight: 0,
        targetAvgTurns: 20
      }
    );
    expect(farFromTarget.score).toBeGreaterThan(onTarget.score);
  });

  it("objective computation is deterministic for same inputs", () => {
    const input = {
      winRates: { "0": 0.52, "1": 0.41, draw: 0.07 },
      averageTurns: 18,
      actionDistribution: { take_tokens: 0.55, buy_card: 0.45 }
    };
    const config = {
      fairnessWeight: 1,
      firstPlayerWeight: 1,
      turnTargetWeight: 1,
      entropyWeight: 1,
      targetAvgTurns: 20
    };

    const first = computeObjective(input, config);
    const second = computeObjective(input, config);
    expect(first).toEqual(second);
  });
});
