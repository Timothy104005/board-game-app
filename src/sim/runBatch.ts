import type { Action, PlayerId, State } from "../engine/contracts.js";
import type { GameModule } from "../games/types.js";
import type { Bot } from "../bots/types.js";
import { runMatch, type MatchResult } from "./runMatch.js";

export interface BatchMetrics {
  matches: number;
  winRates: Record<string, number>;
  averageTurns: number;
  actionDistribution: Record<string, number>;
}

export interface RunBatchInput<S extends State = State, A extends Action = Action> {
  game: GameModule<S, A>;
  bots: Record<PlayerId, Bot<S, A>> | Bot<S, A>[];
  seed: string;
  matches: number;
  maxTurns: number;
}

export interface BatchResult<A extends Action = Action> {
  matches: MatchResult<A>[];
  metrics: BatchMetrics;
}

export function runBatch<S extends State = State, A extends Action = Action>(input: RunBatchInput<S, A>): BatchResult<A> {
  const matches: MatchResult<A>[] = [];
  const winCounts: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};
  let totalTurns = 0;

  for (let i = 0; i < input.matches; i += 1) {
    const result = runMatch({
      game: input.game,
      bots: input.bots,
      seed: `${input.seed}|${i}`,
      maxTurns: input.maxTurns
    });
    matches.push(result);
    totalTurns += result.metrics.turnCount;

    const winnerKey = result.winner ?? "draw";
    winCounts[winnerKey] = (winCounts[winnerKey] ?? 0) + 1;

    for (const [actionType, count] of Object.entries(result.metrics.actionCounts)) {
      actionCounts[actionType] = (actionCounts[actionType] ?? 0) + count;
    }
  }

  const totalActions = Object.values(actionCounts).reduce((sum, value) => sum + value, 0);
  const winRates = Object.fromEntries(
    Object.entries(winCounts).map(([key, count]) => [key, count / input.matches])
  ) as Record<string, number>;
  const actionDistribution = Object.fromEntries(
    Object.entries(actionCounts).map(([key, count]) => [key, totalActions === 0 ? 0 : count / totalActions])
  ) as Record<string, number>;

  return {
    matches,
    metrics: {
      matches: input.matches,
      winRates,
      averageTurns: input.matches === 0 ? 0 : totalTurns / input.matches,
      actionDistribution
    }
  };
}
