import type { PlayerId, RNG, StepResult } from "../../engine/contracts.js";
import { createPlaceMarkAction, type TicTacToeAction } from "./actions.js";
import { createInitialState, type TicTacToePlayerState, type TicTacToeState } from "./state.js";

const WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

export function initialState(seed: string): TicTacToeState {
  return createInitialState(seed);
}

export function legalActions(state: TicTacToeState): TicTacToeAction[] {
  if (isTerminal(state)) {
    return [];
  }

  const actions: TicTacToeAction[] = [];
  for (let index = 0; index < state.board.length; index += 1) {
    if (state.board[index] === null) {
      actions.push(createPlaceMarkAction(state.currentPlayer, index));
    }
  }
  return actions;
}

export function applyAction(
  state: TicTacToeState,
  action: TicTacToeAction,
  rng: RNG
): StepResult<TicTacToeState, TicTacToeAction> {
  void rng;

  if (isTerminal(state)) {
    throw new Error("Cannot apply action to terminal state.");
  }
  if (action.actor !== state.currentPlayer) {
    throw new Error("Only the current player may act.");
  }
  if (action.type !== "place_mark") {
    throw new Error(`Illegal action type: ${String(action.type)}`);
  }

  const index = action.payload?.index;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= state.board.length) {
    throw new Error("place_mark index must be an integer between 0 and 8.");
  }
  if (state.board[index] !== null) {
    throw new Error(`Board slot ${index} is already occupied.`);
  }

  const legal = legalActions(state);
  const isLegal = legal.some((candidate) => candidate.actor === action.actor && candidate.payload?.index === index);
  if (!isLegal) {
    throw new Error("Action is not legal in current state.");
  }

  const stateHashBefore = stableHash(state);
  const next = cloneState(state);
  const actor = getPlayer(next, action.actor);

  next.board[index] = actor.mark;
  next.turn += 1;

  const winnerMark = findWinnerMark(next);
  if (winnerMark) {
    next.winner = findPlayerByMark(next, winnerMark).id;
  }

  const terminal = isTerminal(next);
  if (!terminal) {
    next.currentPlayer = getOpponent(next, action.actor).id;
    next.phase = "main";
    next.stage = "action";
  } else {
    next.phase = "end";
    next.stage = null;
  }

  const stateHashAfter = stableHash(next);
  return {
    state: next,
    terminal,
    scores: terminal ? score(next) : undefined,
    replayEvent: {
      index: state.turn,
      seed: rng.seed,
      turn: next.turn,
      phase: next.phase,
      actor: action.actor,
      action,
      stateHashBefore,
      stateHashAfter,
      stage: next.stage
    }
  };
}

export function isTerminal(state: TicTacToeState): boolean {
  return state.phase === "end" || state.winner !== null || state.turn >= state.maxTurns || isBoardFull(state);
}

export function score(state: TicTacToeState): Record<PlayerId, number> {
  if (!state.winner) {
    return { "0": 0, "1": 0 };
  }
  return state.winner === "0" ? { "0": 1, "1": 0 } : { "0": 0, "1": 1 };
}

export const tictactoeEngine = {
  initialState,
  legalActions,
  applyAction,
  isTerminal,
  score
};

function cloneState(state: TicTacToeState): TicTacToeState {
  return {
    ...state,
    players: [{ ...state.players[0] }, { ...state.players[1] }],
    board: [...state.board]
  };
}

function getPlayer(state: TicTacToeState, playerId: PlayerId): TicTacToePlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Missing player: ${playerId}`);
  }
  return player;
}

function getOpponent(state: TicTacToeState, playerId: PlayerId): TicTacToePlayerState {
  const opponent = state.players.find((candidate) => candidate.id !== playerId);
  if (!opponent) {
    throw new Error(`Missing opponent for player: ${playerId}`);
  }
  return opponent;
}

function findWinnerMark(state: TicTacToeState): "X" | "O" | null {
  for (const [a, b, c] of WIN_LINES) {
    const mark = state.board[a];
    if (mark && mark === state.board[b] && mark === state.board[c]) {
      return mark;
    }
  }
  return null;
}

function findPlayerByMark(state: TicTacToeState, mark: "X" | "O"): TicTacToePlayerState {
  const player = state.players.find((candidate) => candidate.mark === mark);
  if (!player) {
    throw new Error(`Missing player for mark: ${mark}`);
  }
  return player;
}

function isBoardFull(state: TicTacToeState): boolean {
  return state.board.every((cell) => cell !== null);
}

function stableHash(value: unknown): string {
  return fnv1a(stableStringify(value));
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
  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }
  if (typeof value === "function" || typeof value === "symbol") {
    return JSON.stringify(String(value));
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",");
  return `{${body}}`;
}

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
