import Link from "next/link";
import { notFound } from "next/navigation";
import { ReplayViewerClient } from "@/components/ReplayViewerClient";
import { loadReplayByRunId } from "@/lib/replay";

export const dynamic = "force-dynamic";

export default function ReplayPage({ params }: { params: { replayId: string } }) {
  const replay = loadReplayByRunId(params.replayId);
  if (!replay) {
    notFound();
  }

  return (
    <>
      <div className="panel">
        <h1>Replay {params.replayId}</h1>
        <p>
          <Link href={`/runs/${params.replayId}`}>Back to Run</Link>
        </p>
      </div>
      <ReplayViewerClient replay={replay} />
    </>
  );
}
