import type { GameModule } from "../types.js";
import type { TicTacToeAction } from "./actions.js";
import { applyAction, initialState, isTerminal, legalActions, score } from "./engine.js";
import type { TicTacToeState } from "./state.js";

export const tictactoeModule: GameModule<TicTacToeState, TicTacToeAction> = {
  id: "tictactoe",
  name: "Tic-Tac-Toe",
  createInitialState: initialState,
  legalActions,
  applyAction,
  isTerminal,
  score
};
