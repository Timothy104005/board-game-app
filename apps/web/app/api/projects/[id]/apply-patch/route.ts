import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueRun, getProjectRecord } from "@/lib/coreJobs";

export const runtime = "nodejs";

interface LocalPatch {
  operations: Array<{
    op: "set" | "append" | "merge";
    path: string;
    value: unknown;
  }>;
}

const patchSchema = z.object({
  operations: z.array(z.any()).min(1)
});

const payloadSchema = z.object({
  irPath: z.string().optional(),
  patch: patchSchema
});

export async function POST(request: Request, context: { params: { id: string } }) {
  const project = getProjectRecord(context.params.id);
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const body = ((await request.json().catch(() => ({}))) ?? {}) as unknown;
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(" | ") }, { status: 400 });
  }

  const runId = enqueueRun("apply_patch", project.id, {
    irPath: parsed.data.irPath,
    patch: parsed.data.patch as LocalPatch as any
  });
  return NextResponse.json({ runId });
}
