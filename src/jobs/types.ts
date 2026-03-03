import type { IRPatch } from "../ir/patch.js";
import type { BotsMode } from "../sim/botConfig.js";

export type JobType = "rulebook_run" | "rulebook_run_pdf" | "apply_patch" | "simulate" | "tune";
export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export interface RulebookRunPayload {
  rulebookText?: string;
  seed?: string;
  matches?: number;
  maxTurns?: number;
}

export interface RulebookRunPdfPayload {
  uploadId: string;
  pdfPath?: string;
  seed?: string;
  games?: number;
  maxTurns?: number;
}

export interface ApplyPatchPayload {
  irPath?: string;
  patch: IRPatch;
}

export interface SimulatePayload {
  irPath?: string;
  seed?: string;
  matches?: number;
  maxTurns?: number;
  botsMode?: BotsMode;
  poolSize?: number;
}

export interface TunePayload {
  irPath?: string;
  seed?: string;
  iterations?: number;
  candidatesPerIter?: number;
  matches?: number;
  maxTurns?: number;
  poolSize?: number;
  spaceId?: "mini_splendor";
}

export type JobPayload = RulebookRunPayload | RulebookRunPdfPayload | ApplyPatchPayload | SimulatePayload | TunePayload;

export interface ProjectRecord {
  id: string;
  name: string;
  rulebookText: string;
  seedDefault: string;
  createdAt: string;
  updatedAt: string;
  latestRunId: string | null;
  latestIrPath: string | null;
  latestReplayPath: string | null;
}

export interface RunRecord {
  id: string;
  projectId: string;
  jobType: JobType;
  status: RunStatus;
  payload: JobPayload;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  runDir: string;
  manifestPath: string | null;
}

export interface RunManifest {
  runId: string;
  projectId: string;
  jobType: JobType;
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  seed: string;
  config: Record<string, unknown>;
  artifacts: Record<string, string>;
  metrics?: Record<string, unknown>;
  notes?: string[];
  error?: string;
  sourceType?: "text" | "pdf";
  uploadId?: string;
  pdfSha256?: string;
}

export interface CreateProjectInput {
  name: string;
  rulebookText: string;
  seedDefault?: string;
}
