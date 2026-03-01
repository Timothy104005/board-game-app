import type { Action, PlayerId, ReplayEvent, RNG, State } from "../engine/contracts.js";
import type { GameModule } from "../games/types.js";
import type { Bot } from "../bots/types.js";

export interface MatchMetrics {
  turnCount: number;
  actionCounts: Record<string, number>;
}

export interface MatchResult<A extends Action = Action> {
  finalScores: Record<PlayerId, number>;
  winner: PlayerId | null;
  replayLog: ReplayEvent<A>[];
  metrics: MatchMetrics;
}

export interface RunMatchInput<S extends State = State, A extends Action = Action> {
  game: GameModule<S, A>;
  bots: Record<PlayerId, Bot<S, A>> | Bot<S, A>[];
  seed: string;
  maxTurns: number;
}

export function runMatch<S extends State = State, A extends Action = Action>(input: RunMatchInput<S, A>): MatchResult<A> {
  const { game, seed } = input;
  const maxTurns = input.maxTurns;
  const rng = new LcgRng(seed);

  let state = game.createInitialState(seed);
  const replayLog: ReplayEvent<A>[] = [];
  const actionCounts: Record<string, number> = {};

  for (let stepIndex = 0; stepIndex < maxTurns; stepIndex += 1) {
    if (game.isTerminal(state)) {
      break;
    }

    const legalActions = game.legalActions(state);
    if (legalActions.length === 0) {
      break;
    }

    const currentPlayer = inferCurrentPlayer(state, stepIndex);
    const bot = resolveBot(input.bots, currentPlayer);
    const chosen = bot
      ? bot.chooseAction({ game, state, legalActions, playerId: currentPlayer, rng })
      : legalActions[0];

    const action = ensureLegalAction(chosen, legalActions);
    const step = game.applyAction(state, action, rng);
    replayLog.push(step.replayEvent);
    actionCounts[action.type] = (actionCounts[action.type] ?? 0) + 1;
    state = step.state;

    if (step.terminal) {
      break;
    }
  }

  const finalScores = game.score(state);
  return {
    finalScores,
    winner: inferWinner(finalScores),
    replayLog,
    metrics: {
      turnCount: replayLog.length,
      actionCounts
    }
  };
}

class LcgRng implements RNG {
  public readonly seed: string;
  private state: number;
  private cursorValue: number;

  public constructor(seed: string, state?: number, cursor = 0) {
    this.seed = seed;
    this.state = state ?? seedToUint32(seed);
    this.cursorValue = cursor;
  }

  public get cursor(): number {
    return this.cursorValue;
  }

  public nextFloat(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    this.cursorValue += 1;
    return this.state / 0x100000000;
  }

  public nextInt(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive) || maxInclusive < minInclusive) {
      throw new Error("nextInt expects integer bounds with maxInclusive >= minInclusive.");
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.nextFloat() * span);
  }

  public clone(): RNG {
    return new LcgRng(this.seed, this.state, this.cursorValue);
  }
}

function inferCurrentPlayer(state: State, turn: number): PlayerId {
  const asObj = state as Record<string, unknown>;
  if (typeof asObj.currentPlayer === "string") {
    return asObj.currentPlayer;
  }
  return String(turn % 2);
}

function resolveBot<S extends State, A extends Action>(
  bots: Record<PlayerId, Bot<S, A>> | Bot<S, A>[],
  playerId: PlayerId
): Bot<S, A> | null {
  if (Array.isArray(bots)) {
    if (bots.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(playerId, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < bots.length) {
      return bots[parsed];
    }
    return bots[0];
  }
  return bots[playerId] ?? Object.values(bots)[0] ?? null;
}

function ensureLegalAction<A extends Action>(candidate: A, legalActions: A[]): A {
  const key = canonicalAction(candidate);
  return legalActions.find((action) => canonicalAction(action) === key) ?? legalActions[0];
}

function canonicalAction(action: Action): string {
  return `${action.type}|${action.actor}|${stableStringify(action.payload ?? {})}`;
}

function inferWinner(scores: Record<PlayerId, number>): PlayerId | null {
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return null;
  }

  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length > 1 && entries[0][1] === entries[1][1]) {
    return null;
  }
  return entries[0][0];
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "undefined") {
    return '"__undefined__"';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function seedToUint32(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}
