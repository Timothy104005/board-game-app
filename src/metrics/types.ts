import type { BatchMetrics } from "../sim/runBatch.js";

export interface DerivedMetrics {
  winRateBySeat: Record<string, number>;
  drawRate: number;
  avgTurns: number;
  firstPlayerAdvantage: number;
  actionEntropy: number;
}

export interface ObjectiveConfig {
  fairnessWeight: number;
  firstPlayerWeight: number;
  turnTargetWeight: number;
  entropyWeight: number;
  targetAvgTurns: number;
}

export interface ObjectiveBreakdown {
  fairnessPenalty: number;
  firstPlayerPenalty: number;
  turnPenalty: number;
  entropyPenalty: number;
  weightedFairness: number;
  weightedFirstPlayer: number;
  weightedTurn: number;
  weightedEntropy: number;
}

export interface ObjectiveResult {
  score: number;
  derived: DerivedMetrics;
  breakdown: ObjectiveBreakdown;
  config: ObjectiveConfig;
}

export type BatchMetricsLike = Pick<BatchMetrics, "winRates" | "averageTurns" | "actionDistribution">;
