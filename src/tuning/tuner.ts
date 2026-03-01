import { type EvaluationCache, buildEvaluationCacheKey, createFileCache, resolveCodeVersion } from "../cache/cache.js";
import { type ObjectiveConfig, type ObjectiveResult } from "../metrics/types.js";
import { computeObjective } from "../metrics/metrics.js";
import { checkIR } from "../ir/checker.js";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import type { BatchMetrics } from "../sim/runBatch.js";
import { type BotsMode } from "../sim/botConfig.js";
import { runBatchParallel } from "../sim/runBatchParallel.js";
import { createPool, type WorkerPool } from "../sim/workerPool.js";
import { stableHash } from "../utils/stableHash.js";
import type { CandidatePatch, PatchSpace } from "./patchSpace.js";
import { evaluateCandidatesParallel, type CandidateEvalOutcome } from "./parallelEvaluate.js";

export interface TuneIRInput {
  baseIr: unknown;
  space: PatchSpace;
  seed: string;
  iterations: number;
  candidatesPerIter: number;
  simConfig: {
    matches: number;
    maxTurns: number;
  };
  objectiveConfig?: Partial<ObjectiveConfig>;
  stagnationPatience?: number;
  botsMode?: BotsMode;
  poolSize?: number;
  cacheDir?: string;
}

export interface TuneEvaluation {
  ir: GameIRv0;
  patch: CandidatePatch | null;
  metrics: BatchMetrics;
  objective: ObjectiveResult;
}

export interface TuneHistoryItem {
  iter: number;
  patchId: string;
  objective: number;
  keyMetrics: {
    avgTurns: number;
    firstPlayerAdvantage: number;
    drawRate: number;
  };
}

export interface TuneRejectedItem {
  iter: number;
  patchId: string;
  reason: string;
}

export interface TuneIRResult {
  baseline: TuneEvaluation;
  best: TuneEvaluation;
  history: TuneHistoryItem[];
  rejected: TuneRejectedItem[];
}

export async function tuneIR(input: TuneIRInput): Promise<TuneIRResult> {
  const parsedBase = gameIRv0Schema.parse(input.baseIr);
  const baseChecks = checkIR(parsedBase);
  if (baseChecks.errors.length > 0) {
    throw new Error(`Baseline IR check failed: ${baseChecks.errors.join(" | ")}`);
  }

  if (!input.space.canHandle(parsedBase)) {
    throw new Error(`Patch space '${input.space.id}' cannot handle base IR.`);
  }

  const poolSize = Math.max(1, Math.floor(input.poolSize ?? 1));
  const botsMode = input.botsMode ?? "auto";
  const cache = createFileCache({ rootDir: input.cacheDir ?? "artifacts/cache" });
  const codeVersion = resolveCodeVersion();
  const patience = input.stagnationPatience ?? input.iterations;
  const pool = poolSize > 1 ? createPool({ size: poolSize }) : undefined;

  try {
    const baselineBatch = await simulateCandidate({
      ir: parsedBase,
      seed: `${input.seed}|baseline`,
      simConfig: input.simConfig,
      botsMode,
      poolSize,
      cache,
      codeVersion,
      pool
    });
    const baselineObjective = computeObjective(baselineBatch.metrics, input.objectiveConfig);
    const baselineEvaluation: TuneEvaluation = {
      ir: parsedBase,
      patch: null,
      metrics: baselineBatch.metrics,
      objective: baselineObjective
    };

    let best = baselineEvaluation;
    const history: TuneHistoryItem[] = [];
    const rejected: TuneRejectedItem[] = [];
    let stagnantIterations = 0;

    for (let iter = 0; iter < input.iterations; iter += 1) {
      const proposals = input.space.propose(`${input.seed}|iter:${iter}`, parsedBase, input.candidatesPerIter);
      let improvedThisIteration = false;
      const outcomes =
        poolSize > 1
          ? await evaluateCandidatesParallel({
              baseIr: parsedBase,
              candidates: proposals,
              seed: input.seed,
              simConfig: input.simConfig,
              botsConfig: botsMode,
              poolSize,
              cache,
              objectiveConfig: input.objectiveConfig,
              iter,
              space: input.space,
              pool
            })
          : await evaluateSequentially({
              baseIr: parsedBase,
              candidates: proposals,
              seed: input.seed,
              simConfig: input.simConfig,
              botsConfig: botsMode,
              poolSize,
              cache,
              objectiveConfig: input.objectiveConfig,
              iter,
              space: input.space,
              pool
            });

      for (const outcome of outcomes) {
        if (outcome.kind === "rejected") {
          rejected.push({
            iter,
            patchId: outcome.candidate.id,
            reason: outcome.reason
          });
          continue;
        }

        history.push({
          iter,
          patchId: outcome.candidate.id,
          objective: outcome.objective.score,
          keyMetrics: {
            avgTurns: outcome.objective.derived.avgTurns,
            firstPlayerAdvantage: outcome.objective.derived.firstPlayerAdvantage,
            drawRate: outcome.objective.derived.drawRate
          }
        });

        if (outcome.objective.score < best.objective.score) {
          improvedThisIteration = true;
          best = {
            ir: outcome.ir,
            patch: outcome.candidate,
            metrics: outcome.metrics,
            objective: outcome.objective
          };
        }
      }

      if (improvedThisIteration) {
        stagnantIterations = 0;
      } else {
        stagnantIterations += 1;
        if (stagnantIterations >= patience) {
          break;
        }
      }
    }

    return {
      baseline: baselineEvaluation,
      best,
      history,
      rejected
    };
  } finally {
    if (pool) {
      await pool.shutdown();
    }
  }
}

async function evaluateSequentially(input: {
  baseIr: GameIRv0;
  candidates: CandidatePatch[];
  seed: string;
  simConfig: { matches: number; maxTurns: number };
  botsConfig: BotsMode;
  poolSize: number;
  cache: EvaluationCache;
  objectiveConfig?: Partial<ObjectiveConfig>;
  iter: number;
  space: PatchSpace;
  pool?: WorkerPool;
}) {
  const out: CandidateEvalOutcome[] = [];
  for (const candidate of input.candidates) {
    const [single] = await evaluateCandidatesParallel({
      ...input,
      candidates: [candidate]
    });
    out.push(single);
  }
  return out;
}

async function simulateCandidate(input: {
  ir: GameIRv0;
  seed: string;
  simConfig: { matches: number; maxTurns: number };
  botsMode: BotsMode;
  poolSize: number;
  cache: EvaluationCache;
  codeVersion?: string;
  pool?: WorkerPool;
}): Promise<{ metrics: BatchMetrics }> {
  const key = buildEvaluationCacheKey({
    irHash: stableHash(input.ir),
    seed: input.seed,
    botsConfig: input.botsMode,
    simConfig: input.simConfig,
    codeVersion: input.codeVersion
  });
  const cached = input.cache.get<{ metrics: BatchMetrics }>(key);
  if (cached?.metrics) {
    return { metrics: cached.metrics };
  }

  const batch = await runBatchParallel({
    ir: input.ir,
    seed: input.seed,
    matches: input.simConfig.matches,
    maxTurns: input.simConfig.maxTurns,
    bots: input.botsMode,
    poolSize: input.poolSize,
    pool: input.pool
  });
  input.cache.set(key, { metrics: batch.metrics });
  return { metrics: batch.metrics };
}
