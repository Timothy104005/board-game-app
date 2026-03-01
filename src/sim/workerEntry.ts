import { parentPort } from "node:worker_threads";
import { compileToGameModule } from "../ir/compileToGameModule.ts";
import { runMatch } from "./runMatch.ts";
import { resolveBotsForIR } from "./botConfig.ts";
import type { WorkerRequest, WorkerResponse, RunMatchBatchPayload, RunMatchBatchResult } from "./workerTasks.ts";

if (!parentPort) {
  throw new Error("worker entry requires parentPort");
}

parentPort.on("message", (request: WorkerRequest) => {
  handleRequest(request)
    .then((response) => {
      parentPort.postMessage(response);
    })
    .catch((error) => {
      const response: WorkerResponse = {
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
      parentPort.postMessage(response);
    });
});

async function handleRequest(request: WorkerRequest): Promise<WorkerResponse> {
  if (request.taskName !== "runMatchBatch") {
    return {
      id: request.id,
      ok: false,
      error: `unsupported task '${request.taskName}'`
    };
  }

  const payload = request.payload as RunMatchBatchPayload;
  const result = runMatchBatch(payload);
  return {
    id: request.id,
    ok: true,
    result
  };
}

function runMatchBatch(payload: RunMatchBatchPayload): RunMatchBatchResult {
  const game = compileToGameModule(payload.ir);
  const bots = resolveBotsForIR(payload.ir, payload.bots);
  const matches: RunMatchBatchResult["matches"] = [];
  const winCounts: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};
  let totalTurns = 0;

  for (let i = payload.startIndex; i < payload.endExclusive; i += 1) {
    const result = runMatch({
      game,
      bots,
      seed: `${payload.seed}|${i}`,
      maxTurns: payload.maxTurns
    });
    matches.push(result);
    totalTurns += result.metrics.turnCount;

    const winnerKey = result.winner ?? "draw";
    winCounts[winnerKey] = (winCounts[winnerKey] ?? 0) + 1;

    for (const [actionType, count] of Object.entries(result.metrics.actionCounts)) {
      actionCounts[actionType] = (actionCounts[actionType] ?? 0) + count;
    }
  }

  return {
    startIndex: payload.startIndex,
    matches,
    winCounts,
    actionCounts,
    totalTurns
  };
}
