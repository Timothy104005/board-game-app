import { createGreedyBot } from "../bots/greedyBot.js";
import { createRandomBot } from "../bots/randomBot.js";
import type { Bot } from "../bots/types.js";
import { type ObjectiveConfig, type ObjectiveResult } from "../metrics/types.js";
import { computeObjective } from "../metrics/metrics.js";
import { checkIR } from "../ir/checker.js";
import { compileToGameModule } from "../ir/compileToGameModule.js";
import type { IRPatchOperation } from "../ir/patch.js";
import { applyPatch } from "../ir/patch.js";
import { gameIRv0Schema } from "../ir/schema.js";
import type { GameIRv0 } from "../ir/types.js";
import { runBatch, type BatchMetrics } from "../sim/runBatch.js";
import type { CandidatePatch, PatchSpace } from "./patchSpace.js";

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
  botsMode?: "auto" | "greedy_vs_random" | "random_vs_random";
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

export function tuneIR(input: TuneIRInput): TuneIRResult {
  const parsedBase = gameIRv0Schema.parse(input.baseIr);
  const baseChecks = checkIR(parsedBase);
  if (baseChecks.errors.length > 0) {
    throw new Error(`Baseline IR check failed: ${baseChecks.errors.join(" | ")}`);
  }

  if (!input.space.canHandle(parsedBase)) {
    throw new Error(`Patch space '${input.space.id}' cannot handle base IR.`);
  }

  const baselineBatch = simulateCandidate({
    ir: parsedBase,
    seed: `${input.seed}|baseline`,
    simConfig: input.simConfig,
    botsMode: input.botsMode ?? "auto"
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
  const patience = input.stagnationPatience ?? input.iterations;
  let stagnantIterations = 0;

  for (let iter = 0; iter < input.iterations; iter += 1) {
    const proposals = input.space.propose(`${input.seed}|iter:${iter}`, parsedBase, input.candidatesPerIter);
    let improvedThisIteration = false;

    for (const candidate of proposals) {
      const castOps = toPatchOperations(candidate.ops);
      if (!castOps.ok) {
        rejected.push({
          iter,
          patchId: candidate.id,
          reason: castOps.error
        });
        continue;
      }

      const patchResult = applyPatch(parsedBase, { operations: castOps.operations });
      if (patchResult.errors.length > 0) {
        rejected.push({
          iter,
          patchId: candidate.id,
          reason: `patch errors: ${patchResult.errors.join(" | ")}`
        });
        continue;
      }

      const parsedCandidate = gameIRv0Schema.safeParse(patchResult.next);
      if (!parsedCandidate.success) {
        rejected.push({
          iter,
          patchId: candidate.id,
          reason: `schema parse failed: ${parsedCandidate.error.issues.map((issue) => issue.message).join(" | ")}`
        });
        continue;
      }

      const candidateChecks = checkIR(parsedCandidate.data);
      if (candidateChecks.errors.length > 0) {
        rejected.push({
          iter,
          patchId: candidate.id,
          reason: `checker failed: ${candidateChecks.errors.join(" | ")}`
        });
        continue;
      }

      const constraints = input.space.constraints(parsedBase, parsedCandidate.data);
      if (!constraints.ok) {
        rejected.push({
          iter,
          patchId: candidate.id,
          reason: `constraints failed: ${constraints.errors.join(" | ")}`
        });
        continue;
      }

      let simulated: { metrics: BatchMetrics };
      try {
        simulated = simulateCandidate({
          ir: parsedCandidate.data,
          seed: `${input.seed}|iter:${iter}|cand:${candidate.id}`,
          simConfig: input.simConfig,
          botsMode: input.botsMode ?? "auto"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rejected.push({
          iter,
          patchId: candidate.id,
          reason: `compile/sim failed: ${message}`
        });
        continue;
      }

      const objective = computeObjective(simulated.metrics, input.objectiveConfig);
      history.push({
        iter,
        patchId: candidate.id,
        objective: objective.score,
        keyMetrics: {
          avgTurns: objective.derived.avgTurns,
          firstPlayerAdvantage: objective.derived.firstPlayerAdvantage,
          drawRate: objective.derived.drawRate
        }
      });

      if (objective.score < best.objective.score) {
        improvedThisIteration = true;
        best = {
          ir: parsedCandidate.data,
          patch: candidate,
          metrics: simulated.metrics,
          objective
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
}

function simulateCandidate(input: {
  ir: GameIRv0;
  seed: string;
  simConfig: { matches: number; maxTurns: number };
  botsMode: "auto" | "greedy_vs_random" | "random_vs_random";
}): { metrics: BatchMetrics } {
  const game = compileToGameModule(input.ir);
  const bots = chooseBots(input.ir, input.botsMode);
  const batch = runBatch({
    game,
    bots,
    seed: input.seed,
    matches: input.simConfig.matches,
    maxTurns: input.simConfig.maxTurns
  });
  return { metrics: batch.metrics };
}

function chooseBots(ir: GameIRv0, mode: "auto" | "greedy_vs_random" | "random_vs_random"): { "0": Bot; "1": Bot } {
  if (mode === "greedy_vs_random") {
    return {
      "0": createGreedyBot("greedy"),
      "1": createRandomBot("random")
    };
  }
  if (mode === "random_vs_random") {
    return {
      "0": createRandomBot("random0"),
      "1": createRandomBot("random1")
    };
  }

  const actionKinds = ir.actions.map((action) => action.kind);
  const useGreedy = actionKinds.some(
    (kind) => kind === "tictactoe_place" || kind === "take_tokens" || kind === "buy_card"
  );

  if (useGreedy) {
    return {
      "0": createGreedyBot("greedy"),
      "1": createRandomBot("random")
    };
  }
  return {
    "0": createRandomBot("random0"),
    "1": createRandomBot("random1")
  };
}

function toPatchOperations(ops: CandidatePatch["ops"]):
  | { ok: true; operations: IRPatchOperation[] }
  | { ok: false; error: string } {
  const operations: IRPatchOperation[] = [];
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (op.op === "set") {
      operations.push({
        op: "set",
        path: op.path,
        value: op.value
      });
      continue;
    }
    if (op.op === "append") {
      operations.push({
        op: "append",
        path: op.path,
        value: op.value
      });
      continue;
    }
    if (!op.value || typeof op.value !== "object" || Array.isArray(op.value)) {
      return { ok: false, error: `invalid merge op at index ${i}` };
    }
    operations.push({
      op: "merge",
      path: op.path,
      value: op.value as Record<string, unknown>
    });
  }
  return { ok: true, operations };
}
