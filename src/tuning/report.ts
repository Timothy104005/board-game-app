import type { TuneEvaluation, TuneHistoryItem } from "./tuner.js";

export interface TuningReportInput {
  baseIrMeta: {
    id: string;
    name: string;
  };
  baseline: TuneEvaluation;
  best: TuneEvaluation;
  history: TuneHistoryItem[];
  config: {
    spaceId: string;
    seed: string;
    iterations: number;
    candidatesPerIter: number;
    matches: number;
    maxTurns: number;
    botsMode: "auto" | "greedy_vs_random" | "random_vs_random";
  };
}

export interface TuningReportOutput {
  markdown: string;
  json: Record<string, unknown>;
}

export function generateTuningReport(input: TuningReportInput): TuningReportOutput {
  const objectiveDelta = input.best.objective.score - input.baseline.objective.score;
  const json = {
    game: input.baseIrMeta,
    config: input.config,
    baseline: summarizeEval(input.baseline),
    best: summarizeEval(input.best),
    objectiveDelta,
    bestPatchOps: input.best.patch?.ops ?? [],
    history: input.history
  };

  const markdown = [
    "# Tuning A/B Report",
    "",
    "## Baseline",
    toMetricsTable(input.baseline),
    "",
    "## Best Candidate",
    toMetricsTable(input.best),
    "",
    "## Objective Breakdown",
    "```json",
    JSON.stringify(
      {
        baseline: input.baseline.objective.breakdown,
        best: input.best.objective.breakdown,
        delta: objectiveDelta
      },
      null,
      2
    ),
    "```",
    "",
    "## Patch Ops",
    "```json",
    JSON.stringify(input.best.patch?.ops ?? [], null, 2),
    "```",
    "",
    "## Reproducibility",
    "```json",
    JSON.stringify(
      {
        spaceId: input.config.spaceId,
        seed: input.config.seed,
        iterations: input.config.iterations,
        candidatesPerIter: input.config.candidatesPerIter,
        matches: input.config.matches,
        maxTurns: input.config.maxTurns,
        botsMode: input.config.botsMode
      },
      null,
      2
    ),
    "```",
    "",
    "## History Summary",
    "```json",
    JSON.stringify(input.history, null, 2),
    "```"
  ].join("\n");

  return {
    markdown,
    json
  };
}

function summarizeEval(evaluation: TuneEvaluation): Record<string, unknown> {
  return {
    objectiveScore: evaluation.objective.score,
    derived: evaluation.objective.derived,
    metrics: evaluation.metrics,
    patchId: evaluation.patch?.id ?? null
  };
}

function toMetricsTable(evaluation: TuneEvaluation): string {
  const d = evaluation.objective.derived;
  return [
    "| Metric | Value |",
    "|---|---:|",
    `| Objective Score | ${evaluation.objective.score.toFixed(6)} |`,
    `| Avg Turns | ${d.avgTurns.toFixed(4)} |`,
    `| Draw Rate | ${d.drawRate.toFixed(4)} |`,
    `| First Player Advantage | ${d.firstPlayerAdvantage.toFixed(4)} |`,
    `| Action Entropy | ${d.actionEntropy.toFixed(4)} |`
  ].join("\n");
}
