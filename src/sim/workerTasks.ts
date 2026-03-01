import type { MatchResult } from "./runMatch.js";
import type { BotsMode } from "./botConfig.js";
import type { GameIRv0 } from "../ir/types.js";

export type WorkerTaskName = "runMatchBatch";

export interface RunMatchBatchPayload {
  ir: GameIRv0;
  seed: string;
  startIndex: number;
  endExclusive: number;
  maxTurns: number;
  bots: BotsMode;
}

export interface RunMatchBatchResult {
  startIndex: number;
  matches: MatchResult[];
  winCounts: Record<string, number>;
  actionCounts: Record<string, number>;
  totalTurns: number;
}

export interface WorkerRequest {
  id: number;
  taskName: WorkerTaskName;
  payload: unknown;
}

export interface WorkerSuccessResponse {
  id: number;
  ok: true;
  result: unknown;
}

export interface WorkerErrorResponse {
  id: number;
  ok: false;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
