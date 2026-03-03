"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

interface UploadResponse {
  uploadId: string;
  sizeBytes: number;
  pdfPath: string;
}

export function PdfUploadPanel({ projectId, initialUploadId }: { projectId: string; initialUploadId?: string }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadInfo, setUploadInfo] = useState<UploadResponse | null>(initialUploadId ? { uploadId: initialUploadId, sizeBytes: 0, pdfPath: "" } : null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const input = form.elements.namedItem("pdfFile");
    if (!(input instanceof HTMLInputElement) || !input.files || input.files.length === 0) {
      setError("Select a PDF file first.");
      return;
    }

    const file = input.files[0];
    const body = new FormData();
    body.set("file", file);

    setIsUploading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/upload-pdf`, {
        method: "POST",
        body
      });
      const parsed = (await response.json()) as UploadResponse & { error?: string };
      if (!response.ok) {
        setError(parsed.error ?? `Upload failed (${response.status})`);
        return;
      }
      setUploadInfo(parsed);
      router.push(`/projects/${projectId}?uploadId=${encodeURIComponent(parsed.uploadId)}`);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="panel">
      <h3>Upload PDF Rulebook</h3>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="pdfFile">PDF File</label>
        <input id="pdfFile" name="pdfFile" type="file" accept="application/pdf,.pdf" />
        <button type="submit" disabled={isUploading}>
          {isUploading ? "Uploading..." : "Upload PDF"}
        </button>
      </form>
      {uploadInfo ? (
        <p>
          <strong>Latest Upload:</strong> <span className="mono">{uploadInfo.uploadId}</span>
          {uploadInfo.sizeBytes > 0 ? (
            <>
              {" "}
              <span className="mono">({uploadInfo.sizeBytes} bytes)</span>
            </>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <p>
          <strong>Error:</strong> <span className="mono">{error}</span>
        </p>
      ) : null}
    </div>
  );
}
