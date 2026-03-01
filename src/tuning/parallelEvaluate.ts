import { type EvaluationCache, buildEvaluationCacheKey, resolveCodeVersion } from "../cache/cache.js";
import { checkIR } from "../ir/checker.js";
import { compileToGameModule } from "../ir/compileToGameModule.js";
import { applyPatch } from "../ir/patch.js";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import { computeObjective } from "../metrics/metrics.js";
import type { ObjectiveConfig, ObjectiveResult } from "../metrics/types.js";
import { runBatchParallel } from "../sim/runBatchParallel.js";
import type { WorkerPool } from "../sim/workerPool.js";
import { stableHash } from "../utils/stableHash.js";
import { toPatchOperations } from "./patchOps.js";
import type { CandidatePatch, PatchSpace } from "./patchSpace.js";
import type { BatchMetrics } from "../sim/runBatch.js";
import type { BotsMode } from "../sim/botConfig.js";

export interface CandidateEvalSuccess {
  kind: "evaluated";
  candidate: CandidatePatch;
  ir: GameIRv0;
  metrics: BatchMetrics;
  objective: ObjectiveResult;
}

export interface CandidateEvalRejected {
  kind: "rejected";
  candidate: CandidatePatch;
  reason: string;
}

export type CandidateEvalOutcome = CandidateEvalSuccess | CandidateEvalRejected;

export async function evaluateCandidatesParallel(input: {
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
}): Promise<Array<CandidateEvalOutcome>> {
  const codeVersion = resolveCodeVersion();
  const evaluations = await Promise.all(
    input.candidates.map(async (candidate): Promise<CandidateEvalOutcome> => {
      const castOps = toPatchOperations(candidate.ops);
      if (!castOps.ok) {
        return {
          kind: "rejected",
          candidate,
          reason: castOps.error
        };
      }

      const patchResult = applyPatch(input.baseIr, { operations: castOps.operations });
      if (patchResult.errors.length > 0) {
        return {
          kind: "rejected",
          candidate,
          reason: `patch errors: ${patchResult.errors.join(" | ")}`
        };
      }

      const parsedCandidate = gameIRv0Schema.safeParse(patchResult.next);
      if (!parsedCandidate.success) {
        return {
          kind: "rejected",
          candidate,
          reason: `schema parse failed: ${parsedCandidate.error.issues.map((issue) => issue.message).join(" | ")}`
        };
      }

      const candidateChecks = checkIR(parsedCandidate.data);
      if (candidateChecks.errors.length > 0) {
        return {
          kind: "rejected",
          candidate,
          reason: `checker failed: ${candidateChecks.errors.join(" | ")}`
        };
      }

      const constraints = input.space.constraints(input.baseIr, parsedCandidate.data);
      if (!constraints.ok) {
        return {
          kind: "rejected",
          candidate,
          reason: `constraints failed: ${constraints.errors.join(" | ")}`
        };
      }

      try {
        compileToGameModule(parsedCandidate.data);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          kind: "rejected",
          candidate,
          reason: `compile/sim failed: ${message}`
        };
      }

      const candidateSeed = `${input.seed}|iter:${input.iter}|cand:${candidate.id}`;
      const key = buildEvaluationCacheKey({
        irHash: stableHash(parsedCandidate.data),
        seed: candidateSeed,
        botsConfig: input.botsConfig,
        simConfig: input.simConfig,
        codeVersion
      });
      const cached = input.cache.get<{ metrics: BatchMetrics }>(key);
      const metrics =
        cached?.metrics ??
        (
          await runBatchParallel({
            ir: parsedCandidate.data,
            seed: candidateSeed,
            matches: input.simConfig.matches,
            maxTurns: input.simConfig.maxTurns,
            bots: input.botsConfig,
            poolSize: input.poolSize,
            pool: input.pool
          })
        ).metrics;

      if (!cached) {
        input.cache.set(key, { metrics });
      }

      const objective = computeObjective(metrics, input.objectiveConfig);
      return {
        kind: "evaluated",
        candidate,
        ir: parsedCandidate.data,
        metrics,
        objective
      };
    })
  );

  return evaluations.sort((a, b) => a.candidate.id.localeCompare(b.candidate.id));
}
