import { NextResponse } from "next/server";
import { z } from "zod";
import { createProjectRecord, listProjectRecords } from "@/lib/coreJobs";

export const runtime = "nodejs";

const createProjectSchema = z.object({
  name: z.string().min(1),
  rulebookText: z.string().min(1),
  seedDefault: z.string().min(1).default("42")
});

export async function GET() {
  return NextResponse.json({
    projects: listProjectRecords()
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as unknown;
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues.map((issue) => issue.message).join(" | ")
      },
      { status: 400 }
    );
  }

  const project = createProjectRecord(parsed.data);
  return NextResponse.json({
    project
  });
}
