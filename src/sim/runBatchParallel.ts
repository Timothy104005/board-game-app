import { compileToGameModule } from "../ir/compileToGameModule.js";
import type { GameIRv0 } from "../ir/types.js";
import { resolveBotsForIR, type BotsMode } from "./botConfig.js";
import { runBatch, type BatchResult } from "./runBatch.js";
import { createPool, type WorkerPool } from "./workerPool.js";
import type { RunMatchBatchPayload, RunMatchBatchResult } from "./workerTasks.js";

export interface RunBatchParallelInput {
  ir: GameIRv0;
  seed: string;
  matches: number;
  maxTurns: number;
  bots: BotsMode;
  poolSize: number;
  pool?: WorkerPool;
}

export async function runBatchParallel(input: RunBatchParallelInput): Promise<BatchResult> {
  if (input.matches <= 0) {
    return {
      matches: [],
      metrics: {
        matches: 0,
        winRates: {},
        averageTurns: 0,
        actionDistribution: {}
      }
    };
  }

  const normalizedPoolSize = Math.max(1, Math.floor(input.poolSize));
  if (normalizedPoolSize <= 1 && !input.pool) {
    const game = compileToGameModule(input.ir);
    const bots = resolveBotsForIR(input.ir, input.bots);
    return runBatch({
      game,
      bots,
      seed: input.seed,
      matches: input.matches,
      maxTurns: input.maxTurns
    });
  }

  const ownedPool = input.pool ? null : createPool({ size: normalizedPoolSize });
  const pool = input.pool ?? ownedPool!;

  try {
    const ranges = buildRanges(input.matches, normalizedPoolSize);
    const partials = await Promise.all(
      ranges.map(([startIndex, endExclusive]) =>
        pool.runTask<RunMatchBatchPayload, RunMatchBatchResult>("runMatchBatch", {
          ir: input.ir,
          seed: input.seed,
          startIndex,
          endExclusive,
          maxTurns: input.maxTurns,
          bots: input.bots
        })
      )
    );

    return aggregateBatchResult(input.matches, partials);
  } finally {
    if (ownedPool) {
      await ownedPool.shutdown();
    }
  }
}

function buildRanges(totalMatches: number, poolSize: number): Array<[number, number]> {
  const chunkSize = Math.max(1, Math.ceil(totalMatches / poolSize));
  const ranges: Array<[number, number]> = [];

  for (let start = 0; start < totalMatches; start += chunkSize) {
    const endExclusive = Math.min(totalMatches, start + chunkSize);
    ranges.push([start, endExclusive]);
  }

  return ranges;
}

function aggregateBatchResult(matchesCount: number, partials: RunMatchBatchResult[]): BatchResult {
  const orderedPartials = [...partials].sort((a, b) => a.startIndex - b.startIndex);
  const matches = orderedPartials.flatMap((partial) => partial.matches);
  const winCounts: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};
  let totalTurns = 0;

  for (const partial of orderedPartials) {
    totalTurns += partial.totalTurns;
    for (const [winner, count] of Object.entries(partial.winCounts)) {
      winCounts[winner] = (winCounts[winner] ?? 0) + count;
    }
    for (const [actionType, count] of Object.entries(partial.actionCounts)) {
      actionCounts[actionType] = (actionCounts[actionType] ?? 0) + count;
    }
  }

  const totalActions = Object.values(actionCounts).reduce((sum, value) => sum + value, 0);
  const winRates = Object.fromEntries(
    Object.entries(winCounts).map(([key, count]) => [key, count / matchesCount])
  ) as Record<string, number>;
  const actionDistribution = Object.fromEntries(
    Object.entries(actionCounts).map(([key, count]) => [key, totalActions === 0 ? 0 : count / totalActions])
  ) as Record<string, number>;

  return {
    matches,
    metrics: {
      matches: matchesCount,
      winRates,
      averageTurns: matchesCount === 0 ? 0 : totalTurns / matchesCount,
      actionDistribution
    }
  };
}
