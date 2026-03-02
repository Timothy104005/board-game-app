"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { enqueueRun, getProjectRecord } from "@/lib/coreJobs";

interface LocalPatch {
  operations: Array<{
    op: "set" | "append" | "merge";
    path: string;
    value: unknown;
  }>;
}

const rulebookRunSchema = z.object({
  projectId: z.string().min(1),
  seed: z.string().min(1).default("42"),
  matches: z.coerce.number().int().positive().default(20),
  maxTurns: z.coerce.number().int().positive().default(80)
});

const simulateSchema = z.object({
  projectId: z.string().min(1),
  seed: z.string().min(1).default("42"),
  matches: z.coerce.number().int().positive().default(100),
  maxTurns: z.coerce.number().int().positive().default(80),
  poolSize: z.coerce.number().int().positive().default(2)
});

const tuneSchema = z.object({
  projectId: z.string().min(1),
  seed: z.string().min(1).default("42"),
  iterations: z.coerce.number().int().positive().default(10),
  candidatesPerIter: z.coerce.number().int().positive().default(10),
  matches: z.coerce.number().int().positive().default(100),
  maxTurns: z.coerce.number().int().positive().default(100),
  poolSize: z.coerce.number().int().positive().default(2)
});

export async function enqueueRulebookRunAction(formData: FormData): Promise<void> {
  const parsed = rulebookRunSchema.parse({
    projectId: String(formData.get("projectId") ?? ""),
    seed: String(formData.get("seed") ?? "42"),
    matches: Number(formData.get("matches") ?? 20),
    maxTurns: Number(formData.get("maxTurns") ?? 80)
  });
  ensureProjectExists(parsed.projectId);

  const runId = enqueueRun("rulebook_run", parsed.projectId, {
    seed: parsed.seed,
    matches: parsed.matches,
    maxTurns: parsed.maxTurns
  });
  redirect(`/runs/${runId}`);
}

export async function enqueueSimulateAction(formData: FormData): Promise<void> {
  const parsed = simulateSchema.parse({
    projectId: String(formData.get("projectId") ?? ""),
    seed: String(formData.get("seed") ?? "42"),
    matches: Number(formData.get("matches") ?? 100),
    maxTurns: Number(formData.get("maxTurns") ?? 80),
    poolSize: Number(formData.get("poolSize") ?? 2)
  });
  ensureProjectExists(parsed.projectId);

  const runId = enqueueRun("simulate", parsed.projectId, {
    seed: parsed.seed,
    matches: parsed.matches,
    maxTurns: parsed.maxTurns,
    poolSize: parsed.poolSize
  });
  redirect(`/runs/${runId}`);
}

export async function enqueueTuneAction(formData: FormData): Promise<void> {
  const parsed = tuneSchema.parse({
    projectId: String(formData.get("projectId") ?? ""),
    seed: String(formData.get("seed") ?? "42"),
    iterations: Number(formData.get("iterations") ?? 10),
    candidatesPerIter: Number(formData.get("candidatesPerIter") ?? 10),
    matches: Number(formData.get("matches") ?? 100),
    maxTurns: Number(formData.get("maxTurns") ?? 100),
    poolSize: Number(formData.get("poolSize") ?? 2)
  });
  ensureProjectExists(parsed.projectId);

  const runId = enqueueRun("tune", parsed.projectId, {
    seed: parsed.seed,
    iterations: parsed.iterations,
    candidatesPerIter: parsed.candidatesPerIter,
    matches: parsed.matches,
    maxTurns: parsed.maxTurns,
    poolSize: parsed.poolSize,
    spaceId: "mini_splendor"
  });
  redirect(`/runs/${runId}`);
}

export async function enqueueApplyPatchAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  ensureProjectExists(projectId);
  const patchText = String(formData.get("patchJson") ?? "").trim();
  const irPathRaw = String(formData.get("irPath") ?? "").trim();
  if (!patchText) {
    throw new Error("patchJson is required");
  }
  let parsedPatch: LocalPatch;
  try {
    const decoded = JSON.parse(patchText) as { patchTemplate?: LocalPatch } | LocalPatch;
    parsedPatch = "operations" in decoded ? decoded : (decoded.patchTemplate as LocalPatch);
  } catch (error) {
    throw new Error(`invalid patch json: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsedPatch || !Array.isArray(parsedPatch.operations)) {
    throw new Error("patch must contain operations");
  }

  const runId = enqueueRun("apply_patch", projectId, {
    irPath: irPathRaw.length > 0 ? irPathRaw : undefined,
    patch: parsedPatch as any
  });
  redirect(`/runs/${runId}`);
}

function ensureProjectExists(projectId: string): void {
  const project = getProjectRecord(projectId);
  if (!project) {
    throw new Error(`project not found: ${projectId}`);
  }
}
