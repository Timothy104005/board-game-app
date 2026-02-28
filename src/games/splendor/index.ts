import type { GameModule } from "../types.js";
import type { SplendorAction } from "./actions.js";
import { applyAction, initialState, isTerminal, legalActions, score } from "./engine.js";
import type { SplendorState } from "./state.js";

export const splendorModule: GameModule<SplendorState, SplendorAction> = {
  id: "splendor",
  name: "Mini Splendor",
  createInitialState: initialState,
  legalActions,
  applyAction,
  isTerminal,
  score
};
