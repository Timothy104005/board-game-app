import type { Action, State } from "../engine/contracts.js";
import type { Bot } from "./types.js";

export function createRandomBot<S extends State = State, A extends Action = Action>(id: string): Bot<S, A> {
  return {
    id,
    chooseAction: ({ legalActions, rng }) => {
      if (legalActions.length === 0) {
        throw new Error("random bot cannot choose from empty legalActions.");
      }
      const index = rng.nextInt(0, legalActions.length - 1);
      return legalActions[index];
    },
    explain: () => "picked a legal action uniformly using seeded RNG"
  };
}
