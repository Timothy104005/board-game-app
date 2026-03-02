import Link from "next/link";
import { notFound } from "next/navigation";
import { RunStatusClient } from "@/components/RunStatusClient";
import { getRunStatusResponse } from "@/lib/runDetail";

export const dynamic = "force-dynamic";

export default function RunPage({ params }: { params: { runId: string } }) {
  const status = getRunStatusResponse(params.runId);
  if (!status) {
    notFound();
  }

  return (
    <>
      <div className="panel">
        <h1>Run {status.run.id}</h1>
        <p>
          <strong>Project:</strong> <span className="mono">{status.run.projectId}</span>
        </p>
        <p>
          <strong>Job Type:</strong> <span className="mono">{status.run.jobType}</span>
        </p>
        <p>
          <Link href={`/projects/${status.run.projectId}`}>Back to Project</Link>
        </p>
      </div>

      <RunStatusClient runId={params.runId} initial={status} />
    </>
  );
}
