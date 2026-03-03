import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { NextResponse } from "next/server";
import { getProjectRecord } from "@/lib/coreJobs";
import { toRepoRelativePath } from "../../../../../../../src/paths";
import { getUploadPdfPath } from "../../../../../../../src/rulebook/pdfArtifacts";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: { id: string } }) {
  const project = getProjectRecord(context.params.id);
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  if (mimeType !== "application/pdf" && !fileName.endsWith(".pdf")) {
    return NextResponse.json({ error: "only PDF uploads are supported" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "empty PDF upload" }, { status: 400 });
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const uploadId = `u${sha256.slice(0, 12)}`;
  const uploadPath = getUploadPdfPath(project.id, uploadId);
  mkdirSync(dirname(uploadPath), { recursive: true });
  writeFileSync(uploadPath, bytes);

  return NextResponse.json({
    uploadId,
    sizeBytes: bytes.length,
    pdfPath: toRepoRelativePath(uploadPath)
  });
}
