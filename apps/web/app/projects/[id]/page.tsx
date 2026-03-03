import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfUploadPanel } from "@/components/PdfUploadPanel";
import { getProjectRecord, listRunRecords } from "@/lib/coreJobs";
import { readArtifactText, getRunStatusResponse } from "@/lib/runDetail";
import {
  enqueueApplyPatchAction,
  enqueueRulebookRunPdfAction,
  enqueueRulebookRunAction,
  enqueueSimulateAction,
  enqueueTuneAction
} from "./actions";
import { isValidUploadId } from "../../../../../src/rulebook/pdfArtifacts";

export const dynamic = "force-dynamic";

export default function ProjectPage({ params, searchParams }: { params: { id: string }; searchParams?: { uploadId?: string } }) {
  const project = getProjectRecord(params.id);
  if (!project) {
    notFound();
  }
  const selectedUploadId =
    typeof searchParams?.uploadId === "string" && isValidUploadId(searchParams.uploadId) ? searchParams.uploadId : null;
  const runs = listRunRecords(project.id).slice().reverse().slice(0, 10);
  const runRows = runs.map((run) => {
    const detail = getRunStatusResponse(run.id);
    const hasReplay = detail?.artifactLinks.some((artifact) => artifact.key.toLowerCase().includes("replay")) ?? false;
    const sourceType = detail?.manifest?.sourceType ?? (run.jobType === "rulebook_run" ? "text" : "-");
    return {
      run,
      hasReplay,
      sourceType
    };
  });
  const latestRunStatus = project.latestRunId ? getRunStatusResponse(project.latestRunId) : null;
  const latestGapArtifact = project.latestRunId ? readArtifactText(project.latestRunId, "gaps") : null;
  const latestPatchArtifact = project.latestRunId ? readArtifactText(project.latestRunId, "patchTemplate") : null;

  return (
    <>
      <div className="panel">
        <h1>Project {project.name}</h1>
        <p>
          <strong>ID:</strong> <span className="mono">{project.id}</span>
        </p>
        <p>
          <strong>Default Seed:</strong> <span className="mono">{project.seedDefault}</span>
        </p>
        <p>
          <strong>Latest Run:</strong> <span className="mono">{project.latestRunId ?? "-"}</span>
        </p>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </div>

      <div className="panel">
        <h2>Run Controls</h2>
        <PdfUploadPanel projectId={project.id} initialUploadId={selectedUploadId ?? undefined} />
        {selectedUploadId ? (
          <form action={enqueueRulebookRunPdfAction} className="panel">
            <h3>Run from PDF</h3>
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="uploadId" value={selectedUploadId} />
            <label>Upload ID</label>
            <input type="text" className="mono" value={selectedUploadId} readOnly />
            <label>Seed</label>
            <input type="text" name="seed" defaultValue={project.seedDefault} />
            <label>Games</label>
            <input type="text" name="games" defaultValue="20" />
            <label>Max Turns</label>
            <input type="text" name="maxTurns" defaultValue="80" />
            <button type="submit">Run from PDF</button>
          </form>
        ) : (
          <p>Upload a PDF rulebook to enable Run from PDF.</p>
        )}
        <div className="row">
          <form action={enqueueRulebookRunAction} className="panel" style={{ flex: 1, minWidth: 280 }}>
            <h3>Run Rulebook</h3>
            <input type="hidden" name="projectId" value={project.id} />
            <label>Seed</label>
            <input type="text" name="seed" defaultValue={project.seedDefault} />
            <label>Matches</label>
            <input type="text" name="matches" defaultValue="20" />
            <label>Max Turns</label>
            <input type="text" name="maxTurns" defaultValue="80" />
            <button type="submit">Run Rulebook</button>
          </form>

          <form action={enqueueSimulateAction} className="panel" style={{ flex: 1, minWidth: 280 }}>
            <h3>Run Simulation</h3>
            <input type="hidden" name="projectId" value={project.id} />
            <label>Seed</label>
            <input type="text" name="seed" defaultValue={project.seedDefault} />
            <label>Matches</label>
            <input type="text" name="matches" defaultValue="100" />
            <label>Max Turns</label>
            <input type="text" name="maxTurns" defaultValue="80" />
            <label>Pool Size</label>
            <input type="text" name="poolSize" defaultValue="2" />
            <button type="submit">Run Sim</button>
          </form>

          <form action={enqueueTuneAction} className="panel" style={{ flex: 1, minWidth: 280 }}>
            <h3>Run Tuning</h3>
            <input type="hidden" name="projectId" value={project.id} />
            <label>Seed</label>
            <input type="text" name="seed" defaultValue={project.seedDefault} />
            <label>Iterations</label>
            <input type="text" name="iterations" defaultValue="10" />
            <label>Candidates/Iter</label>
            <input type="text" name="candidatesPerIter" defaultValue="10" />
            <label>Matches</label>
            <input type="text" name="matches" defaultValue="100" />
            <label>Max Turns</label>
            <input type="text" name="maxTurns" defaultValue="100" />
            <label>Pool Size</label>
            <input type="text" name="poolSize" defaultValue="2" />
            <button type="submit">Run Tune</button>
          </form>
        </div>

        <form action={enqueueApplyPatchAction} className="panel">
          <h3>Apply Patch</h3>
          <input type="hidden" name="projectId" value={project.id} />
          <label>IR Path (optional; default latest IR)</label>
          <input type="text" name="irPath" defaultValue={project.latestIrPath ?? ""} />
          <label>Patch JSON</label>
          <textarea
            name="patchJson"
            rows={12}
            defaultValue={
              latestPatchArtifact?.content ??
              JSON.stringify(
                {
                  patchTemplate: {
                    operations: [{ op: "set", path: "/meta/name", value: "patched_name" }]
                  }
                },
                null,
                2
              )
            }
          />
          <button type="submit">Apply Patch</button>
        </form>
      </div>

      <div className="panel">
        <h2>Runs</h2>
        {runs.length === 0 ? (
          <p>No runs yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Type</th>
                <th>Source</th>
                <th>Status</th>
                <th>Created</th>
                <th>Open</th>
                <th>Replay</th>
              </tr>
            </thead>
            <tbody>
              {runRows.map(({ run, hasReplay, sourceType }) => (
                <tr key={run.id}>
                  <td className="mono">{run.id}</td>
                  <td className="mono">{run.jobType}</td>
                  <td className="mono">{sourceType}</td>
                  <td className="mono">{run.status}</td>
                  <td className="mono">{run.createdAt}</td>
                  <td>
                    <Link href={`/runs/${run.id}`}>Run</Link>
                  </td>
                  <td>{hasReplay ? <Link href={`/replays/${run.id}`}>View Replay</Link> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2>Latest Gaps</h2>
        <pre>{latestGapArtifact?.content ?? "(no gaps artifact yet)"}</pre>
      </div>

      <div className="panel">
        <h2>Latest Patch Template</h2>
        <pre>{latestPatchArtifact?.content ?? "(no patch template artifact yet)"}</pre>
      </div>

      {latestRunStatus ? (
        <div className="panel">
          <h2>Latest Run Snapshot</h2>
          <p>
            <strong>Status:</strong> <span className="mono">{latestRunStatus.run.status}</span>
          </p>
          <p>
            <Link href={`/runs/${latestRunStatus.run.id}`}>Open Latest Run</Link>
          </p>
        </div>
      ) : null}
    </>
  );
}
