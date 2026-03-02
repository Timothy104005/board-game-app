"use client";

import { useEffect, useMemo, useState } from "react";
import type { RunStatusResponse } from "@/lib/runDetail";

export function RunStatusClient({ runId, initial }: { runId: string; initial: RunStatusResponse }) {
  const [data, setData] = useState<RunStatusResponse>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const tick = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          if (isMounted) {
            setError(`status fetch failed (${response.status})`);
          }
          return;
        }
        const parsed = (await response.json()) as RunStatusResponse;
        if (isMounted) {
          setData(parsed);
          setError(null);
        }
      } catch (fetchError) {
        if (isMounted) {
          const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
          setError(message);
        }
      }
    };

    const timer = setInterval(tick, 2000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [runId]);

  const statusClass = useMemo(() => {
    if (data.run.status === "succeeded") {
      return "succeeded";
    }
    if (data.run.status === "failed") {
      return "failed";
    }
    if (data.run.status === "running") {
      return "running";
    }
    return "queued";
  }, [data.run.status]);

  return (
    <div className="panel">
      <h2>Run Status</h2>
      <p>
        <strong>Run:</strong> <span className="mono">{data.run.id}</span>
      </p>
      <p>
        <strong>Job:</strong> <span className="mono">{data.run.jobType}</span>
      </p>
      <p>
        <strong>Status:</strong>{" "}
        <span className="mono" data-testid="run-status">
          {statusClass}
        </span>
      </p>
      {data.run.error ? (
        <p>
          <strong>Error:</strong> <span className="mono">{data.run.error}</span>
        </p>
      ) : null}
      {error ? (
        <p>
          <strong>Polling Error:</strong> <span className="mono">{error}</span>
        </p>
      ) : null}

      <h3>Artifacts</h3>
      <ul>
        {data.artifactLinks.map((artifact) => (
          <li key={artifact.key}>
            <a href={`/runs/${runId}/artifacts/${encodeURIComponent(artifact.key)}`}>
              <span className="mono">{artifact.key}</span>
            </a>{" "}
            <span className="mono">({artifact.path})</span>
            {artifact.key.toLowerCase().includes("replay") ? (
              <>
                {" "}
                <a href={`/replays/${runId}`}>open replay</a>
              </>
            ) : null}
          </li>
        ))}
      </ul>

      <h3>Logs (tail 200)</h3>
      <pre>{data.logTail.join("\n") || "(no logs yet)"}</pre>
    </div>
  );
}
