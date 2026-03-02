"use client";

import { useMemo, useState } from "react";
import type { ReplayLoadResult } from "@/lib/replay";

export function ReplayViewerClient({ replay }: { replay: ReplayLoadResult }) {
  const [cursor, setCursor] = useState(0);
  const step = replay.steps[cursor] ?? null;

  const diffText = useMemo(() => {
    if (!step) {
      return "";
    }
    const payload = step.action.payload ?? {};
    const diff = payload.diff && typeof payload.diff === "object" ? payload.diff : payload;
    return JSON.stringify(diff, null, 2);
  }, [step]);

  return (
    <div className="panel">
      <h2>Replay Viewer</h2>
      <p>
        <strong>Run:</strong> <span className="mono">{replay.runId}</span>
      </p>
      <p>
        <strong>Artifact:</strong> <span className="mono">{replay.artifactPath}</span>
      </p>
      <p>
        <strong>Turn Count:</strong> <span className="mono">{replay.metrics.turnCount}</span>
      </p>

      <div className="row">
        <button onClick={() => setCursor((prev) => Math.max(0, prev - 1))} disabled={cursor <= 0}>
          Prev
        </button>
        <button
          onClick={() => setCursor((prev) => Math.min(replay.steps.length - 1, prev + 1))}
          disabled={cursor >= replay.steps.length - 1}
        >
          Next
        </button>
        <label>
          Step:
          <input
            type="text"
            className="mono"
            value={cursor}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(parsed)) {
                setCursor(Math.max(0, Math.min(replay.steps.length - 1, parsed)));
              }
            }}
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
      </div>

      <h3>Current Step</h3>
      {step ? (
        <table data-testid="replay-step-table">
          <tbody>
            <tr>
              <th>Index</th>
              <td className="mono">{step.index}</td>
            </tr>
            <tr>
              <th>Turn</th>
              <td className="mono">{step.turn}</td>
            </tr>
            <tr>
              <th>Actor</th>
              <td className="mono">{step.actor}</td>
            </tr>
            <tr>
              <th>Action</th>
              <td className="mono">{step.action.type}</td>
            </tr>
            <tr>
              <th>State Hash Before</th>
              <td className="mono">{step.stateHashBefore ?? ""}</td>
            </tr>
            <tr>
              <th>State Hash After</th>
              <td className="mono">{step.stateHashAfter ?? ""}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p>No step selected.</p>
      )}

      <h3>Diff / Payload</h3>
      <pre>{diffText || "(no payload)"}</pre>

      <h3>Action Counts</h3>
      <pre data-testid="replay-action-counts">{JSON.stringify(replay.metrics.actionCounts, null, 2)}</pre>
    </div>
  );
}
