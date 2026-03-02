import { readArtifactText } from "./runDetail";

export interface ReplayStep {
  index: number;
  turn: number;
  phase: string;
  actor: string;
  action: {
    type: string;
    actor?: string;
    payload?: Record<string, unknown>;
  };
  stateHashBefore?: string;
  stateHashAfter?: string;
}

export interface ReplayLoadResult {
  runId: string;
  artifactPath: string;
  steps: ReplayStep[];
  metrics: {
    turnCount: number;
    actionCounts: Record<string, number>;
    actorCounts: Record<string, number>;
  };
}

export function loadReplayByRunId(runId: string): ReplayLoadResult | null {
  const replayArtifact =
    readArtifactText(runId, "sampleReplay") ??
    readArtifactText(runId, "replay") ??
    readArtifactText(runId, "simulateReplay");
  if (!replayArtifact) {
    return null;
  }

  const parsed = JSON.parse(replayArtifact.content) as unknown;
  const rawSteps = Array.isArray(parsed) ? parsed : [];
  const steps: ReplayStep[] = rawSteps.map((entry, index) => normalizeStep(entry, index));
  const actionCounts: Record<string, number> = {};
  const actorCounts: Record<string, number> = {};
  for (const step of steps) {
    actionCounts[step.action.type] = (actionCounts[step.action.type] ?? 0) + 1;
    actorCounts[step.actor] = (actorCounts[step.actor] ?? 0) + 1;
  }

  return {
    runId,
    artifactPath: replayArtifact.path,
    steps,
    metrics: {
      turnCount: steps.length,
      actionCounts,
      actorCounts
    }
  };
}

function normalizeStep(value: unknown, fallbackIndex: number): ReplayStep {
  const asObj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const actionRaw = asObj.action && typeof asObj.action === "object" ? (asObj.action as Record<string, unknown>) : {};
  const payload =
    actionRaw.payload && typeof actionRaw.payload === "object"
      ? (actionRaw.payload as Record<string, unknown>)
      : undefined;
  return {
    index: typeof asObj.index === "number" ? asObj.index : fallbackIndex,
    turn: typeof asObj.turn === "number" ? asObj.turn : fallbackIndex,
    phase: typeof asObj.phase === "string" ? asObj.phase : "",
    actor: typeof asObj.actor === "string" ? asObj.actor : "",
    action: {
      type: typeof actionRaw.type === "string" ? actionRaw.type : "unknown",
      actor: typeof actionRaw.actor === "string" ? actionRaw.actor : undefined,
      payload
    },
    stateHashBefore: typeof asObj.stateHashBefore === "string" ? asObj.stateHashBefore : undefined,
    stateHashAfter: typeof asObj.stateHashAfter === "string" ? asObj.stateHashAfter : undefined
  };
}
