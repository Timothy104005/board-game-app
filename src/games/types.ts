import type { Action, PlayerId, RNG, State, StepResult } from "../engine/contracts.js";

export interface GameModule<S extends State = State, A extends Action = Action> {
  id: string;
  name: string;
  createInitialState(seed: string): S;
  legalActions(state: S): A[];
  applyAction(state: S, action: A, rng: RNG): StepResult<S, A>;
  isTerminal(state: S): boolean;
  score(state: S): Record<PlayerId, number>;
}
