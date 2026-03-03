import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { checkIR } from "../ir/checker.js";
import { compileToGameModule } from "../ir/compileToGameModule.js";
import { applyPatch } from "../ir/patch.js";
import { getRepoRoot, isPathInsideRepo, toRepoRelativePath } from "../paths.js";
import type { GameIRv0 } from "../ir/types.js";
import { getUploadExtractedTextPath, getUploadPdfPath, isValidUploadId } from "../rulebook/pdfArtifacts.js";
import { extractTextFromPdfBuffer } from "../rulebook/pdfExtract.js";
import { buildGapReport } from "../rulebook/gapReport.js";
import { runRulebookPipeline } from "../rulebook/runRulebookPipeline.js";
import { runBatchParallel } from "../sim/runBatchParallel.js";
import { generateTuningReport } from "../tuning/report.js";
import { miniSplendorSpace } from "../tuning/spaces/miniSplendorSpace.js";
import { tuneIR } from "../tuning/tuner.js";
import { stableStringify } from "../utils/stableJson.js";
import type {
  ApplyPatchPayload,
  JobType,
  ProjectRecord,
  RulebookRunPdfPayload,
  RulebookRunPayload,
  RunManifest,
  RunRecord,
  SimulatePayload,
  TunePayload
} from "./types.js";

export interface ExecutionInput {
  run: RunRecord;
  project: ProjectRecord;
  maxParallelPoolSize: number;
  log: (line: string) => void;
}

export interface ExecutionResult {
  ok: boolean;
  manifest: RunManifest;
  projectPatch?: Partial<Pick<ProjectRecord, "latestIrPath" | "latestReplayPath">>;
}

export async function executeRun(input: ExecutionInput): Promise<ExecutionResult> {
  switch (input.run.jobType) {
    case "rulebook_run":
      return executeRulebookRun(input);
    case "rulebook_run_pdf":
      return executeRulebookRunPdf(input);
    case "apply_patch":
      return executeApplyPatch(input);
    case "simulate":
      return executeSimulate(input);
    case "tune":
      return executeTune(input);
    default: {
      const neverJob: never = input.run.jobType;
      throw new Error(`unsupported job type: ${String(neverJob)}`);
    }
  }
}

async function executeRulebookRun(input: ExecutionInput): Promise<ExecutionResult> {
  const payload = input.run.payload as RulebookRunPayload;
  const seed = payload.seed ?? input.project.seedDefault;
  const matches = payload.matches ?? 20;
  const maxTurns = payload.maxTurns ?? 80;
  const rulebookText = payload.rulebookText ?? input.project.rulebookText;
  input.log(`[rulebook_run] seed=${seed} matches=${matches} maxTurns=${maxTurns}`);

  const result = runRulebookPipeline({
    text: rulebookText,
    seed,
    matches,
    maxTurns
  });

  const irPath = writeJson(input.run.runDir, "rulebook.ir.json", result.irDraft);
  const gapsPath = writeJson(input.run.runDir, "rulebook.gaps.json", result.gapReport);
  const patchPath = writeJson(input.run.runDir, "rulebook.patch.template.json", {
    patchTemplate: result.patchTemplate
  });

  const artifacts: Record<string, string> = {
    ir: irPath,
    gaps: gapsPath,
    patchTemplate: patchPath
  };

  let replayPath: string | null = null;
  if (result.simulation) {
    artifacts.simSummary = writeJson(input.run.runDir, "rulebook.sim.summary.json", result.simulation.summary);
    replayPath = writeJson(input.run.runDir, "rulebook.replay.sample.json", result.simulation.sampleReplay);
    artifacts.sampleReplay = replayPath;
  }

  const manifest: RunManifest = {
    runId: input.run.id,
    projectId: input.project.id,
    jobType: "rulebook_run",
    status: "succeeded",
    createdAt: input.run.createdAt,
    startedAt: input.run.startedAt,
    finishedAt: timestamp(),
    seed,
    config: {
      matches,
      maxTurns
    },
    artifacts,
    metrics: result.simulation
      ? {
          winRates: result.simulation.summary.winRates,
          averageTurns: result.simulation.summary.averageTurns
        }
      : undefined,
    notes: result.ok ? ["pipeline_ok"] : ["pipeline_not_ok"],
    sourceType: "text"
  };

  return {
    ok: true,
    manifest,
    projectPatch: {
      latestIrPath: irPath,
      latestReplayPath: replayPath
    }
  };
}

async function executeRulebookRunPdf(input: ExecutionInput): Promise<ExecutionResult> {
  const payload = input.run.payload as RulebookRunPdfPayload;
  if (!payload.uploadId) {
    throw new Error("rulebook_run_pdf requires payload.uploadId");
  }
  if (!isValidUploadId(payload.uploadId)) {
    throw new Error(`invalid uploadId: ${payload.uploadId}`);
  }
  const seed = payload.seed ?? input.project.seedDefault;
  const matches = payload.games ?? 20;
  const maxTurns = payload.maxTurns ?? 80;
  const defaultPdfPath = getUploadPdfPath(input.project.id, payload.uploadId);
  const resolvedPdfPath = payload.pdfPath ? resolveRepoPath(payload.pdfPath) : defaultPdfPath;
  if (!isPathInsideRepo(resolvedPdfPath)) {
    throw new Error(`pdf path is outside repository: ${resolvedPdfPath}`);
  }
  if (!existsSync(resolvedPdfPath)) {
    throw new Error(`pdf file not found: ${resolvedPdfPath}`);
  }

  input.log(`[rulebook_run_pdf] upload=${payload.uploadId} seed=${seed} games=${matches} maxTurns=${maxTurns}`);

  const pdfBuffer = readFileSync(resolvedPdfPath);
  const pdfSha256 = createHash("sha256").update(pdfBuffer).digest("hex");
  const extracted = await extractTextFromPdfBuffer(pdfBuffer);
  const extractedUploadPath = getUploadExtractedTextPath(input.project.id, payload.uploadId);
  mkdirSync(dirname(extractedUploadPath), { recursive: true });
  writeFileSync(extractedUploadPath, `${extracted.text}\n`, "utf8");
  const extractedUploadPathRel = toRepoRelativePath(extractedUploadPath);
  const extractedRunPath = writeText(input.run.runDir, "rulebook.extracted.txt", `${extracted.text}\n`);

  const result = runRulebookPipeline({
    text: extracted.text,
    seed,
    matches,
    maxTurns
  });

  const irPath = writeJson(input.run.runDir, "rulebook.ir.json", result.irDraft);
  const gapsPath = writeJson(input.run.runDir, "rulebook.gaps.json", result.gapReport);
  const patchPath = writeJson(input.run.runDir, "rulebook.patch.template.json", {
    patchTemplate: result.patchTemplate
  });

  const artifacts: Record<string, string> = {
    extractedText: extractedRunPath,
    uploadExtractedText: extractedUploadPathRel,
    ir: irPath,
    gaps: gapsPath,
    patchTemplate: patchPath
  };

  let replayPath: string | null = null;
  if (result.simulation) {
    artifacts.simSummary = writeJson(input.run.runDir, "rulebook.sim.summary.json", result.simulation.summary);
    replayPath = writeJson(input.run.runDir, "rulebook.replay.sample.json", result.simulation.sampleReplay);
    artifacts.sampleReplay = replayPath;
  }

  const notes = result.ok ? ["pipeline_ok"] : ["pipeline_not_ok"];
  if (extracted.meta.error) {
    notes.push(`pdf_extract_warning: ${extracted.meta.error}`);
  }

  const manifest: RunManifest = {
    runId: input.run.id,
    projectId: input.project.id,
    jobType: "rulebook_run_pdf",
    status: "succeeded",
    createdAt: input.run.createdAt,
    startedAt: input.run.startedAt,
    finishedAt: timestamp(),
    seed,
    config: {
      matches,
      maxTurns
    },
    artifacts,
    metrics: result.simulation
      ? {
          winRates: result.simulation.summary.winRates,
          averageTurns: result.simulation.summary.averageTurns
        }
      : undefined,
    notes,
    sourceType: "pdf",
    uploadId: payload.uploadId,
    pdfSha256
  };

  return {
    ok: true,
    manifest,
    projectPatch: {
      latestIrPath: irPath,
      latestReplayPath: replayPath
    }
  };
}

async function executeApplyPatch(input: ExecutionInput): Promise<ExecutionResult> {
  const payload = input.run.payload as ApplyPatchPayload;
  const sourceIrPath = payload.irPath ?? input.project.latestIrPath;
  if (!sourceIrPath) {
    throw new Error("apply_patch requires payload.irPath or project.latestIrPath");
  }

  input.log(`[apply_patch] source=${sourceIrPath}`);
  const ir = readJson(resolveRepoPath(sourceIrPath)) as unknown;
  const applied = applyPatch(ir, payload.patch);
  const checker = checkIR(applied.next);
  const gapReport = buildGapReport(applied.next, checker, {});
  let compileError: string | null = null;
  try {
    compileToGameModule(applied.next);
  } catch (error) {
    compileError = error instanceof Error ? error.message : String(error);
  }

  const patchedPath = writeJson(input.run.runDir, "patched.ir.json", applied.next);
  const checkedPath = writeJson(input.run.runDir, "patched.checked.json", {
    appliedOps: applied.appliedOps,
    patchErrors: applied.errors,
    checker,
    compileError
  });
  const gapsPath = writeJson(input.run.runDir, "patched.gaps.json", gapReport);
  const ok = applied.errors.length === 0 && checker.errors.length === 0 && compileError === null;

  const manifest: RunManifest = {
    runId: input.run.id,
    projectId: input.project.id,
    jobType: "apply_patch",
    status: ok ? "succeeded" : "failed",
    createdAt: input.run.createdAt,
    startedAt: input.run.startedAt,
    finishedAt: timestamp(),
    seed: input.project.seedDefault,
    config: {},
    artifacts: {
      patchedIr: patchedPath,
      checked: checkedPath,
      gaps: gapsPath
    },
    error: ok
      ? undefined
      : [applied.errors.join(" | "), checker.errors.join(" | "), compileError ?? ""].filter((part) => part).join(" | ")
  };

  return {
    ok,
    manifest,
    projectPatch: ok
      ? {
          latestIrPath: patchedPath
        }
      : undefined
  };
}

async function executeSimulate(input: ExecutionInput): Promise<ExecutionResult> {
  const payload = input.run.payload as SimulatePayload;
  const sourceIrPath = payload.irPath ?? input.project.latestIrPath;
  if (!sourceIrPath) {
    throw new Error("simulate requires payload.irPath or project.latestIrPath");
  }

  const seed = payload.seed ?? input.project.seedDefault;
  const matches = payload.matches ?? 100;
  const maxTurns = payload.maxTurns ?? 80;
  const poolSize = normalizePoolSize(payload.poolSize, input.maxParallelPoolSize);
  const botsMode = payload.botsMode ?? "auto";
  input.log(`[simulate] source=${sourceIrPath} seed=${seed} matches=${matches} maxTurns=${maxTurns} pool=${poolSize}`);

  const ir = readJson(resolveRepoPath(sourceIrPath)) as GameIRv0;
  const batch = await runBatchParallel({
    ir,
    seed,
    matches,
    maxTurns,
    bots: botsMode,
    poolSize
  });

  const summaryPath = writeJson(input.run.runDir, "simulate.summary.json", batch.metrics);
  const replayPath = writeJson(input.run.runDir, "simulate.replay.sample.json", batch.matches[0]?.replayLog ?? []);
  const manifest: RunManifest = {
    runId: input.run.id,
    projectId: input.project.id,
    jobType: "simulate",
    status: "succeeded",
    createdAt: input.run.createdAt,
    startedAt: input.run.startedAt,
    finishedAt: timestamp(),
    seed,
    config: {
      matches,
      maxTurns,
      botsMode,
      poolSize
    },
    artifacts: {
      summary: summaryPath,
      sampleReplay: replayPath
    },
    metrics: {
      matches: batch.metrics.matches,
      winRates: batch.metrics.winRates,
      averageTurns: batch.metrics.averageTurns
    }
  };

  return {
    ok: true,
    manifest,
    projectPatch: {
      latestReplayPath: replayPath
    }
  };
}

async function executeTune(input: ExecutionInput): Promise<ExecutionResult> {
  const payload = input.run.payload as TunePayload;
  const sourceIrPath = payload.irPath ?? input.project.latestIrPath;
  if (!sourceIrPath) {
    throw new Error("tune requires payload.irPath or project.latestIrPath");
  }
  const seed = payload.seed ?? input.project.seedDefault;
  const iterations = payload.iterations ?? 10;
  const candidatesPerIter = payload.candidatesPerIter ?? 10;
  const matches = payload.matches ?? 100;
  const maxTurns = payload.maxTurns ?? 100;
  const poolSize = normalizePoolSize(payload.poolSize, input.maxParallelPoolSize);
  const spaceId = payload.spaceId ?? "mini_splendor";
  if (spaceId !== "mini_splendor") {
    throw new Error(`unsupported tune space: ${spaceId}`);
  }

  input.log(
    `[tune] source=${sourceIrPath} seed=${seed} iter=${iterations} cand=${candidatesPerIter} matches=${matches} maxTurns=${maxTurns} pool=${poolSize}`
  );
  const ir = readJson(resolveRepoPath(sourceIrPath)) as unknown;
  const tuned = await tuneIR({
    baseIr: ir,
    space: miniSplendorSpace,
    seed,
    iterations,
    candidatesPerIter,
    simConfig: {
      matches,
      maxTurns
    },
    poolSize
  });

  const report = generateTuningReport({
    baseIrMeta: {
      id: tuned.baseline.ir.meta.id,
      name: tuned.baseline.ir.meta.name
    },
    baseline: tuned.baseline,
    best: tuned.best,
    history: tuned.history,
    config: {
      spaceId,
      seed,
      iterations,
      candidatesPerIter,
      matches,
      maxTurns,
      botsMode: "auto"
    }
  });

  const reportMd = writeText(input.run.runDir, "tune.report.md", `${report.markdown}\n`);
  const reportJson = writeJson(input.run.runDir, "tune.report.json", report.json);
  const bestIr = writeJson(input.run.runDir, "tune.best.ir.json", tuned.best.ir);
  const bestPatch = writeJson(input.run.runDir, "tune.best.patch.json", {
    id: tuned.best.patch?.id ?? null,
    operations: tuned.best.patch?.ops ?? [],
    meta: tuned.best.patch?.meta ?? { reason: "baseline selected", seed, knobs: {} }
  });

  const manifest: RunManifest = {
    runId: input.run.id,
    projectId: input.project.id,
    jobType: "tune",
    status: "succeeded",
    createdAt: input.run.createdAt,
    startedAt: input.run.startedAt,
    finishedAt: timestamp(),
    seed,
    config: {
      spaceId,
      iterations,
      candidatesPerIter,
      matches,
      maxTurns,
      poolSize
    },
    artifacts: {
      reportMd,
      reportJson,
      bestIr,
      bestPatch
    },
    metrics: {
      baselineObjective: tuned.baseline.objective.score,
      bestObjective: tuned.best.objective.score
    }
  };

  return {
    ok: true,
    manifest,
    projectPatch: {
      latestIrPath: bestIr
    }
  };
}

function normalizePoolSize(requested: number | undefined, maxParallelPoolSize: number): number {
  const fallback = 2;
  const raw = requested ?? fallback;
  return Math.max(1, Math.min(maxParallelPoolSize, Math.floor(raw)));
}

function writeJson(runDir: string, fileName: string, value: unknown): string {
  const full = resolve(runDir, fileName);
  writeFileSync(full, `${stableStringify(value)}\n`, "utf8");
  return toRepoRelativePath(full);
}

function writeText(runDir: string, fileName: string, value: string): string {
  const full = resolve(runDir, fileName);
  writeFileSync(full, value, "utf8");
  return toRepoRelativePath(full);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function resolveRepoPath(pathValue: string): string {
  return resolve(getRepoRoot(), pathValue);
}

function timestamp(): string {
  return new Date().toISOString();
}

export function isJobType(value: string): value is JobType {
  return value === "rulebook_run" || value === "rulebook_run_pdf" || value === "apply_patch" || value === "simulate" || value === "tune";
}
