import { NextResponse } from "next/server";
import { getRunStatusResponse } from "@/lib/runDetail";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: { runId: string } }) {
  const status = getRunStatusResponse(context.params.runId);
  if (!status) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }
  return NextResponse.json(status);
}
