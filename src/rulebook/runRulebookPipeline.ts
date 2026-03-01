import type { PlayerId } from "../engine/contracts.js";
import type { IRCheckResult } from "../ir/checker.js";
import { checkIR } from "../ir/checker.js";
import { compileToGameModule } from "../ir/compileToGameModule.js";
import type { IRPatch } from "../ir/patch.js";
import { createGreedyBot } from "../bots/greedyBot.js";
import { createRandomBot } from "../bots/randomBot.js";
import type { Bot } from "../bots/types.js";
import { runBatch, type BatchMetrics } from "../sim/runBatch.js";
import { runMatch } from "../sim/runMatch.js";
import { draftIRFromRulebookText } from "./draftIRFromText.js";
import { buildGapReport, type GapReport } from "./gapReport.js";
import { suggestPatchTemplate } from "./gapsToPatchTemplate.js";
import type { GapItem } from "./types.js";

export interface RulebookPipelineInput {
  text: string;
  seed: string;
  matches: number;
  maxTurns: number;
}

export interface RulebookPipelineSimulation {
  summary: BatchMetrics;
  sampleReplay: unknown[];
  sampleFinalScores: Record<PlayerId, number>;
  sampleWinner: PlayerId | null;
}

export interface RulebookPipelineResult {
  ok: boolean;
  irDraft: unknown;
  checker: IRCheckResult;
  gapReport: GapReport;
  patchTemplate: IRPatch;
  simulation?: RulebookPipelineSimulation;
}

export function runRulebookPipeline(input: RulebookPipelineInput): RulebookPipelineResult {
  const drafted = draftIRFromRulebookText(input.text, { seedId: input.seed });
  const checker = checkIR(drafted.irDraft);
  const gapReport = buildGapReport(drafted.irDraft, checker, drafted.debug);
  const patchSuggestion = suggestPatchTemplate(drafted.irDraft, gapReport.gaps);

  if (gapReport.summary.errors > 0) {
    return {
      ok: false,
      irDraft: drafted.irDraft,
      checker,
      gapReport,
      patchTemplate: patchSuggestion.patchTemplate
    };
  }

  try {
    const game = compileToGameModule(drafted.irDraft);
    const bots = chooseBots(drafted.irDraft);
    const batch = runBatch({
      game,
      bots,
      seed: input.seed,
      matches: input.matches,
      maxTurns: input.maxTurns
    });
    const sample = runMatch({
      game,
      bots,
      seed: `${input.seed}|sample`,
      maxTurns: input.maxTurns
    });

    return {
      ok: true,
      irDraft: drafted.irDraft,
      checker,
      gapReport,
      patchTemplate: patchSuggestion.patchTemplate,
      simulation: {
        summary: batch.metrics,
        sampleReplay: sample.replayLog,
        sampleFinalScores: sample.finalScores,
        sampleWinner: sample.winner
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const compileGap: GapItem = {
      filePointer: "/",
      severity: "error",
      message: `compile/sim failure: ${message}`,
      suggestedFix: "Adjust draft IR and rerun pipeline."
    };
    const augmentedGapReport: GapReport = {
      gaps: [...gapReport.gaps, compileGap],
      summary: {
        errors: gapReport.summary.errors + 1,
        warnings: gapReport.summary.warnings
      },
      notes: [...gapReport.notes, "Compile/sim step failed."]
    };
    const augmentedPatchSuggestion = suggestPatchTemplate(drafted.irDraft, augmentedGapReport.gaps);

    return {
      ok: false,
      irDraft: drafted.irDraft,
      checker,
      gapReport: augmentedGapReport,
      patchTemplate: augmentedPatchSuggestion.patchTemplate
    };
  }
}

function chooseBots(irDraft: unknown): { "0": Bot; "1": Bot } {
  const actions = getActionKinds(irDraft);
  const useGreedy = actions.some((kind) => kind === "tictactoe_place" || kind === "take_tokens" || kind === "buy_card");

  if (useGreedy) {
    return {
      "0": createGreedyBot("greedy"),
      "1": createRandomBot("random")
    };
  }
  return {
    "0": createRandomBot("random0"),
    "1": createRandomBot("random1")
  };
}

function getActionKinds(irDraft: unknown): string[] {
  if (!irDraft || typeof irDraft !== "object") {
    return [];
  }
  const maybeActions = (irDraft as Record<string, unknown>).actions;
  if (!Array.isArray(maybeActions)) {
    return [];
  }

  const kinds: string[] = [];
  for (const action of maybeActions) {
    if (!action || typeof action !== "object") {
      continue;
    }
    const kind = (action as Record<string, unknown>).kind;
    if (typeof kind === "string") {
      kinds.push(kind);
    }
  }
  return kinds;
}
