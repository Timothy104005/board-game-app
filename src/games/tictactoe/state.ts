import type { Phase, PlayerId, Stage } from "../../engine/contracts.js";

export type TicTacToeMark = "X" | "O";
export type BoardCell = TicTacToeMark | null;

export interface TicTacToePlayerState {
  id: PlayerId;
  mark: TicTacToeMark;
}

export interface TicTacToeState {
  seed: string;
  turn: number;
  phase: Phase;
  stage: Stage;
  currentPlayer: PlayerId;
  players: [TicTacToePlayerState, TicTacToePlayerState];
  board: BoardCell[];
  winner: PlayerId | null;
  maxTurns: number;
}

export const TIC_TAC_TOE_MAX_TURNS = 9;

export function createInitialState(seed: string): TicTacToeState {
  return {
    seed,
    turn: 0,
    phase: "main",
    stage: "action",
    currentPlayer: "0",
    players: [
      { id: "0", mark: "X" },
      { id: "1", mark: "O" }
    ],
    board: Array.from({ length: 9 }, () => null),
    winner: null,
    maxTurns: TIC_TAC_TOE_MAX_TURNS
  };
}
