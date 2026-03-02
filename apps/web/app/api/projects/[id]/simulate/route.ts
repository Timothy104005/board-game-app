import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueRun, getProjectRecord } from "@/lib/coreJobs";

export const runtime = "nodejs";

const payloadSchema = z.object({
  irPath: z.string().optional(),
  seed: z.string().min(1).default("42"),
  matches: z.number().int().positive().default(100),
  maxTurns: z.number().int().positive().default(80),
  poolSize: z.number().int().positive().default(2)
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
  const runId = enqueueRun("simulate", project.id, parsed.data);
  return NextResponse.json({ runId });
}
