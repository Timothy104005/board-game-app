import { NextResponse } from "next/server";
import { getProjectRecord, listRunRecords } from "@/lib/coreJobs";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const project = getProjectRecord(context.params.id);
  if (!project) {
    return NextResponse.json(
      {
        error: `project not found: ${context.params.id}`
      },
      { status: 404 }
    );
  }
  return NextResponse.json({
    project,
    runs: listRunRecords(project.id).slice().reverse()
  });
}
