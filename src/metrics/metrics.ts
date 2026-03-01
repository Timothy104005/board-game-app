import type { BatchMetricsLike, DerivedMetrics, ObjectiveConfig, ObjectiveResult } from "./types.js";

export const DEFAULT_OBJECTIVE_CONFIG: ObjectiveConfig = {
  fairnessWeight: 1,
  firstPlayerWeight: 1,
  turnTargetWeight: 1,
  entropyWeight: 1,
  targetAvgTurns: 20
};

export function computeDerivedMetrics(batchMetrics: BatchMetricsLike): DerivedMetrics {
  const winRateBySeat = Object.fromEntries(
    Object.entries(batchMetrics.winRates).filter(([seat]) => seat !== "draw")
  ) as Record<string, number>;
  const seatRates = Object.values(winRateBySeat);
  const meanSeatWinRate = seatRates.length === 0 ? 0 : seatRates.reduce((sum, value) => sum + value, 0) / seatRates.length;
  const firstSeatWinRate = winRateBySeat["0"] ?? 0;

  return {
    winRateBySeat,
    drawRate: batchMetrics.winRates.draw ?? 0,
    avgTurns: batchMetrics.averageTurns,
    firstPlayerAdvantage: firstSeatWinRate - meanSeatWinRate,
    actionEntropy: shannonEntropy(batchMetrics.actionDistribution)
  };
}

export function computeObjective(
  batchMetrics: BatchMetricsLike,
  objectiveConfig: Partial<ObjectiveConfig> = {}
): ObjectiveResult {
  const config: ObjectiveConfig = {
    ...DEFAULT_OBJECTIVE_CONFIG,
    ...objectiveConfig
  };
  const derived = computeDerivedMetrics(batchMetrics);
  const seatRates = Object.values(derived.winRateBySeat);

  const fairnessPenalty = stddev(seatRates);
  const firstPlayerPenalty = Math.abs(derived.firstPlayerAdvantage);
  const turnPenalty = Math.abs(derived.avgTurns - config.targetAvgTurns) / Math.max(1, config.targetAvgTurns);
  const entropyPenalty = -derived.actionEntropy;

  const weightedFairness = config.fairnessWeight * fairnessPenalty;
  const weightedFirstPlayer = config.firstPlayerWeight * firstPlayerPenalty;
  const weightedTurn = config.turnTargetWeight * turnPenalty;
  const weightedEntropy = config.entropyWeight * entropyPenalty;

  return {
    score: weightedFairness + weightedFirstPlayer + weightedTurn + weightedEntropy,
    derived,
    breakdown: {
      fairnessPenalty,
      firstPlayerPenalty,
      turnPenalty,
      entropyPenalty,
      weightedFairness,
      weightedFirstPlayer,
      weightedTurn,
      weightedEntropy
    },
    config
  };
}

export function stddev(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => {
    const delta = value - mean;
    return sum + delta * delta;
  }, 0) / values.length;
  return Math.sqrt(variance);
}

export function shannonEntropy(distribution: Record<string, number>): number {
  let entropy = 0;
  for (const value of Object.values(distribution)) {
    if (value <= 0) {
      continue;
    }
    entropy += -value * Math.log2(value);
  }
  return entropy;
}
