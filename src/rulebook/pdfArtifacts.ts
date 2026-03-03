import { resolve, sep } from "node:path";
import { resolveArtifactsPath } from "../paths.js";

const UPLOAD_ID_PATTERN = /^u[a-f0-9]{12}$/;

export function getProjectUploadsDir(projectId: string): string {
  return resolveArtifactsPath("projects", projectId, "uploads");
}

export function getProjectRunsDir(projectId: string): string {
  return resolveArtifactsPath("projects", projectId, "runs");
}

export function getUploadPdfPath(projectId: string, uploadId: string): string {
  if (!isValidUploadId(uploadId)) {
    throw new Error(`invalid uploadId: ${uploadId}`);
  }
  const uploadsDir = getProjectUploadsDir(projectId);
  return resolve(uploadsDir, `${uploadId}.pdf`);
}

export function getUploadExtractedTextPath(projectId: string, uploadId: string): string {
  if (!isValidUploadId(uploadId)) {
    throw new Error(`invalid uploadId: ${uploadId}`);
  }
  const uploadsDir = getProjectUploadsDir(projectId);
  return resolve(uploadsDir, `${uploadId}.extracted.txt`);
}

export function isValidUploadId(uploadId: string): boolean {
  return UPLOAD_ID_PATTERN.test(uploadId) && !uploadId.includes(sep) && !uploadId.includes("/");
}
